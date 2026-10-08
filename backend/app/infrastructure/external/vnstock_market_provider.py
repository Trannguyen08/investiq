"""Vnstock-backed delayed market adapter for evaluation and local development.

Vnstock is a connector to third-party sources, not a licensed redistribution feed.
This adapter therefore labels every snapshot as source-delayed and partial, keeps
credentials server-side, and serves stale cached data instead of inventing values.
"""

from __future__ import annotations

import logging
import math
import os
import re
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from threading import RLock, Thread
from time import monotonic
from typing import Protocol
from zoneinfo import ZoneInfo

from app.application.use_cases.market_data.errors import MarketDataUnavailable
from app.domain.entities.market import (
    Candle,
    MarketEvent,
    MarketIndex,
    MarketInstrument,
    MarketPerson,
)

logger = logging.getLogger(__name__)

_MARKET_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
_STOCK_SYMBOL = re.compile(r"^[A-Z]{3}$")
_INDEX_EXCHANGE = {
    "VNINDEX": "HOSE",
    "VN30": "VN30",
    "HNXINDEX": "HNX",
    "UPCOMINDEX": "UPCOM",
}
_INDEX_NAMES = {
    "VNINDEX": "VN-Index",
    "VN30": "VN30-Index",
    "HNXINDEX": "HNX-Index",
    "UPCOMINDEX": "UPCoM-Index",
}


@dataclass(frozen=True, slots=True)
class VnstockConfig:
    api_key: str | None
    refresh_seconds: int
    candle_cache_seconds: int
    fundamental_cache_seconds: int
    max_symbols: int


class VnstockGateway(Protocol):
    """Small owned boundary around the source-available Vnstock package."""

    def reference_rows(self) -> tuple[list[dict[str, object]], set[str], dict[str, str]]: ...

    def quote_rows(self, symbols: list[str]) -> list[dict[str, object]]: ...

    def previous_session_rows(self, symbols: list[str]) -> list[dict[str, object]]: ...

    def candle_rows(
        self,
        symbol: str,
        interval: str,
        count: int,
    ) -> list[dict[str, object]]: ...

    def fundamental_rows(self, symbol: str) -> list[dict[str, object]]: ...


def _frame_records(value: object) -> list[dict[str, object]]:
    converter = getattr(value, "to_dict", None)
    if not callable(converter):
        raise TypeError("Vnstock returned a non-tabular response")
    raw = converter(orient="records")
    if not isinstance(raw, list):
        raise TypeError("Vnstock table did not return record rows")
    rows: list[dict[str, object]] = []
    for item in raw:
        if isinstance(item, dict):
            rows.append({str(key): field for key, field in item.items()})
    return rows


def _series_strings(value: object) -> set[str]:
    converter = getattr(value, "tolist", None)
    if not callable(converter):
        raise TypeError("Vnstock returned a non-series response")
    raw = converter()
    if not isinstance(raw, list):
        raise TypeError("Vnstock series did not return a list")
    return {str(item).strip().upper() for item in raw if str(item).strip()}


