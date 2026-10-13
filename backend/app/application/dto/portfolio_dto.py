"""Application commands for paper trading."""

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class PlacePaperOrder:
    side: str
    symbol: str
    quantity: int
    order_type: str
    limit_price: Decimal
    idempotency_key: str
