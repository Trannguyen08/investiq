"""Coordinate idempotent article ingestion and enrichment."""

from __future__ import annotations

import re

from app.application.dto.news_dto import ParsedArticle
from app.domain.entities.stock import Security
from app.domain.repositories.i_news_repository import INewsRepository
from app.domain.services.i_sentiment_analyzer import ISentimentAnalyzer


class IngestNews:
    def __init__(
        self,
        repository: INewsRepository,
        sentiment_analyzer: ISentimentAnalyzer,
    ) -> None:
        self._repository = repository
        self._sentiment_analyzer = sentiment_analyzer

    def execute(self, parsed: ParsedArticle) -> tuple[str, bool]:
        if not parsed.title.strip():
            raise ValueError("article title is required")
        if not parsed.canonical_url.startswith(("https://", "http://")):
            raise ValueError("article URL must use HTTP or HTTPS")

        securities = self._repository.find_securities(parsed.candidate_symbols)
        article_text = "\n".join(
            part for part in (parsed.title, parsed.description, parsed.content_text) if part
        )
        analysis_text = article_text
        if parsed.candidate_symbols:
            analysis_text += "\nMã chứng khoán được nguồn nhắc đến: " + ", ".join(
                parsed.candidate_symbols
            )
        article_sentiment = self._sentiment_analyzer.analyze(analysis_text)
        symbol_sentiments = {
            security.qualified_symbol: self._sentiment_analyzer.analyze(
                self._security_context(article_text, security)
            )
            for security in securities
        }
        return self._repository.upsert_article(
            parsed,
            securities,
            article_sentiment,
            symbol_sentiments,
            self._sentiment_analyzer.version,
        )

    @staticmethod
    def _security_context(article_text: str, security: Security) -> str:
        sentences = re.split(r"(?<=[.!?])\s+|\n+", article_text)
        qualified_pattern = re.compile(
            rf"\b{re.escape(security.exchange)}\s*:\s*{re.escape(security.symbol)}\b",
            re.IGNORECASE,
        )
        symbol_pattern = re.compile(rf"\b{re.escape(security.symbol)}\b", re.IGNORECASE)
        matching = [
            sentence.strip()
            for sentence in sentences
            if qualified_pattern.search(sentence) or symbol_pattern.search(sentence)
        ]
        return "\n".join(matching)
