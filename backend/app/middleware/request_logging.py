"""HTTP request correlation and structured access logging."""

import logging
import re
import time
from collections.abc import Awaitable, Callable
from typing import Final
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.infrastructure.config.logging_config import (
    bind_request_id,
    problem_for_status,
    reset_request_id,
)

logger = logging.getLogger("investiq.api.access")

_request_id_pattern: Final[re.Pattern[str]] = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
_excluded_paths: Final[frozenset[str]] = frozenset({"/healthz", "/readyz"})


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log one sanitized summary per API request and propagate its correlation ID."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        supplied_request_id = request.headers.get("x-request-id", "")
        request_id = (
            supplied_request_id
            if _request_id_pattern.fullmatch(supplied_request_id)
            else uuid4().hex
        )
        request.state.request_id = request_id
        context_token = bind_request_id(request_id)
        started_at = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            self._write_log(request, 500, started_at, request_id, exception=True)
            raise
        else:
            response.headers["X-Request-ID"] = request_id
            if request.url.path not in _excluded_paths:
                self._write_log(request, response.status_code, started_at, request_id)
            return response
        finally:
            reset_request_id(context_token)

    @staticmethod
    def _write_log(
        request: Request,
        status_code: int,
        started_at: float,
        request_id: str,
        *,
        exception: bool = False,
    ) -> None:
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        extra = {
            "api_url": request.url.path,
            "duration_ms": duration_ms,
            "problem": problem_for_status(status_code),
            "request_id": request_id,
            "status_code": status_code,
        }
        message = f"{request.method} {request.url.path} completed with HTTP {status_code}"
        if exception:
            logger.exception(message, extra=extra)
        elif status_code >= 500:
            logger.error(message, extra=extra)
        elif status_code >= 400:
            logger.warning(message, extra=extra)
        else:
            logger.info(message, extra=extra)
