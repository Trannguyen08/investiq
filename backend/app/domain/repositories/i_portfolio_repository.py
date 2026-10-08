"""Persistence port for private paper-trading ledgers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol

from app.domain.entities.portfolio import PaperPortfolio, PaperTrade


class PortfolioConflictError(ValueError):
    pass


class InsufficientCashError(ValueError):
    pass


class InsufficientSharesError(ValueError):
    pass


class HoldingLimitError(ValueError):
    pass


@dataclass(frozen=True)
class PaperExecution:
    idempotency_key: str
    side: str
    symbol: str
    name: str
    exchange: str
    sector: str | None
    quantity: int
    execution_price: Decimal
    gross_amount: Decimal
    fee_rate: Decimal
    fee_amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    provider: str
    price_at: datetime
    received_at: datetime
    delay_class: str


class IPortfolioRepository(Protocol):
    def get_or_create(self, user_id: str, starting_cash: Decimal) -> PaperPortfolio: ...

    def execute(
        self,
        user_id: str,
        starting_cash: Decimal,
        execution: PaperExecution,
        max_holdings: int,
    ) -> PaperTrade: ...
