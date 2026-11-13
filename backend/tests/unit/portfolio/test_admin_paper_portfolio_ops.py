from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.deps import get_admin_repository, require_admin_user, require_auth_bff
from app.main import app
from app.schemas.admin_ops import (
    AdminPortfolioDetail,
    AdminPortfolioItem,
    PortfolioHoldingItem,
    PortfolioOrderItem,
    PortfolioTradeItem,
)

client = TestClient(app)


def test_admin_portfolio_detail_and_cancel_order() -> None:
    portfolio_id = str(uuid4())
    order_id = str(uuid4())

    mock_repo = MagicMock()
    mock_detail = AdminPortfolioDetail(
        portfolio=AdminPortfolioItem(
            id=portfolio_id,
            user_id="user-1",
            user_email="investor@example.com",
            user_name="Nguyen Van A",
            starting_cash=100_000_000.0,
            cash_balance=85_000_000.0,
            realized_pnl=2_500_000.0,
            is_public=True,
            nickname="TraderPro",
            holdings_count=1,
            trades_count=2,
            created_at="2026-11-01T00:00:00Z",
            updated_at="2026-11-01T00:00:00Z",
        ),
        holdings=[
            PortfolioHoldingItem(
                symbol="HPG",
                quantity=500,
                total_cost_basis=14_000_000.0,
                avg_price=28_000.0,
                updated_at="2026-11-01T00:00:00Z",
            )
        ],
        recent_trades=[
            PortfolioTradeItem(
                id=str(uuid4()),
                symbol="HPG",
                side="buy",
                quantity=500,
                execution_price=28_000.0,
                gross_amount=14_000_000.0,
                fee_amount=14_000.0,
                tax_amount=0.0,
                realized_pnl=None,
                created_at="2026-11-01T00:00:00Z",
            )
        ],
        orders=[
            PortfolioOrderItem(
                id=order_id,
                symbol="VND",
                side="buy",
                order_type="LO",
                status="open",
                quantity=300,
                filled_quantity=0,
                limit_price=15_000.0,
                reserved_cash=4_500_000.0,
                reserved_quantity=0,
                created_at="2026-11-01T00:00:00Z",
                expires_at="2026-11-01T15:00:00Z",
                cancelled_at=None,
            )
        ],
    )
    mock_repo.get_portfolio_detail.return_value = mock_detail
    mock_repo.cancel_paper_order.return_value = (True, "Hủy lệnh thành công.")

    app.dependency_overrides[require_auth_bff] = lambda: {"user_id": "admin-1", "role": "admin"}
    app.dependency_overrides[require_admin_user] = lambda: "admin-1"
    app.dependency_overrides[get_admin_repository] = lambda: mock_repo

    try:
        # 1. Test get portfolio detail includes orders list
        detail_res = client.get(f"/api/v1/admin/portfolios/{portfolio_id}")
        assert detail_res.status_code == 200
        detail_data = detail_res.json()
        assert "orders" in detail_data
        assert len(detail_data["orders"]) == 1
        assert detail_data["orders"][0]["id"] == order_id
        assert detail_data["orders"][0]["status"] == "open"
        assert detail_data["orders"][0]["symbol"] == "VND"

        # 2. Test cancel order successfully with reason
        cancel_res = client.post(
            f"/api/v1/admin/portfolios/{portfolio_id}/orders/{order_id}/cancel",
            json={"reason": "Can thiệp rủi ro thị trường"},
        )
        assert cancel_res.status_code == 200
        cancel_data = cancel_res.json()
        assert cancel_data["status"] == "ok"
        assert cancel_data["order_id"] == order_id
        mock_repo.cancel_paper_order.assert_called_once()
        call_kwargs = mock_repo.cancel_paper_order.call_args.kwargs
        assert call_kwargs["portfolio_id"] == portfolio_id
        assert call_kwargs["order_id"] == order_id
        assert call_kwargs["actor_id"] == "admin-1"
        assert call_kwargs["reason"] == "Can thiệp rủi ro thị trường"

        # 3. Test cancel order failure if repo returns False (e.g. order already filled or not found)
        mock_repo.cancel_paper_order.return_value = (
            False,
            "Không thể hủy lệnh ở trạng thái 'filled'.",
        )
        fail_res = client.post(
            f"/api/v1/admin/portfolios/{portfolio_id}/orders/{order_id}/cancel",
            json={"reason": "Hủy lệnh trễ"},
        )
        assert fail_res.status_code == 400
        assert "Không thể hủy lệnh" in fail_res.json()["error"]["message"]

        # 4. Test validation: reason too short
        short_res = client.post(
            f"/api/v1/admin/portfolios/{portfolio_id}/orders/{order_id}/cancel",
            json={"reason": "ok"},
        )
        assert short_res.status_code == 422
    finally:
        app.dependency_overrides.pop(require_auth_bff, None)
        app.dependency_overrides.pop(require_admin_user, None)
        app.dependency_overrides.pop(get_admin_repository, None)
