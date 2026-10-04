"""FastAPI dependency composition."""

import hmac
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.domain.repositories.i_news_repository import INewsRepository
from app.infrastructure.config.settings import settings
from app.infrastructure.db.repositories.sql_news_repository import SqlNewsRepository
from app.infrastructure.db.repositories.sql_user_repository import SqlUserRepository
from app.infrastructure.db.session import get_pool
from app.infrastructure.security.jwt_handler import JwtError, JwtHandler


def get_news_repository() -> Iterator[INewsRepository]:
    yield SqlNewsRepository(get_pool())


def require_news_admin(authorization: str | None = Header(default=None)) -> None:
    configured = settings.news_admin_token
    if configured is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="News administration is not configured",
        )
    scheme, _, supplied = (authorization or "").partition(" ")
    if scheme.casefold() != "bearer" or not hmac.compare_digest(
        supplied, configured.get_secret_value()
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid news administration credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_auth_bff(x_bff_secret: str | None = Header(default=None)) -> None:
    try:
        settings.require_auth_secrets()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Authentication is not configured") from exc
    configured = settings.auth_bff_secret
    assert configured is not None
    if not x_bff_secret or not hmac.compare_digest(x_bff_secret, configured.get_secret_value()):
        raise HTTPException(status_code=401, detail="Invalid authentication service credentials")


def get_user_repository() -> Iterator[SqlUserRepository]:
    yield SqlUserRepository(get_pool())


def authenticated_user_id(
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """Resolve an active user from the BFF-forwarded, verified bearer session."""
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.casefold() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    secret = settings.auth_jwt_secret
    if secret is None:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    try:
        claims = JwtHandler(
            secret.get_secret_value(),
            settings.auth_issuer,
            settings.auth_audience,
            settings.auth_access_token_seconds,
            settings.auth_jwt_previous_secret.get_secret_value()
            if settings.auth_jwt_previous_secret
            else None,
        ).verify(token)
        user = repository.active_session_user(
            str(claims["sid"]), str(claims["sub"]), datetime.now(UTC)
        )
    except (JwtError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired session") from exc
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user.id
