"""Strict market and watchlist API contracts."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

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


class ForensicRedFlagItem(StrictModel):
    flag_id: str
    name: str
    severity: str
    title: str
    description: str
    indicator_value: str
    threshold: str
    implication: str


class FinancialForensicsResponse(StrictModel):
    symbol: str
    z_score: str
    z_zone: str
    z_label: str
    health_score: int
    red_flags: list[ForensicRedFlagItem]
    risk_summary: str
    recommendation: str
    is_finance: bool = False


class FinancialForensicsEnvelope(StrictModel):
    data: FinancialForensicsResponse
    meta: MarketMeta


class EcosystemTickerItem(StrictModel):
    symbol: str
    price: str
    change_percent: str
    market_cap: str


class EcosystemSummaryItem(StrictModel):
    id: str
    name: str
    founder_id: str
    founder_name: str
    sector: str
    overview: str
    core_tickers: list[EcosystemTickerItem]
    total_market_cap: str
    node_count: int
    link_count: int


class EcosystemsResponse(StrictModel):
    data: list[EcosystemSummaryItem]
    meta: MarketMeta


class EcosystemNodeItem(StrictModel):
    id: str
    name: str
    ticker: str | None = None
    node_type: str
    role: str
    ownership_percent: str
    exchange: str
    description: str
    price: str | None = None
    change_percent: str | None = None
    market_cap: str | None = None


class EcosystemLinkItem(StrictModel):
    source: str
    target: str
    relation_type: str
    percentage: str
    label: str


class EcosystemDetailData(StrictModel):
    id: str
    name: str
    founder_id: str
    founder_name: str
    sector: str
    overview: str
    nodes: list[EcosystemNodeItem]
    links: list[EcosystemLinkItem]


class EcosystemDetailEnvelope(StrictModel):
    data: EcosystemDetailData
    meta: MarketMeta


class DCASimulatorRequest(StrictModel):
    symbol: str = Field(min_length=1, max_length=12)
    monthly_amount: Decimal = Field(default=Decimal("5000000"), gt=0)
    duration_years: int = Field(default=3, ge=1, le=10)
    savings_rate: Decimal = Field(default=Decimal("6.0"), ge=0, le=25)


class DCATimelinePoint(StrictModel):
    month: int
    label: str
    price: str
    shares_bought: int
    total_shares: int
    invested: str
    portfolio_value: str
    savings_value: str


class DCASimulatorData(StrictModel):
    symbol: str
    duration_years: int
    duration_months: int
    monthly_amount: str
    total_invested: str
    total_shares: int
    average_buy_price: str
    current_price: str
    portfolio_value: str
    stock_profit: str
    stock_roi_percent: str
    savings_rate_percent: str
    savings_value: str
    savings_profit: str
    savings_roi_percent: str
    alpha_amount: str
    alpha_percent: str
    outperformed: bool
    timeline: list[DCATimelinePoint]


class DCASimulatorEnvelope(StrictModel):
    data: DCASimulatorData
    meta: MarketMeta


class DailyDigestSessionSummary(StrictModel):
    vnindex_value: str
    vnindex_change: str
    is_positive: bool
    liquidity: str
    breadth: dict[str, int]


class DailyDigestGainer(StrictModel):
    symbol: str
    price: str
    change_pct: str
    sector: str


class DailyDigestSpike(StrictModel):
    symbol: str
    surge_label: str
    price: str
    change_pct: str
    sector: str


class DailyDigestEvent(StrictModel):
    symbol: str
    title: str
    event_type: str
    date: str


class DailyDigestData(StrictModel):
    date: str
    headline: str
    tone: str
    session_summary: DailyDigestSessionSummary
    key_drivers: list[str]
    gainers: list[DailyDigestGainer]
    volume_breakouts: list[DailyDigestSpike]
    upcoming_events: list[DailyDigestEvent]
    meta: dict[str, str]


class DailyDigestEnvelope(StrictModel):
    data: DailyDigestData
    meta: MarketMeta


class DividendItem(StrictModel):
    id: str
    symbol: str
    event_date: str
    ex_date: str | None = None
    record_date: str | None = None
    payout_date: str | None = None
    type: str
    ratio: str | None = None
    cash_value: float | None = None
    title: str
    source: str = "CafeF / Market Disclosures"


class DividendSummary(StrictModel):
    symbol: str
    dividend_yield_percent: float | None = None
    frequency: str = "Hàng năm"
    latest_event_date: str | None = None
    latest_payout_ratio: str | None = None
    primary_type: str = "cash"
    total_events: int = 0


class SymbolDividendsData(StrictModel):
    symbol: str
    summary: DividendSummary
    events: list[DividendItem]


class SymbolDividendsEnvelope(StrictModel):
    data: SymbolDividendsData
    meta: MarketMeta


class DividendCalendarData(StrictModel):
    total: int
    events: list[DividendItem]


class DividendCalendarEnvelope(StrictModel):
    data: DividendCalendarData
    meta: MarketMeta


class FinancialChartItem(StrictModel):
    period: str
    revenue_billion: float | None = None
    gross_profit_billion: float | None = None
    net_profit_billion: float | None = None
    gross_margin_percent: float | None = None
    net_margin_percent: float | None = None
    total_assets_billion: float | None = None
    total_debt_billion: float | None = None
    equity_billion: float | None = None


class FinancialMetricItem(StrictModel):
    code: str
    name: str
    values: list[float | None]


class FinancialStatementsData(StrictModel):
    symbol: str
    period_type: str
    periods: list[str]
    charts: list[FinancialChartItem]
    income_statement: list[FinancialMetricItem]
    balance_sheet: list[FinancialMetricItem]
    cash_flow: list[FinancialMetricItem]
    source: str


class FinancialStatementsEnvelope(StrictModel):
    data: FinancialStatementsData
    meta: MarketMeta
