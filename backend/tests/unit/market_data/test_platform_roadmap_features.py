"""Unit tests for sentiment-impact ML scorer, counter-analysis, rate limiter, and candle repo."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock

from app.application.use_cases.community.counter_analysis import generate_counter_analysis
from app.domain.entities.market import Candle
from app.infrastructure.cache.rate_limiter import SlidingWindowRateLimiter
from app.infrastructure.db.repositories.sql_market_candles_repository import (
    SqlMarketCandlesRepository,
)
from app.infrastructure.ml.sentiment_impact_model import compute_sentiment_impact


def _sample_candles(closes: list[float]) -> list[Candle]:
    base = datetime(2026, 11, 1, tzinfo=UTC)
    return [
        Candle(
            timestamp=base + timedelta(days=i),
            open=Decimal(str(c)),
            high=Decimal(str(c + 500)),
            low=Decimal(str(c - 500)),
            close=Decimal(str(c)),
            volume=Decimal("1500000" if i == len(closes) - 1 else "1000000"),
        )
        for i, c in enumerate(closes)
    ]


def test_sentiment_impact_bullish_and_bearish() -> None:
    now = datetime(2026, 11, 13, 12, 0, tzinfo=UTC)
    candles_up = _sample_candles([20000, 20200, 20400, 20800, 21100, 21600])
    res_up = compute_sentiment_impact(
        symbol="HPG",
        news_items=[
            {"sentiment": "positive", "sentiment_score": 0.9, "published_at": now.isoformat()},
            {"sentiment": "positive", "sentiment_score": 0.8, "published_at": now.isoformat()},
        ],
        candles=candles_up,
        now=now,
    )
    assert res_up.expected_direction == "bullish"
    assert res_up.impact_score > 60.0
    assert res_up.positive_count == 2
    assert res_up.price_momentum_5d_pct is not None and res_up.price_momentum_5d_pct > 0

    candles_down = _sample_candles([22000, 21800, 21500, 21100, 20600, 20000])
    res_down = compute_sentiment_impact(
        symbol="HPG",
        news_items=[
            {"sentiment": "negative", "sentiment_score": 0.85, "published_at": now.isoformat()},
        ],
        candles=candles_down,
        now=now,
    )
    assert res_down.expected_direction == "bearish"
    assert res_down.impact_score < 42.0


def test_generate_counter_analysis_challenges_bullish_thesis() -> None:
    result = generate_counter_analysis(
        thesis={
            "id": "t-1",
            "symbol": "HPG",
            "stance": "bullish",
            "entry_price": "21000",
            "target_price": "22000",
            "stop_loss_price": "19500",
        },
        news_items=[
            {
                "title": "Giá thép thế giới chịu áp lực giảm",
                "sentiment": "negative",
                "source_name": "CafeF",
                "canonical_url": "https://cafef.vn/test-hpg",
            }
        ],
        financial_statement={
            "charts": [
                {"period": "Q3-2026", "revenue_billion": 30000.0, "profit_billion": 2500.0},
                {"period": "Q2-2026", "revenue_billion": 34000.0, "profit_billion": 2900.0},
            ]
        },
        current_price=Decimal("21500"),
    )
    assert result["symbol"] == "HPG"
    types = {pt["evidence_type"] for pt in result["counter_points"]}
    assert "price_action" in types
    assert "news" in types
    assert "financials" in types


def test_sliding_window_rate_limiter() -> None:
    limiter = SlidingWindowRateLimiter()
    for _ in range(3):
        allowed, _ = limiter.check("ai-chat:u1", max_requests=3, window_seconds=60)
        assert allowed is True
    allowed, retry_after = limiter.check("ai-chat:u1", max_requests=3, window_seconds=60)
    assert allowed is False
    assert retry_after >= 1


def test_sql_market_candles_repository_get_candles_orders_chronologically() -> None:
    t1 = datetime(2026, 11, 11, tzinfo=UTC)
    t2 = datetime(2026, 11, 12, tzinfo=UTC)
    mock_cur = MagicMock()
    mock_cur.fetchall.return_value = [
        (t2, Decimal("1734"), Decimal("1740"), Decimal("1730"), Decimal("1735"), Decimal("500")),
        (t1, Decimal("1720"), Decimal("1735"), Decimal("1718"), Decimal("1734"), Decimal("480")),
    ]
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_pool = MagicMock()
    mock_pool.connection.return_value.__enter__.return_value = mock_conn

    repo = SqlMarketCandlesRepository(pool=mock_pool)
    candles = repo.get_candles("VNINDEX", "1D", limit=10)
    assert len(candles) == 2
    assert candles[0].timestamp == t1
    assert candles[1].timestamp == t2
