"""Environment-backed application settings."""

from functools import lru_cache

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


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
