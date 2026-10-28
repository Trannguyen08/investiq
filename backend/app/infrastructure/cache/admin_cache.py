"""Admin cache layer using Redis with thread-safe in-memory fallback."""

from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from app.infrastructure.config.settings import settings

logger = logging.getLogger("investiq.admin.cache")


class AdminCache:
    """Resilient caching for admin aggregate queries and dashboard metrics."""

    _lock = threading.Lock()
    _memory_cache: dict[str, tuple[dict[str, Any], float]] = {}

    def __init__(self, client: Redis | None = None) -> None:
        self._client = client or Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=0.4,
            socket_timeout=0.4,
            decode_responses=True,
        )
        self._prefix = f"admin:v1:{settings.app_env}:"

    def get(self, key: str) -> dict[str, Any] | None:
        full_key = f"{self._prefix}{key}"
        try:
            val = self._client.get(full_key)
            if val is not None and isinstance(val, str):
                decoded = json.loads(val)
                if isinstance(decoded, dict):
                    return decoded
        except (RedisError, json.JSONDecodeError, Exception):
            logger.debug("Redis lookup failed for key %s, trying memory fallback", key)

        with self._lock:
            entry = self._memory_cache.get(full_key)
            if entry is not None:
                data, expiry = entry
                if time.time() < expiry:
                    return data
                self._memory_cache.pop(full_key, None)
        return None

    def set(self, key: str, payload: dict[str, Any], ttl_seconds: int = 60) -> None:
        full_key = f"{self._prefix}{key}"
        serialized = json.dumps(payload, ensure_ascii=False, default=str)
        try:
            self._client.set(full_key, serialized, ex=ttl_seconds)
        except (RedisError, Exception):
            logger.debug("Redis set failed for key %s, writing to memory fallback", key)

        with self._lock:
            self._memory_cache[full_key] = (payload, time.time() + ttl_seconds)

    def invalidate(self, key_pattern: str = "*") -> None:
        pattern = f"{self._prefix}{key_pattern}"
        try:
            keys = self._client.keys(pattern)
            if keys:
                self._client.delete(*keys)
        except RedisError:
            pass

        with self._lock:
            if key_pattern == "*":
                self._memory_cache.clear()
            else:
                to_delete = [k for k in self._memory_cache if k.startswith(pattern.rstrip("*"))]
                for k in to_delete:
                    self._memory_cache.pop(k, None)


_admin_cache_instance: AdminCache | None = None


def get_admin_cache() -> AdminCache:
    global _admin_cache_instance
    if _admin_cache_instance is None:
        _admin_cache_instance = AdminCache()
    return _admin_cache_instance
