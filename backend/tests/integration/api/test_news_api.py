from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi.testclient import TestClient

from app.api.deps import get_news_repository
from app.application.dto.news_dto import NewsQuery, ParsedArticle
from app.domain.entities.news_article import (
    ArticleMention,
    ContentAccess,
    ContentBlock,
    ExtractionStatus,
    NewsArticle,
    NewsSource,
)
from app.domain.entities.stock import Security
from app.domain.value_objects.sentiment_score import SentimentLabel, SentimentScore
from app.main import app

SOURCE = NewsSource(
    id="91d46443-4e4b-4c09-8ce0-36c8279a0001",
    slug="vietstock",
    name="Vietstock",
    base_url="https://vietstock.vn",
    status="active",
    display_mode=ContentAccess.FULL_TEXT,
    last_success_at=datetime(2026, 9, 29, 3, 30, tzinfo=UTC),
)
SENTIMENT = SentimentScore(
    label=SentimentLabel.POSITIVE,
    score=0.5,
    confidence=None,
    market_impact="Có thể hỗ trợ tâm lý ngắn hạn đối với cổ phiếu được nhắc đến.",
    impact_scope="cổ phiếu được nhắc đến",
    horizon="short_term",
    rationale="Nội dung có tín hiệu tích cực.",
    evidence=("lợi nhuận tăng",),
    method="rules",
    analyzer_version="rules-vi-1",
    analyzed_at=datetime(2026, 9, 29, 3, 31, tzinfo=UTC),
)
SECURITY = Security(
    id="d428587b-c492-40f8-a3af-b99dd12de001",
    symbol="FPT",
    exchange="HOSE",
    issuer_name="Công ty Cổ phần FPT",
)


def make_article(article_id: str, minute: int) -> NewsArticle:
    timestamp = datetime(2026, 9, 29, 3, minute, tzinfo=UTC)
    return NewsArticle(
        id=article_id,
        revision_id="a1feef4b-b0aa-47d1-a44f-d8c837532001",
        source=SOURCE,
        canonical_url="https://vietstock.vn/fpt.htm",
        title="FPT ghi nhận lợi nhuận tăng",
        description="Kết quả kinh doanh mới nhất.",
        content_text="Lợi nhuận tăng trong quý.",
        content_blocks=(ContentBlock(id="b1", type="paragraph", text="Lợi nhuận tăng trong quý."),),
        authors=("Minh An",),
        published_at=timestamp,
        source_updated_at=None,
        first_seen_at=timestamp,
        feed_at=timestamp,
        fetched_at=timestamp,
        category="Chứng khoán",
        tags=("FPT",),
        assets=(),
        mentions=(ArticleMention(SECURITY, True, "exchange_pattern", 1, ("HOSE:FPT",), SENTIMENT),),
        sentiment=SENTIMENT,
        extraction_status=ExtractionStatus.COMPLETE,
        content_access=ContentAccess.FULL_TEXT,
        quality_flags=(),
        candidate_symbols=("HOSE:FPT", "HOSE:VPB"),
    )


class FakeNewsRepository:
    articles = (
        make_article("11111111-1111-4111-8111-111111111111", 20),
        make_article("22222222-2222-4222-8222-222222222222", 10),
    )

    def list_articles(self, query: NewsQuery) -> tuple[tuple[NewsArticle, ...], bool]:
        if query.cursor_id:
            return (self.articles[1],), False
        return self.articles[: query.limit], len(self.articles) > query.limit

    def get_article(self, article_id: str) -> NewsArticle | None:
        return next((article for article in self.articles if article.id == article_id), None)

    def list_sources(self) -> tuple[NewsSource, ...]:
        return (SOURCE,)

    def search_securities(self, query: str, limit: int) -> tuple[Security, ...]:
        return (SECURITY,) if "fp" in query.lower() else ()

    def find_securities(self, symbols: tuple[str, ...]) -> tuple[Security, ...]:
        return (SECURITY,) if "HOSE:FPT" in symbols else ()

    def upsert_article(
        self,
        parsed: ParsedArticle,
        securities: tuple[Security, ...],
        article_sentiment: SentimentScore,
        symbol_sentiments: dict[str, SentimentScore],
        analyzer_version: str,
    ) -> tuple[str, bool]:
        raise NotImplementedError


