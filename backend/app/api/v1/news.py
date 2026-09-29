"""Public versioned news endpoints."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.api.deps import get_news_repository
from app.application.dto.news_dto import NewsQuery
from app.domain.entities.news_article import ArticleAsset, NewsArticle, NewsSource
from app.domain.repositories.i_news_repository import INewsRepository
from app.domain.value_objects.sentiment_score import SentimentScore
from app.infrastructure.config.settings import settings
from app.schemas.news import (
    AssetResponse,
    ContentBlockResponse,
    NewsCollectionResponse,
    NewsDetailResponse,
    NewsEnvelope,
    NewsSummaryResponse,
    PaginationResponse,
    ResponseMeta,
    SecuritiesEnvelope,
    SecurityResponse,
    SentimentResponse,
    SourceResponse,
    SourcesEnvelope,
    SymbolResponse,
)

router = APIRouter(prefix="/api/v1", tags=["news"])


def _private_response(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _filter_hash(filters: dict[str, object]) -> str:
    raw = json.dumps(filters, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()[:16]


def _encode_cursor(article: NewsArticle, filters: dict[str, object]) -> str:
    payload = {
        "v": 1,
        "feed_at": article.feed_at.isoformat(),
        "id": article.id,
        "filters": _filter_hash(filters),
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    signature = hmac.new(settings.secret_key.encode(), raw, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(raw + signature).decode().rstrip("=")


def _decode_cursor(cursor: str, filters: dict[str, object]) -> tuple[datetime, str]:
    if len(cursor) > 2048:
        raise ValueError("cursor is too long")
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        signed = base64.urlsafe_b64decode(padded.encode())
        raw, signature = signed[:-32], signed[-32:]
        expected = hmac.new(settings.secret_key.encode(), raw, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("cursor signature is invalid")
        payload = json.loads(raw)
        if payload.get("v") != 1 or payload.get("filters") != _filter_hash(filters):
            raise ValueError("cursor does not match filters")
        feed_at = datetime.fromisoformat(str(payload["feed_at"]))
        article_id = str(payload["id"])
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise ValueError("invalid cursor") from exc
    return feed_at, article_id


def _source(source: NewsSource) -> SourceResponse:
    return SourceResponse(
        slug=source.slug,
        name=source.name,
        url=source.base_url,
        status=source.status,
        content_access=source.display_mode.value,
        last_success_at=source.last_success_at,
    )


def _sentiment(value: SentimentScore | None) -> SentimentResponse:
    if value is None:
        return SentimentResponse(
            status="pending",
            label=None,
            score=None,
            confidence=None,
            method=None,
            analyzer_version=None,
            analyzed_at=None,
            rationale=None,
            evidence=[],
            market_impact=None,
            impact_scope=None,
        )
    return SentimentResponse(
        status="ready",
        label=value.label.value,
        score=value.score,
        confidence=value.confidence,
        method=value.method,
        analyzer_version=value.analyzer_version,
        analyzed_at=value.analyzed_at,
        rationale=value.rationale,
        evidence=list(value.evidence),
        market_impact=value.market_impact,
        impact_scope=value.impact_scope,
        horizon=value.horizon,
    )


def _asset(value: ArticleAsset) -> AssetResponse:
    return AssetResponse(
        id=value.id,
        kind=value.kind,
        role=value.role,
        url=value.url,
        alt=value.alt,
        caption=value.caption,
        credit=value.credit,
        position=value.position,
    )


def _symbols(article: NewsArticle) -> list[SymbolResponse]:
    return [
        SymbolResponse(
            security_id=mention.security.id,
            symbol=mention.security.symbol,
            exchange=mention.security.exchange,
            company_name=mention.security.issuer_name,
            is_primary=mention.is_primary,
            match_method=mention.method,
            match_confidence=mention.confidence,
            evidence=list(mention.evidence),
            sentiment=_sentiment(mention.sentiment) if mention.sentiment else None,
        )
        for mention in article.mentions
    ]


def _summary(article: NewsArticle) -> NewsSummaryResponse:
    thumbnail = next((asset for asset in article.assets if asset.role == "thumbnail"), None)
    if thumbnail is None:
        thumbnail = next((asset for asset in article.assets if asset.kind == "image"), None)
    return NewsSummaryResponse(
        id=article.id,
        title=article.title,
        description=article.description,
        url=article.canonical_url,
        source=_source(article.source),
        published_at=article.published_at,
        updated_at=article.source_updated_at,
        first_seen_at=article.first_seen_at,
        feed_at=article.feed_at,
        category=article.category,
        tags=list(article.tags),
        thumbnail=_asset(thumbnail) if thumbnail else None,
        symbols=_symbols(article),
        mentioned_symbols=[
            value
            for value in article.candidate_symbols
            if value not in {mention.security.qualified_symbol for mention in article.mentions}
        ],
        sentiment=_sentiment(article.sentiment),
        extraction_status=article.extraction_status.value,
        content_access=article.content_access.value,
    )


def _detail(article: NewsArticle) -> NewsDetailResponse:
    summary = _summary(article).model_dump()
    return NewsDetailResponse(
        **summary,
        revision_id=article.revision_id,
        content=article.content_text,
        content_blocks=[ContentBlockResponse(**asdict(block)) for block in article.content_blocks],
        authors=list(article.authors),
        fetched_at=article.fetched_at,
        images=[_asset(asset) for asset in article.assets if asset.kind == "image"],
        attachments=[_asset(asset) for asset in article.assets if asset.role == "attachment"],
        quality_flags=list(article.quality_flags),
        reading_time_minutes=article.reading_time_minutes,
    )


def _meta(
    request: Request, sources: tuple[NewsSource, ...], *, as_of: datetime | None = None
) -> ResponseMeta:
    observed_at = as_of or datetime.now(UTC)
    successful = [source.last_success_at for source in sources if source.last_success_at]
    last_ingested = max(successful) if successful else None
    freshness = "unavailable"
    if last_ingested is not None:
        freshness = "fresh" if observed_at - last_ingested <= timedelta(minutes=15) else "stale"
    return ResponseMeta(
        request_id=str(request.state.request_id),
        as_of=observed_at,
        last_ingested_at=last_ingested,
        freshness=freshness,
    )


@router.get("/news", response_model=NewsCollectionResponse)
def list_news(
    request: Request,
    response: Response,
    repository: Annotated[INewsRepository, Depends(get_news_repository)],
    q: Annotated[str | None, Query(min_length=2, max_length=200)] = None,
    source: Annotated[list[str] | None, Query(max_length=64)] = None,
    symbol: Annotated[list[str] | None, Query(max_length=24)] = None,
    category: Annotated[str | None, Query(max_length=80)] = None,
    sentiment: Annotated[
        str | None, Query(pattern="^(positive|negative|neutral|mixed|unknown)$")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    cursor: Annotated[str | None, Query(max_length=2048)] = None,
) -> NewsCollectionResponse:
    _private_response(response)
    normalized_query = q.strip() if q else None
    if normalized_query is not None and len(normalized_query) < 2:
        raise HTTPException(status_code=422, detail="Search query is too short")
    sources = tuple(value.strip().lower() for value in (source or ()))
    symbols = tuple(value.strip().upper() for value in (symbol or ()))
    if len(sources) > 9 or len(symbols) > 10:
        raise HTTPException(status_code=422, detail="Too many filter values")
    if any(len(value) > 64 or not re.fullmatch(r"[a-z0-9-]+", value) for value in sources):
        raise HTTPException(status_code=422, detail="Invalid news source filter")
    if any(not re.fullmatch(r"(?:HOSE|HNX|UPCOM):[A-Z0-9]{1,12}", value) for value in symbols):
        raise HTTPException(status_code=422, detail="Invalid security filter")
    filters: dict[str, object] = {
        "q": normalized_query,
        "source": sources,
        "symbol": symbols,
        "category": category.strip() if category else None,
        "sentiment": sentiment,
        "limit": limit,
    }
    cursor_feed_at = None
    cursor_id = None
    if cursor:
        try:
            cursor_feed_at, cursor_id = _decode_cursor(cursor, filters)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
            ) from exc
    query = NewsQuery(
        query=normalized_query,
        sources=sources,
        symbols=symbols,
        category=category.strip() if category else None,
        sentiment=sentiment,
        limit=limit,
        cursor_feed_at=cursor_feed_at,
        cursor_id=cursor_id,
    )
    items, has_more = repository.list_articles(query)
    next_cursor = _encode_cursor(items[-1], filters) if has_more and items else None
    source_rows = repository.list_sources()
    return NewsCollectionResponse(
        data=[_summary(item) for item in items],
        pagination=PaginationResponse(next_cursor=next_cursor, has_more=has_more),
        meta=_meta(request, source_rows),
    )


@router.get("/news/{article_id}", response_model=NewsEnvelope)
def get_news(
    article_id: UUID,
    request: Request,
    response: Response,
    repository: Annotated[INewsRepository, Depends(get_news_repository)],
) -> NewsEnvelope:
    _private_response(response)
    article = repository.get_article(str(article_id))
    if article is None:
        raise HTTPException(status_code=404, detail="News article was not found")
    return NewsEnvelope(data=_detail(article), meta=_meta(request, (article.source,)))


@router.get("/news-sources", response_model=SourcesEnvelope)
def list_sources(
    request: Request,
    response: Response,
    repository: Annotated[INewsRepository, Depends(get_news_repository)],
) -> SourcesEnvelope:
    _private_response(response)
    sources = repository.list_sources()
    return SourcesEnvelope(
        data=[_source(source) for source in sources], meta=_meta(request, sources)
    )


@router.get("/securities/search", response_model=SecuritiesEnvelope)
def search_securities(
    request: Request,
    response: Response,
    repository: Annotated[INewsRepository, Depends(get_news_repository)],
    q: Annotated[str, Query(min_length=2, max_length=100)],
    limit: Annotated[int, Query(ge=1, le=20)] = 10,
) -> SecuritiesEnvelope:
    _private_response(response)
    securities = repository.search_securities(q, limit)
    return SecuritiesEnvelope(
        data=[
            SecurityResponse(
                security_id=item.id,
                symbol=item.symbol,
                exchange=item.exchange,
                company_name=item.issuer_name,
            )
            for item in securities
        ],
        meta=_meta(request, ()),
    )
