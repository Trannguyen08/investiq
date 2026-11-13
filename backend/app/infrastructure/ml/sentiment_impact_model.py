"""Quantitative Sentiment-to-Impact scoring model combining news sentiment and price/volume features."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.domain.entities.market import Candle


@dataclass(frozen=True, slots=True)
class SentimentImpactResult:
    symbol: str
    impact_score: float
    expected_direction: str
    confidence: float
    news_count: int
    positive_count: int
    negative_count: int
    neutral_count: int
    price_momentum_5d_pct: float | None
    volume_ratio_20d: float | None
    feature_contributions: dict[str, float]
    model_version: str = "sentiment-impact-logistic-v1"

    def to_dict(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "impact_score": round(self.impact_score, 2),
            "expected_direction": self.expected_direction,
            "confidence": round(self.confidence, 4),
            "news_count": self.news_count,
            "positive_count": self.positive_count,
            "negative_count": self.negative_count,
            "neutral_count": self.neutral_count,
            "price_momentum_5d_pct": (
                round(self.price_momentum_5d_pct, 2)
                if self.price_momentum_5d_pct is not None
                else None
            ),
            "volume_ratio_20d": (
                round(self.volume_ratio_20d, 2) if self.volume_ratio_20d is not None else None
            ),
            "feature_contributions": {
                k: round(v, 4) for k, v in self.feature_contributions.items()
            },
            "model_version": self.model_version,
        }


def _sigmoid(x: float) -> float:
    clamped = max(-20.0, min(20.0, x))
    return 1.0 / (1.0 + math.exp(-clamped))


def compute_sentiment_impact(
    *,
    symbol: str,
    news_items: Sequence[dict[str, Any]],
    candles: Sequence[Candle],
    now: datetime | None = None,
) -> SentimentImpactResult:
    """Compute explainable sentiment-to-impact score from news & OHLCV candles."""
    ref_now = now or datetime.now(UTC)
    pos_count = 0
    neg_count = 0
    neu_count = 0
    weighted_sent_sum = 0.0
    weight_total = 0.0

    for item in news_items:
        label = str(item.get("sentiment") or item.get("sentiment_label") or "neutral").lower()
        raw_score = item.get("sentiment_score")
        if label == "positive":
            pos_count += 1
            polarity = float(raw_score) if isinstance(raw_score, (int, float)) else 0.75
        elif label == "negative":
            neg_count += 1
            polarity = -abs(float(raw_score)) if isinstance(raw_score, (int, float)) else -0.75
        else:
            neu_count += 1
            polarity = 0.0

        published_at = item.get("published_at")
        age_hours = 24.0
        if isinstance(published_at, datetime):
            dt = published_at if published_at.tzinfo else published_at.replace(tzinfo=UTC)
            age_hours = max(0.0, (ref_now - dt).total_seconds() / 3600.0)
        elif isinstance(published_at, str):
            try:
                dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=UTC)
                age_hours = max(0.0, (ref_now - dt).total_seconds() / 3600.0)
            except ValueError:
                age_hours = 24.0

        decay_weight = math.exp(-age_hours / 48.0)
        weighted_sent_sum += polarity * decay_weight
        weight_total += decay_weight

    decayed_sentiment = (weighted_sent_sum / weight_total) if weight_total > 0 else 0.0

    momentum_5d_pct: float | None = None
    volume_ratio_20d: float | None = None
    if len(candles) >= 6:
        close_now = float(candles[-1].close)
        close_5d = float(candles[-6].close)
        if close_5d > 0:
            momentum_5d_pct = ((close_now - close_5d) / close_5d) * 100.0

    if len(candles) >= 2:
        recent_vols = [float(c.volume) for c in candles[-21:-1] if float(c.volume) > 0]
        latest_vol = float(candles[-1].volume)
        if recent_vols and latest_vol >= 0:
            avg_vol = sum(recent_vols) / len(recent_vols)
            if avg_vol > 0:
                volume_ratio_20d = latest_vol / avg_vol

    sent_contrib = 1.8 * decayed_sentiment
    mom_contrib = 0.08 * max(-15.0, min(15.0, momentum_5d_pct or 0.0))
    vol_contrib = 0.25 * max(-1.0, min(2.0, (volume_ratio_20d - 1.0) if volume_ratio_20d else 0.0))

    logit = sent_contrib + mom_contrib + vol_contrib
    prob_bullish = _sigmoid(logit)
    impact_score = prob_bullish * 100.0

    if prob_bullish >= 0.58:
        direction = "bullish"
    elif prob_bullish <= 0.42:
        direction = "bearish"
    else:
        direction = "neutral"

    evidence_strength = min(1.0, (len(news_items) / 10.0) * 0.6 + (0.4 if candles else 0.0))
    margin = abs(prob_bullish - 0.5) * 2.0
    confidence = max(0.15, min(0.95, 0.35 * evidence_strength + 0.65 * margin))

    return SentimentImpactResult(
        symbol=symbol.upper(),
        impact_score=impact_score,
        expected_direction=direction,
        confidence=confidence,
        news_count=len(news_items),
        positive_count=pos_count,
        negative_count=neg_count,
        neutral_count=neu_count,
        price_momentum_5d_pct=momentum_5d_pct,
        volume_ratio_20d=volume_ratio_20d,
        feature_contributions={
            "decayed_news_sentiment": sent_contrib,
            "price_momentum_5d": mom_contrib,
            "volume_surge_20d": vol_contrib,
        },
    )
