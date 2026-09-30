"""Freshness policy shared by ingestion and retention operations."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.application.dto.news_dto import ParsedArticle


class UnverifiableArticleDate(ValueError):
    """The publisher did not provide a trustworthy publication timestamp."""


class StaleArticle(ValueError):
    """The article falls outside the configured ingestion window."""


def require_recent_article(
    article: ParsedArticle,
    *,
    max_age: timedelta,
    now: datetime | None = None,
) -> None:
    """Reject undated, stale, or implausibly future-dated publisher content."""
    observed_at = (now or datetime.now(UTC)).astimezone(UTC)
    published_at = article.published_at
    if published_at is None:
        raise UnverifiableArticleDate("publisher publication time is required")
    published_at = published_at.astimezone(UTC)
    if published_at < observed_at - max_age:
        raise StaleArticle("article is older than the ingestion window")
    if published_at > observed_at + timedelta(minutes=15):
        raise UnverifiableArticleDate("publisher publication time is in the future")
