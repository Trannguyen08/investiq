"""Sentiment values with explicit financial-domain semantics."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class SentimentLabel(StrEnum):
    """A text tone label; it is not a prediction of future price movement."""

    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    MIXED = "mixed"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class SentimentScore:
    """A bounded tone score and optional calibrated confidence."""

    label: SentimentLabel
    score: float | None
    confidence: float | None
    rationale: str
    evidence: tuple[str, ...]
    market_impact: str | None = None
    impact_scope: str | None = None
    horizon: str | None = None
    topics: tuple[str, ...] = ()
    event_types: tuple[str, ...] = ()
    method: str | None = None
    analyzer_version: str | None = None
    analyzed_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.score is not None and not -1 <= self.score <= 1:
            raise ValueError("sentiment score must be between -1 and 1")
        if self.confidence is not None and not 0 <= self.confidence <= 1:
            raise ValueError("sentiment confidence must be between 0 and 1")
        if self.label is SentimentLabel.UNKNOWN and self.score is not None:
            raise ValueError("unknown sentiment cannot have a numeric score")
