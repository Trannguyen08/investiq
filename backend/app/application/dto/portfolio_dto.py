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
    execution_mode: str | None = None
    use_orderbook_depth: bool = False
    strict_rules: bool = False
    stop_loss_price: Decimal | None = None
    take_profit_price: Decimal | None = None
