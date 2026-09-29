import os
from collections.abc import Generator
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import psycopg
import pytest
from psycopg_pool import ConnectionPool

from app.application.dto.news_dto import NewsQuery
from app.application.use_cases.news.analyze_sentiment import VietnameseRuleSentimentAnalyzer
from app.application.use_cases.news.ingest_news import IngestNews
from app.infrastructure.config.settings import settings
from app.infrastructure.db.base import apply_migrations
from app.infrastructure.db.repositories.sql_news_repository import SqlNewsRepository
from app.infrastructure.external.crawlers.vietstock_crawler import VietstockCrawler
from app.workers import news_ingestion_worker

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")


def require_database_url() -> str:
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL repository integration tests")
    return TEST_DATABASE_URL


ARTICLE_HTML = """
<html><head>
  <link rel="canonical" href="https://vietstock.vn/chung-khoan/fpt-ket-qua-123.htm">
  <meta property="og:title" content="FPT công bố kết quả kinh doanh">
  <meta property="og:description" content="Lợi nhuận tăng so với cùng kỳ.">
</head><body><article itemprop="articleBody">
  <p>Doanh nghiệp HOSE:FPT ghi nhận lợi nhuận tăng mạnh trong quý.</p>
  <img src="/images/fpt.jpg" alt="FPT">
</article></body></html>
"""


@pytest.fixture
def news_repository() -> Generator[SqlNewsRepository, None, None]:
    database_url = require_database_url()
    apply_migrations(database_url)
    with psycopg.connect(database_url) as connection:
        connection.execute(
            """
            TRUNCATE ingestion_jobs, crawl_runs, sentiment_analyses, article_mentions,
                     security_identifiers, securities, article_assets, article_revisions,
                     news_articles RESTART IDENTITY CASCADE
            """
        )
        connection.execute(
            """
            INSERT INTO securities (id, issuer_name, master_source, master_verified_at)
            VALUES ('d428587b-c492-40f8-a3af-b99dd12de001', 'Công ty Cổ phần FPT',
                    'integration-fixture', '2026-09-29T00:00:00Z')
            """
        )
        connection.execute(
            """
            INSERT INTO security_identifiers
                (id, security_id, symbol, exchange, valid_from)
            VALUES ('e528587b-c492-40f8-a3af-b99dd12de001',
                    'd428587b-c492-40f8-a3af-b99dd12de001', 'FPT', 'HOSE', '2006-01-01')
            """
        )
    pool = ConnectionPool(database_url, min_size=1, max_size=2, open=True)
    try:
        yield SqlNewsRepository(pool)
    finally:
        pool.close()


def test_repository_keeps_idempotency_and_article_revision_history(
    news_repository: SqlNewsRepository,
) -> None:
    parsed = VietstockCrawler().parse_article(
        ARTICLE_HTML,
        "https://vietstock.vn/chung-khoan/fpt-ket-qua-123.htm",
        fetched_at=datetime(2026, 9, 29, 3, 0, tzinfo=UTC),
    )
    use_case = IngestNews(news_repository, VietnameseRuleSentimentAnalyzer())

    article_id, first_changed = use_case.execute(parsed)
    same_id, duplicate_changed = use_case.execute(parsed)
    updated = replace(
        parsed,
        content_text=f"{parsed.content_text}\nDoanh thu vượt kế hoạch.",
        fetched_at=datetime(2026, 9, 29, 4, 0, tzinfo=UTC),
    )
    updated_id, update_changed = use_case.execute(updated)

    class UpdatedAnalyzer(VietnameseRuleSentimentAnalyzer):
        version = "rules-vi-test"

    reanalyzed_id, analysis_changed = IngestNews(
        news_repository, UpdatedAnalyzer()
    ).execute(updated)

    assert UUID(article_id)
    assert same_id == updated_id == article_id
    assert first_changed is True
    assert duplicate_changed is False
    assert update_changed is True
    assert reanalyzed_id == article_id
    assert analysis_changed is True

    items, has_more = news_repository.list_articles(
        NewsQuery(symbols=("HOSE:FPT",), sentiment="positive", limit=20)
    )
    detail = news_repository.get_article(article_id)

    assert has_more is False
    assert len(items) == 1
    assert items[0].mentions[0].security.symbol == "FPT"
    assert detail is not None
    assert detail.content_text and "vượt kế hoạch" in detail.content_text
    assert detail.sentiment and detail.sentiment.analyzer_version == "rules-vi-test"
    assert detail.sentiment.market_impact
    inline_asset = next(asset for asset in detail.assets if asset.role == "inline")
    image_block = next(block for block in detail.content_blocks if block.type == "image")
    assert image_block.url == inline_asset.url

    with psycopg.connect(require_database_url()) as connection:
        revision_count = connection.execute(
            "SELECT count(*) FROM article_revisions WHERE article_id = %s",
            (article_id,),
        ).fetchone()
    assert revision_count == (2,)


def test_dispatcher_recovers_pending_and_expired_jobs(
    news_repository: SqlNewsRepository, monkeypatch: pytest.MonkeyPatch
) -> None:
    pending_id = uuid4()
    expired_id = uuid4()
    exhausted_id = uuid4()
    now = datetime.now(UTC)
    with news_repository._pool.connection() as connection:
        for job_id, status_value, lease_until in (
            (pending_id, "pending", None),
            (expired_id, "running", now - timedelta(minutes=1)),
        ):
            connection.execute(
                """
                INSERT INTO ingestion_jobs
                    (id, source_id, job_type, payload, job_key, status, lease_until)
                VALUES (%s, '91d46443-4e4b-4c09-8ce0-36c8279a0001', 'fetch',
                        '{"url":"https://vietstock.vn/a.htm"}', %s, %s, %s)
                """,
                (job_id, f"test-{job_id}", status_value, lease_until),
            )
        connection.execute(
            """
            INSERT INTO ingestion_jobs
                (id, source_id, job_type, payload, job_key, status,
                 attempt_count, max_attempts, lease_until)
            VALUES (%s, '91d46443-4e4b-4c09-8ce0-36c8279a0001', 'fetch',
                    '{"url":"https://vietstock.vn/exhausted.htm"}', %s, 'running', 3, 3, %s)
            """,
            (exhausted_id, f"test-{exhausted_id}", now - timedelta(minutes=1)),
        )

    published: list[str] = []
    monkeypatch.setattr(news_ingestion_worker, "get_pool", lambda: news_repository._pool)
    monkeypatch.setattr(settings, "news_ingestion_enabled", True)
    monkeypatch.setattr(
        news_ingestion_worker.fetch_news_article,
        "apply_async",
        lambda *, args, queue: published.append(str(args[0])),
    )

    result = news_ingestion_worker.dispatch_news_jobs.run(limit=10)

    assert result == {"dispatched": 2}
    assert set(published) == {str(pending_id), str(expired_id)}
    with news_repository._pool.connection() as connection:
        statuses = connection.execute(
            "SELECT id::text, status, error_code FROM ingestion_jobs ORDER BY job_key"
        ).fetchall()
    status_by_id = {row[0]: (row[1], row[2]) for row in statuses}
    assert status_by_id[str(pending_id)] == ("dispatched", None)
    assert status_by_id[str(expired_id)] == ("dispatched", None)
    assert status_by_id[str(exhausted_id)] == ("failed", "ATTEMPTS_EXHAUSTED")
