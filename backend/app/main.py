"""FastAPI application entry point and platform health endpoints."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
from collections.abc import AsyncIterator, Awaitable
from contextlib import asynccontextmanager
from typing import Any

import psycopg
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

from app.api.v1.admin import router as news_admin_router
from app.api.v1.admin_assessment import router as admin_assessment_router
from app.api.v1.admin_learning import router as admin_learning_router
from app.api.v1.admin_ops import router as admin_ops_router
from app.api.v1.admin_users import router as admin_users_router
from app.api.v1.ai_chat import router as ai_chat_router
from app.api.v1.assessment import router as assessment_router
from app.api.v1.auth import router as auth_router
from app.api.v1.learning import router as learning_router
from app.api.v1.market_data import (
    close_market_provider,
    start_market_provider,
    watchlist_router,
)
from app.api.v1.market_data import (
    router as market_router,
)
from app.api.v1.market_data import (
    stream_router as market_stream_router,
)
from app.api.v1.news import router as news_router
from app.api.v1.portfolio import (
    public_portfolio_router,
)
from app.api.v1.portfolio import (
    router as paper_portfolio_router,
)
from app.api.v1.theses import router as thesis_router
from app.application.use_cases.auth.auth_service import AuthError
from app.application.use_cases.market_data.errors import MarketDataUnavailable
from app.infrastructure.config.settings import settings
from app.infrastructure.db.session import close_pool
from app.infrastructure.security.jwt_handler import JwtError
from app.middleware.request_logging import RequestLoggingMiddleware
from app.workers.events_ingestion_worker import run_events_ingestion_cycle
from app.workers.news_ingestion_worker import run_direct_ingestion_cycle

logger = logging.getLogger("investiq.news.lifecycle")
events_logger = logging.getLogger("investiq.events.lifecycle")


async def _news_background_loop() -> None:
    await asyncio.sleep(2)
    while True:
        try:
            logger.info("Executing news retention and ingestion cycle")
            await asyncio.to_thread(run_direct_ingestion_cycle)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Error during background news cycle: %s", exc)
        await asyncio.sleep(900)


def _check_and_dispatch_due_reminders() -> None:
    from datetime import UTC, datetime

    from app.infrastructure.db.repositories.sql_event_reminder_repository import (
        get_event_reminder_repository,
    )
    from app.infrastructure.external.notifications.event_reminder_email import (
        send_event_reminder_email,
    )

    repo = get_event_reminder_repository()
    due = repo.get_due_reminders(window_hours=48)
    now = datetime.now(UTC)

    for r in (due or []):
        try:
            ev_date = r["event_at"]
            days_left = (
                max(1, (ev_date.date() - now.date()).days) if hasattr(ev_date, "date") else 1
            )
            date_str = (
                ev_date.strftime("%d/%m/%Y") if hasattr(ev_date, "strftime") else str(ev_date)
            )

            send_event_reminder_email(
                to_email=r["email"],
                symbol=r["symbol"],
                event_title=r["event_title"],
                event_type=r["event_type"],
                event_date_str=date_str,
                days_left=days_left,
            )
            repo.mark_sent(r["id"])
            events_logger.info("Dispatched reminder email for %s to %s", r["symbol"], r["email"])
        except Exception as exc:
            events_logger.error("Failed sending reminder %s: %s", r.get("id"), exc)


def _check_and_dispatch_paper_daily_reports() -> None:
    from datetime import UTC, datetime

    from app.api.v1.portfolio import get_paper_trading_service
    from app.application.use_cases.portfolio.ai_portfolio_advisor import (
        generate_ai_portfolio_review,
    )
    from app.infrastructure.db.repositories.sql_paper_report_repository import (
        get_paper_report_repository,
    )
    from app.infrastructure.external.notifications.paper_portfolio_email import (
        send_paper_portfolio_daily_email,
    )

    repo = get_paper_report_repository()
    active_subs = repo.list_active_subscriptions()
    service = get_paper_trading_service()

    for sub in active_subs:
        uid = sub.get("user_id")
        to_email = sub.get("email")
        if not uid or not to_email:
            continue

        last_sent = sub.get("last_sent_at")
        if (
            last_sent
            and hasattr(last_sent, "date")
            and last_sent.date() == datetime.now(UTC).date()
        ):
            continue

        try:
            dashboard = service.dashboard(str(uid))
            account_raw = dashboard.get("account")
            account_dict: dict[str, Any] = dict(account_raw) if isinstance(account_raw, dict) else {}
            holdings_raw = dashboard.get("holdings")
            holdings_list: list[dict[str, Any]] = list(holdings_raw) if isinstance(holdings_raw, list) else []
            trades_raw = dashboard.get("trades")
            trades_list: list[dict[str, Any]] | None = list(trades_raw) if isinstance(trades_raw, list) else None

            if not holdings_list and not trades_list:
                continue

            ai_review = generate_ai_portfolio_review(
                account_data=account_dict,
                holdings_data=holdings_list,
                trades_data=trades_list,
            )

            send_paper_portfolio_daily_email(
                to_email=str(to_email),
                account_data=account_dict,
                ai_review=ai_review,
            )
            repo.mark_sent(str(uid))
            events_logger.info("Dispatched daily AI paper portfolio report to %s", to_email)
        except Exception as exc:
            events_logger.error("Failed dispatching daily paper report for %s: %s", uid, exc)


async def _events_background_loop() -> None:
    await asyncio.sleep(5)
    while True:
        try:
            events_logger.info("Executing corporate events background sync cycle")
            await asyncio.to_thread(run_events_ingestion_cycle)
            await asyncio.to_thread(_check_and_dispatch_due_reminders)
            await asyncio.to_thread(_check_and_dispatch_paper_daily_reports)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            events_logger.error("Error during background events cycle: %s", exc)
        await asyncio.sleep(1800)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await start_market_provider()
    news_task = None
    events_task = None
    if settings.news_ingestion_enabled:
        news_task = asyncio.create_task(_news_background_loop())
    events_task = asyncio.create_task(_events_background_loop())
    try:
        yield
    finally:
        if news_task:
            news_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await news_task
        if events_task:
            events_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await events_task
        await close_market_provider()
        close_pool()


_raw_origins = os.getenv("BACKEND_CORS_ORIGINS", "")
_extra_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
_cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    *_extra_origins,
]

app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"^https://.*(vercel\.app|onrender\.com|koyeb\.app)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.include_router(news_router)
app.include_router(news_admin_router)
app.include_router(admin_users_router)
app.include_router(admin_ops_router)
app.include_router(auth_router)
app.include_router(ai_chat_router)
app.include_router(market_router)
app.include_router(market_stream_router)
app.include_router(watchlist_router)
app.include_router(paper_portfolio_router)
app.include_router(public_portfolio_router)
app.include_router(thesis_router)
app.include_router(learning_router)
app.include_router(admin_learning_router)
app.include_router(assessment_router)
app.include_router(admin_assessment_router)


def _request_id(request: Request) -> str:
    return str(getattr(request.state, "request_id", "unknown"))


def _private_error_headers(request: Request) -> dict[str, str]:
    private_prefixes = (
        "/api/v1/auth",
        "/api/v1/admin/users",
        "/api/v1/watchlists",
        "/api/v1/paper-portfolio",
        "/api/v1/admin/learning",
        "/api/v1/admin/assessment",
    )
    return {"Cache-Control": "no-store"} if request.url.path.startswith(private_prefixes) else {}


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
    code = "NOT_FOUND" if exc.status_code == 404 else "REQUEST_REJECTED"
    headers = {**dict(exc.headers or {}), **_private_error_headers(request)}
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": str(exc.detail),
                "request_id": _request_id(request),
                "details": [],
            }
        },
        headers=headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = [
        {"location": list(error["loc"]), "message": error["msg"], "type": error["type"]}
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed.",
                "request_id": _request_id(request),
                "details": details,
            }
        },
        headers=_private_error_headers(request),
    )


@app.exception_handler(AuthError)
async def auth_error(request: Request, exc: AuthError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "request_id": _request_id(request),
                "details": [],
            }
        },
        headers={"Cache-Control": "no-store"},
    )


@app.exception_handler(JwtError)
async def jwt_error(request: Request, _: JwtError) -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={
            "error": {
                "code": "INVALID_SESSION",
                "message": "Phiên đăng nhập đã hết hạn.",
                "request_id": _request_id(request),
                "details": [],
            }
        },
        headers={"Cache-Control": "no-store", "WWW-Authenticate": "Bearer"},
    )


@app.exception_handler(MarketDataUnavailable)
async def market_data_error(request: Request, _: MarketDataUnavailable) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "error": {
                "code": "MARKET_DATA_UNAVAILABLE",
                "message": "Market data provider is temporarily unavailable.",
                "request_id": _request_id(request),
                "details": [],
            }
        },
        headers={"Cache-Control": "no-store", "Retry-After": "15"},
    )


@app.get("/healthz", tags=["operations"])
async def liveness() -> dict[str, str]:
    """Report whether the API process can serve requests."""
    return {"status": "ok"}


def _check_postgres() -> None:
    with psycopg.connect(settings.database_url, connect_timeout=2) as connection:
        connection.execute("SELECT 1")


async def _check_redis() -> None:
    client: Redis = Redis.from_url(settings.redis_url, socket_connect_timeout=2)
    try:
        await client.ping()
    finally:
        await client.aclose()


@app.get("/readyz", tags=["operations"], response_model=None)
async def readiness() -> dict[str, Any] | JSONResponse:
    """Report whether required runtime dependencies are reachable."""
    checks: dict[str, str] = {}
    dependency_checks: tuple[tuple[str, Awaitable[object]], ...] = (
        ("postgres", asyncio.to_thread(_check_postgres)),
        ("redis", _check_redis()),
    )

    for name, check in dependency_checks:
        try:
            await check
            checks[name] = "ok"
        except Exception:  # Dependency details must not leak through a public endpoint.
            checks[name] = "unavailable"

    if all(value == "ok" for value in checks.values()):
        return {"status": "ready", "checks": checks}

    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "not_ready", "checks": checks},
    )


@app.get("/api/v1/status", tags=["operations"])
async def api_status() -> dict[str, str]:
    """Expose a versioned endpoint for reverse-proxy and client smoke tests."""
    return {"service": "investiq-backend", "status": "ok"}
