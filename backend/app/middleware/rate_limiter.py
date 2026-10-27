"""Shared Redis fixed-window limiter for authentication abuse controls."""

import hashlib
import hmac
import logging
import threading
import time
from typing import cast

from redis import Redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


class RateLimitExceeded(ValueError):
    def __init__(self, retry_after: int) -> None:
        super().__init__("Rate limit exceeded")
        self.retry_after = max(1, retry_after)


class AuthRateLimiter:
    def __init__(self, redis_url: str, key_secret: str) -> None:
        self._client = Redis.from_url(redis_url, socket_connect_timeout=1, socket_timeout=1)
        self._secret = key_secret.encode()
        self._local_lock = threading.Lock()
        self._local_buckets: dict[str, tuple[int, float]] = {}

    def _check_local(self, key: str, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        with self._local_lock:
            # Purge expired buckets periodically if dictionary grows
            if len(self._local_buckets) > 1000:
                expired = [
                    k
                    for k, (_, start) in self._local_buckets.items()
                    if now - start >= window_seconds
                ]
                for k in expired:
                    del self._local_buckets[k]

            count, start_time = self._local_buckets.get(key, (0, now))
            if now - start_time >= window_seconds:
                count = 1
                start_time = now
            else:
                count += 1
            self._local_buckets[key] = (count, start_time)
            ttl = max(1, int(window_seconds - (now - start_time)))

        if count > limit:
            raise RateLimitExceeded(ttl)

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
        except RedisError:
            logger.warning("Auth rate limiter Redis unavailable; using process-local limiter")
            self._check_local(key, limit, window_seconds)
            return

        if int(count) > limit:
            raise RateLimitExceeded(int(ttl))
