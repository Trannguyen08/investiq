"""Unit tests for ThesisService and Proof-of-Thesis Arena."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

import pytest

from app.application.use_cases.community.thesis_service import (
    ThesisService,
    ThesisValidationError,
)
from app.domain.entities.market import MarketInstrument
from app.domain.entities.thesis import AnalystReputation, InvestmentThesis
from app.domain.repositories.i_thesis_repository import IThesisRepository


class MockThesisRepository(IThesisRepository):
    def __init__(self) -> None:
        self.theses: dict[str, InvestmentThesis] = {}
        self.evaluations: list[dict[str, object]] = []

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
    ) -> InvestmentThesis:
        t_id = f"thesis-{len(self.theses) + 1}"
        thesis = InvestmentThesis(
            id=t_id,
            user_id=user_id,
            author_name=author_name,
            symbol=symbol,
            stance=stance,
            entry_price=entry_price,
            target_price=target_price,
            stop_loss_price=stop_loss_price,
            horizon_months=horizon_months,
            title=title,
            thesis_body=thesis_body,
            catalysts=catalysts,
            status="active",
            outcome_roi=None,
            closed_at=None,
            closed_price=None,
            upvotes=0,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        self.theses[t_id] = thesis
        return thesis

    def list_all(
        self,
        symbol: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[InvestmentThesis, ...]:
        items = list(self.theses.values())
        if symbol:
            items = [t for t in items if t.symbol == symbol]
        if status:
            items = [t for t in items if t.status == status]
        return tuple(items[offset : offset + limit])

    def get_by_id(self, thesis_id: str) -> InvestmentThesis | None:
        return self.theses.get(thesis_id)

    def update_evaluation(
        self,
        thesis_id: str,
        status: str,
        outcome_roi: Decimal,
        closed_price: Decimal,
    ) -> InvestmentThesis:
        old = self.theses[thesis_id]
        updated = InvestmentThesis(
            id=old.id,
            user_id=old.user_id,
            author_name=old.author_name,
            symbol=old.symbol,
            stance=old.stance,
            entry_price=old.entry_price,
            target_price=old.target_price,
            stop_loss_price=old.stop_loss_price,
            horizon_months=old.horizon_months,
            title=old.title,
            thesis_body=old.thesis_body,
            catalysts=old.catalysts,
            status=status,
            outcome_roi=outcome_roi,
            closed_at=datetime.now(),
            closed_price=closed_price,
            upvotes=old.upvotes,
            created_at=old.created_at,
            updated_at=datetime.now(),
        )
        self.theses[thesis_id] = updated
        self.evaluations.append({"id": thesis_id, "status": status, "outcome_roi": outcome_roi})
        return updated

    def upvote(self, thesis_id: str) -> int:
        if thesis_id in self.theses:
            old = self.theses[thesis_id]
            self.theses[thesis_id] = InvestmentThesis(
                id=old.id,
                user_id=old.user_id,
                author_name=old.author_name,
                symbol=old.symbol,
                stance=old.stance,
                entry_price=old.entry_price,
                target_price=old.target_price,
                stop_loss_price=old.stop_loss_price,
                horizon_months=old.horizon_months,
                title=old.title,
                thesis_body=old.thesis_body,
                catalysts=old.catalysts,
                status=old.status,
                outcome_roi=old.outcome_roi,
                closed_at=old.closed_at,
                closed_price=old.closed_price,
                upvotes=old.upvotes + 1,
                created_at=old.created_at,
                updated_at=old.updated_at,
            )
            return old.upvotes + 1
        return 0

    def get_leaderboard(self, limit: int = 10) -> tuple[AnalystReputation, ...]:
        return (
            AnalystReputation(
                user_id="user-1",
                author_name="Analyst Minh",
                total_theses=10,
                active_theses=2,
                successful_theses=7,
                stopped_theses=1,
                win_rate_percent=Decimal("87.5"),
                avg_roi_percent=Decimal("18.4"),
                rank_tier="Grandmaster",
            ),
        )

    def list_by_user(self, user_id: str) -> tuple[InvestmentThesis, ...]:
        return tuple(t for t in self.theses.values() if t.user_id == user_id)


class MockMarketProvider:
    def __init__(self, price: Decimal = Decimal("28000")) -> None:
        self.current_price = price

    def instrument(self, symbol: str) -> MarketInstrument | None:
        return MarketInstrument(
            symbol=symbol,
            name=f"Company {symbol}",
            exchange="HOSE",
            sector="Thép",
            price=self.current_price,
            reference_price=Decimal("27500"),
            ceiling_price=Decimal("29400"),
            floor_price=Decimal("25600"),
            open_price=Decimal("27800"),
            high_price=Decimal("28200"),
            low_price=Decimal("27600"),
            volume=Decimal("1000000"),
            matched_value=Decimal("28000000000"),
            foreign_net_value=Decimal("1400000000"),
            market_cap=Decimal("150000000000000"),
            pe=Decimal("10.5"),
            pb=Decimal("1.4"),
            eps=Decimal("2600"),
            roe_percent=Decimal("14.5"),
            volume_vs_20d=Decimal("1.2"),
            interest_score=Decimal("80"),
            interest_reasons=(),
            candles=(),
            is_vn30=True,
        )

    def candles(self, symbol: str, interval: str) -> tuple:
        return ()


def test_publish_thesis_bullish_success() -> None:
    repo = MockThesisRepository()
    provider = MockMarketProvider(price=Decimal("28000"))
    service = ThesisService(repo, provider)

    thesis = service.publish_thesis(
        user_id="user-123",
        author_name="Tran Nguyen",
        symbol="hpg",
        stance="bullish",
        target_price=Decimal("35000"),
        stop_loss_price=Decimal("25000"),
        horizon_months=6,
        title="HPG bước vào chu kỳ tăng trưởng Dung Quất 2",
        thesis_body=(
            "Lò cao Dung Quất 2 đi vào vận hành giúp sản lượng HRC tăng 80%, "
            "biên gộp hồi phục."
        ),
        catalysts=("Dung Quất 2 vận hành", "Nhu cầu đầu tư công"),
    )

    assert thesis.symbol == "HPG"
    assert thesis.entry_price == Decimal("28000")
    assert thesis.target_price == Decimal("35000")
    assert thesis.stop_loss_price == Decimal("25000")
    assert thesis.status == "active"
    assert len(repo.theses) == 1


def test_publish_thesis_bullish_validation_errors() -> None:
    repo = MockThesisRepository()
    provider = MockMarketProvider(price=Decimal("28000"))
    service = ThesisService(repo, provider)

    # Bullish target must be higher than current price
    with pytest.raises(ThesisValidationError, match="giá mục tiêu .* phải cao hơn giá thị trường"):
        service.publish_thesis(
            user_id="user-1",
            author_name="Analyst",
            symbol="HPG",
            stance="bullish",
            target_price=Decimal("25000"),  # lower than 28000
            stop_loss_price=Decimal("24000"),
            horizon_months=3,
            title="Dự báo sai",
            thesis_body="Nội dung phân tích hợp lệ và dài hơn 20 ký tự.",
            catalysts=(),
        )

    # Bullish stop loss must be lower than current price
    with pytest.raises(ThesisValidationError, match="giá cắt lỗ .* phải thấp hơn giá thị trường"):
        service.publish_thesis(
            user_id="user-1",
            author_name="Analyst",
            symbol="HPG",
            stance="bullish",
            target_price=Decimal("32000"),
            stop_loss_price=Decimal("30000"),  # higher than 28000
            horizon_months=3,
            title="Dự báo sai stop loss",
            thesis_body="Nội dung phân tích hợp lệ và dài hơn 20 ký tự.",
            catalysts=(),
        )


def test_evaluate_thesis_hit_target() -> None:
    repo = MockThesisRepository()
    # Initially 28,000
    provider = MockMarketProvider(price=Decimal("28000"))
    service = ThesisService(repo, provider)

    _ = service.publish_thesis(
        user_id="user-1",
        author_name="Analyst",
        symbol="HPG",
        stance="bullish",
        target_price=Decimal("32000"),
        stop_loss_price=Decimal("25000"),
        horizon_months=3,
        title="HPG mục tiêu 32.000",
        thesis_body="Nội dung phân tích chi tiết triển vọng lợi nhuận phục hồi mạnh.",
        catalysts=(),
    )

    # Price moves to 33,000 (hits target)
    provider.current_price = Decimal("33000")

    theses = service.list_theses(symbol="HPG")
    assert len(theses) == 1
    assert theses[0]["status"] == "hit_target"
    assert theses[0]["outcome_roi"] == "+14.3%"
    assert theses[0]["progress_percent"] == "100.0"


def test_evaluate_thesis_stopped_out() -> None:
    repo = MockThesisRepository()
    provider = MockMarketProvider(price=Decimal("28000"))
    service = ThesisService(repo, provider)

    _ = service.publish_thesis(
        user_id="user-1",
        author_name="Analyst",
        symbol="HPG",
        stance="bullish",
        target_price=Decimal("35000"),
        stop_loss_price=Decimal("25000"),
        horizon_months=6,
        title="HPG triển vọng",
        thesis_body="Nội dung phân tích chi tiết triển vọng lợi nhuận phục hồi mạnh.",
        catalysts=(),
    )

    # Price drops to 24,000 (below stop loss)
    provider.current_price = Decimal("24000")

    theses = service.list_theses(symbol="HPG")
    assert theses[0]["status"] == "stopped_out"
    assert theses[0]["outcome_roi"] == "-10.7%"


def test_upvote_and_leaderboard() -> None:
    repo = MockThesisRepository()
    provider = MockMarketProvider(price=Decimal("28000"))
    service = ThesisService(repo, provider)

    thesis = service.publish_thesis(
        user_id="user-1",
        author_name="Analyst",
        symbol="FPT",
        stance="bullish",
        target_price=Decimal("40000"),
        stop_loss_price=Decimal("25000"),
        horizon_months=12,
        title="FPT dẫn đầu công nghệ và AI toàn cầu",
        thesis_body=(
            "Hợp đồng ký mới chuyển đổi số và AI tại Mỹ, Nhật Bản duy trì "
            "tăng trưởng trên 25%."
        ),
        catalysts=("Doanh thu AI tăng trưởng",),
    )

    upvotes = service.upvote_thesis(thesis.id)
    assert upvotes == 1

    leaderboard = service.get_leaderboard()
    assert len(leaderboard) == 1
    assert leaderboard[0]["rank_tier"] == "Grandmaster"
    assert leaderboard[0]["win_rate_percent"] == "87.5%"
