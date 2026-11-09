from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.api import deps
from app.api.v1 import portfolio as portfolio_api
from app.application.dto.portfolio_dto import PlacePaperOrder
from app.domain.entities.portfolio import PaperOrder, PaperTrade
from app.infrastructure.config.settings import settings
from app.main import app


def dashboard_payload() -> dict[str, object]:
    now = "2026-10-08T02:00:00Z"
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
            "created_at": now,
            "updated_at": now,
        },
        "holdings": [],
        "orders": [],
        "trades": [],
        "equity_curve": [],
        "equity_curve_method": "current_holdings_replay",
        "notices": [
            {
                "level": "info",
                "symbol": "",
                "title": "Bắt đầu",
                "message": "Dùng vị thế nhỏ.",
            }
        ],
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


class FakeService:
    command: object | None = None
    cancelled_id: str | None = None
    filled_id: str | None = None
    execution_mode: str = "instant"

    def dashboard(self, user_id: str) -> dict[str, object]:
        assert user_id == "user-1"
        payload = dashboard_payload()
        payload["exchange_simulation"] = {
            "execution_mode": self.execution_mode,
            "session_active": True,
            "session_message": "Đang trong phiên giao dịch khớp lệnh liên tục.",
            "supported_order_types": ["LO", "MP", "ATO", "ATC"],
            "price_bands": {"HOSE": "7%", "HNX": "10%", "UPCoM": "15%"},
            "t2_settlement": {
                "cycle_rule": "T+2",
                "advance_fee_rate_per_day": "0.0003",
                "pending_buy_shares_by_symbol": {},
                "pending_buy_settlements": [],
                "pending_sell_settlements": [],
                "receivable_cash_t2": "10000000",
                "already_advanced_cash": "0",
                "advanceable_cash": "10000000",
                "estimated_advance_fee": "6000",
                "net_advance_available": "9994000",
                "recent_advances": [],
            },
            "conditional_triggers": [],
            "order_meta": {},
        }
        return payload

    def set_execution_mode(self, user_id: str, mode: str) -> dict[str, object]:
        assert user_id == "user-1"
        self.execution_mode = mode
        return self.dashboard(user_id)

    def force_fill_order(self, user_id: str, order_id: str) -> tuple[PaperOrder, PaperTrade]:
        assert user_id == "user-1"
        self.filled_id = order_id
        prev_command = self.command
        order, trade = self.place_order(user_id, prev_command)
        assert trade is not None
        return order, trade

    def advance_sale_cash(
        self,
        user_id: str,
        requested_amount: Decimal | None = None,
    ) -> dict[str, object]:
        assert user_id == "user-1"
        gross = requested_amount or Decimal("10000000")
        return {
            "advance": {
                "id": "adv-1",
                "gross_amount": format(gross, "f"),
                "fee_amount": "6000",
                "net_received": "9994000",
                "days_advanced": 2,
                "created_at": "2026-10-08T02:00:00Z",
            },
            "data": self.dashboard(user_id),
        }

    def upsert_conditional_trigger(
        self,
        user_id: str,
        symbol: str,
        stop_loss_price: Decimal | None,
        take_profit_price: Decimal | None,
        quantity: int | None = None,
    ) -> dict[str, object]:
        assert user_id == "user-1"
        assert symbol == "FPT"
        assert stop_loss_price == Decimal("95000")
        assert take_profit_price == Decimal("115000")
        assert quantity == 100
        return self.dashboard(user_id)

    def cancel_conditional_trigger(self, user_id: str, trigger_id: str) -> dict[str, object]:
        assert user_id == "user-1"
        assert trigger_id == "trig-1"
        return self.dashboard(user_id)

    def place_order(self, user_id: str, command: object) -> tuple[PaperOrder, PaperTrade | None]:
        assert user_id == "user-1"
        self.command = command
        now = datetime(2026, 10, 8, 2, tzinfo=UTC)
        order = PaperOrder(
            id="order-1",
            idempotency_key="12345678-1234-4234-8234-123456789012",
            side="buy",
            order_type="LO",
            status="filled",
            symbol="FPT",
            name="CTCP FPT",
            exchange="HOSE",
            quantity=100,
            filled_quantity=100,
            limit_price=Decimal("100000"),
            reserved_cash=Decimal(),
            reserved_quantity=0,
            provider="fixture",
            price_at=now,
            received_at=now,
            delay_class="development_fixture",
            created_at=now,
            updated_at=now,
            expires_at=now,
            cancelled_at=None,
        )
        trade = PaperTrade(
            id="trade-1",
            idempotency_key="12345678-1234-4234-8234-123456789012",
            side="buy",
            symbol="FPT",
            name="CTCP FPT",
            exchange="HOSE",
            quantity=100,
            execution_price=Decimal("100000"),
            gross_amount=Decimal("10000000"),
            fee_rate=Decimal("0.0015"),
            fee_amount=Decimal("15000"),
            tax_rate=Decimal(),
            tax_amount=Decimal(),
            cash_effect=Decimal("-10015000"),
            realized_pnl=None,
            provider="fixture",
            price_at=now,
            received_at=now,
            delay_class="development_fixture",
            created_at=now,
        )
        return order, trade

    def cancel_order(self, user_id: str, order_id: str) -> PaperOrder:
        assert user_id == "user-1"
        self.cancelled_id = order_id
        now = datetime(2026, 10, 8, 2, tzinfo=UTC)
        return PaperOrder(
            id=order_id,
            idempotency_key="cancel-key-123456",
            side="buy",
            order_type="LO",
            status="cancelled",
            symbol="FPT",
            name="CTCP FPT",
            exchange="HOSE",
            quantity=100,
            filled_quantity=0,
            limit_price=Decimal("99000"),
            reserved_cash=Decimal(),
            reserved_quantity=0,
            provider="fixture",
            price_at=now,
            received_at=now,
            delay_class="development_fixture",
            created_at=now,
            updated_at=now,
            expires_at=now,
            cancelled_at=now,
        )


