"""Public market reads, realtime snapshots, and private watchlists."""

from __future__ import annotations

import asyncio
import json
from decimal import Decimal
from functools import lru_cache
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Query,
    Response,
    WebSocket,
    WebSocketDisconnect,
    status,
)

from app.api.deps import authenticated_user_id, require_auth_bff
from app.application.use_cases.market_data.errors import MarketDataUnavailable
from app.application.use_cases.market_data.market_service import MarketService, decode_cursor
from app.domain.repositories.i_market_provider import IMarketProvider
from app.infrastructure.cache.market_cache import MarketReadCache, get_market_read_cache
from app.infrastructure.config.settings import settings
from app.infrastructure.db.repositories.sql_watchlist_repository import (
    SqlWatchlistRepository,
    WatchlistConflictError,
    WatchlistNotFoundError,
)
from app.infrastructure.db.session import get_pool
from app.infrastructure.external.market_fixture_provider import FixtureMarketProvider
from app.infrastructure.external.tcbs_market_provider import TcbsConfig, TcbsMarketProvider
from app.infrastructure.external.vnstock_market_provider import VnstockConfig, VnstockMarketProvider
from app.schemas.market import (
    AddWatchlistItemRequest,
    CandlesResponse,
    CreateWatchlistRequest,
    EventsResponse,
    IndexEnvelope,
    IndicesResponse,
    InstrumentEnvelope,
    InstrumentsResponse,
    OverviewResponse,
    PeopleResponse,
    PersonEnvelope,
    SectorsResponse,
    WatchlistResponse,
    WatchlistsResponse,
)

router = APIRouter(prefix="/api/v1/market", tags=["market"])
stream_router = APIRouter(tags=["market-stream"])
watchlist_router = APIRouter(
    prefix="/api/v1/watchlists",
    tags=["watchlists"],
    dependencies=[Depends(require_auth_bff)],
)


@lru_cache
def _provider() -> IMarketProvider:
    if settings.market_data_mode == "fixture":
        return FixtureMarketProvider()
    if settings.market_data_mode == "tcbs":
        settings.require_tcbs_configuration()
        return TcbsMarketProvider(
            TcbsConfig(
                api_base_url=settings.tcbs_api_base_url,
                ws_url=settings.tcbs_ws_url,
                api_key=(
                    settings.tcbs_api_key.get_secret_value() if settings.tcbs_api_key else None
                ),
                otp=settings.tcbs_otp.get_secret_value() if settings.tcbs_otp else None,
                access_token=(
                    settings.tcbs_access_token.get_secret_value()
                    if settings.tcbs_access_token
                    else None
                ),
                request_timeout_seconds=settings.tcbs_request_timeout_seconds,
                quote_refresh_seconds=settings.tcbs_quote_refresh_seconds,
                security_refresh_seconds=settings.tcbs_security_refresh_seconds,
                retry_attempts=settings.tcbs_http_retry_attempts,
                circuit_failure_threshold=settings.tcbs_circuit_failure_threshold,
                circuit_open_seconds=settings.tcbs_circuit_open_seconds,
            )
        )
    if settings.market_data_mode == "vnstock":
        return VnstockMarketProvider(
            VnstockConfig(
                api_key=(
                    settings.vnstock_api_key.get_secret_value()
                    if settings.vnstock_api_key
                    else None
                ),
                refresh_seconds=settings.vnstock_refresh_seconds,
                candle_cache_seconds=settings.vnstock_candle_cache_seconds,
                fundamental_cache_seconds=settings.vnstock_fundamental_cache_seconds,
                max_symbols=settings.vnstock_max_symbols,
            )
        )
    raise RuntimeError("Market data is disabled until a licensed provider is configured")


async def start_market_provider() -> None:
    if settings.market_data_mode == "tcbs":
        provider = _provider()
        if isinstance(provider, TcbsMarketProvider):
            await provider.start()


