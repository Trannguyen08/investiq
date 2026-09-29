"""Thin Celery adapters for durable news discovery and ingestion jobs."""

from __future__ import annotations

import hashlib
import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from celery import Task
from psycopg.rows import dict_row

from app.application.use_cases.news.analyze_sentiment import VietnameseRuleSentimentAnalyzer
from app.application.use_cases.news.ingest_news import IngestNews
from app.infrastructure.config.settings import settings
from app.infrastructure.db.repositories.sql_news_repository import SqlNewsRepository
from app.infrastructure.db.session import get_pool
from app.infrastructure.external.crawlers.base import NewsProviderError
from app.infrastructure.external.crawlers.cafef_crawler import CafeFCrawler
from app.infrastructure.external.crawlers.vietstock_crawler import VietstockCrawler
from app.workers.celery_app import celery_app

logger = logging.getLogger("investiq.news.worker")


def _crawler(source_slug: str) -> VietstockCrawler | CafeFCrawler:
    if source_slug == "vietstock":
        return VietstockCrawler()
    if source_slug == "cafef":
        return CafeFCrawler()
    raise ValueError("unsupported news source")


@celery_app.task(  # type: ignore[untyped-decorator]
    name="investiq.news.discover.v1", soft_time_limit=90, time_limit=120
)
def discover_news(source_slug: str, limit: int = 50) -> dict[str, int | str]:
    if not settings.news_ingestion_enabled:
        return {"source": source_slug, "queued": 0, "status": "disabled"}
    provider = _crawler(source_slug)
    urls = provider.discover(limit=limit)
    pool = get_pool()
    run_id = uuid4()
    queued_job_ids: list[str] = []
    window = datetime.now(UTC).strftime("%Y%m%d%H")
    with pool.connection() as connection, connection.transaction():
        source = connection.execute(
            "SELECT id FROM news_sources WHERE slug = %s AND status = 'active' FOR UPDATE",
            (source_slug,),
        ).fetchone()
        if not source:
            raise ValueError("news source is not active")
        connection.execute(
            """
            INSERT INTO crawl_runs (id, source_id, trigger, status, started_at, discovered_count)
            VALUES (%s, %s, 'scheduled', 'running', %s, %s)
            """,
            (run_id, source[0], datetime.now(UTC), len(urls)),
        )
        for url in urls:
            job_key = hashlib.sha256(f"fetch:{source_slug}:{window}:{url}".encode()).hexdigest()
            candidate_job_id = uuid4()
            inserted = connection.execute(
                """
                INSERT INTO ingestion_jobs
                    (id, source_id, crawl_run_id, job_type, payload, job_key, status)
                VALUES (%s, %s, %s, 'fetch', jsonb_build_object('url', %s), %s, 'pending')
                ON CONFLICT (job_key) DO NOTHING
                RETURNING id::text
                """,
                (candidate_job_id, source[0], run_id, url, job_key),
            ).fetchone()
            if inserted:
                queued_job_ids.append(inserted[0])
        connection.execute(
            "UPDATE crawl_runs SET status = 'succeeded', finished_at = %s WHERE id = %s",
            (datetime.now(UTC), run_id),
        )
    dispatch_news_jobs.apply_async(queue="news-ingestion")
    return {"source": source_slug, "queued": len(queued_job_ids), "status": "succeeded"}


@celery_app.task(  # type: ignore[untyped-decorator]
    name="investiq.news.dispatch.v1",
    soft_time_limit=30,
    time_limit=45,
)
def dispatch_news_jobs(limit: int = 100) -> dict[str, int]:
    """Claim persisted work and publish it, including jobs left by worker loss."""
    if not settings.news_ingestion_enabled:
        return {"dispatched": 0}
    if not 1 <= limit <= 500:
        raise ValueError("dispatch limit must be between 1 and 500")
    now = datetime.now(UTC)
    lease_until = now + timedelta(minutes=2)
    with get_pool().connection() as connection, connection.transaction():
        connection.execute(
            """
            UPDATE ingestion_jobs
            SET status = 'failed', error_code = 'ATTEMPTS_EXHAUSTED',
                lease_until = NULL, updated_at = %s
            WHERE status IN ('pending', 'dispatched', 'running')
              AND attempt_count >= max_attempts
              AND (lease_until IS NULL OR lease_until < %s)
            """,
            (now, now),
        )
        rows = connection.execute(
            """
            WITH candidates AS (
                SELECT id
                FROM ingestion_jobs
                WHERE attempt_count < max_attempts
                  AND (
                    (status = 'pending' AND next_attempt_at <= %s)
                    OR (status IN ('dispatched', 'running') AND lease_until < %s)
                  )
                ORDER BY next_attempt_at, created_at
                FOR UPDATE SKIP LOCKED
                LIMIT %s
            )
            UPDATE ingestion_jobs AS job
            SET status = 'dispatched', lease_until = %s, updated_at = %s
            FROM candidates
            WHERE job.id = candidates.id
            RETURNING job.id
            """,
            (now, now, limit, lease_until, now),
        ).fetchall()
    job_ids = [str(row[0]) for row in rows if isinstance(row[0], UUID)]
    for persisted_job_id in job_ids:
        fetch_news_article.apply_async(args=(persisted_job_id,), queue="news-ingestion")
    return {"dispatched": len(job_ids)}


