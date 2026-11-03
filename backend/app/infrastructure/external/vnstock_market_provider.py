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
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from threading import RLock, Thread
from time import monotonic
from typing import Protocol
from zoneinfo import ZoneInfo

from app.application.use_cases.market_data.errors import MarketDataUnavailable
from app.domain.entities.market import (
    Candle,
    IntradayTrade,
    MarketDepthLevel,
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
_EVENT_CACHE_SECONDS = 30 * 60
_EVENT_MAX_WORKERS = 6
_EVENT_SYMBOL_LIMIT = 8
_EVENT_WINDOW_DAYS = 30
_EVENT_CODES = "DIV,ISS,DDIND,DDINS,DDRP,AGME,AGMR,EGME,AIS,MA,MOVE,NLIS,OTHE,RETU,SUSP"
_EVENT_DATE_FIELDS = {
    "exright_date": "ex_right_date",
    "record_date": "record_date",
    "payout_date": "payment_date",
    "issue_date": "issue_date",
    "listing_date": "effective_date",
    "start_date": "start_date",
    "end_date": "end_date",
    "display_date1": "event_date",
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

    def fundamental_quarterly_rows(self, symbol: str) -> list[dict[str, object]]: ...

    def trade_rows(self, symbol: str, limit: int) -> list[dict[str, object]]: ...

    def event_rows(self, symbol: str) -> list[dict[str, object]]: ...


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


def _snake_record(row: dict[str, object]) -> dict[str, object]:
    return {re.sub(r"(?<!^)(?=[A-Z])", "_", str(key)).lower(): value for key, value in row.items()}


def _latest_vci_fundamental_rows(
    rows: list[dict[str, object]],
) -> list[dict[str, object]]:
    """Normalize the newest VCI TTM quarter to the provider ratio-row shape."""

    latest = max(
        (
            row
            for row in rows
            if _text(row.get("ratio_type")).upper() == "RATIO_TTM"
            and 1 <= _integer(row.get("quarter")) <= 4
        ),
        key=lambda row: (
            _integer(row.get("year")),
            _integer(row.get("quarter")),
        ),
        default=None,
    )
    if latest is None:
        return []
    period = f"{_integer(latest.get('year'))}-Q{_integer(latest.get('quarter'))}"
    roe = _optional_decimal(latest.get("roe"))
    return [
        {"item_id": "pe_ratio", period: latest.get("pe")},
        {"item_id": "pb_ratio", period: latest.get("pb")},
        {"item_id": "roe", period: roe * Decimal("100") if roe is not None else None},
    ]


class OfficialVnstockGateway:
    """Calls Vnstock 4's unified API and returns plain Python records."""

    def __init__(self, api_key: str | None) -> None:
        if api_key:
            os.environ["VNSTOCK_API_KEY"] = api_key
        from vnstock import Company, Market, Reference, Trading
        from vnstock.core.utils.client import send_request
        from vnstock.core.utils.user_agent import get_headers
        from vnstock.explorer.vci.const import _VCI_EVENTS_URL

        self._market = Market()
        self._reference = Reference()
        self._company_type = Company
        self._trading_type = Trading
        self._event_url = _VCI_EVENTS_URL
        self._event_headers = get_headers(data_source="VCI")
        self._event_sender = send_request

    def reference_rows(self) -> tuple[list[dict[str, object]], set[str], dict[str, str]]:
        try:
            references = _frame_records(self._reference.equity.list_by_exchange(source="kbs"))
            vn30 = _series_strings(self._reference.equity.list_by_group(group="VN30", source="kbs"))
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
        if symbol not in _INDEX_EXCHANGE:
            try:
                frame = self._market.equity(symbol=symbol).ohlcv(
                    interval=interval,
                    count=count,
                    source="kbs",
                    get_all=True,
                )
                rows = _frame_records(frame)
                if rows:
                    return rows
            except (Exception, SystemExit):
                logger.warning(
                    "vnstock_kbs_candles_unavailable_using_vci",
                    extra={"symbol": symbol, "interval": interval},
                )
            try:
                frame = self._market.equity(symbol=symbol).ohlcv(
                    interval=interval,
                    count=count,
                    source="vci",
                    get_all=True,
                )
                return _frame_records(frame)
            except (Exception, SystemExit) as exc:
                raise RuntimeError("Vnstock candle request failed") from exc
        try:
            frame = self._market.index(symbol=symbol).ohlcv(
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
            frame = self._company_type(
                source="vci",
                symbol=symbol,
            ).ratio_summary()
            rows = _frame_records(frame)
        except (Exception, SystemExit) as exc:
            raise RuntimeError("Vnstock fundamental request failed") from exc

        # VCI returns the full ratio history in ascending order. Prefer the
        # newest trailing-twelve-month quarter so valuation ratios do not get
        # mixed with the annual row (quarter=5) for the same year.
        return _latest_vci_fundamental_rows(rows)

    def fundamental_quarterly_rows(self, symbol: str) -> list[dict[str, object]]:
        try:
            frame = self._company_type(
                source="vci",
                symbol=symbol,
            ).ratio_summary()
            return _frame_records(frame)
        except (Exception, SystemExit) as exc:
            logger.warning(
                "vnstock_quarterly_ratios_unavailable",
                extra={"symbol": symbol, "error": str(exc)},
            )
            return []

    def trade_rows(self, symbol: str, limit: int) -> list[dict[str, object]]:
        try:
            frame = self._market.equity(symbol=symbol).trades(
                source="kbs",
                page_size=limit,
                page=1,
                get_all=True,
            )
            return _frame_records(frame)
        except (Exception, SystemExit) as exc:
            raise RuntimeError("Vnstock intraday trade request failed") from exc

    def event_rows(self, symbol: str) -> list[dict[str, object]]:
        try:
            now = datetime.now(UTC).astimezone(_MARKET_TZ)
            payload = self._event_sender(
                url=self._event_url,
                headers=self._event_headers,
                method="GET",
                params={
                    "ticker": symbol,
                    "fromDate": (now - timedelta(days=365)).strftime("%Y%m%d"),
                    "toDate": now.strftime("%Y%m%d"),
                    "eventCode": _EVENT_CODES,
                    "page": 0,
                    "size": 50,
                },
                show_log=False,
                timeout=5,
            )
            data = payload.get("data", {})
            content = data.get("content", []) if isinstance(data, dict) else []
            if not isinstance(content, list):
                raise TypeError("VCI returned an invalid event page")
            return [_snake_record(row) for row in content if isinstance(row, dict)]
        except (Exception, SystemExit) as exc:
            raise RuntimeError("Vnstock event request failed") from exc


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
        _text(row.get("item_id")): _latest_ratio(row) for row in rows if _text(row.get("item_id"))
    }
    return (
        values.get("pe_ratio"),
        values.get("pb_ratio"),
        values.get("trailing_eps"),
        values.get("roe"),
    )


def _match_side(value: object) -> str:
    normalized = _text(value).lower()
    return normalized if normalized in {"buy", "sell", "ato", "atc"} else "unknown"


def _event_date(value: object) -> date | None:
    text = _text(value)
    if not text:
        return None
    try:
        return datetime.fromisoformat(text[:10]).date()
    except ValueError:
        return None


def _event_type(row: dict[str, object]) -> str:
    code = _text(row.get("event_code")).upper()
    title = " ".join((_text(row.get("event_name_vi")), _text(row.get("event_title_vi")))).lower()
    if code == "DIV":
        if "cổ phiếu" in title and "tiền mặt" not in title:
            return "stock_dividend"
        return "cash_dividend"
    if code in {"AGME", "AGMR", "EGME"}:
        return "shareholder_meeting"
    if code in {"DDIND", "DDINS", "DDRP"}:
        return "insider_trading"
    if code == "ISS":
        return "share_issuance"
    if code in {"AIS", "NLIS"}:
        return "additional_listing"
    return "corporate_action"


def _market_event(
    row: dict[str, object],
    symbol: str,
    window_start: date,
    window_end: date,
) -> MarketEvent | None:
    milestones = sorted(
        (
            (value, position, date_type)
            for position, (field, date_type) in enumerate(_EVENT_DATE_FIELDS.items())
            if (value := _event_date(row.get(field))) is not None
            and window_start <= value <= window_end
        ),
        key=lambda item: (item[0], item[1]),
    )
    if not milestones:
        return None
    event_day, _, date_type = milestones[0]
    normalized_symbol = _text(row.get("ticker")).upper() or symbol
    if not _STOCK_SYMBOL.fullmatch(normalized_symbol):
        return None
    event_name = _text(row.get("event_name_vi"))
    title = _text(row.get("event_title_vi")) or event_name
    if not title:
        return None
    provider_id = _text(row.get("id")) or f"{normalized_symbol}-{event_day.isoformat()}"
    event_at = datetime.combine(event_day, datetime.min.time(), _MARKET_TZ).astimezone(UTC)
    return MarketEvent(
        id=f"vci-{provider_id}-{date_type}",
        symbol=normalized_symbol,
        event_type=_event_type(row),
        title=title,
        summary=(
            f"{event_name}. Mốc thời gian theo lịch đã công bố của doanh nghiệp."
            if event_name and event_name.casefold() not in title.casefold()
            else "Mốc thời gian theo lịch đã công bố của doanh nghiệp."
        ),
        date_type=date_type,
        event_at=event_at,
        status="official",
        source_name="VCI qua Vnstock",
        source_url=None,
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
        today: Callable[[], date] | None = None,
    ) -> None:
        self._config = config
        self._gateway = gateway or OfficialVnstockGateway(config.api_key)
        self._clock = clock
        self._today = today or (lambda: datetime.now(UTC).astimezone(_MARKET_TZ).date())
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
        self._intraday_cache: dict[str, tuple[float, tuple[IntradayTrade, ...]]] = {}
        self._event_lock = RLock()
        self._event_cache: tuple[float, tuple[MarketEvent, ...]] | None = None
        self._growth_cache: dict[str, tuple[float, list[dict[str, object]]]] = {}

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
        self._ensure_snapshot()
        now = self._clock()
        cached = self._event_cache
        if cached and cached[0] > now:
            return cached[1]
        with self._event_lock:
            cached = self._event_cache
            if cached and cached[0] > now:
                return cached[1]
            values, successful_symbols = self._load_events()
            if successful_symbols == 0 and cached is not None:
                self._event_cache = (now + min(300, _EVENT_CACHE_SECONDS), cached[1])
                return cached[1]
            ttl = _EVENT_CACHE_SECONDS if successful_symbols else 60
            self._event_cache = (now + ttl, values)
            return values

    def _load_events(self) -> tuple[tuple[MarketEvent, ...], int]:
        symbols = [
            item.symbol
            for item in sorted(
                self._instruments,
                key=lambda item: item.interest_score,
                reverse=True,
            )[:_EVENT_SYMBOL_LIMIT]
        ]
        if not symbols:
            return (), 0
        window_start = self._today()
        window_end = window_start + timedelta(days=_EVENT_WINDOW_DAYS)
        events: dict[str, MarketEvent] = {}
        successful_symbols = 0
        with ThreadPoolExecutor(
            max_workers=min(_EVENT_MAX_WORKERS, len(symbols)),
            thread_name_prefix="vnstock-events",
        ) as executor:
            futures = {
                executor.submit(self._gateway.event_rows, symbol): symbol for symbol in symbols
            }
            for future in as_completed(futures):
                symbol = futures[future]
                try:
                    rows = future.result()
                except (RuntimeError, TypeError, ValueError):
                    logger.warning("vnstock_events_unavailable", extra={"symbol": symbol})
                    continue
                successful_symbols += 1
                for row in rows:
                    value = _market_event(row, symbol, window_start, window_end)
                    if value is not None:
                        events[value.id] = value
        return (
            tuple(sorted(events.values(), key=lambda item: (item.event_at, item.symbol, item.id))),
            successful_symbols,
        )

    def people(self) -> tuple[MarketPerson, ...]:
        from app.infrastructure.external.crawlers.leader_crawler import get_leader_crawler

        try:
            crawler = get_leader_crawler()
            instruments = self.instruments()
            return crawler.get_prominent_leaders(instruments)
        except Exception as exc:
            logger.warning("Failed to compute prominent leaders: %s", exc)
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

    def fundamental_growth_rows(self, symbol: str) -> list[dict[str, object]]:
        normalized = symbol.upper()
        now = self._clock()
        cached = self._growth_cache.get(normalized)
        if cached and cached[0] > now:
            return cached[1]
        try:
            rows = self._gateway.fundamental_quarterly_rows(normalized)
        except (RuntimeError, TypeError, ValueError):
            logger.warning("vnstock_growth_rows_unavailable", extra={"symbol": normalized})
            rows = []
        ttl = self._config.fundamental_cache_seconds
        if len(self._growth_cache) >= self._config.max_symbols:
            self._growth_cache.clear()
        self._growth_cache[normalized] = (now + ttl, rows)
        return rows

    def candles(self, symbol: str, interval: str) -> tuple[Candle, ...]:
        normalized = symbol.upper()
        if interval not in {"1d", "1h", "30m", "5m"}:
            return ()
        key = (normalized, interval)
        now = self._clock()
        cached = self._candle_cache.get(key)
        if cached and cached[0] > now:
            if interval == "1d":
                return self._with_current_daily_candle(normalized, cached[1])
            return cached[1]
        source_interval = {"1d": "1D", "1h": "1H", "30m": "30m", "5m": "5m"}[interval]
        count = 500 if interval in {"1d", "1h"} else 200
        try:
            rows = self._gateway.candle_rows(normalized, source_interval, count)
            fetched_at = datetime.now(UTC)
            values = tuple(
                item for row in rows if (item := _candle(row, normalized, fetched_at)) is not None
            )
        except (RuntimeError, TypeError, ValueError):
            logger.warning("vnstock_candles_unavailable", extra={"symbol": normalized})
            return cached[1] if cached else ()
        self._candle_cache[key] = (
            now + self._config.candle_cache_seconds,
            values,
        )
        return self._with_current_daily_candle(normalized, values) if interval == "1d" else values

    def intraday_trades(self, symbol: str, limit: int) -> tuple[IntradayTrade, ...]:
        normalized = symbol.upper()
        now = self._clock()
        cached = self._intraday_cache.get(normalized)
        if cached and cached[0] > now:
            return cached[1][-limit:]
        try:
            fetched_at = datetime.now(UTC)
            values = tuple(
                IntradayTrade(
                    timestamp=_timestamp(row.get("time"), fetched_at),
                    price=_decimal(row.get("price")) * Decimal("1000"),
                    volume=_decimal(row.get("volume")),
                    match_side=_match_side(row.get("match_type")),
                )
                for row in self._gateway.trade_rows(normalized, max(limit, 100))
                if _decimal(row.get("price")) > 0 and _decimal(row.get("volume")) > 0
            )
            values = tuple(sorted(values, key=lambda item: item.timestamp))
        except (RuntimeError, TypeError, ValueError):
            logger.warning("vnstock_intraday_trades_unavailable", extra={"symbol": normalized})
            return cached[1][-limit:] if cached else ()
        if len(self._intraday_cache) >= self._config.max_symbols:
            self._intraday_cache.clear()
        self._intraday_cache[normalized] = (
            now + min(60, self._config.candle_cache_seconds),
            values,
        )
        return values[-limit:]

    def _with_current_daily_candle(
        self,
        symbol: str,
        values: tuple[Candle, ...],
    ) -> tuple[Candle, ...]:
        instrument = next((item for item in self.instruments() if item.symbol == symbol), None)
        if (
            instrument is None
            or instrument.volume <= 0
            or min(
                instrument.open_price,
                instrument.high_price,
                instrument.low_price,
                instrument.price,
            )
            <= 0
        ):
            return values
        market_day = self._market_time.astimezone(_MARKET_TZ).date()
        timestamp = datetime.combine(market_day, datetime.min.time(), _MARKET_TZ).astimezone(UTC)
        observed = Candle(
            timestamp=timestamp,
            open=instrument.open_price,
            high=instrument.high_price,
            low=instrument.low_price,
            close=instrument.price,
            volume=instrument.volume,
        )
        if values and values[-1].timestamp.astimezone(_MARKET_TZ).date() == market_day:
            return (*values[:-1], observed)
        if values and values[-1].timestamp > observed.timestamp:
            return values
        return (*values, observed)

    def _with_fundamentals(self, value: MarketInstrument) -> MarketInstrument:
        now = self._clock()
        cached = self._fundamental_cache.get(value.symbol)
        if cached and cached[0] > now:
            fundamentals = cached[1]
        else:
            try:
                fundamentals = _fundamental_values(self._gateway.fundamental_rows(value.symbol))
                ttl = self._config.fundamental_cache_seconds
            except (RuntimeError, TypeError, ValueError):
                logger.warning(
                    "vnstock_fundamentals_unavailable",
                    extra={"symbol": value.symbol},
                )
                fundamentals = (
                    cached[1]
                    if cached and any(item is not None for item in cached[1])
                    else (None, None, None, None)
                )
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
            _text(row.get("symbol")).upper(): row for row in quote_rows if _text(row.get("symbol"))
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
            if (
                item := self._instrument_from_rows(
                    symbol,
                    metadata[symbol],
                    quote_by_symbol.get(symbol),
                    sectors.get(symbol, "Chưa phân loại"),
                    symbol in vn30,
                )
            )
            is not None
        )
        if not instruments:
            raise ValueError("Vnstock returned no usable stock quotes")

        fetched_at = datetime.now(UTC)
        indices: list[MarketIndex] = []
        for symbol in _INDEX_EXCHANGE:
            try:
                rows = self._gateway.candle_rows(symbol, "1D", 170)
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
        bid_levels = tuple(
            MarketDepthLevel(
                price=_price(quote.get(f"bid_price_{level}")),
                volume=_decimal(quote.get(f"bid_vol_{level}")),
            )
            for level in range(1, 4)
            if _price(quote.get(f"bid_price_{level}")) > 0
            and _decimal(quote.get(f"bid_vol_{level}")) > 0
        )
        ask_levels = tuple(
            MarketDepthLevel(
                price=_price(quote.get(f"ask_price_{level}")),
                volume=_decimal(quote.get(f"ask_vol_{level}")),
            )
            for level in range(1, 4)
            if _price(quote.get(f"ask_price_{level}")) > 0
            and _decimal(quote.get(f"ask_vol_{level}")) > 0
        )
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
            bid_levels=bid_levels,
            ask_levels=ask_levels,
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
