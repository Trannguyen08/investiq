import json
import logging
import sys
from pathlib import Path

import pytest

from app.infrastructure.config.logging_config import (
    JsonLogFormatter,
    bind_request_id,
    configure_logging,
    problem_for_status,
    reset_request_id,
)
from app.infrastructure.config.settings import settings

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]


def test_dozzle_profile_visible_keys_can_be_hydrated_by_v11() -> None:
    profile_path = REPOSITORY_ROOT / "infra" / "log-viewer" / "profile.json"
    profile = json.loads(profile_path.read_text(encoding="utf-8"))

    visible_keys = profile.get("visibleKeys", [])
    assert isinstance(visible_keys, list)
    for host_key, container_keys in visible_keys:
        assert isinstance(host_key, str)
        assert isinstance(container_keys, list)
        for container_key, keys in container_keys:
            assert isinstance(container_key, list)
            assert container_key
            assert all(isinstance(part, str) for part in container_key)
            assert isinstance(keys, bool)


def test_dozzle_profile_prioritizes_api_request_fields() -> None:
    profile_path = REPOSITORY_ROOT / "infra" / "log-viewer" / "profile.json"
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    profiles = dict(profile["visibleKeys"])
    preview_key = (
        "investiq-preview-api: uvicorn app.main:app --host 0.0.0.0 --port 8000 "
        "--proxy-headers --forwarded-allow-ips=*"
    )
    configured_fields = {
        tuple(field_path): enabled for field_path, enabled in profiles[preview_key]
    }

    assert configured_fields == {
        ("code",): True,
        ("api_url",): True,
        ("duration_ms",): True,
        ("log_content",): True,
        ("problem",): True,
        ("request_id",): True,
        ("timestamp",): False,
        ("level",): False,
        ("message",): False,
        ("logged_at",): False,
        ("container",): False,
    }


def test_json_formatter_emits_viewer_contract_and_redacts_secrets() -> None:
    record = logging.LogRecord(
        name="investiq.test",
        level=logging.ERROR,
        pathname=__file__,
        lineno=12,
        msg="Authorization: Bearer abc.def password=unsafe",
        args=(),
        exc_info=None,
    )
    record.status_code = 500
    record.api_url = "/api/v1/status"
    record.request_id = "request-123"

    payload = json.loads(JsonLogFormatter().format(record))

    assert payload["code"] == 500
    assert payload["api_url"] == "/api/v1/status"
    assert payload["container"] == "backend"
    assert payload["logged_at"].endswith("Z")
    assert payload["level"] == "error"
    assert payload["problem"] == problem_for_status(500)
    assert payload["request_id"] == "request-123"
    assert "abc.def" not in payload["log_content"]
    assert "unsafe" not in payload["log_content"]
    assert payload["message"] == payload["log_content"]


def test_problem_for_status_explains_each_status_group() -> None:
    assert "successfully" in problem_for_status(200)
    assert "redirected" in problem_for_status(301)
    assert "client request" in problem_for_status(404)
    assert "server failed" in problem_for_status(500)
    assert "Non-standard" in problem_for_status(199)


def test_formatter_uses_bound_request_id_and_level_problem_for_non_http_log() -> None:
    token = bind_request_id("task-request-123")
    try:
        record = logging.LogRecord(
            name="investiq.worker",
            level=logging.WARNING,
            pathname=__file__,
            lineno=42,
            msg="Provider response was delayed",
            args=(),
            exc_info=None,
        )
        payload = json.loads(JsonLogFormatter().format(record))
    finally:
        reset_request_id(token)

    assert payload["code"] is None
    assert payload["api_url"] is None
    assert payload["request_id"] == "task-request-123"
    assert payload["problem"] == "Runtime warning; the service continued but may need attention."


def test_formatter_includes_duration_and_redacted_exception() -> None:
    try:
        raise ValueError("token=unsafe-exception-value")
    except ValueError:
        exception_info = sys.exc_info()

    record = logging.LogRecord(
        name="investiq.worker",
        level=logging.ERROR,
        pathname=__file__,
        lineno=60,
        msg="Task failed",
        args=(),
        exc_info=exception_info,
    )
    record.duration_ms = 12.5

    payload = json.loads(JsonLogFormatter().format(record))

    assert payload["duration_ms"] == 12.5
    assert payload["problem"] == "Runtime error; inspect the message and related request or task."
    assert "unsafe-exception-value" not in payload["exception"]


def test_formatter_uses_informational_problem_by_default() -> None:
    record = logging.LogRecord(
        name="investiq.worker",
        level=logging.INFO,
        pathname=__file__,
        lineno=78,
        msg="Task started",
        args=(),
        exc_info=None,
    )

    payload = json.loads(JsonLogFormatter().format(record))

    assert payload["problem"] == "Informational runtime event."


def test_configure_logging_sets_json_handler_and_service_loggers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root_logger = logging.getLogger()
    service_loggers = [logging.getLogger(name) for name in ("uvicorn", "uvicorn.error", "celery")]
    access_logger = logging.getLogger("uvicorn.access")
    original_root_handlers = root_logger.handlers[:]
    original_root_level = root_logger.level
    original_service_states = [
        (logger.handlers[:], logger.propagate) for logger in service_loggers
    ]
    original_access_disabled = access_logger.disabled
    monkeypatch.setattr(settings, "log_level", "WARNING")

    try:
        configure_logging()

        assert root_logger.level == logging.WARNING
        assert len(root_logger.handlers) == 1
        assert isinstance(root_logger.handlers[0].formatter, JsonLogFormatter)
        assert all(not logger.handlers and logger.propagate for logger in service_loggers)
        assert access_logger.disabled is True
    finally:
        root_logger.handlers = original_root_handlers
        root_logger.setLevel(original_root_level)
        for logger, (handlers, propagate) in zip(
            service_loggers,
            original_service_states,
            strict=True,
        ):
            logger.handlers = handlers
            logger.propagate = propagate
        access_logger.disabled = original_access_disabled
