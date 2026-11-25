"""Shared gzip-compressed Redis snapshot cache for VnstockMarketProvider."""

from __future__ import annotations

import base64
import gzip
import json
import logging
import os
from datetime import datetime
from decimal import Decimal
from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from app.domain.entities.market import Candle, MarketEvent, MarketIndex, MarketInstrument
from app.infrastructure.config.settings import settings

logger = logging.getLogger("investiq.market.vnstock_snapshot_cache")

_SNAPSHOT_TTL_SECONDS = 1800


def _redis_client() -> Redis | None:
    if os.getenv("PYTEST_CURRENT_TEST") or not settings.redis_url:
        return None
    return Redis.from_url(
        settings.redis_url,
        socket_connect_timeout=2.0,
        socket_timeout=2.0,
        decode_responses=True,
    )


def _snapshot_key() -> str:
    return f"vnstock:snapshot:v1:{settings.app_env}"


def _candle_to_dict(c: Candle) -> dict[str, Any]:
    return {
        "t": c.timestamp.isoformat(),
        "o": str(c.open),
        "h": str(c.high),
        "l": str(c.low),
        "c": str(c.close),
        "v": str(c.volume),
    }


def _dict_to_candle(d: dict[str, Any]) -> Candle:
    return Candle(
        timestamp=datetime.fromisoformat(str(d["t"])),
        open=Decimal(str(d["o"])),
        high=Decimal(str(d["h"])),
        low=Decimal(str(d["l"])),
        close=Decimal(str(d["c"])),
        volume=Decimal(str(d["v"])),
    )


def _dec_or_none(val: Any) -> Decimal | None:
    return None if val is None else Decimal(str(val))


def save_vnstock_snapshot(
    instruments: tuple[MarketInstrument, ...],
    indices: tuple[MarketIndex, ...],
    market_time: datetime | None,
    events: tuple[MarketEvent, ...] = (),
) -> bool:
    client = _redis_client()
    if client is None or not instruments:
        return False
    payload = {
        "market_time": market_time.isoformat() if isinstance(market_time, datetime) else market_time,
        "instruments": [
            {
                "s": i.symbol,
                "n": i.name,
                "ex": i.exchange,
                "sec": i.sector,
                "sub": i.subsector,
                "p": str(i.price),
                "ref": str(i.reference_price),
                "ceil": str(i.ceiling_price),
                "fl": str(i.floor_price),
                "op": str(i.open_price),
                "hi": str(i.high_price),
                "lo": str(i.low_price),
                "vol": str(i.volume),
                "val": str(i.matched_value),
                "fn": str(i.foreign_net_value),
                "mc": str(i.market_cap),
                "pe": None if i.pe is None else str(i.pe),
                "pb": None if i.pb is None else str(i.pb),
                "eps": None if i.eps is None else str(i.eps),
                "roe": None if i.roe_percent is None else str(i.roe_percent),
                "v20": str(i.volume_vs_20d),
                "isc": str(i.interest_score),
                "ir": list(i.interest_reasons),
                "vn30": i.is_vn30,
                "c": [_candle_to_dict(c) for c in i.candles],
            }
            for i in instruments
        ],
        "indices": [
            {
                "s": idx.symbol,
                "n": idx.name,
                "val": str(idx.value),
                "ref": str(idx.reference_value),
                "op": str(idx.open_value),
                "hi": str(idx.high_value),
                "lo": str(idx.low_value),
                "vol": str(idx.volume),
                "mv": str(idx.matched_value),
                "adv": idx.advances,
                "dec": idx.declines,
                "unc": idx.unchanged,
                "ceil": idx.ceiling_count,
                "fl": idx.floor_count,
                "c": [_candle_to_dict(c) for c in idx.candles],
            }
            for idx in indices
        ],
        "events": [
            {
                "id": e.id,
                "s": e.symbol,
                "et": e.event_type,
                "t": e.title,
                "sum": e.summary,
                "dt": e.date_type,
                "ea": e.event_at.isoformat(),
                "st": e.status,
                "sn": e.source_name,
                "su": e.source_url,
            }
            for e in events
        ],
    }
    try:
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        encoded = base64.b64encode(gzip.compress(raw, compresslevel=6)).decode("ascii")
        client.set(_snapshot_key(), encoded, ex=_SNAPSHOT_TTL_SECONDS)
        return True
    except (RedisError, OSError, ValueError) as exc:
        logger.warning("vnstock_snapshot_cache_write_failed: %s", type(exc).__name__)
        return False


