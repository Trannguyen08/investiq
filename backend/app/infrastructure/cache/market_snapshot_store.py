"""Durable last-known-good store for public market read models.

The live provider (FHSC via vnstock) has a nightly maintenance window and the free Render
instance cold-starts with an empty in-memory snapshot. Persisting the last successful public
payloads lets read endpoints keep serving clearly-labelled stale data instead of HTTP 503.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from collections.abc import Callable
from functools import lru_cache
from typing import Any

import psycopg
from psycopg_pool import ConnectionPool

from app.infrastructure.config.settings import settings

logger = logging.getLogger("investiq.market.snapshot_store")

_MAX_PAYLOAD_BYTES = 2 * 1024 * 1024
_STORE_ERRORS = (psycopg.Error, OSError, RuntimeError)


class MarketSnapshotStore:
    def __init__(
        self,
        pool_factory: Callable[[], ConnectionPool] | None = None,
        *,
        enabled: bool = True,
        write_interval_seconds: float = 300.0,
        failure_backoff_seconds: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._pool_factory = pool_factory
        self._enabled = enabled
        self._write_interval = write_interval_seconds
        self._failure_backoff = failure_backoff_seconds
        self._clock = clock
        self._lock = threading.Lock()
        self._memory: dict[str, dict[str, Any]] = {}
        self._last_write: dict[str, float] = {}
        self._broken_until = 0.0

    @property
    def enabled(self) -> bool:
        return self._enabled

    def _pool(self) -> ConnectionPool:
        if self._pool_factory is None:
            from app.infrastructure.db.session import get_pool

            return get_pool()
        return self._pool_factory()

    def _db_available(self) -> bool:
        return self._clock() >= self._broken_until

    def _mark_broken(self, operation: str, exc: BaseException) -> None:
        self._broken_until = self._clock() + self._failure_backoff
        logger.warning(
            "market_snapshot_store_unavailable",
            extra={"operation": operation, "error_type": type(exc).__name__},
        )

    def save(self, resource: str, key: str, payload: dict[str, Any]) -> None:
        if not self._enabled:
            return
        now = self._clock()
        with self._lock:
            self._memory[key] = payload
            last = self._last_write.get(key)
            if last is not None and now - last < self._write_interval:
                return
            self._last_write[key] = now
        if not self._db_available():
            return
        try:
            encoded = json.dumps(payload, default=str, ensure_ascii=False)
        except (TypeError, ValueError):
            return
        if len(encoded.encode()) > _MAX_PAYLOAD_BYTES:
            return
        try:
            with self._pool().connection() as conn:
                conn.execute(
                    """
                    INSERT INTO market_read_snapshots (cache_key, resource, payload, stored_at)
                    VALUES (%s, %s, %s::jsonb, now())
                    ON CONFLICT (cache_key) DO UPDATE
                    SET payload = EXCLUDED.payload, stored_at = EXCLUDED.stored_at
                    """,
                    (key, resource[:64], encoded),
                )
        except _STORE_ERRORS as exc:
            with self._lock:
                self._last_write.pop(key, None)
            self._mark_broken("save", exc)

    def load(self, key: str) -> dict[str, Any] | None:
        if not self._enabled:
            return None
        with self._lock:
            cached = self._memory.get(key)
        if cached is not None:
            return cached
        if not self._db_available():
            return None
        try:
            with self._pool().connection() as conn:
                row = conn.execute(
                    "SELECT payload FROM market_read_snapshots WHERE cache_key = %s",
                    (key,),
                ).fetchone()
        except _STORE_ERRORS as exc:
            self._mark_broken("load", exc)
            return None
        if not row or not isinstance(row[0], dict):
            return None
        payload: dict[str, Any] = row[0]
        with self._lock:
            self._memory[key] = payload
        return payload


def mark_stale(payload: dict[str, Any]) -> dict[str, Any]:
    """Label a last-known-good payload as stale while keeping its original market_time."""
    copy = dict(payload)
    meta = copy.get("meta")
    if isinstance(meta, dict):
        copy["meta"] = {**meta, "freshness": "stale"}
    return copy


@lru_cache
def get_market_snapshot_store() -> MarketSnapshotStore:
    return MarketSnapshotStore(enabled=settings.market_data_mode == "vnstock")
