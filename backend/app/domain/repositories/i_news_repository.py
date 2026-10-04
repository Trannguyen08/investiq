"""Persistence port for the news aggregate."""

from __future__ import annotations

from typing import Protocol

from app.application.dto.news_dto import NewsQuery, ParsedArticle
from app.domain.entities.news_article import NewsArticle, NewsSource
from app.domain.entities.stock import Security
from app.domain.value_objects.sentiment_score import SentimentScore


class INewsRepository(Protocol):
    def list_articles(self, query: NewsQuery) -> tuple[tuple[NewsArticle, ...], bool]: ...

    def count_articles(self, query: NewsQuery) -> int: ...

    def get_article(self, article_id: str) -> NewsArticle | None: ...

    def list_sources(self) -> tuple[NewsSource, ...]: ...

    def search_securities(self, query: str, limit: int) -> tuple[Security, ...]: ...

    def find_securities(self, symbols: tuple[str, ...]) -> tuple[Security, ...]: ...

    def upsert_article(
        self,
        parsed: ParsedArticle,
        securities: tuple[Security, ...],
        article_sentiment: SentimentScore,
        symbol_sentiments: dict[str, SentimentScore],
        analyzer_version: str,
    ) -> tuple[str, bool]: ...
