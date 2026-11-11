"""Vnstock-backed delayed market adapter for evaluation and local development.

Vnstock is a connector to third-party sources, not a licensed redistribution feed.
This adapter therefore labels every snapshot as source-delayed and partial, keeps
credentials server-side, and serves stale cached data instead of inventing values.
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from queue import Empty, Queue
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
_MAX_BATCH_QUOTE_SYMBOLS = 30
_QUOTE_BOARD_TIMEOUT_SECONDS = 5
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
_EVENT_DATE_FIELDS = {
    "exright_date": "ex_right_date",
    "ex_right_date": "ex_right_date",
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
    source_api_key: str | None = None


class VnstockGateway(Protocol):
    """Small owned boundary around the source-available Vnstock package."""

    def reference_rows(self) -> tuple[list[dict[str, object]], set[str], dict[str, str]]: ...

    def quote_rows(self, symbols: list[str]) -> list[dict[str, object]]: ...

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


_RESOURCES_DIR = Path(__file__).resolve().parent / "resources"
_SECTORS_FILE = _RESOURCES_DIR / "stock_sectors.json"


def _load_bundled_sectors() -> dict[str, str]:
    if not _SECTORS_FILE.exists():
        return {}
    try:
        with open(_SECTORS_FILE, encoding="utf-8") as file:
            data = json.load(file)
            if isinstance(data, dict):
                return {str(k).upper(): str(v) for k, v in data.items()}
    except Exception:
        logger.warning("failed_loading_bundled_sectors")
    return {}


_BUNDLED_SECTORS = _load_bundled_sectors()

class OfficialVnstockGateway:
    """Calls Vnstock 6's FHSC routes and returns plain Python records."""

    _EXCHANGES = ("HOSE", "HNX", "UPCOM")

    def __init__(self, api_key: str | None, source_api_key: str | None = None) -> None:
        if api_key:
            os.environ["VNSTOCK_API_KEY"] = api_key
        if source_api_key:
            os.environ["FHSC_API_KEY"] = source_api_key
        from vnstock import Fundamental, Market, Reference

        if not os.environ.get("FHSC_API_KEY"):
            logger.warning("vnstock_fhsc_api_key_missing_source_calls_will_fail")
        self._market = Market("fhsc")
        self._reference = Reference("fhsc")
        self._fundamental = Fundamental()
        self._screener_rows: list[dict[str, object]] = []
        self._market_time: str | None = None

    def reference_rows(self) -> tuple[list[dict[str, object]], set[str], dict[str, str]]:
        try:
            screener_rows = [
                row
                for exchange in self._EXCHANGES
                for row in _frame_records(
                    self._market.equity.screener(exchange=exchange, compat="v5")
                )
            ]
            members = _frame_records(self._reference.index("VN30").constituents())
        except (Exception, SystemExit) as exc:
            raise RuntimeError("Vnstock 6 FHSC market reference request failed") from exc

        self._market_time = None
        try:
            index_quote = _frame_records(self._market.index("VNINDEX").quote(compat="v5"))
            if index_quote:
                self._market_time = _text(index_quote[0].get("time")) or None
        except (Exception, SystemExit):
            logger.warning("vnstock_fhsc_market_timestamp_unavailable")

        self._screener_rows = screener_rows
        references: list[dict[str, object]] = []
        sectors = dict(_BUNDLED_SECTORS)
        for row in screener_rows:
            symbol = _text(row.get("symbol")).upper()
            sector = _text(row.get("sector_slug"))
            if not symbol:
                continue
            references.append(
                {
                    "symbol": symbol,
                    "exchange": row.get("exchange"),
                    "organ_name": row.get("name"),
                    "listed_shares": row.get("outstanding_shares"),
                    "sector_slug": sector,
                }
            )
            if sector:
                sectors[symbol] = sector
        vn30 = {
            _text(row.get("symbol")).upper()
            for row in members
            if _text(row.get("symbol"))
        }
        return references, vn30, sectors

    def quote_rows(self, symbols: list[str]) -> list[dict[str, object]]:
        quote_symbols = symbols[:_MAX_BATCH_QUOTE_SYMBOLS]
        wanted = {symbol.upper() for symbol in quote_symbols}
        screener_by_symbol = {
            _text(row.get("symbol")).upper(): row
            for row in self._screener_rows
            if _text(row.get("symbol"))
        }
        try:
            result_queue: Queue[tuple[bool, object]] = Queue(maxsize=1)

            def fetch_quote_board() -> None:
                try:
                    result_queue.put(
                        (True, self._market.equity.quote(quote_symbols, compat="v5"))
                    )
                except (Exception, SystemExit) as exc:
                    result_queue.put((False, exc))

            Thread(
                target=fetch_quote_board,
                name="vnstock-quote-board",
                daemon=True,
            ).start()
            try:
                succeeded, result = result_queue.get(timeout=_QUOTE_BOARD_TIMEOUT_SECONDS)
            except Empty:
                logger.warning("vnstock_fhsc_quote_board_timeout")
                return self._screener_quote_fallback(quote_symbols, screener_by_symbol)
            if not succeeded:
                cause = result if isinstance(result, BaseException) else None
                raise RuntimeError("FHSC quote board request failed") from cause
            quote_rows = _frame_records(result)
        except (Exception, SystemExit) as exc:
            logger.warning(
                "vnstock_fhsc_quote_board_unavailable",
                extra={"error_type": type(exc).__name__},
            )
            quote_rows = []
        quotes_by_symbol = {
            _text(row.get("symbol")).upper(): row
            for row in quote_rows
            if _text(row.get("symbol"))
        }

        rows: list[dict[str, object]] = []
        for symbol in quote_symbols:
            normalized = symbol.upper()
            screen = screener_by_symbol.get(normalized)
            if normalized not in wanted or screen is None:
                continue
            quote = quotes_by_symbol.get(normalized, {})
            screen_close = _optional_decimal(screen.get("close"))
            close_fallback = screen_close * Decimal("1000") if screen_close is not None else None
            change_percent = _optional_decimal(
                quote.get("price_change_percent", screen.get("price_change_percent"))
            )
            reference_fallback = None
            if close_fallback is not None and change_percent is not None:
                divisor = Decimal("1") + change_percent / Decimal("100")
                if divisor != 0:
                    reference_fallback = close_fallback / divisor

            quote_volume = _optional_decimal(quote.get("total_volume"))
            screen_volume = _optional_decimal(screen.get("total_volume"))
            quote_value = _optional_decimal(quote.get("total_value"))
            screen_value = _optional_decimal(screen.get("total_value"))
            rows.append(
                {
                    **screen,
                    **quote,
                    "symbol": normalized,
                    "close_price": _positive_or(quote.get("close_price"), close_fallback),
                    "reference_price": _positive_or(
                        quote.get("reference_price"), reference_fallback
                    ),
                    "volume_accumulated": _positive_or(quote_volume, screen_volume),
                    "total_value": _positive_or(quote_value, screen_value),
                    "time": quote.get("time") or self._market_time,
                }
            )
        return rows

    def _screener_quote_fallback(
        self, symbols: list[str], screener_by_symbol: dict[str, dict[str, object]]
    ) -> list[dict[str, object]]:
        rows: list[dict[str, object]] = []
        for symbol in symbols:
            screen = screener_by_symbol.get(symbol.upper())
            if screen is None:
                continue
            close = _optional_decimal(screen.get("close"))
            change_percent = _optional_decimal(screen.get("price_change_percent"))
            reference = None
            if close is not None and change_percent is not None:
                divisor = Decimal("1") + change_percent / Decimal("100")
                if divisor != 0:
                    reference = close * Decimal("1000") / divisor
            rows.append(
                {
                    **screen,
                    "symbol": symbol.upper(),
                    "close_price": close * Decimal("1000") if close is not None else None,
                    "reference_price": reference,
                    "time": self._market_time,
                }
            )
        return rows

    def candle_rows(
        self,
        symbol: str,
        interval: str,
        count: int,
    ) -> list[dict[str, object]]:
        try:
            asset = (
                self._market.index(symbol)
                if symbol in _INDEX_EXCHANGE
                else self._market.equity(symbol)
            )
            frame = asset.ohlcv(interval=interval, limit=count, compat="v5")
            return _frame_records(frame)
        except (Exception, SystemExit) as exc:
            raise RuntimeError("Vnstock candle request failed") from exc

    def fundamental_rows(self, symbol: str) -> list[dict[str, object]]:
        try:
            row = _frame_records(self._market.equity(symbol).summary())
            if row:
                latest = row[-1]
                return [
                    {"item_id": item_id, "value": latest.get(source_field)}
                    for item_id, source_field in (
                        ("pe_ratio", "pe"),
                        ("pb_ratio", "pb"),
                        ("trailing_eps", "eps"),
                        ("roe", "roe"),
                    )
                ]
        except (Exception, SystemExit) as exc:
            logger.warning(
                "vnstock_fundamental_summary_unavailable",
                extra={"symbol": symbol, "error_type": type(exc).__name__},
            )
        return []

    def fundamental_quarterly_rows(self, symbol: str) -> list[dict[str, object]]:
        try:
            equity = self._fundamental.equity(symbol)
            income_rows = _frame_records(
                equity.income_statement(
                    period="quarter",
                    format="time_series",
                    source="fhsc",
                )
            )
        except (Exception, SystemExit) as exc:
            raise RuntimeError("Vnstock 6 quarterly income statement request failed") from exc

        try:
            balance_rows = _frame_records(
                equity.balance_sheet(
                    period="quarter",
                    format="time_series",
                    source="fhsc",
                )
            )
        except (Exception, SystemExit) as exc:
            logger.warning(
                "vnstock_quarterly_balance_sheet_unavailable",
                extra={"symbol": symbol, "error_type": type(exc).__name__},
            )
            balance_rows = []
        return _quarterly_growth_rows(income_rows, balance_rows)

    def trade_rows(self, symbol: str, limit: int) -> list[dict[str, object]]:
        # FHSC v6 does not publish per-execution trades; its supported routes are DNSE/TCBS.
        return []

    def event_rows(self, symbol: str) -> list[dict[str, object]]:
        try:
            today = datetime.now(UTC).astimezone(_MARKET_TZ).date()
            frame = self._reference.company(symbol).events(
                start=today.isoformat(),
                end=(today + timedelta(days=_EVENT_WINDOW_DAYS)).isoformat(),
            )
            return _frame_records(frame)
        except (Exception, SystemExit) as exc:
            raise RuntimeError("Vnstock event request failed") from exc


