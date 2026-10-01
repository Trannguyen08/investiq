"""Shared Redis fixed-window limiter for authentication abuse controls."""

import hashlib
import hmac
from typing import cast

from redis import Redis
from redis.exceptions import RedisError


class RateLimitExceeded(ValueError):
    def __init__(self, retry_after: int) -> None:
        super().__init__("Rate limit exceeded")
        self.retry_after = max(1, retry_after)


class AuthRateLimiter:
    def __init__(self, redis_url: str, key_secret: str) -> None:
        self._client = Redis.from_url(redis_url, socket_connect_timeout=1, socket_timeout=1)
        self._secret = key_secret.encode()

    def check(self, scope: str, identity: str, limit: int, window_seconds: int) -> None:
        digest = hmac.new(self._secret, identity.encode(), hashlib.sha256).hexdigest()
        key = f"auth-rate:{scope}:{digest}"
        try:
            count, ttl = cast(
                tuple[int, int],
                self._client.eval(
                    """
                    local count = redis.call('INCR', KEYS[1])
                    if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
                    return {count, redis.call('TTL', KEYS[1])}
                    """,
                    1,
                    key,
                    str(window_seconds),
                ),
            )
        except RedisError as exc:
            raise RuntimeError("Authentication rate limiter is unavailable") from exc
        if int(count) > limit:
            raise RateLimitExceeded(int(ttl))
