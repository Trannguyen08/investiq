"""Environment-backed application settings."""

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

    @field_validator("news_admin_token", mode="before")
    @classmethod
    def empty_admin_token_is_disabled(cls, value: object) -> object:
        return None if value == "" else value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
