"""BFF-only authentication API; browser credentials never cross this boundary."""

from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from typing import Annotated, cast
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response

from app.api.deps import get_user_repository, require_auth_bff
from app.application.use_cases.auth.auth_service import AuthError, AuthService, Credentials
from app.domain.entities.user import User
from app.infrastructure.config.settings import settings
from app.infrastructure.db.repositories.sql_user_repository import SqlUserRepository
from app.infrastructure.external.google_oidc import GoogleOidcClient, GoogleOidcError
from app.infrastructure.security.jwt_handler import JwtHandler
from app.infrastructure.security.password_hasher import PasswordHasher
from app.middleware.rate_limiter import AuthRateLimiter, RateLimitExceeded
from app.schemas.auth import (
    ChallengeResponse,
    ChallengeStatusResponse,
    CredentialsResponse,
    GoogleExchangeRequest,
    LoginRequest,
    PasswordResetCompleteRequest,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    ResendRequest,
    ResetGrantResponse,
    UserResponse,
    VerifyOtpRequest,
)

router = APIRouter(
    prefix="/api/v1/auth", tags=["authentication"], dependencies=[Depends(require_auth_bff)]
)


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@lru_cache
def _limiter() -> AuthRateLimiter:
    key = settings.auth_otp_hmac_key
    assert key is not None
    return AuthRateLimiter(settings.redis_url, key.get_secret_value())