async def close_market_provider() -> None:
    if settings.market_data_mode == "tcbs":
        provider = _provider()
        if isinstance(provider, TcbsMarketProvider):
            await provider.close()


def _service() -> MarketService:
    try:
        return MarketService(_provider())
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _watchlists() -> SqlWatchlistRepository:
    return SqlWatchlistRepository(get_pool())


def _public_headers(response: Response) -> None:
    ttl = settings.market_public_cache_seconds
    response.headers["Cache-Control"] = (
        f"public, max-age={min(ttl, 5)}, s-maxage={ttl}, stale-while-revalidate={min(ttl, 15)}"
    )
    response.headers["Vary"] = "Accept-Encoding"


def _private_headers(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"


def _cached(
    resource: str,
    dimensions: dict[str, object],
    loader: object,
    cache: MarketReadCache,
) -> dict[str, object]:
    key = cache.key(resource, dimensions)
    found = cache.get(key)
    if found is not None:
        return found
    if not callable(loader):
        raise TypeError("Market cache loader must be callable")
    payload = loader()
    if not isinstance(payload, dict):
        raise TypeError("Market cache loader returned an invalid payload")
    cache.set(key, payload, settings.market_public_cache_seconds)
    return payload


@router.get("/overview", response_model=OverviewResponse)
def overview(response: Response) -> dict[str, object]:
    _public_headers(response)
    return _cached("overview", {}, _service().overview, get_market_read_cache())


@router.get("/instruments", response_model=InstrumentsResponse)
def instruments(
    response: Response,
    q: Annotated[str, Query(max_length=120)] = "",
    exchange: Annotated[str | None, Query(pattern="^(HOSE|HNX|UPCOM)$")] = None,
    sector: Annotated[str | None, Query(max_length=120)] = None,
    sort: Literal[
        "vn30",
        "symbol",
        "price",
        "change_percent",
        "volume",
        "matched_value",
        "trending",
        "market_cap",
        "volume_vs_20d",
    ] = "vn30",
    direction: Literal["asc", "desc"] = "desc",
    min_change: Annotated[Decimal | None, Query(ge=-100, le=100)] = None,
    max_change: Annotated[Decimal | None, Query(ge=-100, le=100)] = None,
    min_matched_value_billion: Annotated[
        Decimal | None, Query(ge=0, le=1_000_000_000)
    ] = None,
    min_market_cap_billion: Annotated[Decimal | None, Query(ge=0, le=1_000_000_000)] = None,
    min_volume_ratio: Annotated[Decimal | None, Query(ge=0, le=1000)] = None,
    vn30: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 15,
    cursor: Annotated[str | None, Query(max_length=512)] = None,
) -> dict[str, object]:
    _public_headers(response)
    if min_change is not None and max_change is not None and min_change > max_change:
        raise HTTPException(
            status_code=422,
            detail="Minimum daily change cannot exceed maximum daily change",
        )
    try:
        offset = decode_cursor(cursor)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    dimensions: dict[str, object] = {
        "q": q,
        "exchange": exchange or "",
        "sector": sector or "",
        "sort": sort,
        "direction": direction,
        "min_change": str(min_change) if min_change is not None else "",
        "max_change": str(max_change) if max_change is not None else "",
        "min_matched_value_billion": (
            str(min_matched_value_billion) if min_matched_value_billion is not None else ""
        ),
        "min_market_cap_billion": (
            str(min_market_cap_billion) if min_market_cap_billion is not None else ""
        ),
        "min_volume_ratio": str(min_volume_ratio) if min_volume_ratio is not None else "",
        "vn30": vn30,
        "limit": limit,
        "offset": offset,
    }
    service = _service()
    return _cached(
        "instruments",
        dimensions,
        lambda: service.list_instruments(
            query=q,
            exchange=exchange,
            sector=sector,
            sort=sort,
            direction=direction,
            limit=limit,
            offset=offset,
            min_change=min_change,
            max_change=max_change,
            min_matched_value=(
                min_matched_value_billion * Decimal("1000000000")
                if min_matched_value_billion is not None
                else None
            ),
            min_market_cap=(
                min_market_cap_billion * Decimal("1000000000")
                if min_market_cap_billion is not None
                else None
            ),
            min_volume_ratio=min_volume_ratio,
            vn30_only=vn30,
        ),
        get_market_read_cache(),
    )


@router.get("/sectors", response_model=SectorsResponse)
def sectors(response: Response) -> dict[str, object]:
    _public_headers(response)
    return _cached("sectors", {}, _service().sectors, get_market_read_cache())


@router.get("/instruments/{symbol}", response_model=InstrumentEnvelope)
def instrument(symbol: str, response: Response) -> dict[str, object]:
    _public_headers(response)
    value = _service().instrument(symbol)
    if value is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return value


@router.get("/indices", response_model=IndicesResponse)
def indices(response: Response) -> dict[str, object]:
    _public_headers(response)
    return _cached("indices", {}, _service().indices, get_market_read_cache())


@router.get("/indices/{symbol}", response_model=IndexEnvelope)
def index(symbol: str, response: Response) -> dict[str, object]:
    _public_headers(response)
    value = _service().index(symbol)
    if value is None:
        raise HTTPException(status_code=404, detail="Index not found")
    return value


@router.get("/candles", response_model=CandlesResponse)
def candles(
    response: Response,
    symbol: Annotated[str, Query(min_length=1, max_length=24, pattern=r"^[A-Za-z0-9._-]+$")],
    interval: Literal["1d", "5m"] = "1d",
    limit: Annotated[int, Query(ge=1, le=500)] = 120,
) -> dict[str, object]:
    _public_headers(response)
    value = _service().candles(symbol, interval, limit)
    if not value["data"]:
        raise HTTPException(status_code=404, detail="Candle series not found")
    return value


@router.get("/events", response_model=EventsResponse)
def events(
    response: Response,
    symbol: Annotated[str | None, Query(max_length=24, pattern=r"^[A-Za-z0-9._-]+$")] = None,
    event_type: Annotated[str | None, Query(max_length=60, pattern=r"^[a-z_]+$")] = None,
) -> dict[str, object]:
    _public_headers(response)
    service = _service()
    return _cached(
        "events",
        {"symbol": symbol or "", "event_type": event_type or ""},
        lambda: service.events(symbol, event_type),
        get_market_read_cache(),
    )


@router.get("/people", response_model=PeopleResponse)
def people(response: Response) -> dict[str, object]:
    _public_headers(response)
    return _cached("people", {}, _service().people, get_market_read_cache())


@router.get("/people/{person_id}", response_model=PersonEnvelope)
def person(person_id: str, response: Response) -> dict[str, object]:
    _public_headers(response)
    value = _service().person(person_id)
    if value is None:
        raise HTTPException(status_code=404, detail="Person not found")
    return value


@watchlist_router.get("", response_model=WatchlistsResponse)
def list_watchlists(
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
) -> dict[str, object]:
    _private_headers(response)
    return {"data": _watchlists().list(user_id)}


@watchlist_router.post("", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
def create_watchlist(
    body: CreateWatchlistRequest,
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
) -> dict[str, object]:
    _private_headers(response)
    try:
        return _watchlists().create(user_id, body.name)
    except WatchlistConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@watchlist_router.delete("/{watchlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_watchlist(
    watchlist_id: UUID,
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
) -> None:
    _private_headers(response)
    if not _watchlists().delete(user_id, str(watchlist_id)):
        raise HTTPException(status_code=404, detail="Watchlist not found")


@watchlist_router.post("/{watchlist_id}/items", status_code=status.HTTP_204_NO_CONTENT)
def add_watchlist_item(
    watchlist_id: UUID,
    body: AddWatchlistItemRequest,
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key", max_length=128)] = None,
) -> None:
    del idempotency_key
    _private_headers(response)
    selected = _provider().instrument(body.symbol)
    if selected is None:
        raise HTTPException(status_code=422, detail="Unknown instrument")
    try:
        _watchlists().add_item(
            user_id,
            str(watchlist_id),
            {
                "symbol": selected.symbol,
                "exchange": selected.exchange,
                "name": selected.name,
                "sector": selected.sector,
            },
        )
    except WatchlistNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@watchlist_router.delete("/{watchlist_id}/items/{symbol}", status_code=status.HTTP_204_NO_CONTENT)
def remove_watchlist_item(
    watchlist_id: UUID,
    symbol: str,
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
) -> None:
    _private_headers(response)
    if not _watchlists().remove_item(user_id, str(watchlist_id), symbol.upper()):
        raise HTTPException(status_code=404, detail="Watchlist item not found")


@stream_router.websocket("/ws/v1/market")
async def stream_market(websocket: WebSocket) -> None:
    if settings.market_data_mode == "disabled":
        await websocket.close(code=1013, reason="Market data is disabled")
        return
    await websocket.accept()
    await websocket.send_json(
        {
            "version": "1",
            "event_id": str(uuid4()),
            "type": "hello",
            "timestamp": _provider().market_time,
            "data": {"max_symbols": 20, "delay_class": _provider().delay_class},
        }
    )
    sequence = 0
    symbols: list[str] = []
    last_snapshot = ""
    heartbeat_ticks = 0
    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive_json(), timeout=2)
            except TimeoutError:
                if not symbols:
                    continue
                snapshots = await asyncio.to_thread(_stream_snapshots, symbols)
                serialized = json.dumps(snapshots, sort_keys=True, separators=(",", ":"))
                heartbeat_ticks += 1
                if serialized != last_snapshot:
                    sequence += 1
                    last_snapshot = serialized
                    heartbeat_ticks = 0
                    await websocket.send_json(
                        {
                            "version": "1",
                            "event_id": str(uuid4()),
                            "type": "quote",
                            "timestamp": _provider().market_time,
                            "data": {"sequence": sequence, "items": snapshots},
                        }
                    )
                elif heartbeat_ticks >= 10:
                    heartbeat_ticks = 0
                    await websocket.send_json(
                        {
                            "version": "1",
                            "event_id": str(uuid4()),
                            "type": "heartbeat",
                            "timestamp": _provider().market_time,
                            "data": {},
                        }
                    )
                continue
            if not isinstance(message, dict) or message.get("type") != "subscribe":
                await websocket.close(code=1008, reason="Invalid subscription")
                return
            raw_symbols = message.get("symbols")
            if not isinstance(raw_symbols, list) or not 1 <= len(raw_symbols) <= 20:
                await websocket.close(code=1008, reason="Invalid symbol count")
                return
            symbols = [value.upper() for value in raw_symbols if isinstance(value, str)]
            if len(symbols) != len(raw_symbols) or any(len(value) > 24 for value in symbols):
                await websocket.close(code=1008, reason="Invalid symbol")
                return
            symbols = list(dict.fromkeys(symbols))
            snapshots = await asyncio.to_thread(_stream_snapshots, symbols)
            sequence += 1
            last_snapshot = json.dumps(snapshots, sort_keys=True, separators=(",", ":"))
            await websocket.send_json(
                {
                    "version": "1",
                    "event_id": str(uuid4()),
                    "type": "snapshot",
                    "timestamp": _provider().market_time,
                    "data": {"sequence": sequence, "items": snapshots},
                }
            )
    except WebSocketDisconnect:
        return
    except MarketDataUnavailable:
        await websocket.close(code=1013, reason="Market provider unavailable")


def _stream_snapshots(symbols: list[str]) -> list[dict[str, object]]:
    snapshots: list[dict[str, object]] = []
    service = _service()
    for symbol in symbols:
        value = service.instrument(symbol, include_fundamentals=False) or service.index(symbol)
        if value:
            data = value.get("data")
            if isinstance(data, dict):
                snapshots.append(data)
    return snapshots
