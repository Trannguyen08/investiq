"""Persistence port for private paper-trading ledgers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol

from app.domain.entities.portfolio import PaperOrder, PaperPortfolio, PaperTrade


class PortfolioConflictError(ValueError):
    pass


class InsufficientCashError(ValueError):
    pass


class InsufficientSharesError(ValueError):
    pass


class HoldingLimitError(ValueError):
    pass


class OrderNotCancellableError(ValueError):
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


@dataclass(frozen=True)
class PaperOrderSubmission:
    idempotency_key: str
    side: str
    order_type: str
    symbol: str
    name: str
    exchange: str
    sector: str | None
    quantity: int
    limit_price: Decimal
    reserved_cash: Decimal
    reserved_quantity: int
    provider: str
    price_at: datetime
    received_at: datetime
    delay_class: str
    initial_status: str
    expires_at: datetime


class IPortfolioRepository(Protocol):
    def get_or_create(self, user_id: str, starting_cash: Decimal) -> PaperPortfolio: ...

    def execute(
        self,
        user_id: str,
        starting_cash: Decimal,
        execution: PaperExecution,
        max_holdings: int,
    ) -> PaperTrade: ...

    def place_order(
        self,
        user_id: str,
        starting_cash: Decimal,
        submission: PaperOrderSubmission,
        max_holdings: int,
    ) -> PaperOrder: ...

    def fill_order(
        self,
        user_id: str,
        order_id: str,
        execution: PaperExecution,
        max_holdings: int,
    ) -> tuple[PaperOrder, PaperTrade | None]: ...

    def cancel_order(self, user_id: str, order_id: str) -> PaperOrder: ...

    def activate_order(self, user_id: str, order_id: str) -> PaperOrder: ...

    def expire_orders(self, user_id: str, now: datetime) -> int: ...

    def set_public_status(
        self, user_id: str, is_public: bool, nickname: str | None = None
    ) -> PaperPortfolio: ...

    def get_public_leaderboard(self, limit: int = 10) -> tuple[dict, ...]: ...

    def get_public_portfolio(self, portfolio_id: str) -> PaperPortfolio | None: ...
