"""Distributed outbound rate limiting and circuit breaking for news providers."""

from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict, deque
from functools import lru_cache
from typing import cast

from redis import Redis
from redis.exceptions import RedisError

from app.infrastructure.config.settings import settings

logger = logging.getLogger("investiq.news.provider_guard")


class ProviderRateLimited(RuntimeError):
    pass


class ProviderCircuitOpen(RuntimeError):
    pass


class ProviderGuard:
    """Coordinate provider budgets across workers, with a bounded local fallback."""

    _BEFORE_SCRIPT = """
    local open_until = tonumber(redis.call('GET', KEYS[1]) or '0')
    if open_until > tonumber(ARGV[1]) then return -1 end
    local count = redis.call('INCR', KEYS[2])
    if count == 1 then redis.call('EXPIRE', KEYS[2], ARGV[3]) end
    if count > tonumber(ARGV[2]) then return -2 end
    return count
    """
    _FAILURE_SCRIPT = """
    local failures = redis.call('INCR', KEYS[1])
    redis.call('EXPIRE', KEYS[1], ARGV[3])
    if failures >= tonumber(ARGV[1]) then
      redis.call('SET', KEYS[2], tonumber(ARGV[2]) + tonumber(ARGV[3]), 'EX', ARGV[3])
      redis.call('DEL', KEYS[1])
    end
    return failures
    """

    def __init__(self, redis: Redis | None = None) -> None:
        self._redis = redis or Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
            decode_responses=True,
        )
        self._lock = threading.Lock()
        self._local_requests: dict[str, deque[float]] = defaultdict(deque)
        self._local_failures: dict[str, int] = defaultdict(int)
        self._local_open_until: dict[str, float] = {}
        self._redis_broken_until: float = 0.0

    def before_request(self, provider: str) -> None:
        now = int(time.time())
        bucket = now // 60
        mono = time.monotonic()

        if mono < self._redis_broken_until:
            self._before_local(provider, float(now))
            return

        try:
            result = int(
                cast(
                    str | bytes | int,
                    self._redis.eval(
                        self._BEFORE_SCRIPT,
                        2,
                        f"news:provider:{provider}:open",
                        f"news:provider:{provider}:rate:{bucket}",
                        str(now),
                        str(settings.news_provider_requests_per_minute),
                        "70",
                    ),
                )
            )
        except RedisError:
            self._redis_broken_until = mono + 30.0
            logger.warning("Provider guard Redis unavailable; entering 30s local guard mode")
            self._before_local(provider, float(now))
            return
        if result == -1:
            raise ProviderCircuitOpen("provider circuit is temporarily open")
        if result == -2:
            raise ProviderRateLimited("provider request budget is exhausted")

    def record_success(self, provider: str) -> None:
        mono = time.monotonic()
        if mono >= self._redis_broken_until:
            try:
                self._redis.delete(f"news:provider:{provider}:failures")
                return
            except RedisError:
                self._redis_broken_until = mono + 30.0
        with self._lock:
            self._local_failures.pop(provider, None)

    def record_failure(self, provider: str) -> None:
        now = int(time.time())
        mono = time.monotonic()
        if mono >= self._redis_broken_until:
            try:
                self._redis.eval(
                    self._FAILURE_SCRIPT,
                    2,
                    f"news:provider:{provider}:failures",
                    f"news:provider:{provider}:open",
                    str(settings.news_provider_circuit_failure_threshold),
                    str(now),
                    str(settings.news_provider_circuit_open_seconds),
                )
                return
            except RedisError:
                self._redis_broken_until = mono + 30.0
        with self._lock:
            self._local_failures[provider] += 1
            if self._local_failures[provider] >= settings.news_provider_circuit_failure_threshold:
                self._local_open_until[provider] = now + settings.news_provider_circuit_open_seconds
                self._local_failures[provider] = 0

    def _before_local(self, provider: str, now: float) -> None:
        with self._lock:
            if self._local_open_until.get(provider, 0.0) > now:
                raise ProviderCircuitOpen("provider circuit is temporarily open")
            queue = self._local_requests[provider]
            while queue and now - queue[0] >= 60.0:
                queue.popleft()
            if len(queue) >= settings.news_provider_requests_per_minute:
                raise ProviderRateLimited("provider request budget is exhausted")
            queue.append(now)


@lru_cache
def get_provider_guard() -> ProviderGuard:
    return ProviderGuard()
