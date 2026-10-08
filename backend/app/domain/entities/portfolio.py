"""Paper-trading account and immutable execution records."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from app.domain.entities.holding import PaperHolding


@dataclass(frozen=True)
class PaperTrade:
    id: str
    idempotency_key: str
    side: str
    symbol: str
    name: str
    exchange: str
    quantity: int
    execution_price: Decimal
    gross_amount: Decimal
    fee_rate: Decimal
    fee_amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    cash_effect: Decimal
    realized_pnl: Decimal | None
    provider: str
    price_at: datetime
    received_at: datetime
    delay_class: str
    created_at: datetime


@dataclass(frozen=True)
class PaperPortfolio:
    id: str
    user_id: str
    currency: str
    starting_cash: Decimal
    cash_balance: Decimal
    realized_pnl: Decimal
    version: int
    created_at: datetime
    updated_at: datetime
    holdings: tuple[PaperHolding, ...]
    trades: tuple[PaperTrade, ...]
