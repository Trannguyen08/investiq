"""Short-lived cache for public market read models."""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from functools import lru_cache

from redis import Redis
from redis.exceptions import RedisError

from app.infrastructure.config.settings import settings

logger = logging.getLogger("investiq.market.cache")


class MarketReadCache:
    max_bytes = 1024 * 1024

    def __init__(self, client: Redis | None = None) -> None:
        self._client = client or Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=0.15,
            socket_timeout=0.15,
            decode_responses=True,
        )
        self._namespace = f"market:read:v1:{settings.app_env}"
        self._redis_broken_until: float = 0.0
        self._local_lock = threading.Lock()
        self._local_cache: dict[str, tuple[dict[str, object], float]] = {}

    def key(self, resource: str, dimensions: dict[str, object]) -> str:
        raw = json.dumps(dimensions, sort_keys=True, separators=(",", ":")).encode()
        return f"{self._namespace}:{resource}:{hashlib.sha256(raw).hexdigest()}"

    def get(self, key: str) -> dict[str, object] | None:
        now = time.monotonic()
        if now < self._redis_broken_until:
            with self._local_lock:
                entry = self._local_cache.get(key)
                if entry and time.time() < entry[1]:
                    return entry[0]
                self._local_cache.pop(key, None)
            return None

        try:
            value = self._client.get(key)
        except RedisError:
            self._redis_broken_until = now + 30.0
            logger.warning("Market read cache lookup failed, switching to local cache")
            with self._local_lock:
                entry = self._local_cache.get(key)
                if entry and time.time() < entry[1]:
                    return entry[0]
            return None

        if not isinstance(value, (str, bytes, bytearray)):
            return None
        try:
            payload = json.loads(value)
        except json.JSONDecodeError:
            logger.warning("Market read cache contained invalid JSON")
            return None
        return payload if isinstance(payload, dict) else None

    def set(self, key: str, payload: dict[str, object], ttl_seconds: int) -> None:
        value = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        if len(value.encode()) > self.max_bytes:
            return

        now = time.monotonic()
        with self._local_lock:
            self._local_cache[key] = (payload, time.time() + ttl_seconds)

        if now < self._redis_broken_until:
            return

        try:
            self._client.set(key, value, ex=ttl_seconds)
        except RedisError:
            self._redis_broken_until = now + 30.0
            logger.warning("Market read cache store failed, cached in local memory")

    def invalidate_public(self) -> None:
        """Incremented versions can replace this when a live ingestion writer is connected."""
        logger.info("Market public cache invalidation requested; bounded TTL is active")


@lru_cache
def get_market_read_cache() -> MarketReadCache:
    return MarketReadCache()
