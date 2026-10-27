"""Strict private paper-trading API contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PlacePaperOrderRequest(StrictModel):
    side: Literal["buy", "sell"]
    order_type: Literal["LO"] = "LO"
    symbol: str = Field(min_length=1, max_length=24, pattern=r"^[A-Za-z0-9._-]+$")
    quantity: int = Field(ge=1, le=1_000_000)
    limit_price: str = Field(pattern=r"^(?:0|[1-9][0-9]{0,23})(?:\.[0-9]{1,8})?$")


class PaperAccountResponse(StrictModel):
    id: str
    currency: Literal["VND"]
    starting_cash: str
    cash_balance: str
    available_cash: str
    reserved_cash: str
    invested_cost: str
    market_value: str | None
    total_value: str | None
    realized_pnl: str
    unrealized_pnl: str | None
    total_pnl: str | None
    total_return_percent: str | None
    valuation_partial: bool
    version: int
    is_public: bool = False
    nickname: str | None = None
    created_at: datetime
    updated_at: datetime


class PricePointResponse(StrictModel):
    timestamp: datetime
    close: str


class EquityPointResponse(StrictModel):
    timestamp: datetime
    value: str


class PaperHoldingResponse(StrictModel):
    symbol: str
    name: str
    exchange: str
    sector: str | None
    quantity: int
    available_quantity: int
    average_cost: str
    total_cost_basis: str
    current_price: str | None
    market_value: str | None
    unrealized_pnl: str | None
    unrealized_pnl_percent: str | None
    daily_change_percent: str | None
    portfolio_weight_percent: str | None
    price_history: list[PricePointResponse]


class PaperTradeResponse(StrictModel):
    id: str
    side: Literal["buy", "sell"]
    symbol: str
    name: str
    exchange: str
    quantity: int
    execution_price: str
    gross_amount: str
    fee_amount: str
    tax_amount: str
    cash_effect: str
    realized_pnl: str | None
    provider: str
    price_at: datetime
    received_at: datetime
    delay_class: str
    created_at: datetime


class PaperOrderResponse(StrictModel):
    id: str
    side: Literal["buy", "sell"]
    order_type: Literal["LO"]
    status: Literal["pending", "open", "filled", "cancelled", "rejected", "expired"]
    symbol: str
    name: str
    exchange: str
    quantity: int
    filled_quantity: int
    limit_price: str
    reserved_cash: str
    reserved_quantity: int
    provider: str
    price_at: datetime
    received_at: datetime
    delay_class: str
    created_at: datetime
    updated_at: datetime
    expires_at: datetime
    cancelled_at: datetime | None


class PaperNoticeResponse(StrictModel):
    level: Literal["info", "warning"]
    symbol: str
    title: str
    message: str


class PaperOpportunityResponse(StrictModel):
    symbol: str
    name: str
    price: str
    change_percent: str
    volume: str
    matched_value: str
    interest_reasons: list[str]


class PaperAssumptionsResponse(StrictModel):
    starting_cash: str
    broker_fee_rate: str
    sell_tax_rate: str
    fill_model: Literal["automatic_latest_observed_price"]
    max_holdings: int
    disclaimer: str


class PaperMarketMetaResponse(StrictModel):
    provider: str
    provider_name: str
    market_time: datetime
    received_at: datetime
    delay_class: str
    freshness: str
    session: str
    partial: bool


class PaperDashboardResponse(StrictModel):
    account: PaperAccountResponse
    holdings: list[PaperHoldingResponse]
    orders: list[PaperOrderResponse]
    trades: list[PaperTradeResponse]
    equity_curve: list[EquityPointResponse]
    equity_curve_method: Literal["current_holdings_replay"]
    notices: list[PaperNoticeResponse]
    opportunities: list[PaperOpportunityResponse]
    assumptions: PaperAssumptionsResponse
    market: PaperMarketMetaResponse


class PlacePaperOrderResponse(StrictModel):
    order: PaperOrderResponse
    trade: PaperTradeResponse | None
    data: PaperDashboardResponse


class CancelPaperOrderResponse(StrictModel):
    order: PaperOrderResponse
    data: PaperDashboardResponse