class OfficialVnstockGateway:
    """Calls Vnstock 4's unified API and returns plain Python records."""

    def __init__(self, api_key: str | None) -> None:
        if api_key:
            os.environ["VNSTOCK_API_KEY"] = api_key
        from vnstock import Finance, Market, Reference, Trading  # type: ignore[import-untyped]

        self._market = Market()
        self._reference = Reference()
        self._finance_type = Finance
        self._trading_type = Trading

    def reference_rows(self) -> tuple[list[dict[str, object]], set[str], dict[str, str]]:
        try:
            references = _frame_records(
                self._reference.equity.list_by_exchange(source="kbs")
            )
            vn30 = _series_strings(
                self._reference.equity.list_by_group(group="VN30", source="kbs")
            )
        except (Exception, SystemExit) as exc:
            raise RuntimeError("Vnstock reference request failed") from exc
        sectors: dict[str, str] = {}
        try:
            rows = _frame_records(self._reference.equity.list_by_industry(source="vci"))
            for row in rows:
                symbol = _text(row.get("symbol")).upper()
                level = _integer(row.get("icb_level"))
                name = _text(row.get("icb_name"))
                if symbol and name and (level == 2 or symbol not in sectors):
                    sectors[symbol] = name
        except (Exception, SystemExit):
            logger.warning("vnstock_sector_reference_unavailable")
        return references, vn30, sectors

    def quote_rows(self, symbols: list[str]) -> list[dict[str, object]]:
        try:
            value = self._market.quote(symbol=symbols, source="kbs", get_all=True)
            return _frame_records(value)
        except (Exception, SystemExit) as exc:
            raise RuntimeError("Vnstock quote request failed") from exc

    def previous_session_rows(self, symbols: list[str]) -> list[dict[str, object]]:
        """Load the latest completed-session prices in one batch request.

        KBS resets its live board to zero before the next session. VCI keeps both
        the new reference (the last close) and the preceding reference, avoiding
        one historical request per stock when the live board has not opened yet.
        """

        try:
            frame = self._trading_type(source="vci").price_board(
                symbols,
                flatten_columns=True,
            )
            rows = _frame_records(frame)
        except (Exception, SystemExit) as exc:
            raise RuntimeError("Vnstock previous-session request failed") from exc
        return [
            {
                "symbol": row.get("listing_symbol"),
                "close_price": row.get("listing_ref_price"),
                "reference_price": row.get("match_reference_price"),
            }
            for row in rows
            if _price(row.get("listing_ref_price")) > 0
            and _price(row.get("match_reference_price")) > 0
        ]

    def candle_rows(
        self,
        symbol: str,
        interval: str,
        count: int,
    ) -> list[dict[str, object]]:
        try:
            if symbol in _INDEX_EXCHANGE:
                frame = self._market.index(symbol=symbol).ohlcv(
                    interval=interval,
                    count=count,
                    source="kbs",
                    get_all=True,
                )
            else:
                frame = self._market.equity(symbol=symbol).ohlcv(
                    interval=interval,
                    count=count,
                    source="kbs",
                    get_all=True,
                )
            return _frame_records(frame)
        except (Exception, SystemExit) as exc:
            raise RuntimeError("Vnstock candle request failed") from exc

    def fundamental_rows(self, symbol: str) -> list[dict[str, object]]:
        try:
            frame = self._finance_type(
                source="kbs",
                symbol=symbol,
                period="quarter",
                get_all=False,
                show_log=False,
            ).ratio(lang="en", dropna=False)
            return _frame_records(frame)
        except (Exception, SystemExit) as exc:
            raise RuntimeError("Vnstock fundamental request failed") from exc


def _text(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text.lower() in {"nan", "none", "nat"} else text


def _decimal(value: object, default: Decimal = Decimal()) -> Decimal:
    text = _text(value).replace(",", "")
    if not text:
        return default
    try:
        parsed = Decimal(text)
    except InvalidOperation:
        return default
    return default if not parsed.is_finite() else parsed


def _optional_decimal(value: object) -> Decimal | None:
    text = _text(value).replace(",", "")
    if not text:
        return None
    try:
        parsed = Decimal(text)
    except InvalidOperation:
        return None
    return parsed if parsed.is_finite() else None


def _integer(value: object) -> int:
    return int(_decimal(value))


def _timestamp(value: object, fallback: datetime) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, (int, float)) and math.isfinite(float(value)):
        seconds = float(value) / 1000 if float(value) > 10_000_000_000 else float(value)
        parsed = datetime.fromtimestamp(seconds, tz=UTC)
    else:
        text = _text(value)
        parsed = fallback
        if text:
            try:
                parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            except ValueError:
                for pattern in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"):
                    try:
                        parsed = datetime.strptime(text, pattern)
                        break
                    except ValueError:
                        continue
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=_MARKET_TZ)
    return parsed.astimezone(UTC)


def _price(value: object) -> Decimal:
    """KBS price-board values are VND; keep the canonical API in VND."""

    return _decimal(value)


def _latest_ratio(row: dict[str, object]) -> Decimal | None:
    periods: list[tuple[int, int, Decimal]] = []
    for key, raw_value in row.items():
        matched = re.fullmatch(r"(\d{4})(?:-Q([1-4]))?(?:_\d+)?", key)
        if matched is None:
            continue
        value = _optional_decimal(raw_value)
        if value is None:
            continue
        periods.append((int(matched.group(1)), int(matched.group(2) or 4), value))
    if not periods:
        return None
    latest = max(periods, key=lambda item: (item[0], item[1]))
    return latest[2]


