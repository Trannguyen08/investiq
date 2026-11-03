"""Unit tests for admin JWT security enforcement, role checks, and cache."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException, status

from app.api.deps import require_admin_user
from app.domain.entities.user import User
from app.infrastructure.cache.admin_cache import AdminCache
from app.infrastructure.config.settings import settings
from app.infrastructure.security.jwt_handler import JwtHandler


@pytest.fixture
def test_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        settings,
        "auth_jwt_secret",
        MagicMock(get_secret_value=lambda: "x" * 32),
    )
    monkeypatch.setattr(settings, "auth_issuer", "investiq-test")
    monkeypatch.setattr(settings, "auth_audience", "investiq-api-test")
    monkeypatch.setattr(settings, "auth_access_token_seconds", 300)


def test_require_admin_user_rejects_missing_bearer(test_settings: None) -> None:
    request = MagicMock()
    repo = MagicMock()
    with pytest.raises(HTTPException) as exc:
        require_admin_user(request, repo, authorization=None)
    assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED


def test_require_admin_user_rejects_user_role_in_token(test_settings: None) -> None:
    jwt = JwtHandler("x" * 32, "investiq-test", "investiq-api-test", 300)
    token, _ = jwt.issue(str(uuid4()), str(uuid4()), role="user")

    request = MagicMock()
    repo = MagicMock()

    with pytest.raises(HTTPException) as exc:
        require_admin_user(request, repo, authorization=f"Bearer {token}")
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert "Administrator role required in token" in exc.value.detail


def test_require_admin_user_accepts_admin_role_and_active_session(
    test_settings: None,
) -> None:
    jwt = JwtHandler("x" * 32, "investiq-test", "investiq-api-test", 300)
    user_id = str(uuid4())
    session_id = str(uuid4())
    token, _ = jwt.issue(user_id, session_id, role="admin")

    request = MagicMock()
    repo = MagicMock()
    repo.active_session_user.return_value = User(
        id=user_id,
        email="admin@investiq.vn",
        display_name="System Admin",
        role="admin",
        status="active",
        email_verified_at=None,
    )

    resolved_id = require_admin_user(request, repo, authorization=f"Bearer {token}")
    assert resolved_id == user_id


def test_require_admin_user_rejects_revoked_or_disabled_admin(
    test_settings: None,
) -> None:
    jwt = JwtHandler("x" * 32, "investiq-test", "investiq-api-test", 300)
    user_id = str(uuid4())
    token, _ = jwt.issue(user_id, str(uuid4()), role="admin")

    request = MagicMock()
    repo = MagicMock()
    repo.active_session_user.return_value = None  # session revoked or user not found

    with pytest.raises(HTTPException) as exc:
        require_admin_user(request, repo, authorization=f"Bearer {token}")
    assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED


def test_admin_cache_in_memory_fallback() -> None:
    # Use invalid redis client to test fallback
    cache = AdminCache(client=MagicMock(get=MagicMock(side_effect=Exception("Redis down"))))
    cache.set("test_key", {"kpi": 42}, ttl_seconds=60)
    val = cache.get("test_key")
    assert val == {"kpi": 42}

    cache.invalidate("test_key")
    assert cache.get("test_key") is None
