"""Persistence contract owned by the authentication domain/application boundary."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from app.domain.entities.user import User


class DuplicateEmailError(ValueError):
    """The email is already reserved by a user account."""


class PasswordResetAccountError(ValueError):
    """The email is unknown or belongs to an account without a password."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class IUserRepository(Protocol):
    def find_user_by_email(self, email: str) -> tuple[User, str | None] | None: ...
    def find_google_user(self, subject: str) -> User | None: ...
    def create_registration_challenge(
        self,
        *,
        pre_auth_id: str,
        email: str,
        display_name: str,
        password_hash: str,
        otp_digest: str,
        expires_at: datetime,
        resend_at: datetime,
        encrypted_mail_payload: str,
    ) -> tuple[str, str]: ...
    def resend_challenge(
        self,
        *,
        challenge_id: str,
        pre_auth_id: str,
        purpose: str,
        otp_digest: str,
        expires_at: datetime,
        resend_at: datetime,
        encrypted_mail_payload: str,
    ) -> str: ...
    def challenge_status(self, challenge_id: str, pre_auth_id: str) -> dict[str, object] | None: ...
    def verify_registration(
        self,
        challenge_id: str,
        pre_auth_id: str,
        otp_digest: str,
        now: datetime,
        encrypted_mail_payload: str,
    ) -> User | None: ...
    def authenticate(self, email: str) -> tuple[User, str | None] | None: ...
    def create_session(
        self,
        user: User,
        *,
        provider: str,
        refresh_hash: str,
        expires_at: datetime,
        idle_expires_at: datetime,
        session_id: str,
    ) -> None: ...
    def rotate_refresh(
        self,
        token_hash: str,
        new_hash: str,
        now: datetime,
        expires_at: datetime,
    ) -> User | None: ...
    def active_session_user(self, session_id: str, user_id: str, now: datetime) -> User | None: ...
    def revoke_session(self, session_id: str, now: datetime) -> None: ...
    def request_password_reset(
        self,
        *,
        pre_auth_id: str,
        email: str,
        otp_digest: str,
        expires_at: datetime,
        resend_at: datetime,
        encrypted_mail_payload: str,
    ) -> tuple[str | None, str | None]: ...
    def verify_reset_otp(
        self,
        challenge_id: str,
        pre_auth_id: str,
        otp_digest: str,
        now: datetime,
        grant_hash: str,
        grant_expires_at: datetime,
    ) -> str | None: ...
    def complete_password_reset(
        self,
        grant_hash: str,
        password_hash: str,
        now: datetime,
        encrypted_mail_payload: str,
    ) -> str | None: ...
    def reset_grant_email(self, grant_hash: str, now: datetime) -> str | None: ...
    def record_audit(
        self,
        event_type: str,
        outcome: str,
        actor_user_id: str | None = None,
        request_id: str | None = None,
    ) -> None: ...
    def create_google_user_or_login(
        self,
        *,
        subject: str,
        email: str,
        display_name: str,
        avatar_url: str | None,
        encrypted_mail_payload: str,
    ) -> tuple[User | None, str | None]: ...
