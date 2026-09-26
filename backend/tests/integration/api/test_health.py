from fastapi.testclient import TestClient

from app.main import app


def test_liveness_reports_ok() -> None:
    with TestClient(app) as client:
        response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_versioned_status_endpoint_reports_service_name() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/status")

    assert response.status_code == 200
    assert response.json() == {"service": "investiq-backend", "status": "ok"}
