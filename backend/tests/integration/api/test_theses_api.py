"""Integration tests for community investment theses and social paper trading API."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from fastapi.testclient import TestClient

from app.api import deps
from app.api.v1 import portfolio as portfolio_api
from app.api.v1 import theses as theses_api
from app.domain.entities.thesis import InvestmentThesis
from app.main import app


class FakeThesisService:
    def __init__(self) -> None:
        self.theses: list[dict[str, object]] = []

    def publish_thesis(
        self,
        user_id: str,
        author_name: str,
        symbol: str,
        stance: str,
        target_price: Decimal,
        stop_loss_price: Decimal,
        horizon_months: int,
        title: str,
        thesis_body: str,
        catalysts: tuple[str, ...],
    ) -> InvestmentThesis:
        return InvestmentThesis(
            id="11111111-1111-4111-8111-111111111111",
            user_id=user_id,
            author_name=author_name,
            symbol=symbol,
            stance=stance,
            entry_price=Decimal("28000"),
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
            created_at=datetime(2026, 10, 27, 8, 0, 0),
            updated_at=datetime(2026, 10, 27, 8, 0, 0),
        )

    def _format_thesis(self, t: InvestmentThesis) -> dict[str, object]:
        return {
            "id": t.id,
            "user_id": t.user_id,
            "author_name": t.author_name,
            "symbol": t.symbol,
            "stance": t.stance,
            "entry_price": f"{t.entry_price:,.0f}",
            "target_price": f"{t.target_price:,.0f}",
            "stop_loss_price": f"{t.stop_loss_price:,.0f}",
            "current_price": "28,000",
            "progress_percent": "0.0",
            "horizon_months": t.horizon_months,
            "title": t.title,
            "thesis_body": t.thesis_body,
            "catalysts": list(t.catalysts),
            "status": t.status,
            "outcome_roi": None,
            "closed_at": None,
            "closed_price": None,
            "upvotes": t.upvotes,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat(),
        }

    def list_theses(
        self,
        symbol: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
        sort: str = "engagement",
    ) -> list[dict[str, object]]:
        return [
            {
                "id": "11111111-1111-4111-8111-111111111111",
                "user_id": "user-1",
                "author_name": "Analyst user-1",
                "symbol": "HPG",
                "stance": "bullish",
                "entry_price": "28,000",
                "target_price": "35,000",
                "stop_loss_price": "25,000",
                "current_price": "29,500",
                "progress_percent": "21.4",
                "horizon_months": 6,
                "title": "HPG tăng trưởng chu kỳ mới",
                "thesis_body": "Dung Quất 2 đẩy mạnh sản lượng HRC.",
                "catalysts": ["Dung Quất 2"],
                "status": "active",
                "outcome_roi": None,
                "closed_at": None,
                "closed_price": None,
                "upvotes": 5,
                "created_at": "2026-10-27T08:00:00",
                "updated_at": "2026-10-27T08:00:00",
            }
        ]

    def get_thesis(self, thesis_id: str) -> dict[str, object] | None:
        if thesis_id == "11111111-1111-4111-8111-111111111111":
            return self.list_theses()[0]
        return None

    def upvote_thesis(self, thesis_id: str) -> int:
        return 6

    def get_leaderboard(self, limit: int = 10) -> list[dict[str, object]]:
        return [
            {
                "user_id": "user-1",
                "author_name": "Senior Analyst Duc",
                "total_theses": 8,
                "active_theses": 2,
                "successful_theses": 5,
                "stopped_theses": 1,
                "win_rate_percent": "83.3%",
                "avg_roi_percent": "+16.5%",
                "rank_tier": "Grandmaster",
            }
        ]

    def list_by_user(self, user_id: str) -> list[dict[str, object]]:
        return self.list_theses()


class FakePaperTradingService:
    def set_public_visibility(
        self, user_id: str, is_public: bool, nickname: str | None = None
    ) -> dict[str, object]:
        return self.dashboard(user_id)

    def dashboard(self, user_id: str) -> dict[str, object]:
        now = "2026-10-27T08:00:00Z"
        return {
            "account": {
                "id": "portfolio-1",
                "currency": "VND",
                "starting_cash": "100000000",
                "cash_balance": "100000000",
                "available_cash": "100000000",
                "reserved_cash": "0",
                "invested_cost": "0",
                "market_value": "0",
                "total_value": "100000000",
                "realized_pnl": "0",
                "unrealized_pnl": "0",
                "total_pnl": "0",
                "total_return_percent": "0.00",
                "valuation_partial": False,
                "version": 1,
                "is_public": True,
                "nickname": "Pro Trader",
                "created_at": now,
                "updated_at": now,
            },
            "holdings": [],
            "orders": [],
            "trades": [],
            "equity_curve": [],
            "equity_curve_method": "current_holdings_replay",
            "notices": [],
            "opportunities": [],
            "assumptions": {
                "starting_cash": "100000000",
                "broker_fee_rate": "0.0015",
                "sell_tax_rate": "0.001",
                "fill_model": "automatic_latest_observed_price",
                "max_holdings": 20,
                "disclaimer": "Mô phỏng giáo dục.",
            },
            "market": {
                "provider": "fixture",
                "provider_name": "Fixture",
                "market_time": now,
                "received_at": now,
                "delay_class": "development_fixture",
                "freshness": "fixture",
                "session": "closed",
                "partial": False,
            },
        }

    def get_social_leaderboard(self, limit: int = 10) -> list[dict[str, object]]:
        return [
            {
                "portfolio_id": "11111111-2222-4333-8444-555555555555",
                "nickname": "NhaDauTuF0",
                "starting_cash": "100.000.000 đ",
                "cash_balance": "118.500.000 đ",
                "realized_pnl": "+18.500.000 đ",
                "roi_percent": "+18.50%",
                "roi_number": 18.50,
                "holding_count": 3,
                "total_trades": 12,
                "win_trades": 9,
            }
        ]

    def get_public_portfolio_detail(self, portfolio_id: str) -> dict[str, object] | None:
        if portfolio_id == "11111111-2222-4333-8444-555555555555":
            return {
                "id": portfolio_id,
                "nickname": "NhaDauTuF0",
                "starting_cash": "100.000.000 đ",
                "cash_balance": "60.000.000 đ",
                "total_assets": "118.500.000 đ",
                "realized_pnl": "+18.500.000 đ",
                "roi_percent": "+18.50%",
                "holdings": [
                    {
                        "symbol": "HPG",
                        "name": "CTCP Tập đoàn Hòa Phát",
                        "exchange": "HOSE",
                        "sector": "Thép",
                        "quantity": 2000,
                        "current_price": "29.250 đ",
                        "cost_basis": "50.000.000 đ",
                        "market_value": "58.500.000 đ",
                        "unrealized_pnl": "+8.500.000 đ",
                        "roi_percent": "+17.00%",
                    }
                ],
                "trades": [],
            }
        return None


def test_theses_api_workflow() -> None:
    fake_service = FakeThesisService()
    app.dependency_overrides[theses_api.get_thesis_service] = lambda: fake_service
    app.dependency_overrides[deps.authenticated_user_id] = lambda: "user-1"
    app.dependency_overrides[deps.require_auth_bff] = lambda: None

    try:
        client = TestClient(app)

        # 1. Create thesis
        res = client.post(
            "/api/v1/theses",
            json={
                "symbol": "HPG",
                "stance": "bullish",
                "target_price": "35000",
                "stop_loss_price": "25000",
                "horizon_months": 6,
                "title": "HPG tăng trưởng chu kỳ mới",
                "thesis_body": "Dung Quất 2 đẩy mạnh sản lượng HRC lên mức kỷ lục.",
                "catalysts": ["Dung Quất 2"],
            },
        )
        assert res.status_code == 201
        data = res.json()
        assert data["symbol"] == "HPG"
        assert data["target_price"] == "35,000"

        # 2. List theses
        res = client.get("/api/v1/theses?symbol=HPG")
        assert res.status_code == 200
        list_data = res.json()
        assert list_data["total"] == 1
        assert list_data["data"][0]["symbol"] == "HPG"

        # 3. Leaderboard
        res = client.get("/api/v1/theses/leaderboard")
        assert res.status_code == 200
        board = res.json()
        assert len(board["data"]) == 1
        assert board["data"][0]["rank_tier"] == "Grandmaster"

        # 4. Upvote
        res = client.post("/api/v1/theses/11111111-1111-4111-8111-111111111111/upvote")
        assert res.status_code == 200
        assert res.json()["upvotes"] == 6

        # 5. Get thesis by ID
        res = client.get("/api/v1/theses/11111111-1111-4111-8111-111111111111")
        assert res.status_code == 200
        assert res.json()["id"] == "11111111-1111-4111-8111-111111111111"
    finally:
        app.dependency_overrides.clear()


def test_social_paper_trading_api() -> None:
    fake_paper_service = FakePaperTradingService()
    app.dependency_overrides[portfolio_api.get_paper_trading_service] = lambda: fake_paper_service
    app.dependency_overrides[deps.authenticated_user_id] = lambda: "user-1"
    app.dependency_overrides[deps.require_auth_bff] = lambda: None

    try:
        client = TestClient(app)

        # 1. Get public leaderboard
        res = client.get("/api/v1/paper-portfolio/leaderboard")
        assert res.status_code == 200
        leaderboard = res.json()["data"]
        assert len(leaderboard) == 1
        assert leaderboard[0]["nickname"] == "NhaDauTuF0"
        assert leaderboard[0]["roi_percent"] == "+18.50%"

        # 2. Get public portfolio detail
        res = client.get("/api/v1/paper-portfolio/public/11111111-2222-4333-8444-555555555555")
        assert res.status_code == 200
        detail = res.json()
        assert detail["nickname"] == "NhaDauTuF0"
        assert len(detail["holdings"]) == 1
        assert detail["holdings"][0]["symbol"] == "HPG"

        # 3. Set visibility
        res = client.post(
            "/api/v1/paper-portfolio/visibility",
            json={"is_public": True, "nickname": "Pro Trader"},
        )
        assert res.status_code == 200
        assert res.json()["account"]["is_public"] is True
        assert res.json()["account"]["nickname"] == "Pro Trader"
    finally:
        app.dependency_overrides.clear()
