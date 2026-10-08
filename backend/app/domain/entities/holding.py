"""Framework-independent paper holding."""

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class PaperHolding:
    symbol: str
    name: str
    exchange: str
    sector: str | None
    quantity: int
    total_cost_basis: Decimal

    @property
    def average_cost(self) -> Decimal:
        return self.total_cost_basis / Decimal(self.quantity)
