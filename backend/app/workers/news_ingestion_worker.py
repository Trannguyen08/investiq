"""Thin Celery adapters for durable news discovery and ingestion jobs."""

from __future__ import annotations

import hashlib
import logging
from datetime import UTC, date, datetime, timedelta
from uuid import UUID, uuid4

from celery import Task
from psycopg.rows import dict_row

from app.application.use_cases.news.analyze_sentiment import VietnameseRuleSentimentAnalyzer
from app.application.use_cases.news.freshness import (
    StaleArticle,
    UnverifiableArticleDate,
    require_recent_article,
)
from app.application.use_cases.news.ingest_news import IngestNews
from app.infrastructure.cache.redis_client import get_news_read_cache
from app.infrastructure.config.settings import settings
from app.infrastructure.db.repositories.sql_news_repository import SqlNewsRepository
from app.infrastructure.db.session import get_pool
from app.infrastructure.external.crawlers.base import BaseNewsCrawler, NewsProviderError
from app.infrastructure.external.crawlers.cafef_crawler import CafeFCrawler
from app.infrastructure.external.crawlers.hnx_crawler import HnxCrawler
from app.infrastructure.external.crawlers.stockbiz_crawler import StockBizCrawler
from app.infrastructure.external.crawlers.vietstock_crawler import VietstockCrawler
from app.infrastructure.external.crawlers.vneconomy_crawler import VnEconomyCrawler
from app.infrastructure.external.crawlers.vnexpress_crawler import VnExpressCrawler
from app.workers.celery_app import celery_app

logger = logging.getLogger("investiq.news.worker")


CRAWLER_TYPES: dict[str, type[BaseNewsCrawler]] = {
    "cafef": CafeFCrawler,
    "hnx": HnxCrawler,
    "stockbiz": StockBizCrawler,
    "vietstock": VietstockCrawler,
    "vneconomy": VnEconomyCrawler,
    "vnexpress": VnExpressCrawler,
}


def _crawler(source_slug: str) -> BaseNewsCrawler:
    crawler_type = CRAWLER_TYPES.get(source_slug)
    if crawler_type is None:
        raise ValueError("unsupported news source")
    return crawler_type()


@celery_app.task(  # type: ignore[untyped-decorator]
    name="investiq.news.discover.v1", soft_time_limit=90, time_limit=120
)
def discover_news(
    source_slug: str, limit: int = 50, trigger: str = "scheduled"
) -> dict[str, int | str]:
    if not settings.news_ingestion_enabled:
        return {"source": source_slug, "queued": 0, "status": "disabled"}
    if trigger not in {"scheduled", "manual"}:
        raise ValueError("unsupported crawl trigger")
    provider = _crawler(source_slug)
    urls = provider.discover(limit=limit)
    return _persist_discovery(source_slug, urls, trigger)


