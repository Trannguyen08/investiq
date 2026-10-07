"""Compose canonical market read models for API delivery."""

from __future__ import annotations

import base64
import json
import unicodedata
from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from app.domain.entities.market import Candle, MarketIndex, MarketInstrument
from app.domain.repositories.i_market_provider import IMarketProvider


def _decimal(value: Decimal) -> str:
    return format(value, "f")


def _candle(value: Candle) -> dict[str, str]:
    return {
        "timestamp": value.timestamp.isoformat().replace("+00:00", "Z"),
        "open": _decimal(value.open),
        "high": _decimal(value.high),
        "low": _decimal(value.low),
        "close": _decimal(value.close),
        "volume": _decimal(value.volume),
    }


def _instrument(value: MarketInstrument, include_candles: bool = True) -> dict[str, object]:
    payload: dict[str, object] = {
        "symbol": value.symbol,
        "name": value.name,
        "exchange": value.exchange,
        "sector": value.sector,
        "price": _decimal(value.price),
        "reference_price": _decimal(value.reference_price),
        "ceiling_price": _decimal(value.ceiling_price),
        "floor_price": _decimal(value.floor_price),
        "open_price": _decimal(value.open_price),
        "high_price": _decimal(value.high_price),
        "low_price": _decimal(value.low_price),
        "change": _decimal(value.change),
        "change_percent": _decimal(value.change_percent.quantize(Decimal("0.01"))),
        "volume": _decimal(value.volume),
        "matched_value": _decimal(value.matched_value),
        "foreign_net_value": _decimal(value.foreign_net_value),
        "market_cap": _decimal(value.market_cap),
        "pe": _decimal(value.pe) if value.pe is not None else None,
        "pb": _decimal(value.pb) if value.pb is not None else None,
        "eps": _decimal(value.eps) if value.eps is not None else None,
        "roe_percent": _decimal(value.roe_percent) if value.roe_percent is not None else None,
        "volume_vs_20d": _decimal(value.volume_vs_20d),
        "interest_score": _decimal(value.interest_score),
        "interest_reasons": list(value.interest_reasons),
        "is_vn30": value.is_vn30,
    }
    if include_candles:
        payload["candles"] = [_candle(item) for item in value.candles[-30:]]
    return payload


def _index(value: MarketIndex, include_candles: bool = True) -> dict[str, object]:
    payload: dict[str, object] = {
        "symbol": value.symbol,
        "name": value.name,
        "value": _decimal(value.value),
        "reference_value": _decimal(value.reference_value),
        "open_value": _decimal(value.open_value),
        "high_value": _decimal(value.high_value),
        "low_value": _decimal(value.low_value),
        "change": _decimal(value.change),
        "change_percent": _decimal(value.change_percent.quantize(Decimal("0.01"))),
        "volume": _decimal(value.volume),
        "matched_value": _decimal(value.matched_value),
        "advances": value.advances,
        "declines": value.declines,
        "unchanged": value.unchanged,
        "ceiling_count": value.ceiling_count,
        "floor_count": value.floor_count,
    }
    if include_candles:
        payload["candles"] = [_candle(item) for item in value.candles[-30:]]
    return payload


def _fold(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.casefold())
    return "".join(character for character in normalized if unicodedata.category(character) != "Mn")


