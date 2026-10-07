"""Strict market and watchlist API contracts."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MarketMeta(StrictModel):
    schema_version: str
    provider: str
    provider_name: str
    market_time: datetime
    received_at: datetime
    delay_class: str
    freshness: str
    session: str
    partial: bool
    market_timezone: str


class CandleResponse(StrictModel):
    timestamp: datetime
    open: str
    high: str
    low: str
    close: str
    volume: str


class InstrumentResponse(StrictModel):
    symbol: str
    name: str
    exchange: str
    sector: str
    price: str
    reference_price: str
    ceiling_price: str
    floor_price: str
    open_price: str
    high_price: str
    low_price: str
    change: str
    change_percent: str
    volume: str
    matched_value: str
    foreign_net_value: str
    market_cap: str
    pe: str | None
    pb: str | None
    eps: str | None
    roe_percent: str | None
    volume_vs_20d: str
    interest_score: str
    interest_reasons: list[str]
    is_vn30: bool
    candles: list[CandleResponse] = Field(default_factory=list)


class IndexResponse(StrictModel):
    symbol: str
    name: str
    value: str
    reference_value: str
    open_value: str
    high_value: str
    low_value: str
    change: str
    change_percent: str
    volume: str
    matched_value: str
    advances: int
    declines: int
    unchanged: int
    ceiling_count: int
    floor_count: int
    candles: list[CandleResponse] = Field(default_factory=list)


class BreadthResponse(StrictModel):
    advances: int
    declines: int
    unchanged: int
    ceiling_count: int
    floor_count: int
    matched_value: str


class EventResponse(StrictModel):
    id: str
    symbol: str
    event_type: str
    title: str
    summary: str
    date_type: str
    event_at: datetime
    status: str
    source_name: str
    source_url: str | None


class PersonResponse(StrictModel):
    id: str
    rank: int
    full_name: str
    initials: str
    role: str
    company: str
    symbols: list[str]
    sector: str
    disclosed_shares: str
    ownership_percent: str
    estimated_listed_equity_value: str
    daily_change_percent: str
    holding_public_date: datetime


class MethodologyResponse(StrictModel):
    label: str
    description: str
    excludes: list[str]


class OverviewData(StrictModel):
    indices: list[IndexResponse]
    trending: list[InstrumentResponse]
    breadth: BreadthResponse
    upcoming_events: list[EventResponse]


class OverviewResponse(StrictModel):
    data: OverviewData
    meta: MarketMeta


class InstrumentsPagination(StrictModel):
    next_cursor: str | None
    previous_cursor: str | None
    has_more: bool
    limit: int
    total_items: int
    page: int
    total_pages: int


class InstrumentsResponse(StrictModel):
    data: list[InstrumentResponse]
    pagination: InstrumentsPagination
    meta: MarketMeta


class InstrumentEnvelope(StrictModel):
    data: InstrumentResponse
    meta: MarketMeta


class IndicesResponse(StrictModel):
    data: list[IndexResponse]
    meta: MarketMeta


class IndexEnvelope(StrictModel):
    data: IndexResponse
    meta: MarketMeta


class CandlesResponse(StrictModel):
    data: list[CandleResponse]
    instrument: str
    interval: str
    adjusted: bool
    meta: MarketMeta


class EventsResponse(StrictModel):
    data: list[EventResponse]
    meta: MarketMeta


class PeopleResponse(StrictModel):
    data: list[PersonResponse]
    meta: MarketMeta
    methodology: MethodologyResponse


class PersonEnvelope(StrictModel):
    data: PersonResponse
    meta: MarketMeta
    methodology: MethodologyResponse


class WatchlistItemResponse(StrictModel):
    symbol: str
    name: str
    exchange: str
    sector: str | None
    position: int
    added_at: datetime


class WatchlistResponse(StrictModel):
    id: str
    name: str
    position: int
    version: int
    created_at: datetime
    updated_at: datetime
    items: list[WatchlistItemResponse]


class WatchlistsResponse(StrictModel):
    data: list[WatchlistResponse]


class CreateWatchlistRequest(StrictModel):
    name: str = Field(min_length=1, max_length=80)


class AddWatchlistItemRequest(StrictModel):
    symbol: str = Field(min_length=1, max_length=24, pattern=r"^[A-Za-z0-9._-]+$")