def _persist_discovery(
    source_slug: str, urls: tuple[str, ...], trigger: str
) -> dict[str, int | str]:
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
            VALUES (%s, %s, %s, 'running', %s, %s)
            """,
            (run_id, source[0], trigger, datetime.now(UTC), len(urls)),
        )
        for url in urls:
            job_key = hashlib.sha256(f"fetch:{source_slug}:{window}:{url}".encode()).hexdigest()
            candidate_job_id = uuid4()
            inserted = connection.execute(
                """
                INSERT INTO ingestion_jobs
                    (id, source_id, crawl_run_id, job_type, payload, job_key, status)
                VALUES (%s, %s, %s, 'fetch', jsonb_build_object('url', %s::text), %s, 'pending')
                ON CONFLICT (job_key) DO NOTHING
                RETURNING id::text
                """,
                (candidate_job_id, source[0], run_id, url, job_key),
            ).fetchone()
            if inserted:
                queued_job_ids.append(inserted[0])
        connection.execute(
            "UPDATE crawl_runs SET status = %s, finished_at = %s, queued_count = %s WHERE id = %s",
            (
                "succeeded" if not queued_job_ids else "running",
                datetime.now(UTC) if not queued_job_ids else None,
                len(queued_job_ids),
                run_id,
            ),
        )
    return {"source": source_slug, "queued": len(queued_job_ids), "status": "succeeded"}


@celery_app.task(  # type: ignore[untyped-decorator]
    bind=True,
    name="investiq.news.backfill.v1",
    soft_time_limit=60,
    time_limit=90,
    max_retries=3,
)
def backfill_news(self: Task, page: int, start_day: str, end_day: str) -> dict[str, int | str]:
    """Scan one archive page, checkpoint jobs, then schedule the next page."""
    if not settings.news_ingestion_enabled:
        return {"page": page, "queued": 0, "status": "disabled"}
    start, end = date.fromisoformat(start_day), date.fromisoformat(end_day)
    if not 1 <= page <= 150 or start > end or (end - start).days > 90:
        raise ValueError("invalid news backfill range")
    now = datetime.now(UTC)
    with get_pool().connection() as connection, connection.transaction():
        connection.execute(
            """INSERT INTO news_backfill_progress (start_day, end_day, next_page, status)
               VALUES (%s, %s, %s, 'running') ON CONFLICT DO NOTHING""",
            (start, end, page),
        )
        claim = connection.execute(
            """UPDATE news_backfill_progress
               SET lease_until = %s, updated_at = %s
               WHERE start_day = %s AND end_day = %s AND next_page = %s
                 AND status = 'running' AND (lease_until IS NULL OR lease_until < %s)
               RETURNING next_page""",
            (now + timedelta(minutes=2), now, start, end, page, now),
        ).fetchone()
    if claim is None:
        return {"page": page, "queued": 0, "status": "skipped"}
    try:
        urls = VietstockCrawler().discover_history_page(page, start, end)
    except NewsProviderError as exc:
        with get_pool().connection() as connection:
            connection.execute(
                """UPDATE news_backfill_progress SET lease_until = NULL, updated_at = now()
                   WHERE start_day = %s AND end_day = %s AND next_page = %s""",
                (start, end, page),
            )
        raise self.retry(exc=exc, countdown=min(300, 30 * 2**self.request.retries)) from exc
    result = (
        _persist_discovery("vietstock", urls, "backfill")
        if urls
        else {"source": "vietstock", "queued": 0, "status": "succeeded"}
    )
    with get_pool().connection() as connection:
        connection.execute(
            """UPDATE news_backfill_progress
               SET next_page = %s, status = %s, lease_until = NULL, updated_at = now()
               WHERE start_day = %s AND end_day = %s AND next_page = %s""",
            (page + 1, "running" if urls and page < 150 else "complete", start, end, page),
        )
    if urls and page < 150:
        backfill_news.apply_async(
            args=(page + 1, start_day, end_day), queue="news-ingestion", countdown=10
        )
    return {"page": page, "queued": int(str(result["queued"])), "status": str(result["status"])}


@celery_app.task(  # type: ignore[untyped-decorator]
    name="investiq.news.resume-backfills.v1", soft_time_limit=30, time_limit=45
)
def resume_news_backfills() -> dict[str, int]:
    if not settings.news_ingestion_enabled:
        return {"resumed": 0}
    with get_pool().connection() as connection:
        rows = connection.execute(
            """SELECT next_page, start_day::text, end_day::text
               FROM news_backfill_progress
               WHERE status = 'running' AND updated_at < now() - interval '2 minutes'
                 AND (lease_until IS NULL OR lease_until < now())
               ORDER BY updated_at LIMIT 3"""
        ).fetchall()
    for page, start_day, end_day in rows:
        backfill_news.apply_async(args=(page, start_day, end_day), queue="news-ingestion")
    return {"resumed": len(rows)}


@celery_app.task(  # type: ignore[untyped-decorator]
    name="investiq.news.dispatch.v1",
    soft_time_limit=30,
    time_limit=45,
)
def dispatch_news_jobs(limit: int = 20) -> dict[str, int]:
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
        require_recent_article(
            parsed,
            max_age=timedelta(hours=settings.news_ingestion_max_age_hours),
        )
        use_case = IngestNews(SqlNewsRepository(pool), VietnameseRuleSentimentAnalyzer())
        article_id, changed = use_case.execute(parsed)
        if changed:
            get_news_read_cache().invalidate()
    except (StaleArticle, UnverifiableArticleDate) as exc:
        error_code = "STALE_ARTICLE" if isinstance(exc, StaleArticle) else "UNVERIFIABLE_DATE"
        _finish_job(job_id, "cancelled", error_code)
        logger.info(
            "News article skipped by freshness policy",
            extra={"problem": str(exc), "request_id": job_id},
        )
        return {"job_id": job_id, "status": "cancelled", "changed": False}
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
        connection.execute(
            """
            UPDATE crawl_runs AS run
            SET succeeded_count = counts.succeeded_count,
                failed_count = counts.failed_count,
                skipped_count = counts.skipped_count,
                status = CASE
                    WHEN counts.active_count > 0 THEN 'running'
                    WHEN counts.failed_count > 0 AND counts.succeeded_count > 0 THEN 'partial'
                    WHEN counts.failed_count > 0 THEN 'failed'
                    ELSE 'succeeded'
                END,
                finished_at = CASE WHEN counts.active_count = 0 THEN %s ELSE NULL END
            FROM (
                SELECT crawl_run_id,
                       count(*) FILTER (WHERE status = 'succeeded')::integer AS succeeded_count,
                       count(*) FILTER (WHERE status = 'failed')::integer AS failed_count,
                       count(*) FILTER (WHERE status = 'cancelled')::integer AS skipped_count,
                       count(*) FILTER (
                           WHERE status IN ('pending', 'dispatched', 'running')
                       )::integer AS active_count
                FROM ingestion_jobs
                WHERE crawl_run_id = (
                    SELECT crawl_run_id FROM ingestion_jobs WHERE id = %s::uuid
                )
                GROUP BY crawl_run_id
            ) AS counts
            WHERE run.id = counts.crawl_run_id
            """,
            (datetime.now(UTC), job_id),
        )


@celery_app.task(  # type: ignore[untyped-decorator]
    name="investiq.news.retention.v1", soft_time_limit=60, time_limit=90
)
def cleanup_old_news(
    retention_days: int | None = None,
    *,
    dry_run: bool = True,
    confirm: bool = False,
) -> dict[str, int | bool | str]:
    """Preview or delete articles outside retention; deletion requires explicit confirmation."""
    days = retention_days or settings.news_retention_days
    if not 7 <= days <= 3650:
        raise ValueError("retention days must be between 7 and 3650")
    if not dry_run and not confirm:
        raise ValueError("destructive retention cleanup requires confirm=true")
    cutoff = datetime.now(UTC) - timedelta(days=days)
    with get_pool().connection() as connection, connection.transaction():
        count_row = connection.execute(
            "SELECT count(*) FROM news_articles WHERE feed_at < %s", (cutoff,)
        ).fetchone()
        matched = int(count_row[0]) if count_row else 0
        deleted = 0
        if not dry_run:
            deleted_rows = connection.execute(
                "DELETE FROM news_articles WHERE feed_at < %s RETURNING id", (cutoff,)
            ).fetchall()
            deleted = len(deleted_rows)
    if deleted:
        get_news_read_cache().invalidate()
    return {
        "status": "preview" if dry_run else "succeeded",
        "dry_run": dry_run,
        "retention_days": days,
        "matched": matched,
        "deleted": deleted,
    }
