"""Persistence port for community investment theses and analyst reputation."""

from __future__ import annotations

from decimal import Decimal
from typing import Protocol

from app.domain.entities.thesis import AnalystReputation, InvestmentThesis


class IThesisRepository(Protocol):
    def create(
        self,
        user_id: str,
        author_name: str,
        symbol: str,
        stance: str,
        entry_price: Decimal,
        target_price: Decimal,
        stop_loss_price: Decimal,
        horizon_months: int,
        title: str,
        thesis_body: str,
        catalysts: tuple[str, ...],
    ) -> InvestmentThesis: ...

    def list_all(
        self,
        symbol: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
        sort: str = "engagement",
    ) -> tuple[InvestmentThesis, ...]: ...

    def get_by_id(self, thesis_id: str) -> InvestmentThesis | None: ...

    def update_evaluation(
        self,
        thesis_id: str,
        status: str,
        outcome_roi: Decimal,
        closed_price: Decimal,
    ) -> InvestmentThesis: ...

    def upvote(self, thesis_id: str) -> int: ...

    def get_leaderboard(self, limit: int = 10) -> tuple[AnalystReputation, ...]: ...

    def list_by_user(self, user_id: str) -> tuple[InvestmentThesis, ...]: ...
