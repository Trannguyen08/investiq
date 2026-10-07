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
    @property
    def slug(self) -> str: ...

    @property
    def display_name(self) -> str: ...

    @property
    def delay_class(self) -> str: ...

    @property
    def market_time(self) -> str: ...

    @property
    def freshness(self) -> str: ...

    @property
    def session(self) -> str: ...

    @property
    def partial(self) -> bool: ...

    def instruments(self) -> tuple[MarketInstrument, ...]: ...

    def indices(self) -> tuple[MarketIndex, ...]: ...

    def events(self) -> tuple[MarketEvent, ...]: ...

    def people(self) -> tuple[MarketPerson, ...]: ...

    def candles(self, symbol: str, interval: str) -> tuple[Candle, ...]: ...

    def instrument(self, symbol: str) -> MarketInstrument | None: ...

    def index(self, symbol: str) -> MarketIndex | None: ...
