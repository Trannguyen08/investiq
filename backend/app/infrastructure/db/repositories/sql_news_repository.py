"""PostgreSQL implementation of the news repository port."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.application.dto.news_dto import NewsQuery, ParsedArticle
from app.domain.entities.news_article import (
    ArticleAsset,
    ArticleMention,
    ContentAccess,
    ContentBlock,
    ExtractionStatus,
    NewsArticle,
    NewsSource,
)
from app.domain.entities.stock import Security
from app.domain.value_objects.sentiment_score import SentimentLabel, SentimentScore

ARTICLE_SELECT = """
SELECT
    a.id::text AS id,
    a.feed_at,
    a.first_seen_at,
    r.id::text AS revision_id,
    r.title,
    r.description,
    r.content_text,
    r.content_blocks,
    r.authors,
    r.category_key,
    r.tags,
    r.candidate_symbols,
    r.published_at,
    r.source_updated_at,
    r.fetched_at,
    r.extraction_status,
    r.quality_flags,
    s.id::text AS source_id,
    s.slug AS source_slug,
    s.name AS source_name,
    s.base_url,
    s.status AS source_status,
    s.display_mode,
    s.last_success_at,
    a.canonical_url,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id', aa.id::text, 'kind', aa.kind, 'role', aa.role,
            'url', aa.original_url, 'alt', aa.alt, 'caption', aa.caption,
            'credit', aa.credit, 'position', aa.position
        ) ORDER BY aa.position)
        FROM article_assets aa WHERE aa.revision_id = r.id
    ), '[]'::jsonb) AS assets,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'security_id', sec.id::text, 'symbol', si.symbol, 'exchange', si.exchange,
            'issuer_name', sec.issuer_name, 'is_primary', am.is_primary,
            'method', am.method, 'confidence', am.confidence, 'evidence', am.evidence,
            'sentiment_label', msa.label, 'sentiment_score', msa.score,
            'sentiment_confidence', msa.confidence, 'sentiment_rationale', msa.rationale,
            'sentiment_market_impact', msa.market_impact,
            'sentiment_impact_scope', msa.impact_scope,
            'sentiment_horizon', msa.horizon,
            'sentiment_evidence', msa.evidence, 'sentiment_method', msa.method,
            'sentiment_analyzer_version', msa.analyzer_version,
            'sentiment_analyzed_at', msa.analyzed_at
        ) ORDER BY am.is_primary DESC, si.symbol)
        FROM article_mentions am
        JOIN securities sec ON sec.id = am.security_id
        JOIN security_identifiers si ON si.id = am.identifier_id
        LEFT JOIN sentiment_analyses msa
          ON msa.mention_id = am.id AND msa.revision_id = r.id AND msa.is_current
        WHERE am.revision_id = r.id
    ), '[]'::jsonb) AS mentions,
    sa.label AS sentiment_label,
    sa.score AS sentiment_score,
    sa.confidence AS sentiment_confidence,
    sa.rationale AS sentiment_rationale,
    sa.market_impact AS sentiment_market_impact,
    sa.impact_scope AS sentiment_impact_scope,
    sa.horizon AS sentiment_horizon,
    sa.evidence AS sentiment_evidence,
    sa.method AS sentiment_method,
    sa.analyzer_version AS sentiment_analyzer_version,
    sa.analyzed_at AS sentiment_analyzed_at
FROM news_articles a
JOIN article_revisions r ON r.id = a.current_revision_id
JOIN news_sources s ON s.id = a.source_id
LEFT JOIN sentiment_analyses sa
  ON sa.revision_id = r.id AND sa.mention_id IS NULL AND sa.is_current
