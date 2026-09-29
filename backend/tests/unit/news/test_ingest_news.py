from datetime import UTC, datetime

from app.application.dto.news_dto import NewsQuery, ParsedArticle
from app.application.use_cases.news.analyze_sentiment import VietnameseRuleSentimentAnalyzer
from app.application.use_cases.news.ingest_news import IngestNews
from app.domain.entities.news_article import ExtractionStatus, NewsArticle, NewsSource
from app.domain.entities.stock import Security
from app.domain.value_objects.sentiment_score import SentimentScore


class RecordingRepository:
    def __init__(self) -> None:
        self.securities: tuple[Security, ...] = (Security("sec-1", "FPT", "HOSE", "Công ty FPT"),)
        self.received: tuple[ParsedArticle, tuple[Security, ...], SentimentScore] | None = None
        self.symbol_sentiments: dict[str, SentimentScore] = {}

    def find_securities(self, symbols: tuple[str, ...]) -> tuple[Security, ...]:
        return self.securities if "HOSE:FPT" in symbols else ()

    def upsert_article(
        self,
        parsed: ParsedArticle,
        securities: tuple[Security, ...],
        article_sentiment: SentimentScore,
        symbol_sentiments: dict[str, SentimentScore],
        analyzer_version: str,
    ) -> tuple[str, bool]:
        assert analyzer_version == "rules-vi-4"
        self.received = (parsed, securities, article_sentiment)
        self.symbol_sentiments = symbol_sentiments
        return "article-1", True

    def list_articles(self, query: NewsQuery) -> tuple[tuple[NewsArticle, ...], bool]:
        raise NotImplementedError

    def get_article(self, article_id: str) -> NewsArticle | None:
        raise NotImplementedError

    def list_sources(self) -> tuple[NewsSource, ...]:
        raise NotImplementedError

    def search_securities(self, query: str, limit: int) -> tuple[Security, ...]:
        raise NotImplementedError


def test_ingest_resolves_symbols_and_persists_sentiment() -> None:
    repository = RecordingRepository()
    parsed = ParsedArticle(
        source_slug="vietstock",
        canonical_url="https://vietstock.vn/a.htm",
        title="FPT ghi nhận lợi nhuận tăng mạnh",
        description="Kết quả tích cực từ HOSE:FPT.",
        content_text="Doanh thu và lợi nhuận tăng mạnh trong quý.",
        content_blocks=(),
        authors=(),
        published_at=datetime(2026, 9, 29, tzinfo=UTC),
        source_updated_at=None,
        fetched_at=datetime(2026, 9, 29, tzinfo=UTC),
        category="Chứng khoán",
        tags=("FPT",),
        assets=(),
        candidate_symbols=("HOSE:FPT",),
        extraction_status=ExtractionStatus.COMPLETE,
        quality_flags=(),
    )

    article_id, changed = IngestNews(repository, VietnameseRuleSentimentAnalyzer()).execute(parsed)

    assert (article_id, changed) == ("article-1", True)
    assert repository.received is not None
    assert repository.received[1] == repository.securities
    assert repository.symbol_sentiments["HOSE:FPT"].label == repository.received[2].label


def test_ingest_scores_each_security_from_its_own_context() -> None:
    repository = RecordingRepository()
    repository.securities = (
        Security("sec-1", "FPT", "HOSE", "Công ty FPT"),
        Security("sec-2", "HPG", "HOSE", "Công ty Hòa Phát"),
    )
    article_body = " ".join(
        (
            "HOSE:FPT ghi nhận lợi nhuận tăng mạnh.",
            "HOSE:HPG báo lỗ ròng và hoạt động suy giảm.",
        )
    )
    parsed = ParsedArticle(
        source_slug="vietstock",
        canonical_url="https://vietstock.vn/two-symbols.htm",
        title="Cập nhật HOSE:FPT và HOSE:HPG",
        description=None,
        content_text=article_body,
        content_blocks=(),
        authors=(),
        published_at=None,
        source_updated_at=None,
        fetched_at=datetime(2026, 9, 29, tzinfo=UTC),
        category="Chứng khoán",
        tags=(),
        assets=(),
        candidate_symbols=("HOSE:FPT", "HOSE:HPG"),
        extraction_status=ExtractionStatus.COMPLETE,
        quality_flags=(),
    )

    IngestNews(repository, VietnameseRuleSentimentAnalyzer()).execute(parsed)

    assert repository.symbol_sentiments["HOSE:FPT"].label.value == "positive"
    assert repository.symbol_sentiments["HOSE:HPG"].label.value == "negative"
