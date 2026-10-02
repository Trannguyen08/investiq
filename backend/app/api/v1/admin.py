"""Protected operational endpoints for the news ingestion pipeline."""

from __future__ import annotations

import json
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from psycopg.rows import dict_row

from app.api.deps import require_news_admin
from app.infrastructure.db.session import get_pool
from app.schemas.news_admin import (
    CrawlRunResponse,
    ManualCrawlRequest,
    OperationResponse,
    RetentionRequest,
    SourceAdminResponse,
    SourceStatusUpdate,
)
from app.workers.news_ingestion_worker import cleanup_old_news, discover_news

router = APIRouter(
    prefix="/api/v1/admin/news",
    tags=["news-admin"],
    dependencies=[Depends(require_news_admin)],
)


def _audit(
    request: Request, action: str, target: str, outcome: str, details: dict[str, object]
) -> None:
    with get_pool().connection() as connection:
        connection.execute(
            """
            INSERT INTO news_admin_audit (id, request_id, action, target, outcome, details)
            VALUES (%s, %s, %s, %s, %s, %s::jsonb)
            """,
            (
                uuid4(),
                str(request.state.request_id),
                action,
                target,
                outcome,
                json.dumps(details),
            ),
        )


@router.get("/sources", response_model=list[SourceAdminResponse])
def list_admin_sources() -> list[SourceAdminResponse]:
    with get_pool().connection() as connection, connection.cursor(row_factory=dict_row) as cursor:
        rows = cursor.execute(
            """
            SELECT slug, name, status, storage_mode, display_mode, row_version,
                   last_success_at, blocked_reason
            FROM news_sources ORDER BY name
            """
        ).fetchall()
    return [SourceAdminResponse(**row) for row in rows]


@router.patch("/sources/{source_slug}", response_model=SourceAdminResponse)
def update_source_status(
    source_slug: str,
    payload: SourceStatusUpdate,
    request: Request,
) -> SourceAdminResponse:
    _audit(request, "source.status", source_slug, "accepted", payload.model_dump())
    with (
        get_pool().connection() as connection,
        connection.transaction(),
        connection.cursor(row_factory=dict_row) as cursor,
    ):
        row = cursor.execute(
            """
                UPDATE news_sources
                SET status = %s, row_version = row_version + 1, updated_at = now()
                WHERE slug = %s AND row_version = %s AND status IN ('active', 'paused')
                RETURNING slug, name, status, storage_mode, display_mode, row_version,
                          last_success_at, blocked_reason
                """,
            (payload.status, source_slug, payload.expected_row_version),
        ).fetchone()
    if row is None:
        _audit(request, "source.status", source_slug, "rejected", payload.model_dump())
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Source changed, is not operational, or does not exist",
        )
    _audit(request, "source.status", source_slug, "succeeded", payload.model_dump())
    return SourceAdminResponse(**row)


@router.post("/crawl-runs", response_model=OperationResponse, status_code=202)
def trigger_manual_crawl(payload: ManualCrawlRequest, request: Request) -> OperationResponse:
    with get_pool().connection() as connection:
        active = connection.execute(
            "SELECT 1 FROM news_sources WHERE slug = %s AND status = 'active'",
            (payload.source_slug,),
        ).fetchone()
    if not active:
        raise HTTPException(status_code=409, detail="News source is not active")
    _audit(
        request,
        "crawl.trigger",
        payload.source_slug,
        "accepted",
        {"limit": payload.limit},
    )
    result = discover_news.apply_async(
        args=(payload.source_slug, payload.limit, "manual"), queue="news-ingestion"
    )
    _audit(
        request,
        "crawl.trigger",
        payload.source_slug,
        "succeeded",
        {"limit": payload.limit, "operation_id": result.id},
    )
    return OperationResponse(status="accepted", operation_id=result.id)


@router.get("/crawl-runs", response_model=list[CrawlRunResponse])
def list_crawl_runs() -> list[CrawlRunResponse]:
    with get_pool().connection() as connection, connection.cursor(row_factory=dict_row) as cursor:
        rows = cursor.execute(
            """
            SELECT run.id::text, source.slug AS source_slug, run.trigger, run.status,
                   run.started_at, run.finished_at, run.discovered_count, run.queued_count,
                   run.succeeded_count, run.skipped_count, run.failed_count, run.error_code
            FROM crawl_runs run
            JOIN news_sources source ON source.id = run.source_id
            ORDER BY run.created_at DESC, run.id DESC
            LIMIT 100
            """
        ).fetchall()
    return [CrawlRunResponse(**row) for row in rows]


@router.post("/retention", response_model=OperationResponse)
def run_retention(payload: RetentionRequest, request: Request) -> OperationResponse:
    if not payload.dry_run and not payload.confirm:
        raise HTTPException(status_code=409, detail="Deletion requires confirm=true")
    _audit(
        request,
        "retention.cleanup",
        "news_articles",
        "accepted",
        payload.model_dump(),
    )
    result = cleanup_old_news.run(
        payload.retention_days,
        dry_run=payload.dry_run,
        confirm=payload.confirm,
    )
    _audit(
        request,
        "retention.cleanup",
        "news_articles",
        "succeeded",
        result,
    )
    return OperationResponse(**result)
