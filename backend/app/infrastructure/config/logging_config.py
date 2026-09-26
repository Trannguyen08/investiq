"""Structured, sanitized runtime logging shared by API and worker processes."""

import json
import logging
import re
from contextvars import ContextVar, Token
from datetime import UTC, datetime
from typing import Final

from app.infrastructure.config.settings import settings

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
_sensitive_value: Final[re.Pattern[str]] = re.compile(
    r"(?i)(authorization|cookie|api[-_]?key|password|secret|token)([\"'=:\s]+)([^\s,;\"}]+)"
)
_bearer_token: Final[re.Pattern[str]] = re.compile(r"(?i)bearer\s+[a-z0-9._~+/-]+=*")


def bind_request_id(request_id: str) -> Token[str | None]:
    """Attach a request ID to logs emitted while handling the current request."""
    return _request_id.set(request_id)


def reset_request_id(token: Token[str | None]) -> None:
    """Restore the previous request logging context."""
    _request_id.reset(token)


def _redact(value: str) -> str:
    redacted = _bearer_token.sub("Bearer [REDACTED]", value)
    return _sensitive_value.sub(r"\1\2[REDACTED]", redacted)


def problem_for_status(status_code: int) -> str:
    """Return a short, operator-friendly explanation for an HTTP result."""
    if 200 <= status_code < 300:
        return "Request completed successfully."
    if 300 <= status_code < 400:
        return "Request was redirected; verify the destination when unexpected."
    if 400 <= status_code < 500:
        return "The client request was rejected; check its URL, input, or permissions."
    if status_code >= 500:
        return (
            "The server failed to complete the request; inspect this request and its dependencies."
        )
    return "Non-standard HTTP result; inspect the full log entry."


class JsonLogFormatter(logging.Formatter):
    """Serialize records using stable fields understood by the log viewer."""

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.fromtimestamp(record.created, UTC).isoformat().replace("+00:00", "Z")
        status_code = getattr(record, "status_code", None)
        problem = getattr(record, "problem", None)
        if problem is None and isinstance(status_code, int):
            problem = problem_for_status(status_code)
        if problem is None:
            problem = self._problem_for_level(record.levelno)

        message = _redact(record.getMessage())
        payload: dict[str, object] = {
            "timestamp": timestamp,
            "level": record.levelname.lower(),
            "message": message,
            "code": status_code,
            "api_url": getattr(record, "api_url", None),
            "log_content": message,
            "logged_at": timestamp,
            "container": settings.service_name,
            "problem": problem,
            "request_id": getattr(record, "request_id", None) or _request_id.get(),
        }
        duration_ms = getattr(record, "duration_ms", None)
        if duration_ms is not None:
            payload["duration_ms"] = duration_ms
        if record.exc_info:
            payload["exception"] = _redact(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

    @staticmethod
    def _problem_for_level(level: int) -> str:
        if level >= logging.ERROR:
            return "Runtime error; inspect the message and related request or task."
        if level >= logging.WARNING:
            return "Runtime warning; the service continued but may need attention."
        return "Informational runtime event."


def configure_logging() -> None:
    """Configure the process root logger once with JSON output to stdout."""
    handler = logging.StreamHandler()
    handler.setFormatter(JsonLogFormatter())

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(settings.log_level.upper())

    for logger_name in ("uvicorn", "uvicorn.error", "celery"):
        configured_logger = logging.getLogger(logger_name)
        configured_logger.handlers.clear()
        configured_logger.propagate = True

    logging.getLogger("uvicorn.access").disabled = True
