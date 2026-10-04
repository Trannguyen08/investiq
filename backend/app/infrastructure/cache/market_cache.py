"""Short-lived cache for public market read models."""

from __future__ import annotations

import hashlib
import json
import logging
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
            socket_connect_timeout=0.3,
            socket_timeout=0.3,
            decode_responses=True,
        )
        self._namespace = f"market:read:v1:{settings.app_env}"

    def key(self, resource: str, dimensions: dict[str, object]) -> str:
        raw = json.dumps(dimensions, sort_keys=True, separators=(",", ":")).encode()
        return f"{self._namespace}:{resource}:{hashlib.sha256(raw).hexdigest()}"

    def get(self, key: str) -> dict[str, object] | None:
        try:
            value = self._client.get(key)
        except RedisError:
            logger.warning("Market read cache lookup failed")
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
        try:
            self._client.set(key, value, ex=ttl_seconds)
        except RedisError:
            logger.warning("Market read cache store failed")

    def invalidate_public(self) -> None:
        """Incremented versions can replace this when a live ingestion writer is connected."""
        logger.info("Market public cache invalidation requested; bounded TTL is active")


@lru_cache
def get_market_read_cache() -> MarketReadCache:
    return MarketReadCache()
