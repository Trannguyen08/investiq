"""Learning topic and stock basics curriculum domain entities."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class QuizOption:
    id: str
    label: str
    correct: bool
    feedback: str


@dataclass(frozen=True)
class QuizQuestion:
    id: str
    prompt: str
    options: tuple[QuizOption, ...]


@dataclass(frozen=True)
class PracticalExample:
    title: str
    ticker: str | None
    scenario: str
    analysis: str
    key_takeaway: str


@dataclass(frozen=True)
class GlossaryTerm:
    term: str
    definition: str


@dataclass(frozen=True)
class PracticeAction:
    href: str
    label: str
    description: str


@dataclass(frozen=True)
class LearningTopic:
    id: str
    slug: str
    level: str  # 'beginner' | 'intermediate' | 'advanced'
    stage: int  # 1 | 2 | 3
    sort_order: int
    title: str
    eyebrow: str
    summary: str
    estimated_minutes: int
    theory_content: str
    practical_example: PracticalExample
    quizzes: tuple[QuizQuestion, ...]
    glossary: tuple[GlossaryTerm, ...]
    practice_action: PracticeAction
    status: str  # 'published' | 'draft'
    created_at: datetime
    updated_at: datetime
