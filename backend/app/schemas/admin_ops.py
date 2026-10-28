"""Pydantic schemas for Admin operations, dashboards, and moderation."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class UserGrowthPoint(BaseModel):
    model_config = ConfigDict(extra="ignore")
    date: str
    new_users: int
    trades_count: int


class TopTradedSymbol(BaseModel):
    model_config = ConfigDict(extra="ignore")
    symbol: str
    trades_count: int
    total_volume_vnd: float


class SourceStat(BaseModel):
    model_config = ConfigDict(extra="ignore")
    source_slug: str
    name: str
    article_count: int
    status: str
    last_success_at: str | None = None


class RecentAuditItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    occurred_at: str
    actor_email: str | None = None
    event_type: str
    target: str | None = None
    outcome: str


class AdminOverviewResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    # Users
    total_users: int
    active_users: int
    disabled_users: int
    admin_users: int
    new_users_today: int
    new_users_7d: int
    new_users_30d: int
    # Paper Trading
    total_portfolios: int
    total_trades: int
    total_starting_cash_vnd: float
    total_cash_balance_vnd: float
    total_realized_pnl_vnd: float
    top_traded_symbols: list[TopTradedSymbol]
    # Theses / Community
    total_theses: int
    active_theses: int
    hit_target_theses: int
    stopped_out_theses: int
    theses_win_rate: float
    bullish_theses: int
    bearish_theses: int
    neutral_theses: int
    # News Pipeline
    total_news_articles: int
    active_news_sources: int
    total_news_sources: int
    news_sources_stats: list[SourceStat]
    news_sentiment_breakdown: dict[str, int]
    # System Status
    db_connected: bool
    redis_connected: bool
    uptime_seconds: int
    # Charts & Feeds
    activity_chart: list[UserGrowthPoint]
    recent_audits: list[RecentAuditItem]


# Theses schemas
class AdminThesisItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    author_name: str
    author_email: str | None = None
    symbol: str
    stance: Literal["bullish", "bearish", "neutral"]
    entry_price: float
    target_price: float
    stop_loss_price: float
    horizon_months: int
    title: str
    thesis_body: str
    catalysts: list[str]
    status: Literal["active", "hit_target", "stopped_out", "expired"]
    outcome_roi: float | None = None
    closed_at: str | None = None
    closed_price: float | None = None
    upvotes: int
    created_at: str
    updated_at: str


class AdminThesisPage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    items: list[AdminThesisItem]
    total: int
    page: int
    limit: int
    total_pages: int


class AdminThesisUpdate(BaseModel):
    status: Literal["active", "hit_target", "stopped_out", "expired"] | None = None
    note: str | None = Field(default=None, max_length=500)


# Portfolios schemas
class PortfolioHoldingItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    symbol: str
    quantity: int
    total_cost_basis: float
    avg_price: float
    current_price: float | None = None
    unrealized_pnl: float | None = None
    updated_at: str


class PortfolioTradeItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    symbol: str
    side: Literal["buy", "sell"]
    quantity: int
    execution_price: float
    gross_amount: float
    fee_amount: float
    tax_amount: float
    realized_pnl: float | None = None
    created_at: str


class AdminPortfolioItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_email: str
    user_name: str
    starting_cash: float
    cash_balance: float
    realized_pnl: float
    is_public: bool
    nickname: str | None = None
    holdings_count: int
    trades_count: int
    created_at: str
    updated_at: str


class AdminPortfolioPage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    items: list[AdminPortfolioItem]
    total: int
    page: int
    limit: int
    total_pages: int


class AdminPortfolioDetail(BaseModel):
    model_config = ConfigDict(extra="ignore")
    portfolio: AdminPortfolioItem
    holdings: list[PortfolioHoldingItem]
    recent_trades: list[PortfolioTradeItem]


# Audit logs schemas
class AdminAuditLogItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    source_type: Literal["auth", "news", "user_admin", "theses_admin"]
    occurred_at: str
    actor_id: str | None = None
    actor_email: str | None = None
    event_type: str
    target: str | None = None
    outcome: str
    request_id: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class AdminAuditLogPage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    items: list[AdminAuditLogItem]
    total: int
    page: int
    limit: int
    total_pages: int
