"""Redis-backed and local in-memory cache for shared AI responses.

Answers in this cache are keyed by the normalized text of the question. Only public,
non-personalized responses may be stored here.
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from app.infrastructure.config.settings import settings

logger = logging.getLogger("investiq.ai.cache")


class AiChatCache:
    """Bounded, fault-tolerant cache for shared AI answers."""

    max_bytes = 2 * 1024 * 1024  # 2 MB per entry ceiling

    def __init__(self, client: Redis | None = None) -> None:
        self._client = client or Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
            decode_responses=True,
        )
        self._namespace = f"ai:chat:v1:{settings.app_env}"
        self._redis_broken_until: float = 0.0
        self._local_lock = threading.Lock()
        self._local_cache: dict[str, tuple[dict[str, Any], float]] = {}

    def key(self, normalized_query: str) -> str:
        digest = hashlib.sha256(normalized_query.encode("utf-8")).hexdigest()
        return f"{self._namespace}:{digest}"

    def get(self, key: str) -> dict[str, Any] | None:
        now = time.monotonic()
        if now < self._redis_broken_until:
            with self._local_lock:
                entry = self._local_cache.get(key)
                if entry and time.time() < entry[1]:
                    return entry[0]
                self._local_cache.pop(key, None)
            return None

        try:
            raw = self._client.get(key)
        except RedisError:
            self._redis_broken_until = now + 30.0
            logger.warning("AI cache Redis lookup failed, falling back to local memory")
            with self._local_lock:
                entry = self._local_cache.get(key)
                if entry and time.time() < entry[1]:
                    return entry[0]
            return None

        if not isinstance(raw, (str, bytes, bytearray)):
            return None
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("AI cache contained invalid JSON")
            return None
        return payload if isinstance(payload, dict) else None

    def set(self, key: str, payload: dict[str, Any], ttl_seconds: int) -> None:
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        if len(raw.encode("utf-8")) > self.max_bytes:
            return

        now = time.monotonic()
        with self._local_lock:
            # Bound in-memory cache size
            if len(self._local_cache) > 200:
                expired = [k for k, v in self._local_cache.items() if time.time() >= v[1]]
                for k in expired:
                    self._local_cache.pop(k, None)
                if len(self._local_cache) > 200:
                    self._local_cache.clear()
            self._local_cache[key] = (payload, time.time() + ttl_seconds)

        if now < self._redis_broken_until:
            return

        try:
            self._client.set(key, raw, ex=ttl_seconds)
        except RedisError:
            self._redis_broken_until = now + 30.0
            logger.warning("AI cache Redis store failed, retained in local memory")


_ai_cache_instance: AiChatCache | None = None
_ai_cache_lock = threading.Lock()


def get_ai_chat_cache() -> AiChatCache:
    global _ai_cache_instance
    with _ai_cache_lock:
        if _ai_cache_instance is None:
            _ai_cache_instance = AiChatCache()
        return _ai_cache_instance
