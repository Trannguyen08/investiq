"""Application-owned market provider contract."""

from __future__ import annotations

from typing import Protocol

from app.domain.entities.market import (
    Candle,
    MarketEvent,
    MarketIndex,
    MarketInstrument,
    MarketPerson,
)


class IMarketProvider(Protocol):
    slug: str
    display_name: str
    delay_class: str
    market_time: str

    def instruments(self) -> tuple[MarketInstrument, ...]: ...

    def indices(self) -> tuple[MarketIndex, ...]: ...

    def events(self) -> tuple[MarketEvent, ...]: ...

    def people(self) -> tuple[MarketPerson, ...]: ...

    def candles(self, symbol: str, interval: str) -> tuple[Candle, ...]: ...

    def instrument(self, symbol: str) -> MarketInstrument | None: ...

    def index(self, symbol: str) -> MarketIndex | None: ...
