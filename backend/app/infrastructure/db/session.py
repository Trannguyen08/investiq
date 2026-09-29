"""Process-level bounded PostgreSQL connection pool."""

from __future__ import annotations

from threading import Lock

from psycopg_pool import ConnectionPool

from app.infrastructure.config.settings import settings

_pool: ConnectionPool | None = None
_pool_lock = Lock()


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                pool = ConnectionPool(
                    conninfo=settings.database_url,
                    min_size=settings.database_pool_min_size,
                    max_size=settings.database_pool_max_size,
                    timeout=5,
                    open=False,
                )
                pool.open(wait=True)
                _pool = pool
    return _pool


def close_pool() -> None:
    global _pool
    with _pool_lock:
        if _pool is not None:
            _pool.close()
            _pool = None