def repository_override() -> FakeNewsRepository:
    return FakeNewsRepository()


def test_news_collection_has_signed_cursor_and_filter_contract() -> None:
    app.dependency_overrides[get_news_repository] = repository_override
    try:
        with TestClient(app) as client:
            response = client.get(
                "/api/v1/news?limit=1&source=vietstock", headers={"X-Request-ID": "news-list"}
            )
            cursor = response.json()["pagination"]["next_cursor"]
            next_response = client.get(
                f"/api/v1/news?limit=1&source=vietstock&cursor={cursor}",
                headers={"X-Request-ID": "news-next"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["data"][0]["symbols"][0]["symbol"] == "FPT"
    assert response.json()["meta"]["request_id"] == "news-list"
    assert next_response.status_code == 200
    assert next_response.json()["pagination"]["has_more"] is False


def test_cursor_cannot_be_reused_with_different_filters() -> None:
    app.dependency_overrides[get_news_repository] = repository_override
    try:
        with TestClient(app) as client:
            first = client.get("/api/v1/news?limit=1")
            cursor = first.json()["pagination"]["next_cursor"]
            response = client.get(f"/api/v1/news?limit=1&sentiment=negative&cursor={cursor}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "REQUEST_REJECTED"


def test_news_detail_and_security_search_use_public_shapes() -> None:
    article_id = "11111111-1111-4111-8111-111111111111"
    app.dependency_overrides[get_news_repository] = repository_override
    try:
        with TestClient(app) as client:
            detail = client.get(f"/api/v1/news/{article_id}")
            securities = client.get("/api/v1/securities/search?q=FPT")
    finally:
        app.dependency_overrides.clear()

    assert detail.status_code == 200
    assert detail.json()["data"]["content_blocks"][0]["type"] == "paragraph"
    assert detail.json()["data"]["sentiment"]["confidence"] is None
    assert detail.json()["data"]["sentiment"]["horizon"] == "short_term"
    assert "ngắn hạn" in detail.json()["data"]["sentiment"]["market_impact"]
    assert detail.json()["data"]["mentioned_symbols"] == ["HOSE:VPB"]
    assert detail.json()["data"]["sentiment"]["analyzer_version"] == "rules-vi-1"
    assert securities.status_code == 200
    assert securities.json()["data"][0]["exchange"] == "HOSE"
    UUID(securities.json()["data"][0]["security_id"])


def test_invalid_article_id_returns_safe_validation_error() -> None:
    app.dependency_overrides[get_news_repository] = repository_override
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/news/not-a-uuid")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_news_collection_accepts_filters_for_all_seeded_sources() -> None:
    source_slugs = (
        "vietstock",
        "cafef",
        "hnx",
        "hose",
        "stockbiz",
        "fireant",
        "simplize",
        "ssi-iboard",
        "tradingview",
        "vneconomy",
        "vnexpress",
    )
    app.dependency_overrides[get_news_repository] = repository_override
    try:
        with TestClient(app) as client:
            response = client.get(
                "/api/v1/news", params=[("source", slug) for slug in source_slugs]
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200


def test_news_collection_applies_recent_window_to_repository() -> None:
    captured: list[NewsQuery] = []

    class CapturingRepository(FakeNewsRepository):
        def list_articles(self, query: NewsQuery) -> tuple[tuple[NewsArticle, ...], bool]:
            captured.append(query)
            return (), False

    app.dependency_overrides[get_news_repository] = CapturingRepository
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/news?window_days=1")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured[0].published_after is not None
    assert datetime.now(UTC) - captured[0].published_after < timedelta(hours=25)


def test_news_admin_fails_closed_when_token_is_not_configured() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/admin/news/sources")

    assert response.status_code == 503
