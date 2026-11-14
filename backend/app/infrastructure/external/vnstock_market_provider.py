"""Vnstock-backed delayed market adapter for evaluation and local development.

Vnstock is a connector to third-party sources, not a licensed redistribution feed.
This adapter therefore labels every snapshot as source-delayed and partial, keeps
credentials server-side, and serves stale cached data instead of inventing values.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import re
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from queue import Empty, Queue
from threading import Event as ThreadEvent
from threading import RLock, Thread, current_thread
from time import monotonic
from typing import Protocol
from zoneinfo import ZoneInfo

from app.application.use_cases.market_data.errors import MarketDataUnavailable
from app.domain.entities.market import (
    SUBSECTOR_PARENT_MAP,
    Candle,
    IntradayTrade,
    MarketDepthLevel,
    MarketEvent,
    MarketIndex,
    MarketInstrument,
    MarketPerson,
    resolve_sector_hierarchy,
    sector_parent,
)

logger = logging.getLogger(__name__)

_MARKET_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
_STOCK_SYMBOL = re.compile(r"^[A-Z]{3}$")
_MAX_FHSC_QUOTE_SYMBOLS = 30
_DNSE_STREAM_BATCH_SIZE = 200
_DNSE_STREAM_MAX_CONNECTIONS = 10
_QUOTE_BOARD_TIMEOUT_SECONDS = 10
_QUOTE_BOARD_BATCH_SIZE = 5
_DNSE_REQUEST_TIMEOUT_SECONDS = 3
_FUNDAMENTAL_REQUEST_TIMEOUT_SECONDS = 5
_CANDLE_REQUEST_TIMEOUT_SECONDS = 6
_INITIAL_SNAPSHOT_WAIT_SECONDS = 180
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
    dnse_api_key: str | None = None
    dnse_api_secret: str | None = None


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

    def order_book_rows(self, symbol: str) -> list[dict[str, object]]: ...

    def financial_statement_data(
        self, symbol: str, period_type: str, limit: int
    ) -> dict[str, object]: ...

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


def _aggregate_daily_candles(
    rows: list[dict[str, object]], interval: str, limit: int
) -> list[dict[str, object]]:
    """Aggregate observed daily bars into real weekly, monthly or yearly OHLCV bars."""
    norm = interval.upper()
    if norm not in {"1W", "1M", "1Y"}:
        return []
    grouped: dict[tuple[int, int], list[tuple[datetime, dict[str, object]]]] = {}
    fallback = datetime.now(UTC)
    for row in rows:
        timestamp = _timestamp(row.get("time"), fallback)
        day = timestamp.astimezone(_MARKET_TZ).date()
        if norm == "1W":
            key = (day.isocalendar().year, day.isocalendar().week)
        elif norm == "1M":
            key = (day.year, day.month)
        else:
            key = (day.year, 1)
        grouped.setdefault(key, []).append((timestamp, row))

    aggregated: list[dict[str, object]] = []
    for items in grouped.values():
        items.sort(key=lambda item: item[0])
        bars = [row for _, row in items]
        valid = [
            row
            for row in bars
            if all(_decimal(row.get(field)) > 0 for field in ("open", "high", "low", "close"))
        ]
        if not valid:
            continue
        aggregated.append(
            {
                "time": bars[0].get("time"),
                "open": _decimal(valid[0].get("open")),
                "high": max(_decimal(row.get("high")) for row in valid),
                "low": min(_decimal(row.get("low")) for row in valid),
                "close": _decimal(valid[-1].get("close")),
                "volume": sum((_decimal(row.get("volume")) for row in valid), Decimal()),
            }
        )
    aggregated.sort(key=lambda row: _timestamp(row.get("time"), fallback))
    return aggregated[-limit:]


def _bounded_call(call: Callable[[], object], *, timeout: int, operation: str) -> object:
    result_queue: Queue[tuple[bool, object]] = Queue(maxsize=1)

    def run() -> None:
        try:
            result_queue.put((True, call()))
        except BaseException as exc:
            result_queue.put((False, exc))

    Thread(target=run, name=f"vnstock-{operation}", daemon=True).start()
    try:
        succeeded, result = result_queue.get(timeout=timeout)
    except Empty as exc:
        raise TimeoutError(f"Vnstock {operation} timed out") from exc
    if not succeeded:
        cause = result if isinstance(result, BaseException) else None
        raise RuntimeError(f"Vnstock {operation} failed") from cause
    return result


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
_SECTOR_LABELS = {
    "basic-materials": "Nguyên vật liệu",
    "communication-services": "Dịch vụ viễn thông",
    "consumer-cyclical": "Hàng tiêu dùng không thiết yếu",
    "consumer-defensive": "Hàng tiêu dùng thiết yếu",
    "consumer-discretionary": "Hàng tiêu dùng không thiết yếu",
    "consumer-staples": "Hàng tiêu dùng thiết yếu",
    "construction-and-materials": "Xây dựng và Vật liệu",
    "energy": "Năng lượng",
    "financial-services": "Tài chính",
    "financials": "Tài chính",
    "healthcare": "Y tế",
    "industrials": "Công nghiệp",
    "real-estate": "Bất động sản",
    "technology": "Công nghệ",
    "telecommunications": "Viễn thông",
    "utilities": "Tiện ích",
}
_SUBSECTOR_PARENT_LABELS = SUBSECTOR_PARENT_MAP


def _sector_label(value: object) -> str:
    raw = _text(value)
    key = re.sub(r"[\s_]+", "-", raw.casefold()).strip("-")
    return _SECTOR_LABELS.get(key, raw)


def _sector_parent(subsector: object) -> str | None:
    return sector_parent(_text(subsector))


class DnseOhlcStream:
    """Subscribe to DNSE's authenticated daily OHLC stream in bounded batches."""

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        on_ohlc: Callable[[object], None],
    ) -> None:
        self._api_key = api_key
        self._api_secret = api_secret
        self._on_ohlc = on_ohlc
        self._lock = RLock()
        self._symbols: tuple[str, ...] = ()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._changed: asyncio.Event | None = None
        self._stopping: asyncio.Event | None = None
        self._thread: Thread | None = None
        self._ready = ThreadEvent()

    def set_symbols(self, symbols: list[str]) -> None:
        normalized = tuple(dict.fromkeys(symbol.upper() for symbol in symbols))
        normalized = normalized[: _DNSE_STREAM_BATCH_SIZE * _DNSE_STREAM_MAX_CONNECTIONS]
        with self._lock:
            if normalized == self._symbols:
                return
            self._symbols = normalized
            loop = self._loop
            changed = self._changed
            if self._thread is None or not self._thread.is_alive():
                self._ready.clear()
                self._thread = Thread(target=self._run, name="dnse-market-stream", daemon=True)
                self._thread.start()
                return
        if loop is not None and changed is not None:
            loop.call_soon_threadsafe(changed.set)

    def close(self) -> None:
        with self._lock:
            thread = self._thread
        if thread is not None and thread.is_alive():
            self._ready.wait(timeout=2)
        with self._lock:
            loop = self._loop
            stopping = self._stopping
        if loop is not None and stopping is not None:
            loop.call_soon_threadsafe(stopping.set)
        if thread is not None and thread is not current_thread():
            thread.join(timeout=8)

    def _run(self) -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        changed = asyncio.Event()
        stopping = asyncio.Event()
        with self._lock:
            self._loop = loop
            self._changed = changed
            self._stopping = stopping
        self._ready.set()
        try:
            loop.run_until_complete(self._serve(changed, stopping))
        except Exception as exc:
            logger.warning("dnse_ohlc_stream_stopped", extra={"error_type": type(exc).__name__})
        finally:
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()
            if pending:
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
            loop.close()
            with self._lock:
                self._loop = None
                self._changed = None
                self._stopping = None

    async def _serve(self, changed: asyncio.Event, stopping: asyncio.Event) -> None:
        while not stopping.is_set():
            with self._lock:
                symbols = self._symbols
            if not symbols:
                await self._wait_for_change(changed, stopping)
                continue
            batches = self._batches(symbols)
            streams = [
                asyncio.create_task(self._stream_batch(batch, stopping)) for batch in batches
            ]
            changed_task = asyncio.create_task(changed.wait())
            done, pending = await asyncio.wait(
                [*streams, changed_task], return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
            if changed_task in done:
                changed.clear()
            elif not stopping.is_set():
                logger.warning("dnse_ohlc_stream_batch_ended_restarting")
                await asyncio.sleep(5)

    @staticmethod
    def _batches(symbols: tuple[str, ...]) -> list[tuple[str, ...]]:
        return [
            symbols[offset : offset + _DNSE_STREAM_BATCH_SIZE]
            for offset in range(0, len(symbols), _DNSE_STREAM_BATCH_SIZE)
        ]

    async def _wait_for_change(self, changed: asyncio.Event, stopping: asyncio.Event) -> None:
        change_task = asyncio.create_task(changed.wait())
        stop_task = asyncio.create_task(stopping.wait())
        _, pending = await asyncio.wait(
            [change_task, stop_task], return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
        changed.clear()

    async def _stream_batch(self, symbols: tuple[str, ...], stopping: asyncio.Event) -> None:
        client = None
        try:
            from dnse.websocket.client import TradingClient

            client = TradingClient(
                api_key=self._api_key,
                api_secret=self._api_secret,
                base_url="wss://ws-openapi.dnse.com.vn",
                encoding="json",
                auto_reconnect=True,
                max_retries=10,
            )
            await client.connect()
            await client.subscribe_ohlc(
                list(symbols),
                resolution="1D",
                on_ohlc=self._on_ohlc,
                encoding="json",
            )
            await stopping.wait()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(
                "dnse_ohlc_stream_batch_unavailable",
                extra={"batch_size": len(symbols), "error_type": type(exc).__name__},
            )
        finally:
            if client is not None:
                try:
                    await client.disconnect()
                except Exception:
                    logger.warning("dnse_ohlc_stream_disconnect_failed")


class OfficialVnstockGateway:
    """Calls Vnstock 6's FHSC routes and returns plain Python records."""

    _EXCHANGES = ("HOSE", "HNX", "UPCOM")

    def __init__(
        self,
        api_key: str | None,
        source_api_key: str | None = None,
        dnse_api_key: str | None = None,
        dnse_api_secret: str | None = None,
    ) -> None:
        if api_key:
            os.environ["VNSTOCK_API_KEY"] = api_key
        if source_api_key:
            os.environ["FHSC_API_KEY"] = source_api_key
        if dnse_api_key:
            os.environ["DNSE_API_KEY"] = dnse_api_key
        if dnse_api_secret:
            os.environ["DNSE_API_SECRET"] = dnse_api_secret
        from vnstock import Fundamental, Market, Reference

        if not os.environ.get("FHSC_API_KEY"):
            logger.warning("vnstock_fhsc_api_key_missing_source_calls_will_fail")
        self._market = Market("fhsc")
        self._dnse_market = Market("dnse") if dnse_api_key and dnse_api_secret else None
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
        sectors = {
            symbol: resolve_sector_hierarchy("", name)[0]
            for symbol, name in _BUNDLED_SECTORS.items()
        }
        for row in screener_rows:
            symbol = _text(row.get("symbol")).upper()
            subsector = _BUNDLED_SECTORS.get(symbol, "")
            raw_sector = _sector_label(row.get("sector_slug"))
            sector, subsector = resolve_sector_hierarchy(raw_sector, subsector)
            if not symbol:
                continue
            references.append(
                {
                    "symbol": symbol,
                    "exchange": row.get("exchange"),
                    "organ_name": row.get("name"),
                    "listed_shares": row.get("outstanding_shares"),
                    "sector_slug": sector,
                    "subsector": subsector,
                }
            )
            if sector:
                sectors[symbol] = sector
        vn30 = {_text(row.get("symbol")).upper() for row in members if _text(row.get("symbol"))}
        return references, vn30, sectors

    def quote_rows(self, symbols: list[str]) -> list[dict[str, object]]:
        all_symbols = list(dict.fromkeys(symbol.upper() for symbol in symbols))
        fhsc_quote_symbols = all_symbols[:_MAX_FHSC_QUOTE_SYMBOLS]
        screener_by_symbol = {
            _text(row.get("symbol")).upper(): row
            for row in self._screener_rows
            if _text(row.get("symbol"))
        }
        # The exchange screener is the full-market baseline. FHSC's quote route is
        # per-symbol and rate-limited, so only the highest-priority 30 get the richer board.
        rows = self._screener_quote_fallback(all_symbols, screener_by_symbol)
        rows_by_symbol = {
            _text(row.get("symbol")).upper(): row for row in rows if _text(row.get("symbol"))
        }
        quote_rows: list[dict[str, object]] = []
        for offset in range(0, len(fhsc_quote_symbols), _QUOTE_BOARD_BATCH_SIZE):
            batch = fhsc_quote_symbols[offset : offset + _QUOTE_BOARD_BATCH_SIZE]

            def fetch_batch(batch: list[str] = batch) -> object:
                return self._market.equity.quote(batch, compat="v5")

            try:
                result = _bounded_call(
                    fetch_batch,
                    timeout=_QUOTE_BOARD_TIMEOUT_SECONDS,
                    operation="fhsc-quote-board",
                )
                quote_rows.extend(_frame_records(result))
            except (Exception, SystemExit) as exc:
                logger.warning(
                    "vnstock_fhsc_quote_board_batch_unavailable",
                    extra={"batch_size": len(batch), "error_type": type(exc).__name__},
                )
        quotes_by_symbol = {
            _text(row.get("symbol")).upper(): row for row in quote_rows if _text(row.get("symbol"))
        }
        for symbol in fhsc_quote_symbols:
            normalized = symbol.upper()
            base = rows_by_symbol.get(normalized)
            quote = quotes_by_symbol.get(normalized)
            if base is None or quote is None:
                continue
            merged = {key: value for key, value in quote.items() if value is not None}
            merged = {**base, **merged, "symbol": normalized}
            for field in (
                "close_price",
                "reference_price",
                "open_price",
                "high_price",
                "low_price",
                "ceiling_price",
                "floor_price",
            ):
                merged[field] = _positive_or(quote.get(field), base.get(field))
            merged["volume_accumulated"] = _positive_or(
                quote.get("total_volume"), base.get("volume_accumulated")
            )
            merged["total_value"] = _positive_or(quote.get("total_value"), base.get("total_value"))
            merged["time"] = quote.get("time") or base.get("time") or self._market_time
            rows_by_symbol[normalized] = merged

        dnse_market = getattr(self, "_dnse_market", None)
        if dnse_market is None or not rows_by_symbol:
            return list(rows_by_symbol.values())
        futures: dict[Future[dict[str, object] | None], str] = {}
        fhsc_priority = set(fhsc_quote_symbols)
        dnse_symbols: list[tuple[str, bool, bool]] = []
        for symbol, quote in rows_by_symbol.items():
            needs_last_trade = _positive_or(quote.get("close_price"), None) <= 0
            needs_daily_ohlc = symbol in fhsc_priority and any(
                _positive_or(quote.get(field), None) <= 0
                for field in ("open_price", "high_price", "low_price")
            )
            if needs_last_trade or needs_daily_ohlc:
                dnse_symbols.append((symbol, needs_last_trade, needs_daily_ohlc))
        if not dnse_symbols:
            return list(rows_by_symbol.values())
        executor = ThreadPoolExecutor(
            max_workers=min(6, len(dnse_symbols)), thread_name_prefix="dnse-last-trade"
        )
        for symbol, needs_last_trade, needs_daily_ohlc in dnse_symbols:
            futures[
                executor.submit(
                    self._dnse_last_trade_row,
                    symbol,
                    needs_last_trade,
                    needs_daily_ohlc,
                )
            ] = symbol
        dnse_by_symbol: dict[str, dict[str, object]] = {}
        try:
            for future in as_completed(futures, timeout=_DNSE_REQUEST_TIMEOUT_SECONDS):
                symbol = futures[future]
                try:
                    last_trade = future.result()
                except (Exception, SystemExit) as exc:
                    logger.warning(
                        "vnstock_dnse_last_trade_unavailable",
                        extra={"symbol": symbol, "error_type": type(exc).__name__},
                    )
                    continue
                if last_trade:
                    dnse_by_symbol[symbol.upper()] = last_trade
        except TimeoutError:
            logger.warning("vnstock_dnse_last_trade_batch_timeout")
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

        merged_rows: list[dict[str, object]] = []
        for symbol, row in rows_by_symbol.items():
            dnse = dnse_by_symbol.get(symbol)
            if dnse is None:
                merged_rows.append(row)
                continue
            merged = dict(row)
            last_price = _optional_decimal(dnse.get("price"))
            if last_price is not None and last_price > 0:
                merged["close_price"] = last_price * Decimal("1000")
            accumulated_volume = _optional_decimal(dnse.get("accumulated_volume"))
            if accumulated_volume is not None and accumulated_volume > 0:
                merged["volume_accumulated"] = accumulated_volume
            daily_ohlc = dnse.get("daily_ohlc")
            if isinstance(daily_ohlc, dict):
                session_time = dnse.get("time") or row.get("time")
                session_day = (
                    _timestamp(session_time, datetime.now(UTC)).astimezone(_MARKET_TZ).date()
                )
                candle_day = (
                    _timestamp(daily_ohlc.get("time"), datetime.now(UTC))
                    .astimezone(_MARKET_TZ)
                    .date()
                )
                if session_day == candle_day:
                    for field in ("open", "high", "low"):
                        value = _optional_decimal(daily_ohlc.get(field))
                        if value is not None and value > 0:
                            # Vnstock's v5 OHLCV prices are expressed in thousand VND.
                            merged[f"{field}_price"] = value * Decimal("1000")
            merged["time"] = dnse.get("time") or row.get("time")
            merged_rows.append(merged)
        return merged_rows

    def _dnse_last_trade_row(
        self,
        symbol: str,
        include_last_trade: bool = True,
        include_daily_ohlc: bool = False,
    ) -> dict[str, object] | None:
        market = self._dnse_market
        if market is None:
            return None
        last_trade: dict[str, object] = {}
        if include_last_trade:
            try:
                frame = _bounded_call(
                    lambda: market.equity(symbol).last_trade(),
                    timeout=_DNSE_REQUEST_TIMEOUT_SECONDS,
                    operation="dnse-last-trade",
                )
                rows = _frame_records(frame)
            except (Exception, SystemExit) as exc:
                logger.warning(
                    "vnstock_dnse_last_trade_unavailable",
                    extra={"symbol": symbol, "error_type": type(exc).__name__},
                )
            else:
                if rows:
                    last_trade = dict(rows[-1])
        if include_daily_ohlc:
            try:
                candles = _frame_records(
                    _bounded_call(
                        lambda: market.equity(symbol).ohlcv(interval="1D", length=1, compat="v5"),
                        timeout=_DNSE_REQUEST_TIMEOUT_SECONDS,
                        operation="dnse-daily-ohlc",
                    )
                )
            except (Exception, SystemExit) as exc:
                logger.warning(
                    "vnstock_dnse_daily_ohlc_unavailable",
                    extra={"symbol": symbol, "error_type": type(exc).__name__},
                )
            else:
                if candles:
                    last_trade["daily_ohlc"] = candles[-1]
        return last_trade or None

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
                    "volume_accumulated": _optional_decimal(screen.get("total_volume")),
                    "total_value": _optional_decimal(screen.get("total_value")),
                    "foreign_net_value": _optional_decimal(screen.get("foreign_net_value")),
                    "listed_shares": _optional_decimal(screen.get("outstanding_shares")),
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
        dnse_market = getattr(self, "_dnse_market", None)
        norm_interval = interval.upper() if interval.lower() in {"1w", "1m", "1y"} else interval
        source_interval = "1D" if norm_interval in {"1W", "1M", "1Y"} else interval
        is_daily_or_higher = norm_interval in {"1D", "1W", "1M", "1Y"}

        def _fetch_fhsc() -> list[dict[str, object]]:
            asset = (
                self._market.index(symbol)
                if symbol in _INDEX_EXCHANGE
                else self._market.equity(symbol)
            )
            frame = _bounded_call(
                lambda: asset.ohlcv(interval=source_interval, limit=count, compat="v5"),
                timeout=_CANDLE_REQUEST_TIMEOUT_SECONDS,
                operation="fhsc-candles",
            )
            rows = _frame_records(frame)
            if norm_interval in {"1W", "1M", "1Y"}:
                rows = _aggregate_daily_candles(rows, norm_interval, count)
            return rows

        def _fetch_dnse() -> list[dict[str, object]]:
            if dnse_market is None or symbol in _INDEX_EXCHANGE:
                return []
            frame = _bounded_call(
                lambda: dnse_market.equity(symbol).ohlcv(
                    interval=interval, limit=count, compat="v5"
                ),
                timeout=_DNSE_REQUEST_TIMEOUT_SECONDS,
                operation="dnse-candles",
            )
            return _frame_records(frame)

        # Daily/weekly/monthly candles come cleanly from FHSC without waiting for DNSE first;
        # intraday candles prefer DNSE and only fall back to FHSC if DNSE is empty/unavailable.
        if is_daily_or_higher:
            try:
                rows = _fetch_fhsc()
                if rows:
                    return rows
            except (Exception, SystemExit) as exc:
                logger.warning(
                    "vnstock_fhsc_candles_unavailable",
                    extra={"symbol": symbol, "interval": interval, "error_type": type(exc).__name__},
                )
            try:
                rows = _fetch_dnse()
                if rows:
                    return rows
            except (Exception, SystemExit) as exc:
                logger.warning(
                    "vnstock_dnse_candles_unavailable",
                    extra={"symbol": symbol, "error_type": type(exc).__name__},
                )
        else:
            try:
                rows = _fetch_dnse()
                if rows:
                    return rows
            except (Exception, SystemExit) as exc:
                logger.warning(
                    "vnstock_dnse_candles_unavailable_using_fhsc",
                    extra={"symbol": symbol, "error_type": type(exc).__name__},
                )
            try:
                rows = _fetch_fhsc()
                if rows:
                    return rows
            except (Exception, SystemExit) as exc:
                logger.warning(
                    "vnstock_fhsc_candles_unavailable",
                    extra={"symbol": symbol, "interval": interval, "error_type": type(exc).__name__},
                )
        raise RuntimeError("Vnstock candle request failed")

    def fundamental_rows(self, symbol: str) -> list[dict[str, object]]:
        try:
            frame = _bounded_call(
                lambda: self._market.equity(symbol).summary(),
                timeout=_FUNDAMENTAL_REQUEST_TIMEOUT_SECONDS,
                operation="fhsc-fundamental-summary",
            )
            row = _frame_records(frame)
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
            income_frame = _bounded_call(
                lambda: equity.income_statement(
                    period="quarter",
                    format="time_series",
                    source="fhsc",
                ),
                timeout=_FUNDAMENTAL_REQUEST_TIMEOUT_SECONDS,
                operation="fhsc-quarterly-income",
            )
            income_rows = _frame_records(income_frame)
        except (Exception, SystemExit) as exc:
            raise RuntimeError("Vnstock 6 quarterly income statement request failed") from exc

        try:
            balance_frame = _bounded_call(
                lambda: equity.balance_sheet(
                    period="quarter",
                    format="time_series",
                    source="fhsc",
                ),
                timeout=_FUNDAMENTAL_REQUEST_TIMEOUT_SECONDS,
                operation="fhsc-quarterly-balance",
            )
            balance_rows = _frame_records(balance_frame)
        except (Exception, SystemExit) as exc:
            logger.warning(
                "vnstock_quarterly_balance_sheet_unavailable",
                extra={"symbol": symbol, "error_type": type(exc).__name__},
            )
            balance_rows = []
        return _quarterly_growth_rows(income_rows, balance_rows)

    def financial_statement_data(
        self, symbol: str, period_type: str, limit: int
    ) -> dict[str, object]:
        try:
            equity = self._fundamental.equity(symbol)
        except (Exception, SystemExit) as exc:
            logger.warning(
                "vnstock_financial_statements_unavailable",
                extra={"symbol": symbol, "error_type": type(exc).__name__},
            )
            return _empty_financial_statement_data(symbol, period_type)

        tables: dict[str, list[dict[str, object]]] = {}
        for table_name, getter in (
            (
                "income_statement",
                lambda: equity.income_statement(
                    period=period_type, format="long", source="fhsc", compat="v5"
                ),
            ),
            (
                "balance_sheet",
                lambda: equity.balance_sheet(
                    period=period_type, format="long", source="fhsc", compat="v5"
                ),
            ),
            (
                "cash_flow",
                lambda: equity.cash_flow(
                    period=period_type, format="long", source="fhsc", compat="v5"
                ),
            ),
        ):
            try:
                frame = _bounded_call(
                    getter,
                    timeout=_FUNDAMENTAL_REQUEST_TIMEOUT_SECONDS,
                    operation=f"fhsc-{table_name.replace('_', '-')}",
                )
                tables[table_name] = _frame_records(frame)
            except (Exception, SystemExit) as exc:
                logger.warning(
                    "vnstock_financial_statement_table_unavailable",
                    extra={
                        "symbol": symbol,
                        "table": table_name,
                        "error_type": type(exc).__name__,
                    },
                )
                tables[table_name] = []
        return _financial_statement_data(symbol, period_type, tables, limit)

    def trade_rows(self, symbol: str, limit: int) -> list[dict[str, object]]:
        dnse_market = self._dnse_market
        if dnse_market is None:
            return []
        try:
            frame = _bounded_call(
                lambda: dnse_market.equity(symbol).trades(
                    limit=min(limit, 1000), board="G1", compat="v5"
                ),
                timeout=_DNSE_REQUEST_TIMEOUT_SECONDS,
                operation="dnse-trades",
            )
            return _frame_records(frame)
        except (Exception, SystemExit) as exc:
            raise RuntimeError("DNSE intraday trade request failed") from exc

    def order_book_rows(self, symbol: str) -> list[dict[str, object]]:
        dnse_market = self._dnse_market
        if dnse_market is None:
            return []
        try:
            frame = _bounded_call(
                # Vnstock 6.0.0's DNSE order_book route rejects the board argument,
                # while its default already selects the supported board.
                lambda: dnse_market.equity(symbol).order_book(compat="v5"),
                timeout=_DNSE_REQUEST_TIMEOUT_SECONDS,
                operation="dnse-order-book",
            )
            return _frame_records(frame)
        except (Exception, SystemExit) as exc:
            raise RuntimeError("DNSE order-book request failed") from exc

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
            for left, right in zip(trailing_periods[:-1], trailing_periods[1:], strict=True)
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
            (
                candidate
                for candidate in periods
                if _quarter_index(candidate) == _quarter_index(period) - 4
            ),
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
                "after_tax_profit_margin": (profit_ttm / revenue_ttm if revenue_ttm else None),
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


def _empty_financial_statement_data(symbol: str, period_type: str) -> dict[str, object]:
    return {
        "symbol": symbol,
        "period_type": period_type,
        "periods": [],
        "charts": [],
        "income_statement": [],
        "balance_sheet": [],
        "cash_flow": [],
        "source": "Vnstock 6 · FHSC (chưa có dữ liệu) ",
    }


def _financial_statement_data(
    symbol: str,
    period_type: str,
    tables: dict[str, list[dict[str, object]]],
    limit: int,
) -> dict[str, object]:
    period_values = {
        _text(row.get("period"))
        for rows in tables.values()
        for row in rows
        if _text(row.get("period"))
    }
    if not period_values:
        return _empty_financial_statement_data(symbol, period_type)

    def period_key(period: str) -> tuple[int, int]:
        matched = re.fullmatch(r"(\d{4})(?:-Q([1-4]))?", period)
        if matched is None:
            return (0, 0)
        return (int(matched.group(1)), int(matched.group(2) or 5))

    periods = sorted(period_values, key=period_key)[-limit:]
    normalized_tables: dict[str, list[dict[str, object]]] = {}
    for table_name, rows in tables.items():
        grouped: dict[str, dict[str, object]] = {}
        for row in rows:
            period = _text(row.get("period"))
            code = _text(row.get("id") or row.get("item_id"))
            name = _text(row.get("name") or row.get("item_name"))
            if period not in periods or not code:
                continue
            metric = grouped.setdefault(
                code,
                {"code": code, "name": name or code, "values": [None] * len(periods)},
            )
            value = _optional_decimal(row.get("value"))
            if value is not None:
                metric_values = metric.get("values")
                if isinstance(metric_values, list):
                    metric_values[periods.index(period)] = float(value)
        normalized_tables[table_name] = sorted(
            grouped.values(), key=lambda item: _text(item.get("code"))
        )

    def metric_series(table_name: str, item_ids: tuple[str, ...]) -> list[float | None]:
        for metric in normalized_tables.get(table_name, []):
            if _text(metric.get("code")) in item_ids:
                values = metric.get("values")
                if isinstance(values, list):
                    return [value if isinstance(value, float) else None for value in values]
        return [None] * len(periods)

    revenues = metric_series(
        "income_statement",
        ("IS_NET_REVENUE", "IS_REVENUE", "IS_TOTAL_OPERATING_INCOME", "IS_TOTAL_REVENUE"),
    )
    gross_profits = metric_series("income_statement", ("IS_GROSS_PROFIT",))
    net_profits = metric_series(
        "income_statement",
        (
            "IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY",
            "IS_NET_PROFIT_AFTER_TAX",
            "IS_PROFIT_AFTER_TAX",
        ),
    )
    assets = metric_series("balance_sheet", ("BS_TOTAL_ASSETS",))
    liabilities = metric_series("balance_sheet", ("BS_TOTAL_LIABILITIES",))
    equity = metric_series(
        "balance_sheet",
        (
            "BS_TOTAL_EQUITY",
            "BS_TOTAL_SHAREHOLDERS_EQUITY",
            "BS_OWNER_EQUITY",
            "BS_EQUITY",
            "BS_OWNERS_EQUITY",
        ),
    )
    charts: list[dict[str, object]] = []
    for index, period in enumerate(periods):
        revenue = revenues[index]
        gross_profit = gross_profits[index]
        net_profit = net_profits[index]
        total_assets = assets[index]
        total_liabilities = liabilities[index]
        total_equity = equity[index]
        charts.append(
            {
                "period": period,
                "revenue_billion": revenue / 1_000_000_000 if revenue is not None else None,
                "gross_profit_billion": (
                    gross_profit / 1_000_000_000 if gross_profit is not None else None
                ),
                "net_profit_billion": (
                    net_profit / 1_000_000_000 if net_profit is not None else None
                ),
                "gross_margin_percent": (
                    gross_profit * 100 / revenue
                    if gross_profit is not None and revenue not in {None, 0}
                    else None
                ),
                "net_margin_percent": (
                    net_profit * 100 / revenue
                    if net_profit is not None and revenue not in {None, 0}
                    else None
                ),
                "total_assets_billion": (
                    total_assets / 1_000_000_000 if total_assets is not None else None
                ),
                "total_debt_billion": (
                    total_liabilities / 1_000_000_000 if total_liabilities is not None else None
                ),
                "equity_billion": (
                    total_equity / 1_000_000_000 if total_equity is not None else None
                ),
            }
        )

    return {
        "symbol": symbol,
        "period_type": period_type,
        "periods": periods,
        "charts": charts,
        **normalized_tables,
        "source": "Vnstock 6 · FHSC",
    }


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

    slug = "vnstock-multi-source"
    delay_class = "source_delayed"
    partial = True

    @property
    def display_name(self) -> str:
        if self._config.dnse_api_key and self._config.dnse_api_secret:
            return "Vnstock · FHSC + DNSE"
        return "Vnstock · FHSC"

    def __init__(
        self,
        config: VnstockConfig,
        gateway: VnstockGateway | None = None,
        clock: Callable[[], float] = monotonic,
        today: Callable[[], date] | None = None,
    ) -> None:
        self._config = config
        self._gateway = gateway or OfficialVnstockGateway(
            config.api_key,
            config.source_api_key,
            config.dnse_api_key,
            config.dnse_api_secret,
        )
        self._clock = clock
        self._today = today or (lambda: datetime.now(UTC).astimezone(_MARKET_TZ).date())
        self._lock = RLock()
        self._expires_at = 0.0
        self._instruments: tuple[MarketInstrument, ...] = ()
        self._indices: tuple[MarketIndex, ...] = ()
        self._market_time = datetime.now(UTC)
        self._stale = False
        self._refreshing = False
        self._snapshot_ready = ThreadEvent()
        self._closed = False
        self._candle_cache: dict[tuple[str, str], tuple[float, tuple[Candle, ...]]] = {}
        self._fundamental_cache: dict[
            str,
            tuple[
                float,
                tuple[Decimal | None, Decimal | None, Decimal | None, Decimal | None],
            ],
        ] = {}
        self._intraday_cache: dict[str, tuple[float, tuple[IntradayTrade, ...]]] = {}
        self._order_book_cache: dict[str, tuple[float, list[dict[str, object]]]] = {}
        self._event_lock = RLock()
        self._event_cache: tuple[float, tuple[MarketEvent, ...]] | None = None
        self._growth_cache: dict[str, tuple[float, list[dict[str, object]]]] = {}
        self._financial_statement_cache: dict[
            tuple[str, str, int], tuple[float, dict[str, object]]
        ] = {}
        self._dnse_daily_ohlc: dict[str, object] = {}
        self._dnse_ohlc_stream = (
            DnseOhlcStream(
                config.dnse_api_key,
                config.dnse_api_secret,
                self._apply_dnse_ohlc,
            )
            if config.dnse_api_key and config.dnse_api_secret
            else None
        )

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
            self._snapshot_ready.clear()
            Thread(
                target=self._refresh_snapshot_in_background,
                name="vnstock-market-warmup",
                daemon=True,
            ).start()

    def close(self) -> None:
        """Stop provider-owned market streams during application shutdown."""
        with self._lock:
            self._closed = True
        if self._dnse_ohlc_stream is not None:
            self._dnse_ohlc_stream.close()

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
        value = self._with_fundamentals(value)
        return self._with_dnse_depth(value)

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

    def financial_statements(self, symbol: str, period_type: str, limit: int) -> dict[str, object]:
        normalized = symbol.upper()
        key = (normalized, period_type, limit)
        now = self._clock()
        cached = self._financial_statement_cache.get(key)
        if cached and cached[0] > now:
            return cached[1]
        try:
            result = self._gateway.financial_statement_data(normalized, period_type, limit)
        except (RuntimeError, TypeError, ValueError):
            logger.warning("vnstock_financial_statements_unavailable", extra={"symbol": normalized})
            result = _empty_financial_statement_data(normalized, period_type)
        has_complete_statements = all(
            isinstance(result.get(table), list) and bool(result[table])
            for table in ("income_statement", "balance_sheet", "cash_flow")
        )
        cache_seconds = (
            self._config.fundamental_cache_seconds
            if has_complete_statements
            else min(60, self._config.fundamental_cache_seconds)
        )
        if len(self._financial_statement_cache) >= self._config.max_symbols:
            self._financial_statement_cache.clear()
        self._financial_statement_cache[key] = (
            now + cache_seconds,
            result,
        )
        return result

    def candles(self, symbol: str, interval: str) -> tuple[Candle, ...]:
        normalized = symbol.upper()
        source_intervals = {
            "1d": "1D",
            "1w": "1W",
            "1M": "1M",
            "1m": "1M",
            "1y": "1Y",
            "1Y": "1Y",
            "1h": "1H",
            "30m": "30m",
            "5m": "5m",
        }
        if interval not in source_intervals:
            return ()
        key = (normalized, interval)
        now = self._clock()
        cached = self._candle_cache.get(key)
        if cached and cached[0] > now:
            if interval == "1d":
                return self._with_current_daily_candle(normalized, cached[1])
            return cached[1]
        source_interval = source_intervals[interval]
        count = {
            "1d": 500,
            "1w": 260,
            "1M": 600,
            "1m": 600,
            "1y": 600,
            "1Y": 600,
            "1h": 200,
            "30m": 200,
            "5m": 200,
        }[interval]
        try:
            rows = self._gateway.candle_rows(normalized, source_interval, count)
            fetched_at = datetime.now(UTC)
            values = tuple(
                item for row in rows if (item := _candle(row, normalized, fetched_at)) is not None
            )
        except (RuntimeError, TypeError, ValueError):
            logger.warning("vnstock_candles_unavailable", extra={"symbol": normalized})
            if cached and cached[1]:
                return cached[1]
            return self._db_candles_fallback(normalized, source_interval, count)
        if not values and cached and cached[1]:
            return cached[1]
        if not values:
            values = self._db_candles_fallback(normalized, source_interval, count)
        if values:
            self._candle_cache[key] = (
                now + self._config.candle_cache_seconds,
                values,
            )
            if interval == "1d" and not os.getenv("PYTEST_CURRENT_TEST"):
                self._persist_candles_async(normalized, source_interval, values)
        return self._with_current_daily_candle(normalized, values) if interval == "1d" else values

    def _persist_candles_async(
        self, symbol: str, source_interval: str, values: tuple[Candle, ...]
    ) -> None:
        def _save() -> None:
            try:
                from app.infrastructure.db.repositories.sql_market_candles_repository import (
                    SqlMarketCandlesRepository,
                )

                instrument = next(
                    (item for item in self._instruments if item.symbol == symbol), None
                )
                SqlMarketCandlesRepository().upsert_candles(
                    provider_slug="vnstock",
                    provider_name="Vnstock 6",
                    symbol=symbol,
                    exchange=instrument.exchange if instrument else "HOSE",
                    name=instrument.name if instrument else symbol,
                    instrument_type="index" if symbol in _INDEX_EXCHANGE else "stock",
                    interval=source_interval,
                    candles=values,
                )
            except Exception:
                pass

        Thread(target=_save, name=f"persist-candles-{symbol}", daemon=True).start()

    @staticmethod
    def _db_candles_fallback(symbol: str, source_interval: str, limit: int) -> tuple[Candle, ...]:
        if source_interval not in {"1D", "1W", "1M"}:
            return ()
        try:
            from app.infrastructure.db.repositories.sql_market_candles_repository import (
                SqlMarketCandlesRepository,
            )

            return SqlMarketCandlesRepository().get_candles(symbol, source_interval, limit)
        except Exception:
            return ()

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
            fallback = cached[1] if cached else ()
            self._intraday_cache[normalized] = (
                now + min(30, self._config.candle_cache_seconds),
                fallback,
            )
            return fallback[-limit:]
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
        try:
            instrument = next((item for item in self.instruments() if item.symbol == symbol), None)
        except Exception:
            return values
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

    def _with_dnse_depth(self, value: MarketInstrument) -> MarketInstrument:
        now = self._clock()
        cached = self._order_book_cache.get(value.symbol)
        if cached and cached[0] > now:
            rows = cached[1]
        else:
            try:
                rows = self._gateway.order_book_rows(value.symbol)
            except (RuntimeError, TypeError, ValueError):
                logger.warning(
                    "vnstock_dnse_order_book_unavailable", extra={"symbol": value.symbol}
                )
                rows = cached[1] if cached else []
            if len(self._order_book_cache) >= self._config.max_symbols:
                self._order_book_cache.clear()
            self._order_book_cache[value.symbol] = (now + 30.0, rows)
        if not rows:
            return value
        row = rows[-1]
        bid_levels = tuple(
            MarketDepthLevel(
                price=_price(row.get(f"bid_price_{level}")),
                volume=_decimal(row.get(f"bid_vol_{level}")),
            )
            for level in range(1, 4)
            if _price(row.get(f"bid_price_{level}")) > 0
            and _decimal(row.get(f"bid_vol_{level}")) > 0
        )
        ask_levels = tuple(
            MarketDepthLevel(
                price=_price(row.get(f"ask_price_{level}")),
                volume=_decimal(row.get(f"ask_vol_{level}")),
            )
            for level in range(1, 4)
            if _price(row.get(f"ask_price_{level}")) > 0
            and _decimal(row.get(f"ask_vol_{level}")) > 0
        )
        return replace(
            value,
            bid_levels=bid_levels or value.bid_levels,
            ask_levels=ask_levels or value.ask_levels,
        )

    def _ensure_snapshot(self) -> None:
        now = self._clock()
        if self._instruments and now < self._expires_at:
            return
        wait_for_initial_snapshot = False
        refresh_synchronously = False
        with self._lock:
            if self._instruments and now < self._expires_at:
                return
            if self._refreshing:
                if self._instruments:
                    return
                wait_for_initial_snapshot = True
            elif self._instruments:
                self._stale = True
                self._refreshing = True
                self._snapshot_ready.clear()
                Thread(
                    target=self._refresh_snapshot_in_background,
                    name="vnstock-market-refresh",
                    daemon=True,
                ).start()
                return
            else:
                self._refreshing = True
                self._snapshot_ready.clear()
                refresh_synchronously = True

        if wait_for_initial_snapshot:
            if not self._snapshot_ready.wait(timeout=_INITIAL_SNAPSHOT_WAIT_SECONDS):
                raise MarketDataUnavailable("Vnstock initial market snapshot is still loading")
            if not self._instruments:
                raise MarketDataUnavailable("Vnstock initial market snapshot is unavailable")
            return

        if refresh_synchronously:
            try:
                self._refresh_snapshot()
            except (RuntimeError, TypeError, ValueError) as exc:
                self._stale = True
                self._expires_at = self._clock() + min(30, self._config.refresh_seconds)
                raise MarketDataUnavailable("Vnstock snapshot is unavailable") from exc
            finally:
                with self._lock:
                    self._refreshing = False
                    self._snapshot_ready.set()

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
                self._snapshot_ready.set()

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
                rows = self._gateway.candle_rows(symbol, "1D", 500)
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
        for daily_ohlc in tuple(self._dnse_daily_ohlc.values()):
            self._apply_dnse_ohlc(daily_ohlc)
        if self._dnse_ohlc_stream is not None and not self._closed:
            self._dnse_ohlc_stream.set_symbols(symbols)

    def _apply_dnse_ohlc(self, event: object) -> None:
        """Merge only today's complete DNSE daily candle into the FHSC baseline."""
        symbol = _text(getattr(event, "symbol", None)).upper()
        if not _STOCK_SYMBOL.fullmatch(symbol) or _text(getattr(event, "resolution", None)) != "1D":
            return
        try:
            updated_at = int(getattr(event, "lastUpdated", 0))
            timestamp = datetime.fromtimestamp(updated_at, UTC)
        except (OverflowError, OSError, TypeError, ValueError):
            return
        if timestamp.astimezone(_MARKET_TZ).date() != self._today():
            return
        fields = {
            name: _optional_decimal(getattr(event, name, None))
            for name in ("open", "high", "low", "close", "volume")
        }
        opened, high, low, close = (fields[name] for name in ("open", "high", "low", "close"))
        if (
            opened is None
            or high is None
            or low is None
            or close is None
            or min(opened, high, low, close) <= 0
            or high < max(opened, close)
            or low > min(opened, close)
        ):
            return
        with self._lock:
            self._dnse_daily_ohlc[symbol] = event
            updated: list[MarketInstrument] = []
            found = False
            for instrument in self._instruments:
                if instrument.symbol != symbol:
                    updated.append(instrument)
                    continue
                found = True
                updated.append(
                    replace(
                        instrument,
                        price=close * Decimal("1000"),
                        open_price=opened * Decimal("1000"),
                        high_price=high * Decimal("1000"),
                        low_price=low * Decimal("1000"),
                        volume=fields["volume"] or instrument.volume,
                    )
                )
            if found:
                self._instruments = tuple(updated)
            self._market_time = max(self._market_time, timestamp)

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
        parent_sector, subsector = resolve_sector_hierarchy(
            sector, _text(metadata.get("subsector"))
        )

        return MarketInstrument(
            symbol=symbol,
            name=_text(metadata.get("organ_name") or metadata.get("name")) or symbol,
            exchange=_text(metadata.get("exchange")).upper().replace("HSX", "HOSE"),
            sector=parent_sector,
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
            subsector=subsector,
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