def test_paper_portfolio_requires_the_private_bff_boundary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "auth_enabled", False)
    response = TestClient(app).get("/api/v1/paper-portfolio")

    assert response.status_code == 503
    assert response.headers["cache-control"] == "no-store"


def test_paper_dashboard_and_order_contracts_are_private_and_authenticated() -> None:
    service = FakeService()
    app.dependency_overrides[deps.require_auth_bff] = lambda: None
    app.dependency_overrides[deps.authenticated_user_id] = lambda: "user-1"
    app.dependency_overrides[portfolio_api.get_paper_trading_service] = lambda: service
    try:
        with TestClient(app) as client:
            dashboard = client.get("/api/v1/paper-portfolio")
            order = client.post(
                "/api/v1/paper-portfolio/orders",
                headers={"Idempotency-Key": "12345678-1234-4234-8234-123456789012"},
                json={
                    "side": "buy",
                    "order_type": "LO",
                    "symbol": "fpt",
                    "quantity": 100,
                    "limit_price": "100000",
                },
            )
            cancelled = client.delete(
                "/api/v1/paper-portfolio/orders/12345678-1234-4234-8234-123456789012"
            )
    finally:
        app.dependency_overrides.clear()

    assert dashboard.status_code == 200
    assert dashboard.headers["cache-control"] == "private, no-store, max-age=0"
    assert dashboard.json()["account"]["cash_balance"] == "100000000"
    assert order.status_code == 201
    assert order.json()["order"]["status"] == "filled"
    assert order.json()["trade"]["symbol"] == "FPT"
    assert isinstance(service.command, PlacePaperOrder)
    assert service.command.idempotency_key == "12345678-1234-4234-8234-123456789012"
    assert cancelled.status_code == 200
    assert cancelled.json()["order"]["status"] == "cancelled"
    assert service.cancelled_id == "12345678-1234-4234-8234-123456789012"


def test_paper_order_rejects_missing_idempotency_key() -> None:
    app.dependency_overrides[deps.require_auth_bff] = lambda: None
    app.dependency_overrides[deps.authenticated_user_id] = lambda: "user-1"
    app.dependency_overrides[portfolio_api.get_paper_trading_service] = FakeService
    try:
        response = TestClient(app).post(
            "/api/v1/paper-portfolio/orders",
            json={
                "side": "buy",
                "order_type": "LO",
                "symbol": "FPT",
                "quantity": 100,
                "limit_price": "100000",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert response.headers["cache-control"] == "no-store"


def test_exchange_simulation_endpoints_mode_advance_fill_and_conditional_triggers() -> None:
    service = FakeService()
    app.dependency_overrides[deps.require_auth_bff] = lambda: None
    app.dependency_overrides[deps.authenticated_user_id] = lambda: "user-1"
    app.dependency_overrides[portfolio_api.get_paper_trading_service] = lambda: service
    try:
        with TestClient(app) as client:
            # 1. Switch execution mode to exchange_hours
            mode_res = client.post(
                "/api/v1/paper-portfolio/execution-mode",
                json={"execution_mode": "exchange_hours"},
            )
            # 2. Place MP order with orderbook depth & stop-loss / take-profit
            mp_order_res = client.post(
                "/api/v1/paper-portfolio/orders",
                headers={"Idempotency-Key": "mp-order-idemp-key-123456"},
                json={
                    "side": "buy",
                    "order_type": "MP",
                    "symbol": "FPT",
                    "quantity": 100,
                    "limit_price": "100000",
                    "execution_mode": "exchange_hours",
                    "use_orderbook_depth": True,
                    "strict_rules": True,
                    "stop_loss_price": "95000",
                    "take_profit_price": "115000",
                },
            )
            # 3. Force-fill an open waiting order
            fill_res = client.post(
                "/api/v1/paper-portfolio/orders/12345678-1234-4234-8234-123456789012/fill"
            )
            # 4. Advance T+2 sale cash
            adv_res = client.post(
                "/api/v1/paper-portfolio/advance-cash",
                json={"amount": "10000000"},
            )
            # 5. Upsert & cancel conditional trigger
            trig_res = client.post(
                "/api/v1/paper-portfolio/conditional-triggers",
                json={
                    "symbol": "FPT",
                    "stop_loss_price": "95000",
                    "take_profit_price": "115000",
                    "quantity": 100,
                },
            )
            del_trig_res = client.delete(
                "/api/v1/paper-portfolio/conditional-triggers/trig-1"
            )
    finally:
        app.dependency_overrides.clear()

    assert mode_res.status_code == 200
    assert mode_res.json()["exchange_simulation"]["execution_mode"] == "exchange_hours"

    assert mp_order_res.status_code == 201
    assert isinstance(service.command, PlacePaperOrder)
    assert service.command.order_type == "MP"
    assert service.command.use_orderbook_depth is True
    assert service.command.strict_rules is True
    assert service.command.stop_loss_price == Decimal("95000")
    assert service.command.take_profit_price == Decimal("115000")

    assert fill_res.status_code == 200
    assert service.filled_id == "12345678-1234-4234-8234-123456789012"

    assert adv_res.status_code == 200
    assert adv_res.json()["advance"]["net_received"] == "9994000"

    assert trig_res.status_code == 200
    assert del_trig_res.status_code == 200
