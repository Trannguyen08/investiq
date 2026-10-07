"""Canonical market entities independent from providers and delivery frameworks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class Candle:
    timestamp: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal


@dataclass(frozen=True, slots=True)
class MarketInstrument:
    symbol: str
    name: str
    exchange: str
    sector: str
    price: Decimal
    reference_price: Decimal
    ceiling_price: Decimal
    floor_price: Decimal
    open_price: Decimal
    high_price: Decimal
    low_price: Decimal
    volume: Decimal
    matched_value: Decimal
    foreign_net_value: Decimal
    market_cap: Decimal
    pe: Decimal | None
    pb: Decimal | None
    eps: Decimal | None
    roe_percent: Decimal | None
    volume_vs_20d: Decimal
    interest_score: Decimal
    interest_reasons: tuple[str, ...]
    candles: tuple[Candle, ...]
    is_vn30: bool = False

    @property
    def change(self) -> Decimal:
        return self.price - self.reference_price

    @property
    def change_percent(self) -> Decimal:
        if self.reference_price == 0:
            return Decimal("0")
        return self.change * Decimal("100") / self.reference_price


@dataclass(frozen=True, slots=True)
class MarketIndex:
    symbol: str
    name: str
    value: Decimal
    reference_value: Decimal
    open_value: Decimal
    high_value: Decimal
    low_value: Decimal
    volume: Decimal
    matched_value: Decimal
    advances: int
    declines: int
    unchanged: int
    ceiling_count: int
    floor_count: int
    candles: tuple[Candle, ...]

    @property
    def change(self) -> Decimal:
        return self.value - self.reference_value

    @property
    def change_percent(self) -> Decimal:
        if self.reference_value == 0:
            return Decimal("0")
        return self.change * Decimal("100") / self.reference_value


@dataclass(frozen=True, slots=True)
class MarketEvent:
    id: str
    symbol: str
    event_type: str
    title: str
    summary: str
    date_type: str
    event_at: datetime
    status: str
    source_name: str
    source_url: str | None


@dataclass(frozen=True, slots=True)
class MarketPerson:
    id: str
    full_name: str
    initials: str
    role: str
    company: str
    symbols: tuple[str, ...]
    sector: str
    disclosed_shares: Decimal
    ownership_percent: Decimal
    estimated_listed_equity_value: Decimal
    daily_change_percent: Decimal
    holding_public_date: datetime