def load_vnstock_snapshot() -> (
    tuple[tuple[MarketInstrument, ...], tuple[MarketIndex, ...], datetime | None, tuple[MarketEvent, ...]]
    | None
):
    client = _redis_client()
    if client is None:
        return None
    try:
        encoded = client.get(_snapshot_key())
        if not isinstance(encoded, str) or not encoded:
            return None
        raw = gzip.decompress(base64.b64decode(encoded))
        data = json.loads(raw.decode("utf-8"))
        instruments = tuple(
            MarketInstrument(
                symbol=str(d["s"]),
                name=str(d["n"]),
                exchange=str(d["ex"]),
                sector=str(d["sec"]),
                subsector=str(d.get("sub", "")),
                price=Decimal(str(d["p"])),
                reference_price=Decimal(str(d["ref"])),
                ceiling_price=Decimal(str(d["ceil"])),
                floor_price=Decimal(str(d["fl"])),
                open_price=Decimal(str(d["op"])),
                high_price=Decimal(str(d["hi"])),
                low_price=Decimal(str(d["lo"])),
                volume=Decimal(str(d["vol"])),
                matched_value=Decimal(str(d["val"])),
                foreign_net_value=Decimal(str(d["fn"])),
                market_cap=Decimal(str(d["mc"])),
                pe=_dec_or_none(d.get("pe")),
                pb=_dec_or_none(d.get("pb")),
                eps=_dec_or_none(d.get("eps")),
                roe_percent=_dec_or_none(d.get("roe")),
                volume_vs_20d=Decimal(str(d["v20"])),
                interest_score=Decimal(str(d["isc"])),
                interest_reasons=tuple(str(r) for r in d.get("ir", [])),
                is_vn30=bool(d.get("vn30", False)),
                candles=tuple(_dict_to_candle(c) for c in d.get("c", [])),
            )
            for d in data.get("instruments", [])
        )
        indices = tuple(
            MarketIndex(
                symbol=str(d["s"]),
                name=str(d["n"]),
                value=Decimal(str(d["val"])),
                reference_value=Decimal(str(d["ref"])),
                open_value=Decimal(str(d["op"])),
                high_value=Decimal(str(d["hi"])),
                low_value=Decimal(str(d["lo"])),
                volume=Decimal(str(d["vol"])),
                matched_value=Decimal(str(d["mv"])),
                advances=int(d["adv"]),
                declines=int(d["dec"]),
                unchanged=int(d["unc"]),
                ceiling_count=int(d["ceil"]),
                floor_count=int(d["fl"]),
                candles=tuple(_dict_to_candle(c) for c in d.get("c", [])),
            )
            for d in data.get("indices", [])
        )
        events = tuple(
            MarketEvent(
                id=str(e["id"]),
                symbol=str(e["s"]),
                event_type=str(e["et"]),
                title=str(e["t"]),
                summary=str(e["sum"]),
                date_type=str(e["dt"]),
                event_at=datetime.fromisoformat(str(e["ea"])),
                status=str(e["st"]),
                source_name=str(e["sn"]),
                source_url=e.get("su"),
            )
            for e in data.get("events", [])
        )
        if not instruments:
            return None
        raw_mt = data.get("market_time")
        parsed_mt = datetime.fromisoformat(str(raw_mt)) if raw_mt else None
        return instruments, indices, parsed_mt, events
    except (RedisError, OSError, ValueError, KeyError, TypeError) as exc:
        logger.warning("vnstock_snapshot_cache_read_failed: %s", type(exc).__name__)
        return None
