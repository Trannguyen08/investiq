"""Public news API schemas; persistence fields are deliberately allowlisted."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SourceResponse(StrictModel):
    slug: str
    name: str
    url: str
    status: str
    content_access: str
    last_success_at: datetime | None


class SentimentResponse(StrictModel):
    status: str
    label: str | None
    score: float | None = Field(ge=-1, le=1)
    confidence: float | None = Field(ge=0, le=1)
    method: str | None
    analyzer_version: str | None
    analyzed_at: datetime | None
    horizon: str | None = None
    rationale: str | None
    evidence: list[str]
    market_impact: str | None
    impact_scope: str | None
    topics: list[str]
    event_types: list[str]


class SymbolResponse(StrictModel):
    security_id: str
    symbol: str
    exchange: str
    company_name: str
    is_primary: bool
    match_method: str
    match_confidence: float | None = Field(ge=0, le=1)
    evidence: list[str]
    sentiment: SentimentResponse | None


class AssetResponse(StrictModel):
    id: str
    kind: str
    role: str
    url: str
    alt: str | None
    caption: str | None
    credit: str | None
    position: int = Field(ge=0)


class ContentBlockResponse(StrictModel):
    id: str
    type: str
    text: str | None
    level: int | None
    url: str | None
    caption: str | None
    items: list[str]
    rows: list[list[str]]


class NewsSummaryResponse(StrictModel):
    id: str
    title: str
    description: str | None
    url: str
    source: SourceResponse
    published_at: datetime | None
    updated_at: datetime | None
    first_seen_at: datetime
    feed_at: datetime
    category: str | None
    tags: list[str]
    thumbnail: AssetResponse | None
    symbols: list[SymbolResponse]
    mentioned_symbols: list[str]
    sentiment: SentimentResponse
    extraction_status: str
    content_access: str
    duplicate_source_count: int = Field(ge=1)


class NewsDetailResponse(NewsSummaryResponse):
    revision_id: str
    content: str | None
    content_blocks: list[ContentBlockResponse]
    authors: list[str]
    fetched_at: datetime
    images: list[AssetResponse]
    attachments: list[AssetResponse]
    quality_flags: list[str]
    reading_time_minutes: int = Field(ge=1)


class PaginationResponse(StrictModel):
    next_cursor: str | None
    has_more: bool
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=50)
    total_items: int = Field(ge=0)
    total_pages: int = Field(ge=0)


class ResponseMeta(StrictModel):
    request_id: str
    as_of: datetime
    last_ingested_at: datetime | None
    freshness: str


class NewsCollectionResponse(StrictModel):
    data: list[NewsSummaryResponse]
    pagination: PaginationResponse
    meta: ResponseMeta


class NewsEnvelope(StrictModel):
    data: NewsDetailResponse
    meta: ResponseMeta


class SourcesEnvelope(StrictModel):
    data: list[SourceResponse]
    meta: ResponseMeta


class SecurityResponse(StrictModel):
    security_id: str
    symbol: str
    exchange: str
    company_name: str


class SecuritiesEnvelope(StrictModel):
    data: list[SecurityResponse]
    meta: ResponseMeta
