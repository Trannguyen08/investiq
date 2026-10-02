from typing import NoReturn

import pytest
from fastapi.testclient import TestClient

from app.api import deps
from app.api.v1 import auth as auth_api
from app.application.use_cases.auth.auth_service import AuthError
from app.main import app


def test_auth_api_fails_closed_when_not_configured() -> None:
    response = TestClient(app).post(
        "/api/v1/auth/login",
        headers={"X-BFF-Secret": "not-configured"},
        json={"email": "user@example.com", "password": "irrelevant"},
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


@pytest.mark.parametrize(
    ("path", "body", "service_method", "code", "status"),
    [
        (
            "/register",
            {
                "pre_auth_id": "11111111-1111-4111-8111-111111111111",
                "email": "user@example.com",
                "display_name": "Test Account",
                "password": "secure-password-value-long",
                "password_confirmation": "secure-password-value-long",
            },
            "register",
            "EMAIL_ALREADY_REGISTERED",
            409,
        ),
        (
            "/password-reset/request",
            {
                "pre_auth_id": "11111111-1111-4111-8111-111111111111",
                "email": "missing@example.com",
            },
            "request_password_reset",
            "EMAIL_NOT_FOUND",
            404,
        ),
    ],
)
def test_auth_api_returns_actionable_account_errors(
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    body: dict[str, str],
    service_method: str,
    code: str,
    status: int,
) -> None:
    def fail() -> NoReturn:
        raise AuthError(code, f"Actionable {code}", status)

    class FailingService:
        def register(self, *_: object) -> tuple[str, str]:
            fail()

        def request_password_reset(self, *_: object) -> tuple[str | None, str | None]:
            fail()

    assert service_method in {"register", "request_password_reset"}
    monkeypatch.setattr(auth_api, "_service", lambda _: FailingService())
    monkeypatch.setattr(auth_api, "_require_mail", lambda: None)
    monkeypatch.setattr(auth_api, "_limit", lambda *_: None)
    app.dependency_overrides[deps.require_auth_bff] = lambda: None
    app.dependency_overrides[deps.get_user_repository] = lambda: None
    try:
        response = TestClient(app).post(f"/api/v1/auth{path}", json=body)
    finally:
        app.dependency_overrides.pop(deps.require_auth_bff, None)
        app.dependency_overrides.pop(deps.get_user_repository, None)

    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert response.json()["error"]["message"] == f"Actionable {code}"
    assert response.headers["cache-control"] == "no-store"