"""


class SqlNewsRepository:
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    def list_articles(self, query: NewsQuery) -> tuple[tuple[NewsArticle, ...], bool]:
        clauses = ["a.visibility = 'published'"]
        parameters: list[object] = []
        if query.query:
            clauses.append("r.search_document @@ plainto_tsquery('simple', %s)")
            parameters.append(query.query)
        if query.sources:
            clauses.append("s.slug = ANY(%s)")
            parameters.append(list(query.sources))
        if query.symbols:
            clauses.append(
                "EXISTS (SELECT 1 FROM article_mentions qm "
                "JOIN security_identifiers qi ON qi.id = qm.identifier_id "
                "WHERE qm.revision_id = r.id AND (qi.exchange || ':' || qi.symbol) = ANY(%s))"
            )
            parameters.append(list(query.symbols))
        if query.category:
            clauses.append("r.category_key = %s")
            parameters.append(query.category)
        if query.sentiment:
            clauses.append("sa.label = %s")
            parameters.append(query.sentiment)
        if query.cursor_feed_at and query.cursor_id:
            clauses.append("(a.feed_at, a.id) < (%s, %s::uuid)")
            parameters.extend((query.cursor_feed_at, query.cursor_id))
        sql = (
            ARTICLE_SELECT
            + " WHERE "
            + " AND ".join(clauses)
            + " ORDER BY a.feed_at DESC, a.id DESC LIMIT %s"
        )
        parameters.append(query.limit + 1)
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            rows = cursor.execute(sql, parameters).fetchall()
        has_more = len(rows) > query.limit
        return tuple(self._map_article(row) for row in rows[: query.limit]), has_more

    def get_article(self, article_id: str) -> NewsArticle | None:
        sql = ARTICLE_SELECT + " WHERE a.id = %s::uuid AND a.visibility = 'published'"
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = cursor.execute(sql, (article_id,)).fetchone()
        return self._map_article(row) if row else None

    def list_sources(self) -> tuple[NewsSource, ...]:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            rows = cursor.execute(
                """
                SELECT id::text, slug, name, base_url, status, display_mode, last_success_at
                FROM news_sources ORDER BY name
                """
            ).fetchall()
        return tuple(self._map_source(row) for row in rows)

    def search_securities(self, query: str, limit: int) -> tuple[Security, ...]:
        value = f"%{query.strip()}%"
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            rows = cursor.execute(
                """
                SELECT sec.id::text, si.symbol, si.exchange, sec.issuer_name
                FROM securities sec
                JOIN security_identifiers si
                  ON si.security_id = sec.id AND si.valid_to IS NULL
                WHERE sec.is_active AND (si.symbol ILIKE %s OR sec.issuer_name ILIKE %s)
                ORDER BY CASE WHEN upper(si.symbol) = upper(%s) THEN 0 ELSE 1 END, si.symbol
                LIMIT %s
                """,
                (value, value, query.strip(), limit),
            ).fetchall()
        return tuple(self._map_security(row) for row in rows)

    def find_securities(self, symbols: tuple[str, ...]) -> tuple[Security, ...]:
        if not symbols:
            return ()
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            rows = cursor.execute(
                """
                SELECT sec.id::text, si.symbol, si.exchange, sec.issuer_name
                FROM securities sec
                JOIN security_identifiers si
                  ON si.security_id = sec.id AND si.valid_to IS NULL
                WHERE sec.is_active AND (si.exchange || ':' || si.symbol) = ANY(%s)
                ORDER BY si.exchange, si.symbol
                """,
                (list(symbols),),
            ).fetchall()
        return tuple(self._map_security(row) for row in rows)

    def upsert_article(
        self,
        parsed: ParsedArticle,
        securities: tuple[Security, ...],
        article_sentiment: SentimentScore,
        symbol_sentiments: dict[str, SentimentScore],
        analyzer_version: str,
    ) -> tuple[str, bool]:
        now = datetime.now(UTC)
        url_hash = hashlib.sha256(parsed.canonical_url.encode()).hexdigest()
        content_payload = {
            "title": parsed.title,
            "description": parsed.description,
            "content": parsed.content_text,
            "blocks": [asdict(block) for block in parsed.content_blocks],
        }
        content_hash = self._stable_hash(content_payload)
        revision_payload = {
            **content_payload,
            "authors": parsed.authors,
            "category": parsed.category,
            "tags": parsed.tags,
            "published_at": parsed.published_at.isoformat() if parsed.published_at else None,
            "updated_at": parsed.source_updated_at.isoformat()
            if parsed.source_updated_at
            else None,
            "candidate_symbols": parsed.candidate_symbols,
        }
        revision_hash = self._stable_hash(revision_payload)
        with self._pool.connection() as connection, connection.transaction():
            with connection.cursor(row_factory=dict_row) as cursor:
                source = cursor.execute(
                    """
                    SELECT id, parser_version FROM news_sources
                    WHERE slug = %s AND status = 'active' FOR UPDATE
                    """,
                    (parsed.source_slug,),
                ).fetchone()
            if not source:
                raise ValueError("news source is not active")
            with connection.cursor(row_factory=dict_row) as cursor:
                article = cursor.execute(
                    """
                    SELECT a.id, a.current_revision_id, r.revision_no, r.revision_hash,
                           current_sentiment.analyzer_version AS sentiment_analyzer_version
                    FROM news_articles a
                    LEFT JOIN article_revisions r ON r.id = a.current_revision_id
                    LEFT JOIN sentiment_analyses current_sentiment
                      ON current_sentiment.revision_id = r.id
                     AND current_sentiment.mention_id IS NULL
                     AND current_sentiment.is_current
                    WHERE a.source_id = %s AND a.canonical_url_hash = %s
                    FOR UPDATE OF a
                    """,
                    (source["id"], url_hash),
                ).fetchone()
            if article and article["revision_hash"] == revision_hash:
                if article["sentiment_analyzer_version"] != analyzer_version:
                    current_revision_id = article["current_revision_id"]
                    connection.execute(
                        "UPDATE sentiment_analyses SET is_current = false "
                        "WHERE revision_id = %s AND is_current",
                        (current_revision_id,),
                    )
                    self._insert_sentiment(
                        connection,
                        current_revision_id,
                        None,
                        article_sentiment,
                        analyzer_version,
                        content_hash,
                    )
                    mention_rows = connection.execute(
                        """
                        SELECT am.id, si.exchange || ':' || si.symbol AS qualified_symbol,
                               sec.id::text AS security_id
                        FROM article_mentions am
                        JOIN securities sec ON sec.id = am.security_id
                        JOIN security_identifiers si ON si.id = am.identifier_id
                        WHERE am.revision_id = %s
                        """,
                        (current_revision_id,),
                    ).fetchall()
                    for mention_id, qualified_symbol, security_id in mention_rows:
                        sentiment = symbol_sentiments.get(str(qualified_symbol))
                        if sentiment is None:
                            continue
                        self._insert_sentiment(
                            connection,
                            current_revision_id,
                            mention_id,
                            sentiment,
                            analyzer_version,
                            self._stable_hash(
                                {"content": content_hash, "security": str(security_id)}
                            ),
                        )
                    connection.execute(
                        "UPDATE news_articles SET last_seen_at = %s, updated_at = %s "
                        "WHERE id = %s",
                        (parsed.fetched_at, now, article["id"]),
                    )
                    return str(article["id"]), True
                connection.execute(
                    "UPDATE news_articles SET last_seen_at = %s, updated_at = %s WHERE id = %s",
                    (parsed.fetched_at, now, article["id"]),
                )
                return str(article["id"]), False

            article_id = article["id"] if article else uuid4()
            feed_at = parsed.published_at or parsed.fetched_at
            if not article:
                connection.execute(
                    """
                    INSERT INTO news_articles
                        (id, source_id, canonical_url, canonical_url_hash,
                         first_seen_at, last_seen_at, feed_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        article_id,
                        source["id"],
                        parsed.canonical_url,
                        url_hash,
                        parsed.fetched_at,
                        parsed.fetched_at,
                        feed_at,
                    ),
                )
            revision_no = int(article["revision_no"] or 0) + 1 if article else 1
            revision_id = uuid4()
            connection.execute(
                """
                INSERT INTO article_revisions
                    (id, article_id, revision_no, title, description, content_text, content_blocks,
                     authors, category_key, tags, candidate_symbols, published_at,
                     source_updated_at, fetched_at,
                     parser_version, content_hash, revision_hash, extraction_status, quality_flags)
                VALUES
                    (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb, %s::jsonb,
                     %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    revision_id,
                    article_id,
                    revision_no,
                    parsed.title,
                    parsed.description,
                    parsed.content_text,
                    json.dumps([asdict(block) for block in parsed.content_blocks]),
                    json.dumps(parsed.authors),
                    parsed.category,
                    json.dumps(parsed.tags),
                    json.dumps(parsed.candidate_symbols),
                    parsed.published_at,
                    parsed.source_updated_at,
                    parsed.fetched_at,
                    source["parser_version"] or "1",
                    content_hash,
                    revision_hash,
                    parsed.extraction_status.value,
                    json.dumps(parsed.quality_flags),
                ),
            )
            self._insert_assets(connection, revision_id, parsed.assets)
            mentions = self._insert_mentions(connection, revision_id, securities)
            self._insert_sentiment(
                connection, revision_id, None, article_sentiment, analyzer_version, content_hash
            )
            for qualified_symbol, (mention_id, security) in mentions.items():
                sentiment = symbol_sentiments[qualified_symbol]
                self._insert_sentiment(
                    connection,
                    revision_id,
                    mention_id,
                    sentiment,
                    analyzer_version,
                    self._stable_hash({"content": content_hash, "security": security.id}),
                )
            connection.execute(
                """
                UPDATE news_articles
                SET current_revision_id = %s, last_seen_at = %s, row_version = row_version + 1,
                    updated_at = %s
                WHERE id = %s
                """,
                (revision_id, parsed.fetched_at, now, article_id),
            )
            connection.execute(
                "UPDATE news_sources SET last_success_at = %s, updated_at = %s WHERE id = %s",
                (now, now, source["id"]),
            )
        return str(article_id), True

    @staticmethod
    def _insert_assets(
        connection: Connection[tuple[object, ...]],
        revision_id: UUID,
        assets: tuple[ArticleAsset, ...],
    ) -> None:
        for asset in assets:
            connection.execute(
                """
                INSERT INTO article_assets
                    (id, revision_id, kind, role, position, original_url, alt, caption, credit)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    uuid4(),
                    revision_id,
                    asset.kind,
                    asset.role,
                    asset.position,
                    asset.url,
                    asset.alt,
                    asset.caption,
                    asset.credit,
                ),
            )

    @staticmethod
    def _insert_mentions(
        connection: Connection[tuple[object, ...]],
        revision_id: UUID,
        securities: tuple[Security, ...],
    ) -> dict[str, tuple[UUID, Security]]:
        result: dict[str, tuple[UUID, Security]] = {}
        for index, security in enumerate(securities):
            identifier = connection.execute(
                """
                SELECT id FROM security_identifiers
                WHERE security_id = %s::uuid AND valid_to IS NULL
                  AND exchange = %s AND symbol = %s
                """,
                (security.id, security.exchange, security.symbol),
            ).fetchone()
            if not identifier:
                continue
            mention_id = uuid4()
            connection.execute(
                """
                INSERT INTO article_mentions
                    (id, revision_id, security_id, identifier_id,
                     is_primary, method, confidence, evidence)
                VALUES (%s, %s, %s::uuid, %s, %s, 'exchange_pattern', 1, %s::jsonb)
                """,
                (
                    mention_id,
                    revision_id,
                    security.id,
                    identifier[0],
                    index == 0,
                    json.dumps([security.qualified_symbol]),
                ),
            )
            result[security.qualified_symbol] = (mention_id, security)
        return result

    @staticmethod
    def _insert_sentiment(
        connection: Connection[tuple[object, ...]],
        revision_id: UUID,
        mention_id: UUID | None,
        sentiment: SentimentScore,
        analyzer_version: str,
        input_hash: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO sentiment_analyses
                (id, revision_id, mention_id, method, analyzer_version, input_hash, status,
                 label, score, confidence, rationale, evidence, market_impact, impact_scope,
                 horizon, analyzed_at, is_current)
            VALUES (%s, %s, %s, 'rules', %s, %s, 'ready', %s, %s, %s, %s, %s::jsonb,
                    %s, %s, %s, %s, true)
            """,
            (
                uuid4(),
                revision_id,
                mention_id,
                analyzer_version,
                input_hash,
                sentiment.label.value,
                sentiment.score,
                sentiment.confidence,
                sentiment.rationale,
                json.dumps(sentiment.evidence),
                sentiment.market_impact,
                sentiment.impact_scope,
                sentiment.horizon,
                datetime.now(UTC),
            ),
        )

    @classmethod
    def _map_article(cls, row: dict[str, object]) -> NewsArticle:
        content_access = ContentAccess(str(row["display_mode"]))
        allow_body = content_access is ContentAccess.FULL_TEXT
        blocks = (
            tuple(
                ContentBlock(
                    id=str(item["id"]),
                    type=str(item["type"]),
                    text=str(item["text"]) if item.get("text") is not None else None,
                    level=cls._optional_integer(item.get("level")),
                    url=str(item["url"]) if item.get("url") is not None else None,
                    caption=str(item["caption"]) if item.get("caption") is not None else None,
                    items=tuple(str(value) for value in cls._plain_list(item.get("items"))),
                    rows=tuple(
                        tuple(str(cell) for cell in cls._plain_list(row_value))
                        for row_value in cls._plain_list(item.get("rows"))
                    ),
                )
                for item in cls._object_list(row["content_blocks"])
            )
            if allow_body
            else ()
        )
        assets = (
            tuple(
                ArticleAsset(
                    id=str(item["id"]),
                    kind=str(item["kind"]),
                    role=str(item["role"]),
                    url=str(item["url"]),
                    alt=cls._optional_string(item.get("alt")),
                    caption=cls._optional_string(item.get("caption")),
                    credit=cls._optional_string(item.get("credit")),
                    position=cls._integer(item["position"]),
                )
                for item in cls._object_list(row["assets"])
            )
            if allow_body
            else ()
        )
        mentions = tuple(cls._map_mention(item) for item in cls._object_list(row["mentions"]))
        return NewsArticle(
            id=str(row["id"]),
            revision_id=str(row["revision_id"]),
            source=NewsSource(
                id=str(row["source_id"]),
                slug=str(row["source_slug"]),
                name=str(row["source_name"]),
                base_url=str(row["base_url"]),
                status=str(row["source_status"]),
                display_mode=content_access,
                last_success_at=cls._optional_datetime(row["last_success_at"]),
            ),
            canonical_url=str(row["canonical_url"]),
            title=str(row["title"]),
            description=cls._optional_string(row["description"]),
            content_text=cls._optional_string(row["content_text"]) if allow_body else None,
            content_blocks=blocks,
            authors=tuple(str(item) for item in cls._plain_list(row["authors"])),
            published_at=cls._optional_datetime(row["published_at"]),
            source_updated_at=cls._optional_datetime(row["source_updated_at"]),
            first_seen_at=cls._datetime(row["first_seen_at"]),
            feed_at=cls._datetime(row["feed_at"]),
            fetched_at=cls._datetime(row["fetched_at"]),
            category=cls._optional_string(row["category_key"]),
            tags=tuple(str(item) for item in cls._plain_list(row["tags"])),
            assets=assets,
            mentions=mentions,
            sentiment=cls._map_sentiment(row),
            extraction_status=ExtractionStatus(str(row["extraction_status"])),
            content_access=content_access,
            quality_flags=tuple(str(item) for item in cls._plain_list(row["quality_flags"])),
            candidate_symbols=tuple(
                str(item) for item in cls._plain_list(row["candidate_symbols"])
            ),
        )

    @classmethod
    def _map_mention(cls, item: dict[str, object]) -> ArticleMention:
        sentiment = cls._map_sentiment(item, prefix="sentiment_")
        return ArticleMention(
            security=Security(
                id=str(item["security_id"]),
                symbol=str(item["symbol"]),
                exchange=str(item["exchange"]),
                issuer_name=str(item["issuer_name"]),
            ),
            is_primary=bool(item["is_primary"]),
            method=str(item["method"]),
            confidence=cls._optional_float(item.get("confidence")),
            evidence=tuple(str(value) for value in cls._plain_list(item.get("evidence"))),
            sentiment=sentiment,
        )

    @classmethod
    def _map_sentiment(
        cls, values: dict[str, object], prefix: str = "sentiment_"
    ) -> SentimentScore | None:
        raw_label = values.get(f"{prefix}label")
        if not raw_label:
            return None
        raw_score = values.get(f"{prefix}score")
        raw_confidence = values.get(f"{prefix}confidence")
        return SentimentScore(
            label=SentimentLabel(str(raw_label)),
            score=float(raw_score) if isinstance(raw_score, (Decimal, int, float)) else None,
            confidence=(
                float(raw_confidence) if isinstance(raw_confidence, (Decimal, int, float)) else None
            ),
            rationale=str(values.get(f"{prefix}rationale") or ""),
            evidence=tuple(
                str(value) for value in cls._plain_list(values.get(f"{prefix}evidence"))
            ),
            market_impact=cls._optional_string(values.get(f"{prefix}market_impact")),
            impact_scope=cls._optional_string(values.get(f"{prefix}impact_scope")),
            horizon=cls._optional_string(values.get(f"{prefix}horizon")),
            method=cls._optional_string(values.get(f"{prefix}method")),
            analyzer_version=cls._optional_string(values.get(f"{prefix}analyzer_version")),
            analyzed_at=cls._optional_datetime(values.get(f"{prefix}analyzed_at")),
        )

    @staticmethod
    def _map_source(row: dict[str, object]) -> NewsSource:
        return NewsSource(
            id=str(row["id"]),
            slug=str(row["slug"]),
            name=str(row["name"]),
            base_url=str(row["base_url"]),
            status=str(row["status"]),
            display_mode=ContentAccess(str(row["display_mode"])),
            last_success_at=SqlNewsRepository._optional_datetime(row["last_success_at"]),
        )

    @staticmethod
    def _map_security(row: dict[str, object]) -> Security:
        return Security(
            id=str(row["id"]),
            symbol=str(row["symbol"]),
            exchange=str(row["exchange"]),
            issuer_name=str(row["issuer_name"]),
        )

    @staticmethod
    def _stable_hash(value: object) -> str:
        encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(encoded.encode()).hexdigest()

    @staticmethod
    def _object_list(value: object) -> list[dict[str, object]]:
        return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []

    @staticmethod
    def _plain_list(value: object) -> list[object]:
        return value if isinstance(value, list) else []

    @staticmethod
    def _optional_string(value: object) -> str | None:
        return str(value) if value is not None else None

    @staticmethod
    def _datetime(value: object) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError as exc:
                raise TypeError("database timestamp is invalid") from exc
        raise TypeError("database timestamp is invalid")

    @staticmethod
    def _optional_datetime(value: object) -> datetime | None:
        return SqlNewsRepository._datetime(value) if value is not None else None

    @staticmethod
    def _integer(value: object) -> int:
        if isinstance(value, bool) or not isinstance(value, (int, str)):
            raise TypeError("database integer is invalid")
        return int(value)

    @staticmethod
    def _optional_integer(value: object) -> int | None:
        return SqlNewsRepository._integer(value) if value is not None else None

    @staticmethod
    def _optional_float(value: object) -> float | None:
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, (Decimal, int, float)):
            raise TypeError("database numeric value is invalid")
        return float(value)
