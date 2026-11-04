"""Port for the shared AI answer cache.

The AI assistant answers are not personalized: they depend only on the normalized question and
public market/knowledge data. That makes a shared, question-keyed cache safe. Callers must never
store answers that embed user-specific data behind this port.
"""

from __future__ import annotations

from typing import Protocol


class AiResponseCache(Protocol):
    def get(self, key: str) -> dict[str, object] | None:
        """Return the cached payload, or ``None`` on miss or cache failure."""
        ...

    def set(self, key: str, payload: dict[str, object], ttl_seconds: int) -> None:
        """Store a payload with a bounded TTL; failures must degrade silently to a miss."""
        ...
