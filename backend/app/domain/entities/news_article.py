"""Framework-independent news article entities."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from app.domain.entities.stock import Security
from app.domain.value_objects.sentiment_score import SentimentScore


class ContentAccess(StrEnum):
    FULL_TEXT = "full_text"
    METADATA_ONLY = "metadata_only"
    LINK_ONLY = "link_only"


class ExtractionStatus(StrEnum):
    COMPLETE = "complete"
    PARTIAL = "partial"
    METADATA_ONLY = "metadata_only"


@dataclass(frozen=True, slots=True)
class ContentBlock:
    id: str
    type: str
    text: str | None = None
    level: int | None = None
    url: str | None = None
    caption: str | None = None
    items: tuple[str, ...] = ()
    rows: tuple[tuple[str, ...], ...] = ()


@dataclass(frozen=True, slots=True)
class ArticleAsset:
    id: str
    kind: str
    role: str
    url: str
    alt: str | None = None
    caption: str | None = None
    credit: str | None = None
    position: int = 0


@dataclass(frozen=True, slots=True)
class ArticleMention:
    security: Security
    is_primary: bool
    method: str
    confidence: float | None
    evidence: tuple[str, ...]
    sentiment: SentimentScore | None = None


@dataclass(frozen=True, slots=True)
class NewsSource:
    id: str
    slug: str
    name: str
    base_url: str
    status: str
    display_mode: ContentAccess
    last_success_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class NewsArticle:
    id: str
    revision_id: str
    source: NewsSource
    canonical_url: str
    title: str
    description: str | None
    content_text: str | None
    content_blocks: tuple[ContentBlock, ...]
    authors: tuple[str, ...]
    published_at: datetime | None
    source_updated_at: datetime | None
    first_seen_at: datetime
    feed_at: datetime
    fetched_at: datetime
    category: str | None
    tags: tuple[str, ...]
    assets: tuple[ArticleAsset, ...]
    mentions: tuple[ArticleMention, ...]
    sentiment: SentimentScore | None
    extraction_status: ExtractionStatus
    content_access: ContentAccess
    quality_flags: tuple[str, ...]
    candidate_symbols: tuple[str, ...] = ()
    duplicate_source_count: int = 1

    @property
    def reading_time_minutes(self) -> int:
        word_count = len((self.content_text or "").split())
        return max(1, round(word_count / 220))
