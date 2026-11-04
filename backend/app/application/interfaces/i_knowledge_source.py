"""Port for public, curated InvestIQ knowledge used to ground AI answers."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Protocol


class KnowledgeSource(Protocol):
    def get_topics(
        self, level: str | None = None, status: str | None = "published"
    ) -> Sequence[Mapping[str, object]]:
        """Return learning topics; the AI layer only ever requests ``status="published"``."""
        ...
