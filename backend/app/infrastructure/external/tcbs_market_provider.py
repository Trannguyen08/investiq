"""TCBS iFlash OpenAPI adapter for canonical InvestIQ market entities."""

from __future__ import annotations

import asyncio
import base64
import http.client
import json
import logging
import random
import threading
import time
from collections.abc import Callable, Mapping
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from datetime import time as wall_time
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode, urlsplit
from zoneinfo import ZoneInfo

from websockets.asyncio.client import ClientConnection, connect
from websockets.exceptions import ConnectionClosed

from app.application.use_cases.market_data.errors import MarketDataUnavailable
from app.domain.entities.market import (
    Candle,
    MarketEvent,
    MarketIndex,
    MarketInstrument,
    MarketPerson,
)

logger = logging.getLogger("investiq.market.tcbs")

_MARKET_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
_BOARD_EXCHANGES = {1: "HOSE", 2: "HOSE", 3: "HNX", 5: "UPCOM"}
_INDEXES = {
    1: ("VNINDEX", "VN-Index"),
    2: ("VN30", "VN30-Index"),
    3: ("HNXINDEX", "HNX-Index"),
    5: ("UPCOMINDEX", "UPCoM-Index"),
}
_TRADE_PLACES = {"001": "HOSE", "002": "HNX", "005": "UPCOM"}
_ZERO = Decimal("0")


class TcbsProviderError(MarketDataUnavailable):
    """Safe, normalized TCBS provider failure."""


class TcbsAuthenticationError(TcbsProviderError):
    """TCBS rejected or cannot issue the configured access token."""