def _limit(request: Request, scope: str, identity: str, limit: int, window: int) -> None:
    try:
        _limiter().check(scope, f"{_client_ip(request)}:{identity}", limit, window)
    except RateLimitExceeded as exc:
        raise HTTPException(
            429, "Vui lòng thử lại sau.", headers={"Retry-After": str(exc.retry_after)}
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(503, "Authentication protection is temporarily unavailable") from exc


def _require_mail() -> None:
    if not settings.auth_mail_configured():
        raise HTTPException(503, "Authentication email is not configured")


def _service(repository: SqlUserRepository) -> AuthService:
    jwt_secret = settings.auth_jwt_secret
    otp_key = settings.auth_otp_hmac_key
    payload_key = settings.auth_payload_encryption_key
    assert jwt_secret is not None and otp_key is not None and payload_key is not None
    return AuthService(
        repository,
        PasswordHasher(),
        JwtHandler(
            jwt_secret.get_secret_value(),
            settings.auth_issuer,
            settings.auth_audience,
            settings.auth_access_token_seconds,
            settings.auth_jwt_previous_secret.get_secret_value()
            if settings.auth_jwt_previous_secret
            else None,
        ),
        otp_key.get_secret_value(),
        payload_key.get_secret_value(),
        otp_seconds=settings.auth_otp_seconds,
        reset_grant_seconds=settings.auth_reset_grant_seconds,
        session_hours=settings.auth_session_hours,
        remember_days=settings.auth_remember_session_days,
    )


def _user(value: User) -> UserResponse:
    return UserResponse(
        id=value.id,
        email=value.email,
        display_name=value.display_name,
        role=value.role,
        provider=value.provider,
        avatar_url=value.avatar_url,
    )


def _credentials(value: Credentials) -> CredentialsResponse:
    return CredentialsResponse(
        access_token=value.access_token,
        access_expires_at=value.access_expires_at,
        refresh_token=value.refresh_token,
        refresh_expires_at=value.refresh_expires_at,
        session_id=value.session_id,
        user=_user(value.user),
    )


def _bearer(authorization: str | None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.casefold() != "bearer" or not token:
        raise AuthError("INVALID_SESSION", "Phiên đăng nhập không hợp lệ.", 401)
    return token


@router.post("/register", response_model=ChallengeResponse, status_code=202)
def register(
    body: RegisterRequest,
    request: Request,
    response: Response,
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
) -> ChallengeResponse:
    _private(response)
    _require_mail()
    _limit(request, "register", body.email.casefold(), 5, 3600)
    challenge_id, _ = _service(repository).register(
        body.pre_auth_id, body.email, body.display_name, body.password, body.password_confirmation
    )
    return ChallengeResponse(
        challenge_id=challenge_id, email_queued=True, expires_in=settings.auth_otp_seconds
    )


@router.get("/challenges/current", response_model=ChallengeStatusResponse)
def challenge_status(
    response: Response,
    pre_auth_id: Annotated[str, Query(min_length=36, max_length=36)],
    challenge_id: Annotated[str, Query(min_length=36, max_length=36)],
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
) -> ChallengeStatusResponse:
    _private(response)
    value = _service(repository).challenge_status(pre_auth_id, challenge_id)
    return ChallengeStatusResponse(
        challenge_id=str(value["id"]),
        purpose=str(value["purpose"]),
        masked_email=str(value["masked_email"]),
        delivery_status=str(value["delivery_status"]),
        expires_at=cast(datetime, value["expires_at"]),
        resend_available_at=cast(datetime, value["resend_available_at"]),
        consumed=value["consumed_at"] is not None,
    )


@router.post("/challenges/resend", status_code=202)
def resend(
    body: ResendRequest,
    request: Request,
    response: Response,
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
) -> dict[str, bool]:
    _private(response)
    _require_mail()
    _limit(request, "resend", body.challenge_id, 5, 3600)
    _service(repository).resend(body.pre_auth_id, body.challenge_id, body.purpose)
    return {"accepted": True}


@router.post("/email-verification/verify", response_model=CredentialsResponse, status_code=201)
def verify_email(
    body: VerifyOtpRequest,
    request: Request,
    response: Response,
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
) -> CredentialsResponse:
    _private(response)
    _limit(request, "verify", body.challenge_id, 10, 900)
    return _credentials(
        _service(repository).verify_registration(
            body.pre_auth_id, body.challenge_id, body.otp, body.remember_session
        )
    )


@router.post("/login", response_model=CredentialsResponse)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
) -> CredentialsResponse:
    _private(response)
    _limit(request, "login", body.email.casefold(), 10, 900)
    return _credentials(
        _service(repository).login(body.email, body.password, body.remember_session)
    )


@router.post("/refresh", response_model=CredentialsResponse)
def refresh(
    body: RefreshRequest,
    request: Request,
    response: Response,
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
) -> CredentialsResponse:
    _private(response)
    _limit(request, "refresh", body.refresh_token, 30, 900)
    return _credentials(_service(repository).refresh(body.refresh_token))


@router.get("/me", response_model=UserResponse)
def me(
    response: Response,
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
    authorization: Annotated[str | None, Header()] = None,
) -> UserResponse:
    _private(response)
    return _user(_service(repository).current_user(_bearer(authorization)))


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    _private(response)
    _service(repository).logout(_bearer(authorization))


@router.post("/password-reset/request", response_model=ChallengeResponse, status_code=202)
def request_reset(
    body: PasswordResetRequest,
    request: Request,
    response: Response,
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
) -> ChallengeResponse:
    _private(response)
    _require_mail()
    _limit(request, "reset", body.email.casefold(), 5, 3600)
    challenge_id, _ = _service(repository).request_password_reset(body.pre_auth_id, body.email)
    return ChallengeResponse(
        challenge_id=challenge_id or str(uuid4()),
        email_queued=True,
        expires_in=settings.auth_otp_seconds,
    )


@router.post("/password-reset/verify", response_model=ResetGrantResponse)
def verify_reset(
    body: VerifyOtpRequest,
    request: Request,
    response: Response,
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
) -> ResetGrantResponse:
    _private(response)
    _limit(request, "reset-verify", body.challenge_id, 10, 900)
    return ResetGrantResponse(
        reset_grant=_service(repository).verify_password_reset(
            body.pre_auth_id, body.challenge_id, body.otp
        )
    )


@router.post("/password-reset/complete", status_code=204)
def complete_reset(
    body: PasswordResetCompleteRequest,
    request: Request,
    response: Response,
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
) -> None:
    _private(response)
    _limit(request, "reset-complete", body.reset_grant, 10, 900)
    _service(repository).complete_password_reset(
        body.reset_grant, body.password, body.password_confirmation
    )


@router.post("/google/exchange", response_model=CredentialsResponse)
def google_exchange(
    body: GoogleExchangeRequest,
    request: Request,
    response: Response,
    repository: Annotated[SqlUserRepository, Depends(get_user_repository)],
) -> CredentialsResponse:
    _private(response)
    _limit(request, "google", _client_ip(request), 10, 900)
    secret = settings.auth_google_client_secret
    if not settings.auth_google_client_id or not secret or not settings.auth_google_redirect_uri:
        raise HTTPException(503, "Google authentication is not configured")
    try:
        identity = GoogleOidcClient(
            settings.auth_google_client_id,
            secret.get_secret_value(),
            settings.auth_google_redirect_uri,
        ).exchange(body.code, body.code_verifier, body.nonce)
    except GoogleOidcError as exc:
        raise AuthError("GOOGLE_AUTH_FAILED", "Không thể xác minh tài khoản Google.", 401) from exc
    credentials, _ = _service(repository).google_login(
        subject=identity.subject,
        email=identity.email,
        display_name=identity.display_name,
        avatar_url=identity.avatar_url,
        remember=body.remember_session,
    )
    return _credentials(credentials)
