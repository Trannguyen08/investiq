"""Application-owned news input and query contracts."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.domain.entities.news_article import ArticleAsset, ContentBlock, ExtractionStatus


@dataclass(frozen=True, slots=True)
class ParsedArticle:
    source_slug: str
    canonical_url: str
    title: str
    description: str | None
    content_text: str | None
    content_blocks: tuple[ContentBlock, ...]
    authors: tuple[str, ...]
    published_at: datetime | None
    source_updated_at: datetime | None
    fetched_at: datetime
    category: str | None
    tags: tuple[str, ...]
    assets: tuple[ArticleAsset, ...]
    candidate_symbols: tuple[str, ...]
    extraction_status: ExtractionStatus
    quality_flags: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class NewsQuery:
    query: str | None = None
    sources: tuple[str, ...] = ()
    symbols: tuple[str, ...] = ()
    category: str | None = None
    sentiment: str | None = None
    limit: int = 20
    cursor_feed_at: datetime | None = None
    cursor_id: str | None = None
    published_after: datetime | None = None
