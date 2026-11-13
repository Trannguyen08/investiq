"""Lightweight sliding-window rate limiter for heavy API endpoints."""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding-window rate limiter."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, *, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        """Record a request if under limit; return (allowed, retry_after_seconds)."""
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            bucket = self._buckets[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= max_requests:
                retry_after = max(1, int(bucket[0] + window_seconds - now) + 1)
                return False, retry_after
            bucket.append(now)
            if len(self._buckets) > 10_000:
                stale_keys = [k for k, v in self._buckets.items() if not v or v[-1] <= cutoff]
                for k in stale_keys[:2_000]:
                    self._buckets.pop(k, None)
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()


_limiter = SlidingWindowRateLimiter()


def get_rate_limiter() -> SlidingWindowRateLimiter:
    return _limiter


def rate_limit_dependency(
    scope: str, *, max_requests: int, window_seconds: int
) -> Callable[[Request], None]:
    """Build a FastAPI dependency enforcing per-user/IP rate limits."""

    def _enforce(request: Request) -> None:
        user_id = request.headers.get("x-user-id") or (
            request.client.host if request.client else "anonymous"
        )
        key = f"{scope}:{user_id}"
        allowed, retry_after = _limiter.check(
            key, max_requests=max_requests, window_seconds=window_seconds
        )
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Bạn thao tác quá nhanh. Vui lòng thử lại sau ít giây.",
                headers={"Retry-After": str(retry_after)},
            )

    return _enforce