class TcbsTransientError(TcbsProviderError):
    def __init__(self, message: str, retry_after: float | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


@dataclass(frozen=True, slots=True)
class TcbsConfig:
    api_base_url: str
    ws_url: str
    api_key: str | None
    otp: str | None
    access_token: str | None
    request_timeout_seconds: float
    quote_refresh_seconds: float
    security_refresh_seconds: int
    retry_attempts: int
    circuit_failure_threshold: int
    circuit_open_seconds: int
    max_response_bytes: int = 4 * 1024 * 1024


@dataclass(frozen=True, slots=True)
class TcbsRequest:
    method: str
    path: str
    query: Mapping[str, str]
    headers: Mapping[str, str]
    body: bytes | None
    connect_timeout: float
    read_timeout: float
    total_timeout: float
    max_response_bytes: int


Transport = Callable[[TcbsRequest], object]


def _decimal(value: object, default: Decimal = _ZERO) -> Decimal:
    if value is None or isinstance(value, bool):
        return default
    try:
        parsed = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return default
    return parsed if parsed.is_finite() else default


def _integer(value: object) -> int:
    parsed = _decimal(value)
    return int(parsed) if parsed >= 0 else 0


def _row(value: object) -> dict[str, object] | None:
    return value if isinstance(value, dict) else None


def parse_tcbs_stream_message(message: str) -> tuple[str, dict[str, object]] | None:
    """Parse one bounded TCBS text frame without accepting binary or malformed payloads."""
    if len(message) > 1024 * 1024 or not message.startswith("s|"):
        return None
    parts = message.split("|", 2)
    if len(parts) != 3 or not parts[1].isdigit():
        return None
    try:
        payload = json.loads(parts[2])
    except json.JSONDecodeError:
        return None
    return (parts[1], payload) if isinstance(payload, dict) else None


class _HttpsTransport:
    """Small HTTPS-only JSON transport with explicit connect/read/total budgets."""

    def __init__(self, base_url: str) -> None:
        parsed = urlsplit(base_url)
        if parsed.scheme != "https" or not parsed.hostname:
            raise ValueError("TCBS API base URL must be HTTPS")
        self._host = parsed.hostname
        self._port = parsed.port or 443
        self._prefix = parsed.path.rstrip("/")

    def __call__(self, request: TcbsRequest) -> object:
        started = time.monotonic()
        suffix = f"?{urlencode(request.query)}" if request.query else ""
        connection = http.client.HTTPSConnection(
            self._host,
            self._port,
            timeout=request.connect_timeout,
        )
        try:
            connection.request(
                request.method,
                f"{self._prefix}{request.path}{suffix}",
                body=request.body,
                headers=dict(request.headers),
            )
            remaining = request.total_timeout - (time.monotonic() - started)
            if remaining <= 0:
                raise TcbsTransientError("TCBS request timed out")
            if connection.sock is not None:
                connection.sock.settimeout(min(request.read_timeout, remaining))
            response = connection.getresponse()
            payload = response.read(request.max_response_bytes + 1)
            if len(payload) > request.max_response_bytes:
                raise TcbsProviderError("TCBS response exceeded the configured size limit")
            if response.status in {401, 403}:
                raise TcbsAuthenticationError("TCBS access token was rejected")
            if response.status == 429 or response.status >= 500:
                retry_after = response.getheader("Retry-After")
                try:
                    retry_seconds = min(float(retry_after), 10.0) if retry_after else None
                except ValueError:
                    retry_seconds = None
                raise TcbsTransientError("TCBS is temporarily unavailable", retry_seconds)
            if not 200 <= response.status < 300:
                raise TcbsProviderError("TCBS rejected the request")
            if time.monotonic() - started > request.total_timeout:
                raise TcbsTransientError("TCBS request timed out")
            try:
                return json.loads(payload)
            except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                raise TcbsProviderError("TCBS returned invalid JSON") from exc
        except (TimeoutError, OSError) as exc:
            raise TcbsTransientError("TCBS network request failed") from exc
        finally:
            connection.close()


class TcbsRestClient:
    """Authenticated, bounded TCBS REST client with retry and circuit isolation."""

    def __init__(
        self,
        config: TcbsConfig,
        transport: Transport | None = None,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        self._config = config
        self._transport = transport or _HttpsTransport(config.api_base_url)
        self._sleeper = sleeper
        self._lock = threading.Lock()
        self._token_exchange_lock = threading.Lock()
        self._cached_token: str | None = config.access_token
        self._token_valid_until = float("inf") if config.access_token else 0.0
        self._token_exchange_attempted = False
        self._failure_count = 0
        self._circuit_open_until = 0.0

    def _request(
        self,
        method: str,
        path: str,
        *,
        query: Mapping[str, str] | None = None,
        body: Mapping[str, str] | None = None,
        authenticated: bool = True,
        attempts: int | None = None,
    ) -> object:
        with self._lock:
            if self._circuit_open_until > time.monotonic():
                raise TcbsProviderError("TCBS circuit is temporarily open")
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if authenticated:
            headers["Authorization"] = f"Bearer {self.access_token()}"
        encoded = json.dumps(body, separators=(",", ":")).encode() if body is not None else None
        allowed_attempts = attempts or self._config.retry_attempts
        for attempt in range(allowed_attempts):
            try:
                result = self._transport(
                    TcbsRequest(
                        method=method,
                        path=path,
                        query=query or {},
                        headers=headers,
                        body=encoded,
                        connect_timeout=min(2.0, self._config.request_timeout_seconds),
                        read_timeout=min(3.0, self._config.request_timeout_seconds),
                        total_timeout=self._config.request_timeout_seconds,
                        max_response_bytes=self._config.max_response_bytes,
                    )
                )
            except TcbsTransientError as exc:
                self._record_failure()
                if attempt + 1 >= allowed_attempts:
                    raise
                delay = exc.retry_after
                if delay is None:
                    delay = min(1.5, 0.2 * (2**attempt) + random.uniform(0.0, 0.1))
                self._sleeper(delay)
            except TcbsProviderError:
                self._record_failure()
                raise
            else:
                self._record_success()
                return result
        raise TcbsProviderError("TCBS request failed")

    def _record_failure(self) -> None:
        with self._lock:
            self._failure_count += 1
            if self._failure_count >= self._config.circuit_failure_threshold:
                self._circuit_open_until = time.monotonic() + self._config.circuit_open_seconds
                self._failure_count = 0

    def _record_success(self) -> None:
        with self._lock:
            self._failure_count = 0
            self._circuit_open_until = 0.0

    def access_token(self) -> str:
        # Quote polling and the upstream stream start together. Serialize their first
        # token request so both reuse one OTP exchange instead of racing each other.
        with self._token_exchange_lock:
            with self._lock:
                if self._cached_token and time.monotonic() < self._token_valid_until:
                    return self._cached_token
                if self._token_exchange_attempted:
                    raise TcbsAuthenticationError(
                        "TCBS token expired; provide a new TCBS_ACCESS_TOKEN "
                        "or TCBS_OTP and restart"
                    )
                if not self._config.api_key or not self._config.otp:
                    raise TcbsAuthenticationError("TCBS credentials are incomplete")
                self._token_exchange_attempted = True
                api_key = self._config.api_key
                otp = self._config.otp
            response = self._request(
                "POST",
                "/gaia/v1/oauth2/openapi/token",
                body={"apiKey": api_key, "otp": otp},
                authenticated=False,
                attempts=1,
            )
            token = response.get("token") if isinstance(response, dict) else None
            if not isinstance(token, str) or not token.strip():
                raise TcbsAuthenticationError("TCBS did not issue an access token")
            with self._lock:
                self._cached_token = token.strip()
                self._token_valid_until = time.monotonic() + (7 * 60 * 60 + 45 * 60)
                return self._cached_token

    def get(self, path: str, query: Mapping[str, str] | None = None) -> object:
        return self._request("GET", path, query=query)


class TcbsMarketProvider:
    """Normalize TCBS market snapshots while exposing gaps as partial data."""

    slug = "tcbs-iflash"
    display_name = "TCBS iFlash OpenAPI"
    delay_class = "realtime"
    partial = True

    def __init__(
        self,
        config: TcbsConfig,
        *,
        transport: Transport | None = None,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        self._config = config
        self._client = TcbsRestClient(config, transport=transport, sleeper=sleeper)
        self._state_lock = threading.RLock()
        self._refresh_lock = threading.Lock()
        self._securities: dict[str, dict[str, object]] = {}
        self._quote_rows: dict[str, dict[str, object]] = {}
        self._instruments: dict[str, MarketInstrument] = {}
        self._indices: dict[str, MarketIndex] = {}
        self._last_quote_refresh = 0.0
        self._last_security_refresh = 0.0
        self._market_time = datetime.now(UTC)
        self._stop_event: asyncio.Event | None = None
        self._tasks: list[asyncio.Task[None]] = []

    @property
    def market_time(self) -> str:
        with self._state_lock:
            return self._market_time.isoformat().replace("+00:00", "Z")

    @property
    def freshness(self) -> str:
        with self._state_lock:
            age = time.monotonic() - self._last_quote_refresh
            has_data = bool(self._instruments)
        return (
            "fresh"
            if has_data and age <= max(15.0, self._config.quote_refresh_seconds * 3)
            else "stale"
        )

    @property
    def session(self) -> str:
        now = datetime.now(_MARKET_TZ)
        if now.weekday() >= 5:
            return "closed"
        current = now.time()
        if wall_time(9, 0) <= current <= wall_time(11, 30) or wall_time(
            13, 0
        ) <= current <= wall_time(15, 0):
            return "open"
        return "closed"

    async def start(self) -> None:
        if self._tasks:
            return
        self._stop_event = asyncio.Event()
        self._tasks = [
            asyncio.create_task(self._quote_loop(), name="tcbs-quote-refresh"),
            asyncio.create_task(self._stream_loop(), name="tcbs-index-stream"),
        ]

    async def close(self) -> None:
        if self._stop_event is not None:
            self._stop_event.set()
        for task in self._tasks:
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()

    async def _quote_loop(self) -> None:
        while self._stop_event is not None and not self._stop_event.is_set():
            try:
                await asyncio.to_thread(self._refresh_quotes, True)
                delay = self._config.quote_refresh_seconds
            except MarketDataUnavailable:
                logger.warning("TCBS quote refresh failed")
                delay = max(15.0, self._config.quote_refresh_seconds)
            await asyncio.sleep(delay)

    async def _stream_loop(self) -> None:
        attempt = 0
        while self._stop_event is not None and not self._stop_event.is_set():
            try:
                token = await asyncio.to_thread(self._client.access_token)
                async with connect(
                    self._config.ws_url,
                    ping_interval=None,
                    ping_timeout=None,
                    open_timeout=self._config.request_timeout_seconds,
                    close_timeout=3,
                    max_size=1024 * 1024,
                    max_queue=32,
                ) as upstream:
                    encoded = base64.b64encode(token.encode()).decode()
                    await upstream.send(f"d|a|||{encoded}")
                    await self._await_stream_auth(upstream)
                    # Request an immediate index snapshot so a backend restart outside
                    # trading hours does not leave the index routes empty until the next tick.
                    await upstream.send("d|r|si||1,2,3,5")
                    await upstream.send("d|s|si|rt|1,2,3,5")
                    heartbeat = asyncio.create_task(self._heartbeat(upstream))
                    attempt = 0
                    try:
                        async for message in upstream:
                            if isinstance(message, str):
                                self.apply_stream_message(message)
                    finally:
                        heartbeat.cancel()
                        await asyncio.gather(heartbeat, return_exceptions=True)
            except asyncio.CancelledError:
                raise
            except TcbsAuthenticationError:
                logger.error(
                    "TCBS stream authentication failed; new OTP or access token is required"
                )
                return
            except (ConnectionClosed, OSError, TimeoutError, TcbsProviderError):
                attempt += 1
                logger.warning(
                    "TCBS stream disconnected; reconnect scheduled", extra={"attempt": attempt}
                )
                await asyncio.sleep(min(30.0, float(2 ** min(attempt - 1, 5))))

    async def _await_stream_auth(self, upstream: ClientConnection) -> None:
        for _ in range(3):
            message = await asyncio.wait_for(upstream.recv(), timeout=5.0)
            if not isinstance(message, str) or not message.startswith("d|0|"):
                continue
            try:
                payload = json.loads(message.split("|", 2)[2])
            except json.JSONDecodeError as exc:
                raise TcbsAuthenticationError("TCBS stream authentication was invalid") from exc
            if isinstance(payload, dict) and payload.get("success") is True:
                return
            raise TcbsAuthenticationError("TCBS stream authentication was rejected")
        raise TcbsAuthenticationError("TCBS stream authentication timed out")

    async def _heartbeat(self, upstream: ClientConnection) -> None:
        while True:
            await asyncio.sleep(2)
            await upstream.send("d|p|||")

    def apply_stream_message(
        self,
        message: str,
        *,
        received_at: datetime | None = None,
    ) -> bool:
        parsed = parse_tcbs_stream_message(message)
        if parsed is None or parsed[0] != "8":
            return False
        payload = parsed[1]
        board = _integer(payload.get("indexNumber"))
        identity = _INDEXES.get(board)
        if identity is None:
            return False
        value = _decimal(payload.get("index"))
        change = _decimal(payload.get("change"))
        reference = value - change
        if value <= 0 or reference <= 0:
            return False
        symbol, name = identity
        observed_at = received_at or datetime.now(UTC)
        if observed_at.tzinfo is None:
            observed_at = observed_at.replace(tzinfo=UTC)
        observed_at = observed_at.astimezone(UTC)
        bucket = observed_at.replace(minute=observed_at.minute // 5 * 5, second=0, microsecond=0)
        with self._state_lock:
            previous = self._indices.get(symbol)
            previous_candles = list(previous.candles) if previous else []
            same_session = bool(
                previous_candles
                and previous_candles[-1].timestamp.astimezone(_MARKET_TZ).date()
                == bucket.astimezone(_MARKET_TZ).date()
            )
            if not same_session:
                previous_candles = []
            opening = previous.open_value if previous and same_session else value
            high = max(previous.high_value, value) if previous and same_session else value
            low = min(previous.low_value, value) if previous and same_session else value
            cumulative_volume = _decimal(payload.get("volume"))
            volume_increment = (
                max(_ZERO, cumulative_volume - previous.volume)
                if previous and same_session
                else _ZERO
            )
            if previous_candles and previous_candles[-1].timestamp == bucket:
                current = previous_candles[-1]
                previous_candles[-1] = Candle(
                    timestamp=bucket,
                    open=current.open,
                    high=max(current.high, value),
                    low=min(current.low, value),
                    close=value,
                    volume=current.volume + volume_increment,
                )
            else:
                previous_candles.append(
                    Candle(
                        timestamp=bucket,
                        open=value,
                        high=value,
                        low=value,
                        close=value,
                        volume=volume_increment,
                    )
                )
            self._indices[symbol] = MarketIndex(
                symbol=symbol,
                name=name,
                value=value,
                reference_value=reference,
                open_value=opening,
                high_value=high,
                low_value=low,
                volume=cumulative_volume,
                matched_value=_decimal(payload.get("value")),
                advances=_integer(payload.get("increase")),
                declines=_integer(payload.get("decrease")),
                unchanged=_integer(payload.get("notChange")),
                ceiling_count=_integer(payload.get("ceilIncrease")),
                floor_count=_integer(payload.get("floorDecrease")),
                candles=tuple(previous_candles[-100:]),
            )
            self._market_time = observed_at
        return True

    def _refresh_security_master(self) -> None:
        now = time.monotonic()
        with self._state_lock:
            if now - self._last_security_refresh < self._config.security_refresh_seconds:
                return
        securities: dict[str, dict[str, object]] = {}
        # The public contract documents filtering but not request-side page controls.
        # Query each exchange separately to stay below the default 1,000-row response.
        for trade_place in _TRADE_PLACES:
            response = self._client.get(
                "/ananke/v1/securities",
                {"fields": "all", "filter": f"tradePlace={trade_place}"},
            )
            if not isinstance(response, dict):
                raise TcbsProviderError("TCBS securities response was invalid")
            content = response.get("content")
            if not isinstance(content, list):
                raise TcbsProviderError("TCBS securities response was invalid")
            for item in content:
                value = _row(item)
                if value is None or value.get("secType") != "001" or value.get("status") != "Y":
                    continue
                symbol = value.get("symbol")
                if isinstance(symbol, str) and 1 <= len(symbol) <= 24:
                    securities[symbol.upper()] = value
        with self._state_lock:
            self._securities = securities
            self._last_security_refresh = now

    def _board_quotes(self, board: int) -> tuple[int, list[dict[str, object]], str | None]:
        response = self._client.get("/tartarus/v1/tickerCommons", {"index": str(board)})
        data = response.get("data") if isinstance(response, dict) else None
        if not isinstance(data, list):
            raise TcbsProviderError("TCBS quote response was invalid")
        rows = [value for item in data[:1500] if (value := _row(item)) is not None]
        trading_date = response.get("tradingDate") if isinstance(response, dict) else None
        return board, rows, trading_date if isinstance(trading_date, str) else None

    def _refresh_quotes(self, force: bool = False) -> None:
        now = time.monotonic()
        with self._state_lock:
            if (
                not force
                and self._instruments
                and now - self._last_quote_refresh < self._config.quote_refresh_seconds
            ):
                return
        if not self._refresh_lock.acquire(blocking=False):
            with self._state_lock:
                if self._instruments:
                    return
            with self._refresh_lock:
                return
        try:
            try:
                self._refresh_security_master()
            except MarketDataUnavailable:
                with self._state_lock:
                    self._last_security_refresh = time.monotonic()
                logger.warning(
                    "TCBS security-master refresh failed; quote metadata will be partial"
                )
            with ThreadPoolExecutor(max_workers=4, thread_name_prefix="tcbs-board") as executor:
                board_results = tuple(executor.map(self._board_quotes, _BOARD_EXCHANGES))
            quotes: dict[str, dict[str, object]] = {}
            vn30_symbols: set[str] = set()
            with self._state_lock:
                securities = dict(self._securities)
            trading_dates: list[datetime] = []
            for board, rows, trading_date in board_results:
                exchange = _BOARD_EXCHANGES[board]
                if trading_date:
                    try:
                        trading_dates.append(
                            datetime.strptime(trading_date, "%d/%m/%Y").replace(
                                hour=15,
                                tzinfo=_MARKET_TZ,
                            )
                        )
                    except ValueError:
                        logger.warning("TCBS returned an invalid trading date")
                for value in rows:
                    symbol = value.get("symbol")
                    if not isinstance(symbol, str) or not 1 <= len(symbol) <= 24:
                        continue
                    normalized = symbol.upper()
                    if board == 2:
                        vn30_symbols.add(normalized)
                        continue
                    enriched = dict(value)
                    enriched["_exchange"] = exchange
                    quotes[normalized] = enriched
            if securities:
                quotes = {symbol: quote for symbol, quote in quotes.items() if symbol in securities}
            instruments = {
                symbol: self._instrument_from_rows(
                    symbol,
                    quote,
                    securities.get(symbol),
                    is_vn30=symbol in vn30_symbols,
                )
                for symbol, quote in quotes.items()
            }
            refreshed_at = datetime.now(UTC)
            current_market_date = refreshed_at.astimezone(_MARKET_TZ).date()
            snapshot_time = refreshed_at
            if trading_dates:
                latest_trading_time = max(trading_dates)
                if latest_trading_time.date() < current_market_date:
                    snapshot_time = latest_trading_time.astimezone(UTC)
            with self._state_lock:
                self._quote_rows = quotes
                self._instruments = instruments
                self._last_quote_refresh = time.monotonic()
                self._market_time = snapshot_time
        except MarketDataUnavailable:
            with self._state_lock:
                has_stale = bool(self._instruments)
            if not has_stale:
                raise
        finally:
            self._refresh_lock.release()

    def _instrument_from_rows(
        self,
        symbol: str,
        quote: dict[str, object],
        security: dict[str, object] | None,
        *,
        is_vn30: bool,
    ) -> MarketInstrument:
        detail = _row(security.get("securitiesInfo")) if security else None
        price = _decimal(quote.get("matchPrice"), _decimal(quote.get("refPrice")))
        reference = _decimal(quote.get("refPrice"), price)
        volume = _decimal(quote.get("totalVol"))
        matched_value = _decimal(quote.get("totalVal"), price * volume)
        listing_quantity = _decimal(detail.get("listingQtty")) if detail else _ZERO
        foreign_quantity = _decimal(quote.get("buyForeignQtty")) - _decimal(
            quote.get("sellForeignQtty")
        )
        trade_place = security.get("tradePlace") if security else None
        exchange = _TRADE_PLACES.get(str(trade_place), str(quote.get("_exchange", "UNKNOWN")))
        issuer_name = security.get("issuerName") if security else None
        name = (
            issuer_name.strip() if isinstance(issuer_name, str) and issuer_name.strip() else symbol
        )
        reasons: tuple[str, ...] = ("Thanh khoản trong phiên",) if matched_value > 0 else ()
        return MarketInstrument(
            symbol=symbol,
            name=name,
            exchange=exchange,
            sector="Chưa phân loại",
            price=price,
            reference_price=reference,
            ceiling_price=_decimal(
                quote.get("ceilPrice"),
                _decimal(detail.get("ceilingPrice")) if detail else reference,
            ),
            floor_price=_decimal(
                quote.get("floorPrice"), _decimal(detail.get("floorPrice")) if detail else reference
            ),
            open_price=_decimal(quote.get("open"), reference),
            high_price=_decimal(quote.get("high"), price),
            low_price=_decimal(quote.get("low"), price),
            volume=volume,
            matched_value=matched_value,
            foreign_net_value=foreign_quantity * price,
            market_cap=listing_quantity * price,
            pe=None,
            pb=None,
            eps=None,
            roe_percent=None,
            volume_vs_20d=_ZERO,
            interest_score=matched_value,
            interest_reasons=reasons,
            candles=(),
            is_vn30=is_vn30,
        )

    def instruments(self) -> tuple[MarketInstrument, ...]:
        self._refresh_quotes()
        with self._state_lock:
            return tuple(self._instruments.values())

    def indices(self) -> tuple[MarketIndex, ...]:
        with self._state_lock:
            return tuple(
                self._indices[symbol] for symbol, _ in _INDEXES.values() if symbol in self._indices
            )

    def events(self) -> tuple[MarketEvent, ...]:
        return ()

    def people(self) -> tuple[MarketPerson, ...]:
        return ()

    def candles(self, symbol: str, interval: str) -> tuple[Candle, ...]:
        if interval != "5m":
            return ()
        normalized = symbol.upper()
        response = self._client.get(
            f"/nyx/v1/intraday/{normalized}/his/paging",
            {"page": "0", "size": "100"},
        )
        if not isinstance(response, dict):
            raise TcbsProviderError("TCBS price-history response was invalid")
        rows = response.get("data")
        day_month = response.get("d")
        if not isinstance(rows, list) or not isinstance(day_month, str):
            raise TcbsProviderError("TCBS price-history response was invalid")
        now = datetime.now(_MARKET_TZ)
        try:
            trading_day = datetime.strptime(f"{day_month}/{now.year}", "%d/%m/%Y").date()
        except ValueError as exc:
            raise TcbsProviderError("TCBS price-history date was invalid") from exc
        if trading_day > now.date():
            trading_day = trading_day.replace(year=trading_day.year - 1)
        trades: list[tuple[datetime, Decimal, Decimal]] = []
        for item in rows:
            row = _row(item)
            clock_value = row.get("t") if row is not None else None
            if row is None or not isinstance(clock_value, str):
                continue
            price = _decimal(row.get("p"))
            if price <= 0:
                continue
            try:
                clock = datetime.strptime(clock_value, "%H:%M:%S").time()
            except ValueError:
                continue
            timestamp = datetime.combine(trading_day, clock, _MARKET_TZ).astimezone(UTC)
            trades.append((timestamp, price, _decimal(row.get("v"))))
        trades.sort(key=lambda item: item[0])
        buckets: dict[datetime, list[tuple[Decimal, Decimal]]] = {}
        for timestamp, price, volume in trades:
            bucket = timestamp.replace(minute=timestamp.minute // 5 * 5, second=0, microsecond=0)
            buckets.setdefault(bucket, []).append((price, volume))
        return tuple(
            Candle(
                timestamp=timestamp,
                open=values[0][0],
                high=max(value[0] for value in values),
                low=min(value[0] for value in values),
                close=values[-1][0],
                volume=sum((value[1] for value in values), _ZERO),
            )
            for timestamp, values in sorted(buckets.items())
        )

    def instrument(self, symbol: str) -> MarketInstrument | None:
        self._refresh_quotes()
        with self._state_lock:
            return self._instruments.get(symbol.upper())

    def index(self, symbol: str) -> MarketIndex | None:
        with self._state_lock:
            return self._indices.get(symbol.upper())
