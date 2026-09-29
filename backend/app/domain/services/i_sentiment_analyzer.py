"""Sentiment analysis port owned by the domain layer."""

from typing import Protocol

from app.domain.value_objects.sentiment_score import SentimentScore


class ISentimentAnalyzer(Protocol):
    version: str

    def analyze(self, text: str) -> SentimentScore:
        """Classify the tone expressed by text without predicting market prices."""
        ...
