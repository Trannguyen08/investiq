"""Authentication use cases independent of HTTP, Redis and Celery delivery."""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from cryptography.fernet import Fernet, InvalidToken

from app.domain.entities.user import User
from app.domain.repositories.i_user_repository import IUserRepository
from app.infrastructure.security.jwt_handler import JwtHandler
from app.infrastructure.security.password_hasher import PasswordHasher

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
COMMON_PASSWORDS = {
    "passwordpassword",
    "123456789012345",
    "qwertyqwertyqwerty",
    "matkhau123456789",
}


class AuthError(ValueError):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class Credentials:
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime
    session_id: str
    user: User


class AuthService:
    def __init__(
        self,
        repository: IUserRepository,
        password_hasher: PasswordHasher,
        jwt_handler: JwtHandler,
        otp_key: str,
        payload_key: str,
        *,
        otp_seconds: int = 90,
        reset_grant_seconds: int = 300,
        session_hours: int = 12,
        remember_days: int = 30,
    ) -> None:
        if len(otp_key) < 32:
            raise ValueError("AUTH_OTP_HMAC_KEY must contain at least 32 characters")
        self._repository = repository
        self._passwords = password_hasher
        self._jwt = jwt_handler
        self._otp_key = otp_key.encode()
        try:
            self._cipher = Fernet(payload_key.encode())
        except (ValueError, TypeError) as exc:
            raise ValueError("AUTH_PAYLOAD_ENCRYPTION_KEY must be a Fernet key") from exc
        self._otp_seconds = otp_seconds
        self._reset_seconds = reset_grant_seconds
        self._session_hours = session_hours
        self._remember_days = remember_days

    @staticmethod
    def normalize_email(value: str) -> str:
        email = value.strip().casefold()
        if len(email) > 320 or not EMAIL_PATTERN.fullmatch(email):
            raise AuthError("INVALID_EMAIL", "Email không hợp lệ.", 422)
        return email

    @staticmethod
    def validate_display_name(value: str) -> str:
        name = " ".join(value.strip().split())
        if not 2 <= len(name) <= 80 or "<" in name or ">" in name:
            raise AuthError("INVALID_DISPLAY_NAME", "Tên hiển thị phải có từ 2 đến 80 ký tự.", 422)
        return name

    @staticmethod
    def validate_password(password: str, confirmation: str) -> str:
        if password != confirmation:
            raise AuthError("PASSWORD_MISMATCH", "Mật khẩu nhập lại không khớp.", 422)
        if not 15 <= len(password) <= 128:
            raise AuthError("WEAK_PASSWORD", "Mật khẩu phải có từ 15 đến 128 ký tự.", 422)
        if password.casefold() in COMMON_PASSWORDS:
            raise AuthError("WEAK_PASSWORD", "Mật khẩu này quá phổ biến.", 422)
        return password

    def _otp(self) -> str:
        return f"{secrets.randbelow(1_000_000):06d}"

    def _otp_digest(self, pre_auth_id: str, purpose: str, email: str, otp: str) -> str:
        value = f"{pre_auth_id}:{purpose}:{email}:{otp}".encode()
        return hmac.new(self._otp_key, value, hashlib.sha256).hexdigest()

    @staticmethod
    def _token_hash(value: str) -> str:
        return hashlib.sha256(value.encode()).hexdigest()

    def _encrypt_mail(self, template: str, email: str, **values: str) -> str:
        payload = json.dumps(
            {"template": template, "email": email, **values}, separators=(",", ":")
        )
        return self._cipher.encrypt(payload.encode()).decode()

    def decrypt_mail_payload(self, payload: str) -> dict[str, str]:
        try:
            value = json.loads(self._cipher.decrypt(payload.encode(), ttl=86400))
        except (InvalidToken, ValueError, TypeError, json.JSONDecodeError) as exc:
            raise AuthError("INVALID_MAIL_PAYLOAD", "Email payload is invalid") from exc
        if not isinstance(value, dict) or not all(
            isinstance(k, str) and isinstance(v, str) for k, v in value.items()
        ):
            raise AuthError("INVALID_MAIL_PAYLOAD", "Email payload is invalid")
        return value

    def register(
        self, pre_auth_id: str, email: str, display_name: str, password: str, confirmation: str
    ) -> tuple[str, str]:
        normalized = self.normalize_email(email)
        name = self.validate_display_name(display_name)
        self.validate_password(password, confirmation)
        otp = self._otp()
        now = datetime.now(UTC)
        challenge_id, job_id = self._repository.create_registration_challenge(
            pre_auth_id=pre_auth_id,
            email=normalized,
            display_name=name,
            password_hash=self._passwords.hash(password),
            otp_digest=self._otp_digest(pre_auth_id, "registration", normalized, otp),
            expires_at=now + timedelta(seconds=self._otp_seconds),
            resend_at=now + timedelta(seconds=30),
            encrypted_mail_payload=self._encrypt_mail("registration_otp", normalized, otp=otp),
        )
        return challenge_id, job_id

    def challenge_status(self, pre_auth_id: str, challenge_id: str) -> dict[str, object]:
        value = self._repository.challenge_status(challenge_id, pre_auth_id)
        if value is None:
            raise AuthError("CHALLENGE_NOT_FOUND", "Yêu cầu xác thực không tồn tại.", 404)
        email = str(value["email"])
        local, _, domain = email.partition("@")
        value["masked_email"] = f"{local[:2]}***@{domain}"
        value.pop("email", None)
        return value

    def resend(self, pre_auth_id: str, challenge_id: str, purpose: str) -> str:
        current = self._repository.challenge_status(challenge_id, pre_auth_id)
        if current is None or current.get("purpose") != purpose:
            raise AuthError("CHALLENGE_NOT_FOUND", "Yêu cầu xác thực không tồn tại.", 404)
        email = str(current["email"])
        otp = self._otp()
        now = datetime.now(UTC)
        try:
            return self._repository.resend_challenge(
                challenge_id=challenge_id,
                pre_auth_id=pre_auth_id,
                purpose=purpose,
                otp_digest=self._otp_digest(pre_auth_id, purpose, email, otp),
                expires_at=now + timedelta(seconds=self._otp_seconds),
                resend_at=now + timedelta(seconds=30),
                encrypted_mail_payload=self._encrypt_mail(f"{purpose}_otp", email, otp=otp),
            )
        except ValueError as exc:
            raise AuthError("RESEND_TOO_SOON", "Vui lòng chờ trước khi gửi lại mã.", 429) from exc

    def verify_registration(
        self, pre_auth_id: str, challenge_id: str, otp: str, remember: bool
    ) -> Credentials:
        if not re.fullmatch(r"\d{6}", otp):
            raise AuthError("INVALID_OTP", "Mã OTP không hợp lệ.", 401)
        current = self._repository.challenge_status(challenge_id, pre_auth_id)
        if current is None:
            raise AuthError("INVALID_OTP", "Mã OTP không hợp lệ hoặc đã hết hạn.", 401)
        email = str(current["email"])
        now = datetime.now(UTC)
        user = self._repository.verify_registration(
            challenge_id,
            pre_auth_id,
            self._otp_digest(pre_auth_id, "registration", email, otp),
            now,
            self._encrypt_mail(
                "registration_success", email, display_name=str(current.get("display_name") or "")
            ),
        )
        if user is None:
            self._repository.record_audit("registration_verify", "denied")
            raise AuthError("INVALID_OTP", "Mã OTP không hợp lệ hoặc đã hết hạn.", 401)
        self._repository.record_audit("registration_verify", "success", user.id)
        return self._new_session(user, "password", remember)

    def login(self, email: str, password: str, remember: bool) -> Credentials:
        normalized = self.normalize_email(email)
        found = self._repository.authenticate(normalized)
        valid = bool(found and found[1] and self._passwords.verify(found[1], password))
        if not valid:
            self._passwords.hash("constant-time-dummy-password-value") if found is None else None
            self._repository.record_audit("login", "denied")
            raise AuthError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.", 401)
        assert found is not None
        user = found[0]
        if user.status != "active" or user.email_verified_at is None:
            self._repository.record_audit("login", "denied", user.id)
            raise AuthError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.", 401)
        credentials = self._new_session(user, "password", remember)
        self._repository.record_audit("login", "success", user.id)
        return credentials

    def _new_session(self, user: User, provider: str, remember: bool) -> Credentials:
        now = datetime.now(UTC)
        session_id = str(uuid4())
        refresh_token = f"{session_id}.{secrets.token_urlsafe(48)}"
        refresh_expires = now + (
            timedelta(days=self._remember_days)
            if remember
            else timedelta(hours=self._session_hours)
        )
        idle_expires = min(
            refresh_expires, now + (timedelta(days=7) if remember else timedelta(hours=2))
        )
        self._repository.create_session(
            user,
            provider=provider,
            remember=remember,
            refresh_hash=self._token_hash(refresh_token),
            expires_at=refresh_expires,
            idle_expires_at=idle_expires,
            session_id=session_id,
        )
        access, access_expires = self._jwt.issue(user.id, session_id, user.role)
        return Credentials(access, access_expires, refresh_token, refresh_expires, session_id, user)

    def refresh(self, refresh_token: str) -> Credentials:
        session_id, separator, _ = refresh_token.partition(".")
        if not separator:
            raise AuthError("INVALID_SESSION", "Phiên đăng nhập không hợp lệ.", 401)
        new_refresh = f"{session_id}.{secrets.token_urlsafe(48)}"
        now = datetime.now(UTC)
        expires = now + timedelta(days=self._remember_days)
        user = self._repository.rotate_refresh(
            self._token_hash(refresh_token), self._token_hash(new_refresh), now, expires
        )
        if user is None:
            self._repository.record_audit("refresh", "denied")
            raise AuthError("INVALID_SESSION", "Phiên đăng nhập đã hết hạn.", 401)
        access, access_expires = self._jwt.issue(user.id, session_id, user.role)
        self._repository.record_audit("refresh", "success", user.id)
        return Credentials(access, access_expires, new_refresh, expires, session_id, user)

    def current_user(self, access_token: str) -> User:
        claims = self._jwt.verify(access_token)
        user = self._repository.active_session_user(
            str(claims["sid"]), str(claims["sub"]), datetime.now(UTC)
        )
        if user is None:
            raise AuthError("INVALID_SESSION", "Phiên đăng nhập đã hết hạn.", 401)
        return user

    def logout(self, access_token: str) -> None:
        claims = self._jwt.verify(access_token)
        self._repository.revoke_session(str(claims["sid"]), datetime.now(UTC))
        self._repository.record_audit("logout", "success", str(claims["sub"]))

    def request_password_reset(self, pre_auth_id: str, email: str) -> tuple[str | None, str | None]:
        normalized = self.normalize_email(email)
        otp = self._otp()
        now = datetime.now(UTC)
        return self._repository.request_password_reset(
            pre_auth_id=pre_auth_id,
            email=normalized,
            otp_digest=self._otp_digest(pre_auth_id, "password_reset", normalized, otp),
            expires_at=now + timedelta(seconds=self._otp_seconds),
            resend_at=now + timedelta(seconds=30),
            encrypted_mail_payload=self._encrypt_mail("password_reset_otp", normalized, otp=otp),
        )

    def verify_password_reset(self, pre_auth_id: str, challenge_id: str, otp: str) -> str:
        current = self._repository.challenge_status(challenge_id, pre_auth_id)
        if current is None or not re.fullmatch(r"\d{6}", otp):
            raise AuthError("INVALID_OTP", "Mã OTP không hợp lệ hoặc đã hết hạn.", 401)
        grant = secrets.token_urlsafe(48)
        now = datetime.now(UTC)
        result = self._repository.verify_reset_otp(
            challenge_id,
            pre_auth_id,
            self._otp_digest(pre_auth_id, "password_reset", str(current["email"]), otp),
            now,
            self._token_hash(grant),
            now + timedelta(seconds=self._reset_seconds),
        )
        if result is None:
            raise AuthError("INVALID_OTP", "Mã OTP không hợp lệ hoặc đã hết hạn.", 401)
        return grant

    def complete_password_reset(self, grant: str, password: str, confirmation: str) -> str | None:
        self.validate_password(password, confirmation)
        now = datetime.now(UTC)
        grant_hash = self._token_hash(grant)
        email = self._repository.reset_grant_email(grant_hash, now)
        if email is None:
            self._repository.record_audit("password_reset", "denied")
            raise AuthError("INVALID_RESET_GRANT", "Quyền đổi mật khẩu đã hết hạn.", 401)
        job_id = self._repository.complete_password_reset(
            grant_hash,
            self._passwords.hash(password),
            now,
            self._encrypt_mail("password_changed", email),
        )
        if job_id is None:
            self._repository.record_audit("password_reset", "denied")
            raise AuthError("INVALID_RESET_GRANT", "Quyền đổi mật khẩu đã hết hạn.", 401)
        self._repository.record_audit("password_reset", "success")
        return job_id

    def google_login(
        self,
        *,
        subject: str,
        email: str,
        display_name: str,
        avatar_url: str | None,
        remember: bool,
    ) -> tuple[Credentials, str | None]:
        normalized = self.normalize_email(email)
        name = self.validate_display_name(display_name)
        user, job_id = self._repository.create_google_user_or_login(
            subject=subject,
            email=normalized,
            display_name=name,
            avatar_url=avatar_url,
            encrypted_mail_payload=self._encrypt_mail(
                "registration_success", normalized, display_name=name
            ),
        )
        if user is None:
            self._repository.record_audit("google_login", "denied")
            raise AuthError(
                "ACCOUNT_METHOD_CONFLICT",
                "Email này đã dùng phương thức đăng nhập khác. "
                "Vui lòng đăng nhập bằng phương thức hiện có.",
                409,
            )
        if user.status != "active" or user.email_verified_at is None:
            self._repository.record_audit("google_login", "denied", user.id)
            raise AuthError("INVALID_CREDENTIALS", "Tài khoản không thể đăng nhập.", 401)
        credentials = self._new_session(user, "google", remember)
        self._repository.record_audit("google_login", "success", user.id)
        return credentials, job_id

    @staticmethod
    def user_data(user: User) -> dict[str, object]:
        return asdict(user)
