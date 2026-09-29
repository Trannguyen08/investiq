"""FastAPI application entry point and platform health endpoints."""

import asyncio
from collections.abc import AsyncIterator, Awaitable
from contextlib import asynccontextmanager
from typing import Any

import psycopg
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

from app.api.v1.news import router as news_router
from app.infrastructure.config.logging_config import configure_logging
from app.infrastructure.config.settings import settings
from app.infrastructure.db.session import close_pool
from app.middleware.request_logging import RequestLoggingMiddleware

configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    close_pool()


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(RequestLoggingMiddleware)
app.include_router(news_router)


def _request_id(request: Request) -> str:
    return str(getattr(request.state, "request_id", "unknown"))


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
    code = "NOT_FOUND" if exc.status_code == 404 else "REQUEST_REJECTED"
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
        headers=exc.headers,
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
