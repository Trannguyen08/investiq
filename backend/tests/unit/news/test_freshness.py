from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from app.application.dto.news_dto import ParsedArticle
from app.application.use_cases.news.freshness import (
    StaleArticle,
    UnverifiableArticleDate,
    require_recent_article,
)
from app.domain.entities.news_article import ExtractionStatus

NOW = datetime(2026, 9, 30, 12, tzinfo=UTC)
ARTICLE = ParsedArticle(
    source_slug="vietstock",
    canonical_url="https://vietstock.vn/current.htm",
    title="Current market news",
    description=None,
    content_text=None,
    content_blocks=(),
    authors=(),
    published_at=NOW - timedelta(hours=2),
    source_updated_at=None,
    fetched_at=NOW,
    category=None,
    tags=(),
    assets=(),
    candidate_symbols=(),
    extraction_status=ExtractionStatus.METADATA_ONLY,
    quality_flags=(),
)


def test_recent_article_is_accepted() -> None:
    require_recent_article(ARTICLE, max_age=timedelta(hours=72), now=NOW)


def test_stale_article_is_rejected() -> None:
    with pytest.raises(StaleArticle):
        require_recent_article(
            replace(ARTICLE, published_at=NOW - timedelta(hours=73)),
            max_age=timedelta(hours=72),
            now=NOW,
        )


@pytest.mark.parametrize("published_at", [None, NOW + timedelta(minutes=16)])
def test_unverifiable_article_date_is_rejected(published_at: datetime | None) -> None:
    with pytest.raises(UnverifiableArticleDate):
        require_recent_article(
            replace(ARTICLE, published_at=published_at),
            max_age=timedelta(hours=72),
            now=NOW,
        )
