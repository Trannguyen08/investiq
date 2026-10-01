"""Role-protected account administration endpoints."""

from __future__ import annotations

import base64
import json
from datetime import UTC, datetime
from functools import lru_cache
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from app.api.deps import get_user_repository, require_auth_bff
from app.application.use_cases.admin.manage_users import ManageUsers
from app.infrastructure.config.settings import settings
from app.infrastructure.db.repositories.sql_user_repository import SqlUserRepository
from app.infrastructure.security.jwt_handler import JwtError, JwtHandler
from app.middleware.rate_limiter import AuthRateLimiter, RateLimitExceeded
from app.schemas.admin_users import AdminUserPage, AdminUserResponse, AdminUserUpdate


def _decode_cursor(value: str | None) -> tuple[datetime, str, str, int] | None:
    if not value:
        return None
    try:
        decoded = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        payload = json.loads(decoded)
        if not isinstance(payload, dict):
            raise ValueError
        created_at_value = payload.get("created_at")
        user_id_value = payload.get("id")
        direction = payload.get("direction")
        page = payload.get("page")
        if not isinstance(created_at_value, str) or not isinstance(user_id_value, str):
            raise ValueError
        if not isinstance(direction, str) or type(page) is not int:
            raise ValueError
        created_at = datetime.fromisoformat(created_at_value)
        user_id = str(UUID(user_id_value))
        if (
            created_at.tzinfo is None
            or direction not in {"after", "before"}
            or not 1 <= page <= 1_000_000
        ):
            raise ValueError
        return created_at, user_id, direction, page
    except (ValueError, TypeError, KeyError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=422, detail="Pagination cursor is invalid") from exc


def _encode_cursor(created_at: datetime, user_id: str, direction: str, page: int) -> str:
    payload = json.dumps(
        {
            "created_at": created_at.isoformat(),
            "id": user_id,
            "direction": direction,
            "page": page,
        },
        separators=(",", ":"),
    ).encode()
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")

router = APIRouter(
    prefix="/api/v1/admin/users",
    tags=["admin-users"],
    dependencies=[Depends(require_auth_bff)],
)


@lru_cache
def _admin_limiter() -> AuthRateLimiter:
    key = settings.auth_otp_hmac_key
    if key is None:
        raise RuntimeError("Administrator rate limit is not configured")
    return AuthRateLimiter(settings.redis_url, key.get_secret_value())


def _bearer(authorization: str | None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.casefold() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    return token


def _administrator(
    request: Request,
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    jwt_secret = settings.auth_jwt_secret
    if jwt_secret is None:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    try:
        claims = JwtHandler(
            jwt_secret.get_secret_value(),
            settings.auth_issuer,
            settings.auth_audience,
            settings.auth_access_token_seconds,
            settings.auth_jwt_previous_secret.get_secret_value()
            if settings.auth_jwt_previous_secret
            else None,
        ).verify(_bearer(authorization))
        actor = repository.active_session_user(
            str(claims["sid"]), str(claims["sub"]), datetime.now(UTC)
        )
    except (JwtError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired session") from exc
    if actor is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    if actor.role != "admin":
        repository.record_audit(
            "admin_user_access",
            "denied",
            actor.id,
            str(getattr(request.state, "request_id", "unknown")),
        )
        raise HTTPException(status_code=403, detail="Administrator role required")
    try:
        limit, window = (120, 60) if request.method == "GET" else (30, 60)
        _admin_limiter().check("admin-users", actor.id, limit, window)
    except RateLimitExceeded as exc:
        raise HTTPException(
            status_code=429,
            detail="Too many account administration requests",
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503, detail="Administrator protection is unavailable"
        ) from exc
    return actor.id


@router.get("", response_model=AdminUserPage)
def list_users(
    actor_id: Annotated[str, Depends(_administrator)],
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
    q: Annotated[str, Query(max_length=120)] = "",
    role: Annotated[str | None, Query(pattern="^(user|admin)$")] = None,
    account_status: Annotated[
        str | None, Query(alias="status", pattern="^(active|disabled)$")
    ] = None,
    provider: Annotated[str | None, Query(pattern="^(password|google)$")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: Annotated[str | None, Query(max_length=512)] = None,
) -> AdminUserPage:
    del actor_id
    decoded_cursor = _decode_cursor(cursor)
    items, total = ManageUsers(repository).list(
        query=q,
        role=role,
        status=account_status,
        provider=provider,
        limit=limit,
        cursor=decoded_cursor[:3] if decoded_cursor else None,
    )
    page = decoded_cursor[3] if decoded_cursor else 1
    page_count = max(1, (total + limit - 1) // limit)
    next_cursor = (
        _encode_cursor(items[-1]["created_at"], items[-1]["id"], "after", page + 1)
        if items and page < page_count
        else None
    )
    previous_cursor = (
        _encode_cursor(items[0]["created_at"], items[0]["id"], "before", page - 1)
        if items and page > 1
        else None
    )
    return AdminUserPage(
        items=[AdminUserResponse(**item) for item in items],
        total=total,
        limit=limit,
        page=page,
        next_cursor=next_cursor,
        previous_cursor=previous_cursor,
    )


@router.patch("/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: UUID,
    payload: AdminUserUpdate,
    request: Request,
    actor_id: Annotated[str, Depends(_administrator)],
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
) -> AdminUserResponse:
    if payload.role is None and payload.status is None:
        raise HTTPException(status_code=422, detail="At least one field must be updated")
    try:
        user = ManageUsers(repository).update(
            actor_id=actor_id,
            target_id=str(user_id),
            role=payload.role,
            status=payload.status,
            request_id=str(getattr(request.state, "request_id", "unknown")),
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return AdminUserResponse(**user)
