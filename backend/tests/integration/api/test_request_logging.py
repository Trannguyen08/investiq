from unittest.mock import patch

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.main import app
from app.middleware.request_logging import RequestLoggingMiddleware


def test_request_log_contains_status_path_and_supplied_request_id() -> None:
    with (
        patch("app.middleware.request_logging.logger.info") as log_info,
        TestClient(app) as client,
    ):
        response = client.get(
            "/api/v1/status",
            headers={"X-Request-ID": "request-123"},
        )

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "request-123"
    log_info.assert_called_once()
    assert log_info.call_args.kwargs["extra"] == {
        "api_url": "/api/v1/status",
        "duration_ms": log_info.call_args.kwargs["extra"]["duration_ms"],
        "problem": "Request completed successfully.",
        "request_id": "request-123",
        "status_code": 200,
    }


def test_health_checks_are_not_written_to_access_log() -> None:
    with (
        patch("app.middleware.request_logging.logger.info") as log_info,
        TestClient(app) as client,
    ):
        response = client.get("/healthz")

    assert response.status_code == 200
    log_info.assert_not_called()


def test_invalid_request_id_is_replaced_and_client_error_is_warning() -> None:
    with (
        patch("app.middleware.request_logging.logger.warning") as log_warning,
        TestClient(app) as client,
    ):
        response = client.get(
            "/api/v1/missing",
            headers={"X-Request-ID": "invalid request id"},
        )

    generated_request_id = response.headers["X-Request-ID"]
    assert response.status_code == 404
    assert generated_request_id != "invalid request id"
    assert len(generated_request_id) == 32
    log_warning.assert_called_once()
    assert log_warning.call_args.kwargs["extra"]["status_code"] == 404
    assert log_warning.call_args.kwargs["extra"]["request_id"] == generated_request_id


def test_unhandled_error_is_logged_as_server_failure() -> None:
    failing_app = FastAPI()
    failing_app.add_middleware(RequestLoggingMiddleware)

    @failing_app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("test failure")

    with (
        patch("app.middleware.request_logging.logger.exception") as log_exception,
        TestClient(failing_app, raise_server_exceptions=False) as client,
    ):
        response = client.get("/boom", headers={"X-Request-ID": "failure-123"})

    assert response.status_code == 500
    log_exception.assert_called_once()
    assert log_exception.call_args.kwargs["extra"]["status_code"] == 500
    assert log_exception.call_args.kwargs["extra"]["request_id"] == "failure-123"


def test_server_error_response_is_logged_at_error_level() -> None:
    unavailable_app = FastAPI()
    unavailable_app.add_middleware(RequestLoggingMiddleware)

    @unavailable_app.get("/unavailable")
    async def unavailable() -> JSONResponse:
        return JSONResponse(status_code=503, content={"status": "unavailable"})

    with (
        patch("app.middleware.request_logging.logger.error") as log_error,
        TestClient(unavailable_app) as client,
    ):
        response = client.get("/unavailable")

    assert response.status_code == 503
    log_error.assert_called_once()
    assert log_error.call_args.kwargs["extra"]["status_code"] == 503