@celery_app.task(  # type: ignore[untyped-decorator]
    bind=True,
    name="investiq.news.fetch.v1",
    soft_time_limit=60,
    time_limit=90,
    max_retries=2,
)
def fetch_news_article(self: Task, job_id: str) -> dict[str, str | bool]:
    pool = get_pool()
    now = datetime.now(UTC)
    with pool.connection() as connection, connection.transaction():
        with connection.cursor(row_factory=dict_row) as cursor:
            job = cursor.execute(
                """
                SELECT j.id, j.status, j.attempt_count, j.max_attempts, j.payload,
                       j.lease_until, s.slug
                FROM ingestion_jobs j JOIN news_sources s ON s.id = j.source_id
                WHERE j.id = %s::uuid FOR UPDATE
                """,
                (job_id,),
            ).fetchone()
        if not job:
            raise ValueError("news ingestion job does not exist")
        if job["status"] == "succeeded":
            return {"job_id": job_id, "status": "succeeded", "changed": False}
        if job["status"] in {"failed", "cancelled"}:
            return {"job_id": job_id, "status": str(job["status"]), "changed": False}
        if (
            job["status"] == "running"
            and isinstance(job["lease_until"], datetime)
            and job["lease_until"] >= now
        ):
            return {"job_id": job_id, "status": "running", "changed": False}
        if int(job["attempt_count"]) >= int(job["max_attempts"]):
            connection.execute(
                """
                UPDATE ingestion_jobs
                SET status = 'failed', error_code = 'ATTEMPTS_EXHAUSTED',
                    lease_until = NULL, updated_at = %s
                WHERE id = %s::uuid
                """,
                (now, job_id),
            )
            return {"job_id": job_id, "status": "failed", "changed": False}
        attempt = int(job["attempt_count"]) + 1
        connection.execute(
            """
            UPDATE ingestion_jobs
            SET status = 'running', attempt_count = %s, lease_until = %s,
                fencing_token = fencing_token + 1, updated_at = %s
            WHERE id = %s::uuid
            """,
            (attempt, now + timedelta(minutes=2), now, job_id),
        )
    payload = job["payload"]
    if not isinstance(payload, dict) or not isinstance(payload.get("url"), str):
        _finish_job(job_id, "failed", "INVALID_PAYLOAD")
        raise ValueError("news ingestion job payload is invalid")
    try:
        parsed = _crawler(str(job["slug"])).fetch_article(str(payload["url"]))
        use_case = IngestNews(SqlNewsRepository(pool), VietnameseRuleSentimentAnalyzer())
        article_id, changed = use_case.execute(parsed)
    except NewsProviderError as exc:
        terminal = attempt >= int(job["max_attempts"])
        countdown = min(60, 5 * (2 ** (attempt - 1)))
        retry_at = None if terminal else datetime.now(UTC) + timedelta(seconds=countdown)
        _finish_job(
            job_id,
            "failed" if terminal else "pending",
            "PROVIDER_FAILURE",
            next_attempt_at=retry_at,
        )
        logger.warning(
            "News provider request failed",
            extra={"problem": str(exc), "request_id": job_id},
        )
        if terminal:
            raise
        raise self.retry(exc=exc, countdown=countdown) from exc
    _finish_job(job_id, "succeeded", None, article_id=article_id)
    return {"job_id": job_id, "status": "succeeded", "article_id": article_id, "changed": changed}


def _finish_job(
    job_id: str,
    status_value: str,
    error_code: str | None,
    *,
    article_id: str | None = None,
    next_attempt_at: datetime | None = None,
) -> None:
    with get_pool().connection() as connection:
        connection.execute(
            """
            UPDATE ingestion_jobs
            SET status = %s, error_code = %s, article_id = COALESCE(%s::uuid, article_id),
                next_attempt_at = COALESCE(%s, next_attempt_at), lease_until = NULL,
                updated_at = %s
            WHERE id = %s::uuid
            """,
            (
                status_value,
                error_code,
                article_id,
                next_attempt_at,
                datetime.now(UTC),
                job_id,
            ),
        )
