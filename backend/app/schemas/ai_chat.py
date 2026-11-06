"""Schemas for InvestIQ AI Financial Assistant and Conversations."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class StockScores(BaseModel):
    valuation: int = Field(ge=0, le=100)
    financial_health: int = Field(ge=0, le=100)
    growth: int = Field(ge=0, le=100)
    technical: int = Field(ge=0, le=100)
    cashflow: int = Field(ge=0, le=100)


class StockScoreCardWidgetData(BaseModel):
    symbol: str
    name: str = ""
    current_price: float
    change_percent: float
    pe: float | None = None
    pb: float | None = None
    roe_percent: float | None = None
    scores: StockScores
    verdict: Literal["TÍCH CỰC", "THEO DÕI", "THẬN TRỌNG"]
    key_support: float | None = None
    key_resistance: float | None = None
    analysis_points: list[str] = Field(default_factory=list)


class StockComparisonItem(BaseModel):
    symbol: str
    name: str
    price: float | str
    change_percent: float | str
    pe: float | str | None = None
    pb: float | str | None = None
    roe: float | str | None = None
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)


class StockComparisonWidgetData(BaseModel):
    title: str
    items: list[StockComparisonItem]
    summary_verdict: str


class RedFlagItem(BaseModel):
    level: Literal["warning", "danger", "info"]
    title: str
    detail: str


class ForensicWarningWidgetData(BaseModel):
    symbol: str
    altman_z_score: float
    zone: Literal["safe", "grey", "distress"]
    flags: list[RedFlagItem]


class SuggestedAction(BaseModel):
    label: str
    action_type: Literal["NAVIGATE", "OPEN_MODAL", "TRADE_ORDER", "SEND_PROMPT"]
    url: str | None = None
    modal_type: str | None = None
    symbol: str | None = None
    prompt: str | None = None
    quantity: int | None = None


class AiWidget(BaseModel):
    type: Literal["stock_score_card", "stock_comparison", "forensic_warning", "market_pulse"]
    data: dict[str, Any]


class AiSource(BaseModel):
    kind: Literal["internal", "external"]
    title: str
    url: str


class AiEvaluationResponse(BaseModel):
    score: float
    checks: dict[str, bool] = Field(default_factory=dict)


class AiMessageResponse(BaseModel):
    id: str
    conversation_id: str | None = None
    role: Literal["user", "assistant", "system"]
    content: str
    widgets: list[AiWidget] = Field(default_factory=list)
    suggested_actions: list[SuggestedAction] = Field(default_factory=list)
    sources: list[AiSource] = Field(default_factory=list)
    evaluation: AiEvaluationResponse | None = None
    is_cached: bool = False
    created_at: str


class AiConversationResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0


class AiChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None


class AiChatResponse(BaseModel):
    conversation_id: str
    message: AiMessageResponse


class CreateConversationRequest(BaseModel):
    title: str = Field(default="Hội thoại mới", max_length=200)


class AiMetricsResponse(BaseModel):
    requests: dict[str, Any]
    latency_ms: dict[str, Any]
    guardrail_blocks: dict[str, int]
    cache: dict[str, Any]
    sources: dict[str, int]
    evaluation: dict[str, Any]
    steps: dict[str, Any]
