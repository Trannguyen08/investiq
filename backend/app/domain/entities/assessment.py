"""Domain entities for investor persona, readiness evaluation, and discipline metrics."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class InvestorPersona:
    """Represents an investor personality archetype."""

    code: str
    title: str
    tagline: str
    description: str
    strengths: list[str]
    weaknesses: list[str]
    recommended_strategy: str
    asset_allocation: dict[str, int]  # e.g. {"stocks": 50, "gold": 25, "savings": 25}
    ideal_time_hours_per_week: int
    suitable_instruments: list[str]


@dataclass(frozen=True)
class AssessmentOption:
    """Single choice option within an assessment question."""

    id: str
    label: str
    risk_weight: int  # 0 to 100
    persona_weights: dict[str, int]  # e.g. {"dca_accumulator": 8, "value_growth": 4, ...}


@dataclass(frozen=True)
class AssessmentQuestion:
    """Survey question for investor aptitude and mindset discovery."""

    id: str
    sort_order: int
    category: str
    prompt: str
    subtext: str | None
    options: list[AssessmentOption]
    status: str = "published"


@dataclass(frozen=True)
class DisciplineMetrics:
    """Behavioral discipline indicators computed from paper trading history."""

    cut_loss_score: float  # 0-100
    diversification_score: float  # 0-100
    cash_management_score: float  # 0-100
    emotional_pacing_score: float  # 0-100
    overall_discipline_score: float  # 0-100
    badge: str
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ReadinessEvaluation:
    """Holistic diagnostic verdict determining whether a beginner should trade real money."""

    id: str
    persona: InvestorPersona
    risk_score: float  # 0-100
    knowledge_score: float  # 0-100
    discipline_score: float  # 0-100
    overall_readiness_score: float  # 0-100
    readiness_level: str  # not_ready, needs_training, ready_starter, disciplined_investor
    readiness_label: str  # Vietnamese label
    verdict_summary: str
    can_trade_real_money: bool
    recommended_action: str
    created_at: datetime
    answers: dict[str, str] = field(default_factory=dict)
