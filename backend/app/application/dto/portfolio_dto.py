"""Application commands for paper trading."""

from dataclasses import dataclass


@dataclass(frozen=True)
class PlacePaperOrder:
    side: str
    symbol: str
    quantity: int
    idempotency_key: str
