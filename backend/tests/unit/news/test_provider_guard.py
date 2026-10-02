import pytest
from redis.exceptions import RedisError

from app.infrastructure.config.settings import settings
from app.infrastructure.external.provider_guard import (
    ProviderCircuitOpen,
    ProviderGuard,
    ProviderRateLimited,
)


class UnavailableRedis:
    def eval(self, *_: object) -> object:
        raise RedisError("unavailable")

    def delete(self, *_: object) -> object:
        raise RedisError("unavailable")


def test_local_fallback_enforces_provider_request_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "news_provider_requests_per_minute", 1)
    guard = ProviderGuard(UnavailableRedis())  # type: ignore[arg-type]

    guard.before_request("example.com")

    with pytest.raises(ProviderRateLimited):
        guard.before_request("example.com")


def test_local_fallback_opens_circuit_after_repeated_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "news_provider_circuit_failure_threshold", 2)
    guard = ProviderGuard(UnavailableRedis())  # type: ignore[arg-type]

    guard.record_failure("example.com")
    guard.record_failure("example.com")

    with pytest.raises(ProviderCircuitOpen):
        guard.before_request("example.com")