def _fundamental_values(
    rows: list[dict[str, object]],
) -> tuple[Decimal | None, Decimal | None, Decimal | None, Decimal | None]:
    values = {
        _text(row.get("item_id")): _latest_ratio(row)
        for row in rows
        if _text(row.get("item_id"))
    }
    return (
        values.get("pe_ratio"),
        values.get("pb_ratio"),
        values.get("trailing_eps"),
        values.get("roe"),
    )


def _candle(row: dict[str, object], symbol: str, fallback: datetime) -> Candle | None:
    opened = _decimal(row.get("open"))
    high = _decimal(row.get("high"))
    low = _decimal(row.get("low"))
    close = _decimal(row.get("close"))
    if not all(value > 0 for value in (opened, high, low, close)):
        return None
    multiplier = Decimal("1") if symbol in _INDEX_EXCHANGE else Decimal("1000")
    return Candle(
        timestamp=_timestamp(row.get("time"), fallback),
        open=opened * multiplier,
        high=high * multiplier,
        low=low * multiplier,
        close=close * multiplier,
        volume=_decimal(row.get("volume")),
    )


class VnstockMarketProvider:
    """Cached Vnstock/KBS snapshot normalized to InvestIQ's canonical contract."""

    slug = "vnstock-kbs"
    display_name = "Vnstock · nguồn KBS/VCI (có độ trễ)"
    delay_class = "source_delayed"
    partial = True

    def __init__(
        self,
        config: VnstockConfig,
        gateway: VnstockGateway | None = None,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        self._config = config
        self._gateway = gateway or OfficialVnstockGateway(config.api_key)
        self._clock = clock
        self._lock = RLock()
        self._expires_at = 0.0
        self._instruments: tuple[MarketInstrument, ...] = ()
        self._indices: tuple[MarketIndex, ...] = ()
        self._market_time = datetime.now(UTC)
        self._stale = False
        self._refreshing = False
        self._candle_cache: dict[tuple[str, str], tuple[float, tuple[Candle, ...]]] = {}
        self._fundamental_cache: dict[
            str,
            tuple[
                float,
                tuple[Decimal | None, Decimal | None, Decimal | None, Decimal | None],
            ],
        ] = {}

    @property
    def market_time(self) -> str:
        self._ensure_snapshot()
        return self._market_time.isoformat().replace("+00:00", "Z")

    @property
    def freshness(self) -> str:
        self._ensure_snapshot()
        return "stale" if self._stale else "fresh"

    @property
    def session(self) -> str:
        local = datetime.now(UTC).astimezone(_MARKET_TZ)
        if local.weekday() >= 5:
            return "closed"
        minutes = local.hour * 60 + local.minute
        return "open" if 9 * 60 <= minutes <= 15 * 60 else "closed"

    def instruments(self) -> tuple[MarketInstrument, ...]:
        self._ensure_snapshot()
        return self._instruments

    def indices(self) -> tuple[MarketIndex, ...]:
        self._ensure_snapshot()
        return self._indices

    def events(self) -> tuple[MarketEvent, ...]:
        return ()

    def people(self) -> tuple[MarketPerson, ...]:
        return ()

    def instrument(
        self, symbol: str, *, include_fundamentals: bool = False
    ) -> MarketInstrument | None:
        normalized = symbol.upper()
        value = next((item for item in self.instruments() if item.symbol == normalized), None)
        if value is None or not include_fundamentals:
            return value
        return self._with_fundamentals(value)

    def index(self, symbol: str) -> MarketIndex | None:
        normalized = symbol.upper()
        return next((item for item in self.indices() if item.symbol == normalized), None)

    def candles(self, symbol: str, interval: str) -> tuple[Candle, ...]:
        normalized = symbol.upper()
        if interval not in {"1d", "5m"}:
            return ()
        key = (normalized, interval)
        now = self._clock()
        cached = self._candle_cache.get(key)
        if cached and cached[0] > now:
            return cached[1]
        source_interval = "1D" if interval == "1d" else "5m"
        count = 500 if interval == "1d" else 160
        try:
            rows = self._gateway.candle_rows(normalized, source_interval, count)
            fetched_at = datetime.now(UTC)
            values = tuple(
                item
                for row in rows
                if (item := _candle(row, normalized, fetched_at)) is not None
            )
        except (RuntimeError, TypeError, ValueError):
            logger.warning("vnstock_candles_unavailable", extra={"symbol": normalized})
            return cached[1] if cached else ()
        self._candle_cache[key] = (
            now + self._config.candle_cache_seconds,
            values,
        )
        return values

    def _with_fundamentals(self, value: MarketInstrument) -> MarketInstrument:
        now = self._clock()
        cached = self._fundamental_cache.get(value.symbol)
        if cached and cached[0] > now:
            fundamentals = cached[1]
        else:
            try:
                fundamentals = _fundamental_values(
                    self._gateway.fundamental_rows(value.symbol)
                )
                ttl = self._config.fundamental_cache_seconds
            except (RuntimeError, TypeError, ValueError):
                logger.warning(
                    "vnstock_fundamentals_unavailable",
                    extra={"symbol": value.symbol},
                )
                fundamentals = (None, None, None, None)
                ttl = min(300, self._config.fundamental_cache_seconds)
            if len(self._fundamental_cache) >= self._config.max_symbols:
                self._fundamental_cache.clear()
            self._fundamental_cache[value.symbol] = (now + ttl, fundamentals)
        pe, pb, eps, roe_percent = fundamentals
        return replace(value, pe=pe, pb=pb, eps=eps, roe_percent=roe_percent)

    def _ensure_snapshot(self) -> None:
        now = self._clock()
        if self._instruments and now < self._expires_at:
            return
        with self._lock:
            if self._instruments and now < self._expires_at:
                return
            if self._instruments:
                self._stale = True
                if not self._refreshing:
                    self._refreshing = True
                    Thread(
                        target=self._refresh_snapshot_in_background,
                        name="vnstock-market-refresh",
                        daemon=True,
                    ).start()
                return
            try:
                self._refresh_snapshot()
            except (RuntimeError, TypeError, ValueError) as exc:
                raise MarketDataUnavailable("Vnstock snapshot is unavailable") from exc

    def _refresh_snapshot_in_background(self) -> None:
        try:
            self._refresh_snapshot()
        except (RuntimeError, TypeError, ValueError) as exc:
            self._stale = True
            self._expires_at = self._clock() + min(30, self._config.refresh_seconds)
            logger.warning(
                "vnstock_snapshot_stale",
                extra={"error_type": type(exc).__name__},
            )
        finally:
            with self._lock:
                self._refreshing = False

    def _refresh_snapshot(self) -> None:
        references, vn30, sectors = self._gateway.reference_rows()
        metadata: dict[str, dict[str, object]] = {}
        for row in references:
            symbol = _text(row.get("symbol")).upper()
            exchange = _text(row.get("exchange")).upper().replace("HSX", "HOSE")
            if _STOCK_SYMBOL.fullmatch(symbol) and exchange in {"HOSE", "HNX", "UPCOM"}:
                metadata[symbol] = row
        symbols = sorted(metadata, key=lambda item: (item not in vn30, item))[
            : self._config.max_symbols
        ]
        quote_rows = self._gateway.quote_rows(symbols)
        quote_by_symbol = {
            _text(row.get("symbol")).upper(): row
            for row in quote_rows
            if _text(row.get("symbol"))
        }
        has_live_matches = any(
            _price(row.get("close_price")) > 0 for row in quote_by_symbol.values()
        )
        if quote_by_symbol and not has_live_matches:
            try:
                previous_rows = self._gateway.previous_session_rows(symbols)
                previous_by_symbol = {
                    _text(row.get("symbol")).upper(): row
                    for row in previous_rows
                    if _text(row.get("symbol"))
                }
                quote_by_symbol = {
                    symbol: {**quote, **previous_by_symbol.get(symbol, {})}
                    for symbol, quote in quote_by_symbol.items()
                }
            except (RuntimeError, TypeError, ValueError):
                logger.warning("vnstock_previous_session_unavailable")
        elif has_live_matches:
            quote_by_symbol = {
                symbol: (
                    {**quote, "close_price": quote.get("reference_price")}
                    if _price(quote.get("close_price")) <= 0
                    and _price(quote.get("reference_price")) > 0
                    else quote
                )
                for symbol, quote in quote_by_symbol.items()
            }
        instruments = tuple(
            item
            for symbol in symbols
            if (item := self._instrument_from_rows(
                symbol,
                metadata[symbol],
                quote_by_symbol.get(symbol),
                sectors.get(symbol, "Chưa phân loại"),
                symbol in vn30,
            ))
            is not None
        )
        if not instruments:
            raise ValueError("Vnstock returned no usable stock quotes")

        fetched_at = datetime.now(UTC)
        indices: list[MarketIndex] = []
        for symbol in _INDEX_EXCHANGE:
            try:
                rows = self._gateway.candle_rows(symbol, "1D", 90)
                candles = tuple(
                    candle
                    for row in rows
                    if (candle := _candle(row, symbol, fetched_at)) is not None
                )
                if candles:
                    indices.append(self._index_from_candles(symbol, rows, candles, instruments))
            except (RuntimeError, TypeError, ValueError):
                logger.warning("vnstock_index_unavailable", extra={"symbol": symbol})

        timestamps = [item.timestamp for index in indices for item in index.candles[-1:]]
        if has_live_matches:
            timestamps.extend(
                _timestamp(row.get("time"), fetched_at)
                for row in quote_rows
                if _text(row.get("time"))
            )
        self._instruments = instruments
        self._indices = tuple(indices)
        self._market_time = max(timestamps, default=fetched_at)
        self._expires_at = self._clock() + self._config.refresh_seconds
        self._stale = False

    @staticmethod
    def _instrument_from_rows(
        symbol: str,
        metadata: dict[str, object],
        quote: dict[str, object] | None,
        sector: str,
        is_vn30: bool,
    ) -> MarketInstrument | None:
        if quote is None:
            return None
        price = _price(quote.get("close_price"))
        reference = _price(quote.get("reference_price"))
        if price <= 0:
            return None
        volume = _decimal(quote.get("volume_accumulated"))
        matched_value = _decimal(quote.get("total_value"))
        if matched_value <= 0:
            matched_value = price * volume
        foreign_delta = _decimal(quote.get("foreign_buy_volume")) - _decimal(
            quote.get("foreign_sell_volume")
        )
        listed_shares = _decimal(
            quote.get("listed_shares"),
            _decimal(metadata.get("listed_shares")),
        )
        reasons = ["Thanh khoản trong phiên"] if matched_value > 0 else []
        if is_vn30:
            reasons.append("Thuộc rổ VN30")
        return MarketInstrument(
            symbol=symbol,
            name=_text(metadata.get("organ_name")) or symbol,
            exchange=_text(metadata.get("exchange")).upper().replace("HSX", "HOSE"),
            sector=sector,
            price=price,
            reference_price=reference or price,
            ceiling_price=_price(quote.get("ceiling_price")),
            floor_price=_price(quote.get("floor_price")),
            open_price=_price(quote.get("open_price")),
            high_price=_price(quote.get("high_price")),
            low_price=_price(quote.get("low_price")),
            volume=volume,
            matched_value=matched_value,
            foreign_net_value=foreign_delta * price,
            market_cap=listed_shares * price,
            pe=None,
            pb=None,
            eps=None,
            roe_percent=None,
            volume_vs_20d=Decimal(),
            interest_score=matched_value,
            interest_reasons=tuple(reasons),
            candles=(),
            is_vn30=is_vn30,
        )

    @staticmethod
    def _index_from_candles(
        symbol: str,
        rows: list[dict[str, object]],
        candles: tuple[Candle, ...],
        instruments: tuple[MarketInstrument, ...],
    ) -> MarketIndex:
        current = candles[-1]
        reference = candles[-2].close if len(candles) > 1 else current.open
        exchange = _INDEX_EXCHANGE[symbol]
        members = tuple(
            item
            for item in instruments
            if (exchange == "VN30" and item.is_vn30) or item.exchange == exchange
        )
        advances = sum(item.change > 0 for item in members)
        declines = sum(item.change < 0 for item in members)
        unchanged = len(members) - advances - declines
        ceiling = sum(
            item.ceiling_price > 0 and item.price >= item.ceiling_price for item in members
        )
        floor = sum(item.floor_price > 0 and item.price <= item.floor_price for item in members)
        latest_row = rows[-1] if rows else {}
        matched_value = _decimal(latest_row.get("value"))
        if matched_value <= 0:
            matched_value = sum((item.matched_value for item in members), Decimal())
        return MarketIndex(
            symbol=symbol,
            name=_INDEX_NAMES[symbol],
            value=current.close,
            reference_value=reference,
            open_value=current.open,
            high_value=current.high,
            low_value=current.low,
            volume=current.volume,
            matched_value=matched_value,
            advances=advances,
            declines=declines,
            unchanged=unchanged,
            ceiling_count=ceiling,
            floor_count=floor,
            candles=candles,
        )
