"""Environment-backed application settings."""

import base64
from functools import lru_cache

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration supplied by Compose or the host environment."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "InvestIQ API"
    app_env: str = "development"
    service_name: str = "backend"
    log_level: str = "INFO"
    database_url: str = "postgresql://investiq:investiq@localhost:5432/investiq"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    secret_key: str = "local-development-key-change-before-deployment"
    database_pool_min_size: int = 1
    database_pool_max_size: int = 5
    news_ingestion_enabled: bool = False
    news_ingestion_max_age_hours: int = Field(default=72, ge=1, le=24 * 30)
    news_retention_days: int = Field(default=90, ge=7, le=3650)
    news_provider_requests_per_minute: int = Field(default=30, ge=1, le=600)
    news_provider_circuit_failure_threshold: int = Field(default=5, ge=1, le=50)
    news_provider_circuit_open_seconds: int = Field(default=120, ge=10, le=3600)
    news_admin_token: SecretStr | None = None
    auth_enabled: bool = False
    auth_bff_secret: SecretStr | None = None
    auth_jwt_secret: SecretStr | None = None
    auth_jwt_previous_secret: SecretStr | None = None
    auth_otp_hmac_key: SecretStr | None = None
    auth_payload_encryption_key: SecretStr | None = None
    auth_issuer: str = "investiq"
    auth_audience: str = "investiq-api"
    auth_access_token_seconds: int = Field(default=300, ge=60, le=900)
    auth_otp_seconds: int = Field(default=90, ge=60, le=600)
    auth_reset_grant_seconds: int = Field(default=300, ge=60, le=900)
    auth_session_hours: int = Field(default=12, ge=1, le=24)
    auth_remember_session_days: int = Field(default=30, ge=1, le=90)
    auth_google_client_id: str | None = None
    auth_google_client_secret: SecretStr | None = None
    auth_google_redirect_uri: str | None = None
    auth_mail_from: str | None = None
    auth_smtp_host: str | None = None
    auth_smtp_port: int = Field(default=587, ge=1, le=65535)
    auth_smtp_username: str | None = None
    auth_smtp_password: SecretStr | None = None
    auth_smtp_starttls: bool = True

    @field_validator(
        "news_admin_token",
        "auth_bff_secret",
        "auth_jwt_secret",
        "auth_jwt_previous_secret",
        "auth_otp_hmac_key",
        "auth_payload_encryption_key",
        "auth_google_client_secret",
        "auth_smtp_password",
        mode="before",
    )
    @classmethod
    def empty_admin_token_is_disabled(cls, value: object) -> object:
        return None if value == "" else value

    @field_validator(
        "auth_google_client_id",
        "auth_google_redirect_uri",
        "auth_mail_from",
        "auth_smtp_host",
        "auth_smtp_username",
        mode="before",
    )
    @classmethod
    def empty_auth_text_is_disabled(cls, value: object) -> object:
        return None if value == "" else value

    def require_auth_secrets(self) -> None:
        if not self.auth_enabled:
            raise RuntimeError("Authentication is disabled")
        required = {
            "AUTH_BFF_SECRET": self.auth_bff_secret,
            "AUTH_JWT_SECRET": self.auth_jwt_secret,
            "AUTH_OTP_HMAC_KEY": self.auth_otp_hmac_key,
            "AUTH_PAYLOAD_ENCRYPTION_KEY": self.auth_payload_encryption_key,
        }
        missing = [name for name, value in required.items() if value is None]
        if missing:
            raise RuntimeError(f"Authentication configuration is incomplete: {', '.join(missing)}")
        too_short = [
            name
            for name, value in required.items()
            if name != "AUTH_PAYLOAD_ENCRYPTION_KEY"
            and value is not None
            and len(value.get_secret_value()) < 32
        ]
        payload = self.auth_payload_encryption_key
        try:
            payload_length = len(
                base64.urlsafe_b64decode(payload.get_secret_value())
            ) if payload else 0
        except (ValueError, TypeError):
            payload_length = 0
        if payload_length != 32:
            too_short.append("AUTH_PAYLOAD_ENCRYPTION_KEY")
        if too_short:
            raise RuntimeError(
                f"Authentication keys are invalid: {', '.join(too_short)}"
            )

    def auth_mail_configured(self) -> bool:
        return bool(self.auth_mail_from and self.auth_smtp_host)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
