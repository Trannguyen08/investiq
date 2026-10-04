"""Bounded public news read cache; PostgreSQL remains authoritative."""

from __future__ import annotations

import hashlib
import json
import logging
from functools import lru_cache

from redis import Redis
from redis.exceptions import RedisError

from app.infrastructure.config.settings import settings

logger = logging.getLogger("investiq.news.cache")


class NewsReadCache:
    ttl_seconds = 30
    max_bytes = 512 * 1024

    def __init__(self, client: Redis | None = None) -> None:
        self._client = client or Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=0.3,
            socket_timeout=0.3,
            decode_responses=True,
        )
        self._namespace = f"news:read:v1:{settings.app_env}"

    def key(self, filters: dict[str, object]) -> str | None:
        try:
            version = self._client.get(f"{self._namespace}:version") or "0"
        except RedisError:
            logger.warning("News read cache unavailable")
            return None
        raw = json.dumps(filters, sort_keys=True, separators=(",", ":")).encode()
        return f"{self._namespace}:{version}:{hashlib.sha256(raw).hexdigest()}"

    def get(self, key: str) -> dict[str, object] | None:
        try:
            value = self._client.get(key)
        except RedisError:
            logger.warning("News read cache lookup failed")
            return None
        if value is None:
            logger.debug("News read cache miss")
            return None
        logger.debug("News read cache hit")
        if not isinstance(value, (str, bytes, bytearray)):
            return None
        try:
            payload = json.loads(value)
        except json.JSONDecodeError:
            logger.warning("News read cache contained invalid JSON")
            return None
        return payload if isinstance(payload, dict) else None

    def set(self, key: str, payload: dict[str, object]) -> None:
        value = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        if len(value.encode()) > self.max_bytes:
            return
        try:
            self._client.set(key, value, ex=self.ttl_seconds)
        except RedisError:
            logger.warning("News read cache store failed")

    def invalidate(self) -> None:
        try:
            self._client.incr(f"{self._namespace}:version")
        except RedisError:
            logger.warning("News read cache invalidation failed; TTL is the fallback")


@lru_cache
def get_news_read_cache() -> NewsReadCache:
    return NewsReadCache()
