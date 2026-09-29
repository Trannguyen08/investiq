"""External news provider port."""

from typing import Protocol

from app.application.dto.news_dto import ParsedArticle


class INewsProvider(Protocol):
    source_slug: str

    def discover(self, limit: int = 50) -> tuple[str, ...]: ...

    def fetch_article(self, url: str) -> ParsedArticle: ...
