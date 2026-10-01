from fastapi.testclient import TestClient

from app.main import app


def test_auth_api_fails_closed_when_not_configured() -> None:
    response = TestClient(app).post(
        "/api/v1/auth/login",
        headers={"X-BFF-Secret": "not-configured"},
        json={"email": "user@example.com", "password": "irrelevant", "remember_session": False},
    )

    assert response.status_code == 503
    assert response.json()["error"]["message"] == "Authentication is not configured"


def test_admin_user_api_fails_closed_when_auth_is_not_configured() -> None:
    response = TestClient(app).get(
        "/api/v1/admin/users",
        headers={"X-BFF-Secret": "not-configured"},
    )

    assert response.status_code == 503
    assert response.json()["error"]["message"] == "Authentication is not configured"