def _text(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text.lower() in {"nan", "none", "nat"} else text


def _positive_or(value: object, fallback: object | None) -> Decimal:
    parsed = _optional_decimal(value)
    if parsed is not None and parsed > 0:
        return parsed
    fallback_value = _optional_decimal(fallback)
    return fallback_value if fallback_value is not None and fallback_value > 0 else Decimal()


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
    """FHSC v5-compatible equity prices are VND; keep the API contract in VND."""

    return _decimal(value)


def _latest_ratio(row: dict[str, object]) -> Decimal | None:
    direct = _optional_decimal(row.get("value"))
    if direct is not None:
        return direct
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


def _statement_value(row: dict[str, object], *item_ids: str) -> Decimal | None:
    for item_id in item_ids:
        value = _optional_decimal(row.get(item_id))
        if value is not None:
            return value
    return None


def _period_parts(value: object) -> tuple[int, int] | None:
    matched = re.fullmatch(r"(\d{4})-Q([1-4])", _text(value))
    return (int(matched.group(1)), int(matched.group(2))) if matched else None


def _quarter_index(period: tuple[int, int]) -> int:
    year, quarter = period
    return year * 4 + quarter - 1


def _quarterly_growth_rows(
    income_rows: list[dict[str, object]],
    balance_rows: list[dict[str, object]],
) -> list[dict[str, object]]:
    income_by_period: dict[tuple[int, int], dict[str, object]] = {}
    for row in income_rows:
        period = _period_parts(row.get("period"))
        if period is not None:
            income_by_period[period] = row

    balance_by_period: dict[tuple[int, int], dict[str, object]] = {}
    for row in balance_rows:
        period = _period_parts(row.get("period"))
        if period is not None:
            balance_by_period[period] = row

    periods = sorted(income_by_period)
    values_by_period: dict[tuple[int, int], dict[str, Decimal | None]] = {}
    for period in periods:
        income = income_by_period[period]
        balance = balance_by_period.get(period, {})
        values_by_period[period] = {
            "revenue": _statement_value(
                income,
                "IS_NET_REVENUE",
                "IS_REVENUE",
                "IS_TOTAL_OPERATING_INCOME",
                "IS_TOTAL_REVENUE",
            ),
            "profit": _statement_value(
                income,
                "IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY",
                "IS_NET_PROFIT_AFTER_TAX",
                "IS_PROFIT_AFTER_TAX",
            ),
            "gross_profit": _statement_value(income, "IS_GROSS_PROFIT"),
            "equity": _statement_value(
                balance,
                "BS_TOTAL_EQUITY",
                "BS_TOTAL_SHAREHOLDERS_EQUITY",
                "BS_OWNER_EQUITY",
            ),
            "assets": _statement_value(balance, "BS_TOTAL_ASSETS"),
            "current_assets": _statement_value(balance, "BS_CURRENT_ASSETS"),
            "current_liabilities": _statement_value(balance, "BS_CURRENT_LIABILITIES"),
            "liabilities": _statement_value(balance, "BS_TOTAL_LIABILITIES"),
        }

    normalized: list[dict[str, object]] = []
    for index, period in enumerate(periods):
        trailing_periods = periods[max(0, index - 3) : index + 1]
        if len(trailing_periods) != 4 or any(
            _quarter_index(right) - _quarter_index(left) != 1
            for left, right in zip(
                trailing_periods[:-1], trailing_periods[1:], strict=True
            )
        ):
            continue
        trailing_values = [values_by_period[item] for item in trailing_periods]
        revenues = [item["revenue"] for item in trailing_values]
        profits = [item["profit"] for item in trailing_values]
        if any(value is None for value in revenues + profits):
            continue
        revenue_ttm = sum((value for value in revenues if value is not None), Decimal())
        profit_ttm = sum((value for value in profits if value is not None), Decimal())
        gross_profits = [item["gross_profit"] for item in trailing_values]
        gross_profit_ttm = (
            sum((value for value in gross_profits if value is not None), Decimal())
            if all(value is not None for value in gross_profits)
            else None
        )

        current_balance = values_by_period[period]
        opening_period = next(
            (candidate for candidate in periods if _quarter_index(candidate) == _quarter_index(period) - 4),
            None,
        )
        opening_balance = values_by_period.get(opening_period, {}) if opening_period else {}
        equity = current_balance["equity"]
        opening_equity = opening_balance.get("equity")
        average_equity = (
            (equity + opening_equity) / Decimal("2")
            if equity is not None and opening_equity is not None
            else equity
        )
        assets = current_balance["assets"]
        opening_assets = opening_balance.get("assets")
        average_assets = (
            (assets + opening_assets) / Decimal("2")
            if assets is not None and opening_assets is not None
            else assets
        )
        current_assets = current_balance["current_assets"]
        current_liabilities = current_balance["current_liabilities"]
        liabilities = current_balance["liabilities"]
        year, quarter = period
        normalized.append(
            {
                "ratio_type": "RATIO_TTM",
                "year": year,
                "quarter": quarter,
                "revenue_ttm": revenue_ttm,
                "profit_ttm": profit_ttm,
                "roe": profit_ttm / average_equity if average_equity else None,
                "roa": profit_ttm / average_assets if average_assets else None,
                "after_tax_profit_margin": (
                    profit_ttm / revenue_ttm if revenue_ttm else None
                ),
                "gross_margin": (
                    gross_profit_ttm / revenue_ttm
                    if gross_profit_ttm is not None and revenue_ttm
                    else None
                ),
                "owners_equity": equity,
                "current_ratio": (
                    current_assets / current_liabilities
                    if current_assets is not None and current_liabilities
                    else None
                ),
                "debt_to_equity": (
                    liabilities / equity if liabilities is not None and equity else None
                ),
            }
        )
    return normalized


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
    title = " ".join(
        (
            _text(row.get("event_name_vi")),
            _text(row.get("event_title_vi")),
            _text(row.get("event_title")),
            _text(row.get("event_type")),
        )
    ).lower()
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
    if "dividend" in title or "cổ tức" in title:
        return "cash_dividend"
    if "meeting" in title or "đại hội" in title:
        return "shareholder_meeting"
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
    event_name = _text(row.get("event_type"))
    title = _text(row.get("event_title_vi")) or _text(row.get("event_title")) or event_name
    if not title:
        return None
    provider_id = _text(row.get("id")) or f"{normalized_symbol}-{event_day.isoformat()}"
    event_at = datetime.combine(event_day, datetime.min.time(), _MARKET_TZ).astimezone(UTC)
    return MarketEvent(
        id=f"vnstock-{provider_id}-{date_type}",
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
        source_name="FHSC qua Vnstock",
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
    p_open = opened * multiplier
    p_close = close * multiplier
    p_high = max(p_open, p_close, high * multiplier)
    p_low = max(Decimal("100"), min(p_open, p_close, low * multiplier))
    return Candle(
        timestamp=_timestamp(row.get("time"), fallback),
        open=p_open,
        high=p_high,
        low=p_low,
        close=p_close,
        volume=_decimal(row.get("volume")),
    )


class VnstockMarketProvider:
    """Cached Vnstock 6/FHSC snapshot normalized to InvestIQ's canonical contract."""

    slug = "vnstock-fhsc"
    display_name = "Vnstock · nguồn FHSC (có độ trễ)"
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
        self._gateway = gateway or OfficialVnstockGateway(config.api_key, config.source_api_key)
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
        # This metadata is also read from the WebSocket event loop. Snapshot loading
        # performs network I/O, so callers must not trigger it from a metadata getter.
        return self._market_time.isoformat().replace("+00:00", "Z")

    @property
    def freshness(self) -> str:
        return "stale" if self._stale else "fresh"

    @property
    def session(self) -> str:
        local = datetime.now(UTC).astimezone(_MARKET_TZ)
        if local.weekday() >= 5:
            return "closed"
        t = local.time()
        morning_open = time(9, 0)
        morning_close = time(11, 30)
        afternoon_open = time(13, 0)
        afternoon_close = time(14, 45)
        if morning_close < t < afternoon_open:
            return "lunch_break"
        if (morning_open <= t <= morning_close) or (afternoon_open <= t <= afternoon_close):
            return "open"
        return "closed"

    def instruments(self) -> tuple[MarketInstrument, ...]:
        self._ensure_snapshot()
        return self._instruments

    def warm_up(self) -> None:
        """Refresh the initial market snapshot without blocking the API event loop."""
        with self._lock:
            if self._refreshing or (self._instruments and self._clock() < self._expires_at):
                return
            self._refreshing = True
            Thread(
                target=self._refresh_snapshot_in_background,
                name="vnstock-market-warmup",
                daemon=True,
            ).start()

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
        count = 200 if interval in {"1d", "1h"} else 200
        try:
            rows = self._gateway.candle_rows(normalized, source_interval, count)
            fetched_at = datetime.now(UTC)
            values = tuple(
                item for row in rows if (item := _candle(row, normalized, fetched_at)) is not None
            )
        except (RuntimeError, TypeError, ValueError):
            logger.warning("vnstock_candles_unavailable", extra={"symbol": normalized})
            return cached[1] if cached else ()
        if not values and cached and cached[1]:
            return cached[1]
        if values:
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
        if self._refreshing:
            return
        with self._lock:
            if self._instruments and now < self._expires_at:
                return
            if self._refreshing:
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
        foreign_value = _optional_decimal(quote.get("foreign_net_value"))
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
        pe = _optional_decimal(quote.get("pe"))
        pb = _optional_decimal(quote.get("pb"))
        eps = _optional_decimal(quote.get("eps"))

        return MarketInstrument(
            symbol=symbol,
            name=_text(metadata.get("organ_name") or metadata.get("name")) or symbol,
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
            foreign_net_value=foreign_value if foreign_value is not None else foreign_delta * price,
            market_cap=_decimal(quote.get("market_cap"), listed_shares * price),
            pe=pe,
            pb=pb,
            eps=eps,
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
