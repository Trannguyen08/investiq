"""Deterministic, auditable Vietnamese financial-news analysis."""

from __future__ import annotations

import re
import unicodedata
from datetime import UTC, datetime

from app.domain.services.i_sentiment_analyzer import ISentimentAnalyzer
from app.domain.value_objects.sentiment_score import SentimentLabel, SentimentScore

SignalRules = tuple[tuple[str, int], ...]


def _normalize(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).casefold().split())


class VietnameseRuleSentimentAnalyzer(ISentimentAnalyzer):
    """Explainable financial baseline focused on events that can move listed securities."""

    version = "rules-vi-4"
    _positive: SignalRules = (
        ("lợi nhuận tăng", 3),
        ("lãi ròng tăng", 3),
        ("doanh thu tăng", 2),
        ("vượt kế hoạch", 3),
        ("lãi kỷ lục", 3),
        ("tăng trưởng", 2),
        ("tăng trần", 2),
        ("khởi sắc", 2),
        ("bứt phá", 2),
        ("phục hồi", 2),
        ("mua ròng", 2),
        ("dòng tiền vào", 2),
        ("trúng thầu", 2),
        ("ký kết", 1),
        ("mở rộng", 1),
        ("nâng hạng", 3),
        ("cổ tức", 1),
        ("cổ phiếu thưởng", 1),
        ("giảm lãi suất", 2),
        ("tích cực", 2),
    )
    _negative: SignalRules = (
        ("lỗ ròng", 3),
        ("thua lỗ", 3),
        ("lỗ", 2),
        ("lợi nhuận giảm", 3),
        ("doanh thu giảm", 2),
        ("suy giảm", 2),
        ("giảm sàn", 3),
        ("bán tháo", 3),
        ("bán ròng", 2),
        ("áp lực bán", 2),
        ("nợ xấu", 2),
        ("chậm công bố", 2),
        ("siết giao dịch", 3),
        ("hạn chế giao dịch", 3),
        ("vi phạm", 2),
        ("bị phạt", 2),
        ("đình chỉ", 3),
        ("phá sản", 4),
        ("xin nghỉ", 1),
        ("thoái vốn", 1),
        ("thận trọng", 1),
        ("tiêu cực", 2),
    )
    _scope_rules: tuple[tuple[str, tuple[str, ...]], ...] = (
        (
            "toàn thị trường",
            ("vn-index", "thị trường chứng khoán", "khối ngoại", "tự doanh", "thanh khoản"),
        ),
        ("nhóm ngân hàng", ("ngân hàng", "tín dụng", "nợ xấu", "lãi suất")),
        ("nhóm bất động sản", ("bất động sản", "đất đai", "nhà ở")),
        ("nhóm năng lượng", ("dầu khí", "điện", "năng lượng")),
        ("các doanh nghiệp liên quan", ("doanh nghiệp", "công ty", "tập đoàn")),
    )

    def analyze(self, text: str) -> SentimentScore:
        unique_parts = tuple(
            dict.fromkeys(part.strip() for part in text.splitlines() if part.strip())
        )
        normalized = _normalize(" ".join(unique_parts))
        lead_context = _normalize(" ".join(unique_parts[:2]))
        analyzed_at = datetime.now(UTC)
        if len(normalized) < 20:
            return SentimentScore(
                label=SentimentLabel.UNKNOWN,
                score=None,
                confidence=None,
                rationale="Chưa đủ dữ kiện để hình thành nhận định có cơ sở.",
                evidence=(),
                market_impact="Chưa thể xác định ảnh hưởng đến thị trường chứng khoán.",
                impact_scope=None,
                horizon=None,
                method="rules",
                analyzer_version=self.version,
                analyzed_at=analyzed_at,
            )

        positive_hits = self._find_hits(normalized, self._positive)
        negative_hits = self._find_hits(normalized, self._negative)
        positive_weight = sum(weight for _, weight in positive_hits)
        negative_weight = sum(weight for _, weight in negative_hits)
        net_weight = positive_weight - negative_weight
        total_weight = positive_weight + negative_weight

        if total_weight == 0:
            label = SentimentLabel.NEUTRAL
            score = 0.0
        elif positive_weight and negative_weight and abs(net_weight) <= max(2, total_weight * 0.3):
            label = SentimentLabel.MIXED
            score = round(max(-1.0, min(1.0, net_weight / max(8, total_weight))), 3)
        elif net_weight > 0:
            label = SentimentLabel.POSITIVE
            score = round(min(1.0, 0.2 + net_weight / 10), 3)
        else:
            label = SentimentLabel.NEGATIVE
            score = round(max(-1.0, -0.2 + net_weight / 10), 3)

        positive_terms = tuple(phrase for phrase, _ in positive_hits)
        negative_terms = tuple(phrase for phrase, _ in negative_hits)
        scope = self._impact_scope(normalized, lead_context)
        rationale = self._rationale(label, positive_terms, negative_terms, normalized)
        market_impact = self._market_impact(label, scope, positive_terms, negative_terms)
        evidence = self._evidence(text, (*positive_terms, *negative_terms))

        return SentimentScore(
            label=label,
            score=score,
            confidence=None,
            rationale=rationale,
            evidence=evidence,
            market_impact=market_impact,
            impact_scope=scope,
            horizon="short_term",
            method="rules",
            analyzer_version=self.version,
            analyzed_at=analyzed_at,
        )

    @staticmethod
    def _find_hits(text: str, rules: SignalRules) -> tuple[tuple[str, int], ...]:
        hits: list[tuple[str, int]] = []
        for phrase, weight in rules:
            if any(phrase in existing_phrase for existing_phrase, _ in hits):
                continue
            for match in re.finditer(re.escape(phrase), text):
                prefix = text[max(0, match.start() - 16) : match.start()]
                if re.search(r"(?:không|chưa|khó)\s+$", prefix):
                    continue
                hits.append((phrase, weight))
                break
        return tuple(hits)

    @classmethod
    def _impact_scope(cls, text: str, lead_context: str) -> str:
        if "mã chứng khoán được nguồn nhắc đến:" in text:
            return "các cổ phiếu được nhắc đến"
        for scope, phrases in cls._scope_rules:
            if any(phrase in lead_context for phrase in phrases):
                return scope
        for scope, phrases in cls._scope_rules:
            if any(phrase in text for phrase in phrases):
                return scope
        if re.search(r"\b(?:hose|hnx|upcom)\s*:\s*[a-z0-9]{3,8}\b", text):
            return "cổ phiếu được nhắc đến"
        return "thị trường chung"

    @staticmethod
    def _rationale(
        label: SentimentLabel,
        positive_terms: tuple[str, ...],
        negative_terms: tuple[str, ...],
        text: str,
    ) -> str:
        positive_summary = ", ".join(positive_terms[:3])
        negative_summary = ", ".join(negative_terms[:3])
        if label is SentimentLabel.POSITIVE:
            rationale = f"Quan điểm: tích cực. Động lực chính đến từ {positive_summary}."
            if negative_summary:
                rationale += f" Rủi ro cần theo dõi là {negative_summary}."
            return rationale
        if label is SentimentLabel.NEGATIVE:
            rationale = f"Quan điểm: tiêu cực. Áp lực chính đến từ {negative_summary}."
            if positive_summary:
                rationale += f" Yếu tố hỗ trợ hiện có là {positive_summary}."
            return rationale
        if label is SentimentLabel.MIXED:
            return (
                "Quan điểm: trái chiều. "
                f"Yếu tố hỗ trợ gồm {positive_summary}; rủi ro gồm {negative_summary}."
            )
        topic = "thông tin sự kiện"
        if any(term in text for term in ("bổ nhiệm", "quản trị", "đại hội", "công bố")):
            topic = "thông tin quản trị hoặc công bố"
        elif any(term in text for term in ("thương hiệu", "giải thưởng", "vinh danh")):
            topic = "thông tin thương hiệu"
        return (
            f"Quan điểm: trung tính. Bài viết chủ yếu cung cấp {topic}, "
            "chưa có dữ kiện đủ mạnh về lợi nhuận, dòng tiền hoặc rủi ro "
            "để tạo thiên hướng rõ ràng."
        )

    @staticmethod
    def _market_impact(
        label: SentimentLabel,
        scope: str,
        positive_terms: tuple[str, ...],
        negative_terms: tuple[str, ...],
    ) -> str:
        if label is SentimentLabel.POSITIVE:
            return (
                f"Có thể hỗ trợ tâm lý ngắn hạn đối với {scope}; "
                f"chất xúc tác chính là {', '.join(positive_terms[:2])}."
            )
        if label is SentimentLabel.NEGATIVE:
            return (
                f"Có thể tạo áp lực ngắn hạn lên {scope}; "
                f"rủi ro chính là {', '.join(negative_terms[:2])}."
            )
        if label is SentimentLabel.MIXED:
            return (
                f"Ảnh hưởng ngắn hạn lên {scope} có thể giằng co vì yếu tố hỗ trợ "
                "và rủi ro xuất hiện đồng thời."
            )
        return (
            f"Ảnh hưởng ngắn hạn đến {scope} được đánh giá là hạn chế vì chưa có "
            "chất xúc tác hoặc rủi ro tài chính trực tiếp."
        )

    @staticmethod
    def _evidence(text: str, terms: tuple[str, ...]) -> tuple[str, ...]:
        if not terms:
            return ()
        sentences = re.split(r"(?<=[.!?])\s+|\n+", text)
        evidence: list[str] = []
        for sentence in sentences:
            cleaned = " ".join(sentence.split())
            normalized_sentence = _normalize(cleaned)
            if cleaned and any(term in normalized_sentence for term in terms):
                excerpt = cleaned if len(cleaned) <= 180 else f"{cleaned[:177].rstrip()}…"
                if excerpt not in evidence:
                    evidence.append(excerpt)
            if len(evidence) >= 3:
                break
        return tuple(evidence)
