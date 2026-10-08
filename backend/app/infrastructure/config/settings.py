"""Environment-backed application settings."""

import base64
from functools import lru_cache
from typing import Literal

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
    news_ingestion_enabled: bool = True
    news_ingestion_max_age_hours: int = Field(default=24 * 90, ge=1, le=24 * 365)
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
    auth_otp_seconds: Literal[90] = 90
    auth_reset_grant_seconds: int = Field(default=300, ge=60, le=900)
    auth_session_days: int = Field(default=30, ge=1, le=90)
    auth_google_client_id: str | None = None
    auth_google_client_secret: SecretStr | None = None
    auth_google_redirect_uri: str | None = None
    auth_mail_from: str | None = None
    auth_smtp_host: str | None = None
    auth_smtp_port: int = Field(default=587, ge=1, le=65535)
    auth_smtp_username: str | None = None
    auth_smtp_password: SecretStr | None = None
    auth_smtp_starttls: bool = True
    market_data_mode: Literal["disabled", "fixture", "tcbs", "vnstock"] = "disabled"
    market_public_cache_seconds: int = Field(default=30, ge=1, le=300)
    vnstock_api_key: SecretStr | None = None
    vnstock_refresh_seconds: int = Field(default=60, ge=30, le=900)
    vnstock_candle_cache_seconds: int = Field(default=300, ge=60, le=3600)
    vnstock_fundamental_cache_seconds: int = Field(default=3600, ge=300, le=86400)
    vnstock_max_symbols: int = Field(default=1800, ge=30, le=3000)
    tcbs_api_base_url: str = "https://openapi.tcbs.com.vn"
    tcbs_ws_url: str = "wss://openapi.tcbs.com.vn/ws/thesis/v1/stream/normal"
    tcbs_api_key: SecretStr | None = None
    tcbs_otp: SecretStr | None = None
    tcbs_access_token: SecretStr | None = None
    tcbs_request_timeout_seconds: float = Field(default=5.0, ge=1.0, le=15.0)
    tcbs_quote_refresh_seconds: float = Field(default=3.0, ge=1.0, le=30.0)
    tcbs_security_refresh_seconds: int = Field(default=21600, ge=300, le=86400)
    tcbs_http_retry_attempts: int = Field(default=3, ge=1, le=4)
    tcbs_circuit_failure_threshold: int = Field(default=5, ge=1, le=20)
    tcbs_circuit_open_seconds: int = Field(default=30, ge=5, le=300)

    @field_validator(
        "news_admin_token",
        "auth_bff_secret",
        "auth_jwt_secret",
        "auth_jwt_previous_secret",
        "auth_otp_hmac_key",
        "auth_payload_encryption_key",
        "auth_google_client_secret",
        "auth_smtp_password",
        "tcbs_api_key",
        "tcbs_otp",
        "tcbs_access_token",
        "vnstock_api_key",
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
            payload_length = (
                len(base64.urlsafe_b64decode(payload.get_secret_value())) if payload else 0
            )
        except (ValueError, TypeError):
            payload_length = 0
        if payload_length != 32:
            too_short.append("AUTH_PAYLOAD_ENCRYPTION_KEY")
        if too_short:
            raise RuntimeError(f"Authentication keys are invalid: {', '.join(too_short)}")

    def auth_mail_configured(self) -> bool:
        return bool(self.auth_mail_from and self.auth_smtp_host)

    def require_tcbs_configuration(self) -> None:
        if self.market_data_mode != "tcbs":
            raise RuntimeError("TCBS market data mode is not enabled")
        has_access_token = self.tcbs_access_token is not None
        has_exchange_pair = self.tcbs_api_key is not None and self.tcbs_otp is not None
        if not has_access_token and not has_exchange_pair:
            raise RuntimeError(
                "TCBS configuration requires TCBS_ACCESS_TOKEN or both TCBS_API_KEY and TCBS_OTP"
            )
        if self.tcbs_api_base_url != "https://openapi.tcbs.com.vn":
            raise RuntimeError("TCBS_API_BASE_URL must use the official HTTPS endpoint")
        if self.tcbs_ws_url != "wss://openapi.tcbs.com.vn/ws/thesis/v1/stream/normal":
            raise RuntimeError("TCBS_WS_URL must use the official WSS endpoint")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
