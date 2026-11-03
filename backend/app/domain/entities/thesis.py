"""Investment thesis domain entity and analyst performance metrics."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


@dataclass(frozen=True)
class InvestmentThesis:
    id: str
    user_id: str
    author_name: str
    symbol: str
    stance: str  # 'bullish' | 'bearish' | 'neutral'
    entry_price: Decimal
    target_price: Decimal
    stop_loss_price: Decimal
    horizon_months: int  # 1 | 3 | 6 | 12
    title: str
    thesis_body: str
    catalysts: tuple[str, ...]
    status: str  # 'active' | 'hit_target' | 'stopped_out' | 'expired'
    outcome_roi: Decimal | None
    closed_at: datetime | None
    closed_price: Decimal | None
    upvotes: int
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class AnalystReputation:
    user_id: str
    author_name: str
    total_theses: int
    active_theses: int
    successful_theses: int
    stopped_theses: int
    win_rate_percent: Decimal
    avg_roi_percent: Decimal
    rank_tier: str  # 'Grandmaster' | 'Senior Analyst' | 'Active Analyst' | 'Rising Star'