def _encode_cursor(offset: int) -> str:
    raw = json.dumps({"offset": offset}, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(value: str | None) -> int:
    if not value:
        return 0
    try:
        raw = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        payload = json.loads(raw)
        offset = payload.get("offset") if isinstance(payload, dict) else None
        if type(offset) is not int or offset < 0 or offset > 10_000:
            raise ValueError
        return offset
    except (ValueError, TypeError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Pagination cursor is invalid") from exc


class MarketService:
    def __init__(self, provider: IMarketProvider) -> None:
        self._provider = provider

    def meta(self, partial: bool | None = None) -> dict[str, object]:
        return {
            "schema_version": "1",
            "provider": self._provider.slug,
            "provider_name": self._provider.display_name,
            "market_time": self._provider.market_time,
            "received_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "delay_class": self._provider.delay_class,
            "freshness": self._provider.freshness,
            "session": self._provider.session,
            "partial": self._provider.partial if partial is None else partial,
            "market_timezone": "Asia/Ho_Chi_Minh",
        }

    def overview(self) -> dict[str, object]:
        trending = sorted(
            self._provider.instruments(), key=lambda item: item.interest_score, reverse=True
        )[:8]
        indices = self._provider.indices()
        # VN30 is a subset of HOSE. Counting it again would overstate market breadth
        # and matched value, so the aggregate uses only the three exchange-wide boards.
        breadth_indices = tuple(
            item for item in indices if item.symbol in {"VNINDEX", "HNXINDEX", "UPCOMINDEX"}
        )
        events = sorted(self._provider.events(), key=lambda item: item.event_at)[:4]
        return {
            "data": {
                "indices": [_index(item) for item in indices],
                "trending": [_instrument(item) for item in trending],
                "breadth": {
                    "advances": sum(item.advances for item in breadth_indices),
                    "declines": sum(item.declines for item in breadth_indices),
                    "unchanged": sum(item.unchanged for item in breadth_indices),
                    "ceiling_count": sum(item.ceiling_count for item in breadth_indices),
                    "floor_count": sum(item.floor_count for item in breadth_indices),
                    "matched_value": _decimal(
                        sum((item.matched_value for item in breadth_indices), Decimal())
                    ),
                },
                "upcoming_events": [
                    {
                        "id": item.id,
                        "symbol": item.symbol,
                        "event_type": item.event_type,
                        "title": item.title,
                        "summary": item.summary,
                        "date_type": item.date_type,
                        "event_at": item.event_at.isoformat().replace("+00:00", "Z"),
                        "status": item.status,
                        "source_name": item.source_name,
                        "source_url": item.source_url,
                    }
                    for item in events
                ],
            },
            "meta": self.meta(),
        }

    def list_instruments(
        self,
        *,
        query: str,
        exchange: str | None,
        sector: str | None,
        sort: str,
        direction: str,
        limit: int,
        offset: int,
    ) -> dict[str, object]:
        values = list(self._provider.instruments())
        folded_query = _fold(query.strip())
        if folded_query:
            values = [
                item
                for item in values
                if folded_query in _fold(item.symbol) or folded_query in _fold(item.name)
            ]
        if exchange:
            values = [item for item in values if item.exchange == exchange]
        if sector:
            values = [item for item in values if item.sector == sector]
        sorters: dict[str, Callable[[MarketInstrument], Any]] = {
            "vn30": lambda item: (item.is_vn30, item.matched_value),
            "symbol": lambda item: item.symbol,
            "price": lambda item: item.price,
            "change_percent": lambda item: item.change_percent,
            "volume": lambda item: item.volume,
            "matched_value": lambda item: item.matched_value,
            "trending": lambda item: item.interest_score,
            "market_cap": lambda item: item.market_cap,
        }
        values.sort(
            key=lambda item: (sorters[sort](item), item.symbol), reverse=direction == "desc"
        )
        page = values[offset : offset + limit]
        next_offset = offset + len(page)
        previous_offset = max(0, offset - limit)
        total_pages = (len(values) + limit - 1) // limit
        return {
            "data": [_instrument(item) for item in page],
            "pagination": {
                "next_cursor": _encode_cursor(next_offset) if next_offset < len(values) else None,
                "previous_cursor": _encode_cursor(previous_offset) if offset > 0 else None,
                "has_more": next_offset < len(values),
                "limit": limit,
                "total_items": len(values),
                "page": offset // limit + 1,
                "total_pages": total_pages,
            },
            "meta": self.meta(),
        }

    def instrument(self, symbol: str) -> dict[str, object] | None:
        value = self._provider.instrument(symbol)
        return {"data": _instrument(value), "meta": self.meta()} if value else None

    def indices(self) -> dict[str, object]:
        return {"data": [_index(item) for item in self._provider.indices()], "meta": self.meta()}

    def index(self, symbol: str) -> dict[str, object] | None:
        value = self._provider.index(symbol)
        return {"data": _index(value), "meta": self.meta()} if value else None

    def candles(self, symbol: str, interval: str, limit: int) -> dict[str, object]:
        values = self._provider.candles(symbol, interval)[-limit:]
        return {
            "data": [_candle(item) for item in values],
            "instrument": symbol.upper(),
            "interval": interval,
            "adjusted": False,
            "meta": self.meta(),
        }

    def events(self, symbol: str | None, event_type: str | None) -> dict[str, object]:
        values = list(self._provider.events())
        if symbol:
            values = [item for item in values if item.symbol == symbol.upper()]
        if event_type:
            values = [item for item in values if item.event_type == event_type]
        values.sort(key=lambda item: (item.event_at, item.symbol))
        return {
            "data": [
                {
                    "id": item.id,
                    "symbol": item.symbol,
                    "event_type": item.event_type,
                    "title": item.title,
                    "summary": item.summary,
                    "date_type": item.date_type,
                    "event_at": item.event_at.isoformat().replace("+00:00", "Z"),
                    "status": item.status,
                    "source_name": item.source_name,
                    "source_url": item.source_url,
                }
                for item in values
            ],
            "meta": self.meta(),
        }

    def people(self) -> dict[str, object]:
        values = sorted(
            self._provider.people(),
            key=lambda item: item.estimated_listed_equity_value,
            reverse=True,
        )
        return {
            "data": [
                {
                    "id": item.id,
                    "rank": rank,
                    "full_name": item.full_name,
                    "initials": item.initials,
                    "role": item.role,
                    "company": item.company,
                    "symbols": list(item.symbols),
                    "sector": item.sector,
                    "disclosed_shares": _decimal(item.disclosed_shares),
                    "ownership_percent": _decimal(item.ownership_percent),
                    "estimated_listed_equity_value": _decimal(item.estimated_listed_equity_value),
                    "daily_change_percent": _decimal(item.daily_change_percent),
                    "holding_public_date": item.holding_public_date.isoformat().replace(
                        "+00:00", "Z"
                    ),
                }
                for rank, item in enumerate(values, start=1)
            ],
            "meta": self.meta(),
            "methodology": {
                "label": "Giá trị cổ phiếu niêm yết ước tính",
                "description": "Số cổ phiếu trực tiếp đã công bố nhân với giá minh họa gần nhất.",
                "excludes": [
                    "Tài sản chưa niêm yết",
                    "Sở hữu gián tiếp hoặc người liên quan",
                    "Nợ, thuế và tài sản cầm cố",
                ],
            },
        }

    def person(self, person_id: str) -> dict[str, object] | None:
        collection = self.people()
        rows = collection["data"]
        if not isinstance(rows, list):
            return None
        value = next(
            (item for item in rows if isinstance(item, dict) and item.get("id") == person_id),
            None,
        )
        return (
            {"data": value, "meta": collection["meta"], "methodology": collection["methodology"]}
            if value
            else None
        )
