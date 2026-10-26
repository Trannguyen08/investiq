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


class IntradayTradeResponse(StrictModel):
    timestamp: datetime
    price: str
    volume: str
    match_side: str
    change: str | None
    change_percent: str | None


class MarketDepthLevelResponse(StrictModel):
    price: str
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
    bid_levels: list[MarketDepthLevelResponse] = Field(default_factory=list)
    ask_levels: list[MarketDepthLevelResponse] = Field(default_factory=list)


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
    net_worth_total: str | None = None
    net_worth_external: str | None = None
    bio: str | None = None
    avatar_url: str | None = None


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


class SectorResponse(StrictModel):
    name: str
    change_percent: str
    member_count: int
    advances: int
    declines: int
    unchanged: int
    matched_value: str
    foreign_net_value: str
    market_cap: str


class SectorsResponse(StrictModel):
    data: list[SectorResponse]
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


class IntradayTradesResponse(StrictModel):
    data: list[IntradayTradeResponse]
    instrument: str
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


class QuarterlyGrowthPoint(StrictModel):
    period: str
    revenue_growth_yoy: str | None
    profit_growth_yoy: str | None
    roe: str | None
    net_margin: str | None
    gross_margin: str | None = None
    revenue_display: str | None = None
    profit_display: str | None = None


class FinancialReportAnalysisItem(StrictModel):
    title: str
    summary: str
    image_url: str | None = None
    source: str
    published_at: str | None = None
    article_url: str | None = None
    category: str | None = "Báo cáo tài chính & Tăng trưởng"
    tag: str | None = None


class StockGrowthResponse(StrictModel):
    symbol: str
    company_name: str
    sector: str
    health_status: str
    health_title: str
    health_summary: str
    market_cap: str
    market_cap_growth_1m: str | None
    market_cap_growth_3m: str | None
    market_cap_growth_6m: str | None
    market_cap_growth_1y: str | None
    price_change_1m: str | None = None
    price_change_3m: str | None = None
    price_change_6m: str | None = None
    price_change_1y: str | None = None
    volume_growth_20d: str
    volume_20d_avg: str | None = None
    latest_volume: str | None = None
    pe: str | None
    pb: str | None
    eps: str | None
    bvps: str | None = None
    roe_percent: str | None
    roa_percent: str | None = None
    gross_margin_percent: str | None = None
    net_margin_percent: str | None = None
    current_ratio: str | None = None
    debt_to_equity: str | None = None
    revenue_ttm: str | None = None
    profit_ttm: str | None = None
    ebitda: str | None = None
    quarters: list[QuarterlyGrowthPoint]
    financial_reports: list[FinancialReportAnalysisItem] = Field(default_factory=list)
    insights: list[str]


class StockGrowthEnvelope(StrictModel):
    data: StockGrowthResponse
    meta: MarketMeta
