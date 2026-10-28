"""Admin operations router for overview analytics, content moderation, portfolios, and audit."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.api.deps import (
    get_admin_repository,
    require_admin_user,
    require_auth_bff,
)
from app.infrastructure.cache.admin_cache import get_admin_cache
from app.infrastructure.db.repositories.sql_admin_repository import SqlAdminRepository
from app.schemas.admin_ops import (
    AdminAlertPage,
    AdminAlertUpdate,
    AdminAnalyticsResponse,
    AdminAuditLogItem,
    AdminAuditLogPage,
    AdminInstrumentStatusUpdate,
    AdminMarketInstrumentItem,
    AdminMarketInstrumentPage,
    AdminOverviewResponse,
    AdminPortfolioDetail,
    AdminPortfolioPage,
    AdminThesisItem,
    AdminThesisPage,
    AdminThesisUpdate,
)

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["admin-operations"],
    dependencies=[Depends(require_auth_bff)],
)


@router.get("/overview", response_model=AdminOverviewResponse)
def get_admin_overview(
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
    refresh: Annotated[bool, Query()] = False,
) -> AdminOverviewResponse:
    del actor_id
    cache = get_admin_cache()
    if not refresh:
        cached = cache.get("overview")
        if cached:
            return AdminOverviewResponse(**cached)

    overview = repository.get_overview()
    cache.set("overview", overview.model_dump(), ttl_seconds=60)
    return overview


@router.post("/cache/invalidate")
def invalidate_admin_cache(
    actor_id: Annotated[str, Depends(require_admin_user)],
) -> dict[str, str]:
    del actor_id
    get_admin_cache().invalidate("*")
    return {"status": "ok", "message": "Admin cache invalidated"}


# Theses management & moderation
@router.get("/theses", response_model=AdminThesisPage)
def list_admin_theses(
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
    symbol: Annotated[str | None, Query(max_length=20)] = None,
    status_filter: Annotated[
        str | None,
        Query(alias="status", pattern="^(active|hit_target|stopped_out|expired)$"),
    ] = None,
    stance: Annotated[str | None, Query(pattern="^(bullish|bearish|neutral)$")] = None,
    q: Annotated[str | None, Query(max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    page: Annotated[int, Query(ge=1, le=100_000)] = 1,
) -> AdminThesisPage:
    del actor_id
    return repository.list_theses(
        symbol=symbol,
        status=status_filter,
        stance=stance,
        q=q,
        limit=limit,
        page=page,
    )


@router.get("/theses/{thesis_id}", response_model=AdminThesisItem)
def get_admin_thesis(
    thesis_id: UUID,
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
) -> AdminThesisItem:
    del actor_id
    thesis = repository.get_thesis(str(thesis_id))
    if thesis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thesis not found",
        )
    return thesis


@router.patch("/theses/{thesis_id}", response_model=AdminThesisItem)
def update_admin_thesis(
    thesis_id: UUID,
    payload: AdminThesisUpdate,
    request: Request,
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
) -> AdminThesisItem:
    if not payload.status:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Status field is required",
        )
    req_id = str(getattr(request.state, "request_id", "unknown"))
    updated = repository.update_thesis_status(
        str(thesis_id),
        payload.status,
        actor_id,
        note=payload.note,
        request_id=req_id,
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thesis not found",
        )
    get_admin_cache().invalidate("overview")
    return updated


@router.delete(
    "/theses/{thesis_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
def delete_admin_thesis(
    thesis_id: UUID,
    request: Request,
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
) -> None:
    req_id = str(getattr(request.state, "request_id", "unknown"))
    success = repository.delete_thesis(str(thesis_id), actor_id, req_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thesis not found",
        )
    get_admin_cache().invalidate("overview")


# Portfolios monitoring
@router.get("/portfolios", response_model=AdminPortfolioPage)
def list_admin_portfolios(
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
    q: Annotated[str | None, Query(max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    page: Annotated[int, Query(ge=1, le=100_000)] = 1,
) -> AdminPortfolioPage:
    del actor_id
    return repository.list_portfolios(q=q, limit=limit, page=page)


@router.get("/portfolios/{portfolio_id}", response_model=AdminPortfolioDetail)
def get_admin_portfolio_detail(
    portfolio_id: UUID,
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
) -> AdminPortfolioDetail:
    del actor_id
    detail = repository.get_portfolio_detail(str(portfolio_id))
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found",
        )
    return detail


# Audit logs
@router.get("/audit-logs", response_model=AdminAuditLogPage)
def list_admin_audit_logs(
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
    category: Annotated[str | None, Query(max_length=60)] = None,
    outcome: Annotated[str | None, Query(pattern="^(succeeded|denied|failed)$")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    page: Annotated[int, Query(ge=1, le=100_000)] = 1,
) -> AdminAuditLogPage:
    del actor_id
    return repository.list_audit_logs(category=category, outcome=outcome, limit=limit, page=page)


@router.get("/audit-logs/{log_id}", response_model=AdminAuditLogItem)
def get_admin_audit_log_detail(
    log_id: str,
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
) -> AdminAuditLogItem:
    del actor_id
    log_item = repository.get_audit_log_detail(log_id)
    if log_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log not found",
        )
    return log_item


# Market Instruments management
@router.get("/market/instruments", response_model=AdminMarketInstrumentPage)
def list_admin_market_instruments(
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
    symbol: Annotated[str | None, Query(max_length=20)] = None,
    exchange: Annotated[str | None, Query(max_length=20)] = None,
    sector: Annotated[str | None, Query(max_length=60)] = None,
    status: Annotated[str | None, Query(pattern="^(normal|warning|halted)$")] = None,
    page: Annotated[int, Query(ge=1, le=100_000)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AdminMarketInstrumentPage:
    del actor_id
    return repository.list_market_instruments(
        symbol=symbol,
        exchange=exchange,
        sector=sector,
        status=status,
        page=page,
        limit=limit,
    )


@router.patch("/market/instruments/{symbol}", response_model=AdminMarketInstrumentItem)
def update_admin_market_instrument(
    symbol: str,
    payload: AdminInstrumentStatusUpdate,
    request: Request,
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
) -> AdminMarketInstrumentItem:
    req_id = str(getattr(request.state, "request_id", "unknown"))
    updated = repository.update_market_instrument_status(
        symbol=symbol,
        trading_status=payload.trading_status,
        paper_trading_enabled=payload.paper_trading_enabled,
        actor_id=actor_id,
        request_id=req_id,
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instrument not found",
        )
    return updated


# Risk & Security Alerts
@router.get("/alerts", response_model=AdminAlertPage)
def list_admin_alerts(
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
    severity: Annotated[str | None, Query(pattern="^(high|medium|low)$")] = None,
    status: Annotated[str | None, Query(pattern="^(active|resolved|dismissed)$")] = None,
    category: Annotated[str | None, Query(max_length=50)] = None,
    page: Annotated[int, Query(ge=1, le=100_000)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AdminAlertPage:
    del actor_id
    return repository.list_alerts(
        severity=severity,
        status=status,
        category=category,
        page=page,
        limit=limit,
    )


@router.patch("/alerts/{alert_id}")
def update_admin_alert_status(
    alert_id: str,
    payload: AdminAlertUpdate,
    request: Request,
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
) -> dict[str, str]:
    req_id = str(getattr(request.state, "request_id", "unknown"))
    success = repository.update_alert_status(
        alert_id=alert_id,
        new_status=payload.status,
        actor_id=actor_id,
        note=payload.note,
        request_id=req_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )
    return {"status": "ok", "alert_id": alert_id, "new_status": payload.status}


# Analytics & Intelligence
@router.get("/analytics", response_model=AdminAnalyticsResponse)
def get_admin_analytics(
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlAdminRepository, Depends(get_admin_repository)],
) -> AdminAnalyticsResponse:
    del actor_id
    return repository.get_analytics()

