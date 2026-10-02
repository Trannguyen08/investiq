from app.application.use_cases.news.analyze_sentiment import VietnameseRuleSentimentAnalyzer
from app.domain.value_objects.sentiment_score import SentimentLabel


def test_sentiment_distinguishes_positive_negative_and_mixed_text() -> None:
    analyzer = VietnameseRuleSentimentAnalyzer()

    positive = analyzer.analyze("Doanh nghiệp ghi nhận lợi nhuận tăng và vượt kế hoạch năm.")
    negative = analyzer.analyze("Công ty báo lỗ ròng, hoạt động kinh doanh suy giảm mạnh.")
    mixed = analyzer.analyze("Lợi nhuận tăng nhưng doanh thu suy giảm trong quý này.")

    assert positive.label is SentimentLabel.POSITIVE
    assert positive.score is not None and positive.score > 0
    assert negative.label is SentimentLabel.NEGATIVE
    assert negative.score is not None and negative.score < 0
    assert mixed.label is SentimentLabel.MIXED
    assert mixed.score is not None and -0.3 <= mixed.score <= 0.3
    assert positive.confidence is None
    assert positive.market_impact and "ngắn hạn" in positive.market_impact
    assert positive.horizon == "short_term"
    assert positive.evidence and "lợi nhuận tăng" in positive.evidence[0].casefold()


def test_sentiment_does_not_treat_negated_phrase_as_positive() -> None:
    result = VietnameseRuleSentimentAnalyzer().analyze(
        "Kết quả không tăng trưởng như kế hoạch ban đầu của doanh nghiệp."
    )

    assert result.label is SentimentLabel.NEUTRAL


def test_short_text_abstains_instead_of_returning_neutral() -> None:
    result = VietnameseRuleSentimentAnalyzer().analyze("Tin ngắn")

    assert result.label is SentimentLabel.UNKNOWN
    assert result.score is None
    assert result.market_impact


def test_sentiment_uses_dominant_signal_instead_of_defaulting_to_mixed() -> None:
    result = VietnameseRuleSentimentAnalyzer().analyze(
        "Lợi nhuận tăng, vượt kế hoạch và doanh thu tăng, dù nợ xấu còn hiện hữu."
    )

    assert result.label is SentimentLabel.POSITIVE
    assert result.score is not None and result.score > 0
    assert "Rủi ro cần theo dõi" in result.rationale


def test_neutral_analysis_explains_why_market_impact_is_limited() -> None:
    result = VietnameseRuleSentimentAnalyzer().analyze(
        "Doanh nghiệp công bố bổ nhiệm thành viên hội đồng quản trị mới."
    )

    assert result.label is SentimentLabel.NEUTRAL
    assert "quản trị" in result.rationale
    assert result.market_impact and "hạn chế" in result.market_impact


def test_impact_scope_prioritizes_headline_context_over_deep_mentions() -> None:
    result = VietnameseRuleSentimentAnalyzer().analyze(
        "Thương hiệu quốc gia hỗ trợ doanh nghiệp nâng sức cạnh tranh.\n"
        "Chương trình áp dụng tiêu chí mới.\n"
        "Phần cuối bài có ví dụ về một ngân hàng tham gia."
    )

    assert result.impact_scope == "các doanh nghiệp liên quan"


def test_analysis_classifies_topics_and_events() -> None:
    result = VietnameseRuleSentimentAnalyzer().analyze(
        "Doanh nghiệp công bố kết quả kinh doanh với lợi nhuận tăng và kế hoạch trả cổ tức."
    )

    assert "earnings" in result.topics
    assert set(result.event_types) >= {"earnings_result", "dividend"}
