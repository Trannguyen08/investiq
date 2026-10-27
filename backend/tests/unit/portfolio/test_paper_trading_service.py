from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from app.application.dto.portfolio_dto import PlacePaperOrder
from app.application.use_cases.portfolio.simulate_trade import PaperTradingService
from app.domain.entities.holding import PaperHolding
from app.domain.entities.market import MarketInstrument
from app.domain.entities.portfolio import PaperOrder, PaperPortfolio, PaperTrade
from app.domain.repositories.i_portfolio_repository import PaperExecution, PaperOrderSubmission
from app.infrastructure.external.market_fixture_provider import FixtureMarketProvider


class RecordingPortfolioRepository:
    def __init__(self, portfolio: PaperPortfolio) -> None:
        self.portfolio = portfolio
        self.execution: PaperExecution | None = None
        self.submission: PaperOrderSubmission | None = None
        self.order: PaperOrder | None = None

    def get_or_create(self, _: str, __: Decimal) -> PaperPortfolio:
        return self.portfolio

    def execute(
        self,
        _: str,
        __: Decimal,
        execution: PaperExecution,
        ___: int,
    ) -> PaperTrade:
        self.execution = execution
        return PaperTrade(
            id="trade-1",
            idempotency_key=execution.idempotency_key,
            side=execution.side,
            symbol=execution.symbol,
            name=execution.name,
            exchange=execution.exchange,
            quantity=execution.quantity,
            execution_price=execution.execution_price,
            gross_amount=execution.gross_amount,
            fee_rate=execution.fee_rate,
            fee_amount=execution.fee_amount,
            tax_rate=execution.tax_rate,
            tax_amount=execution.tax_amount,
            cash_effect=-(execution.gross_amount + execution.fee_amount),
            realized_pnl=None,
            provider=execution.provider,
            price_at=execution.price_at,
            received_at=execution.received_at,
            delay_class=execution.delay_class,
            created_at=datetime(2026, 10, 8, tzinfo=UTC),
        )

    def place_order(
        self,
        _: str,
        __: Decimal,
        submission: PaperOrderSubmission,
        ___: int,
    ) -> PaperOrder:
        self.submission = submission
        now = datetime(2026, 10, 8, tzinfo=UTC)
        self.order = PaperOrder(
            id="order-1",
            idempotency_key=submission.idempotency_key,
            side=submission.side,
            order_type=submission.order_type,
            status=submission.initial_status,
            symbol=submission.symbol,
            name=submission.name,
            exchange=submission.exchange,
            quantity=submission.quantity,
            filled_quantity=0,
            limit_price=submission.limit_price,
            reserved_cash=submission.reserved_cash,
            reserved_quantity=submission.reserved_quantity,
            provider=submission.provider,
            price_at=submission.price_at,
            received_at=submission.received_at,
            delay_class=submission.delay_class,
            created_at=now,
            updated_at=now,
            expires_at=submission.expires_at,
            cancelled_at=None,
        )
        self.portfolio = replace(self.portfolio, orders=(self.order,))
        return self.order

    def activate_order(self, _: str, __: str) -> PaperOrder:
        assert self.order is not None
        self.order = replace(self.order, status="open")
        return self.order

    def cancel_order(self, _: str, __: str) -> PaperOrder:
        assert self.order is not None
        self.order = replace(
            self.order,
            status="cancelled",
            reserved_cash=Decimal(),
            reserved_quantity=0,
            cancelled_at=datetime(2026, 10, 8, tzinfo=UTC),
        )
        return self.order

    def fill_order(
        self,
        _: str,
        __: str,
        execution: PaperExecution,
        ___: int,
    ) -> tuple[PaperOrder, PaperTrade]:
        assert self.order is not None
        self.execution = execution
        self.order = replace(
            self.order,
            status="filled",
            filled_quantity=self.order.quantity,
            reserved_cash=Decimal(),
            reserved_quantity=0,
        )
        self.portfolio = replace(self.portfolio, orders=(self.order,))
        trade = self.execute("", Decimal(), execution, 0)
        return self.order, trade

    def expire_orders(self, _: str, __: datetime) -> int:
        return 0

    def set_public_status(
        self, user_id: str, is_public: bool, nickname: str | None = None
    ) -> PaperPortfolio:
        return self.portfolio

    def get_public_leaderboard(self, limit: int = 10) -> tuple[dict[str, Any], ...]:
        return ()

    def get_public_portfolio(self, portfolio_id: str) -> PaperPortfolio | None:
        return self.portfolio


def portfolio(*holdings: PaperHolding) -> PaperPortfolio:
    now = datetime(2026, 10, 8, tzinfo=UTC)
    return PaperPortfolio(
        id="portfolio-1",
        user_id="user-1",
        currency="VND",
        starting_cash=Decimal("100000000"),
        cash_balance=Decimal("75000000"),
        realized_pnl=Decimal("1000000"),
        version=2,
        created_at=now,
        updated_at=now,
        holdings=tuple(holdings),
        orders=(),
        trades=(),
    )


class OpenFixtureProvider(FixtureMarketProvider):
    session = "open"
    freshness = "fresh"

    def __init__(self, price: Decimal | None = None) -> None:
        self.price = price

    def instrument(
        self,
        symbol: str,
        *,
        include_fundamentals: bool = False,
    ) -> MarketInstrument | None:
        item = super().instrument(symbol, include_fundamentals=include_fundamentals)
        if item is not None and self.price is not None:
            return replace(item, price=self.price)
        return item


def test_buy_auto_fills_at_observed_price_outside_the_live_session() -> None:
    repository = RecordingPortfolioRepository(portfolio())
    service = PaperTradingService(repository, FixtureMarketProvider())

    order, trade = service.place_order(
        "user-1",
        PlacePaperOrder(
            "buy",
            "FPT",
            100,
            "LO",
            Decimal("105"),
            "12345678-1234-4234-8234-123456789012",
        ),
    )

    assert trade is not None
    assert trade.execution_price == Decimal("102.40")
    assert order.status == "filled"
    assert repository.submission is not None
    assert repository.submission.limit_price == Decimal("102.40")
    assert repository.submission.reserved_cash == Decimal("10255")
    assert repository.submission.provider == "investiq-fixture"
    assert repository.submission.delay_class == "development_fixture"


def test_dashboard_separates_cash_cost_value_and_unrealized_profit() -> None:
    repository = RecordingPortfolioRepository(
        portfolio(
            PaperHolding(
                symbol="FPT",
                name="CTCP FPT",
                exchange="HOSE",
                sector="Công nghệ",
                quantity=100,
                total_cost_basis=Decimal("9000"),
            )
        )
    )
    dashboard = PaperTradingService(repository, FixtureMarketProvider()).dashboard("user-1")

    assert dashboard["account"] == {
        "id": "portfolio-1",
        "currency": "VND",
        "starting_cash": "100000000",
        "cash_balance": "75000000",
        "available_cash": "75000000",
        "reserved_cash": "0",
        "invested_cost": "9000",
        "market_value": "10240",
        "total_value": "75010240",
        "realized_pnl": "1000000",
        "unrealized_pnl": "1240",
        "total_pnl": "-24989760",
        "total_return_percent": "-24.99",
        "valuation_partial": False,
        "version": 2,
        "is_public": False,
        "nickname": None,
        "created_at": "2026-10-08T00:00:00Z",
        "updated_at": "2026-10-08T00:00:00Z",
    }
    holdings = dashboard["holdings"]
    assert isinstance(holdings, list)
    assert holdings[0]["average_cost"] == "90"
    assert holdings[0]["available_quantity"] == 100
    assert holdings[0]["unrealized_pnl_percent"] == "13.78"
    assert dashboard["equity_curve"]
    assert dashboard["opportunities"]


def test_simulated_order_ignores_limit_crossing_and_auto_fills() -> None:
    matching_repository = RecordingPortfolioRepository(portfolio())
    matching_service = PaperTradingService(matching_repository, OpenFixtureProvider())

    order, trade = matching_service.place_order(
        "user-1",
        PlacePaperOrder("buy", "FPT", 100, "LO", Decimal("105"), "match-key-123456"),
    )

    assert order.status == "filled"
    assert trade is not None
    assert trade.execution_price == Decimal("102.40")

    waiting_repository = RecordingPortfolioRepository(portfolio())
    waiting_service = PaperTradingService(waiting_repository, OpenFixtureProvider())
    waiting, waiting_trade = waiting_service.place_order(
        "user-1",
        PlacePaperOrder("buy", "FPT", 100, "LO", Decimal("100"), "wait-key-12345678"),
    )

    assert waiting.status == "filled"
    assert waiting_trade is not None
    assert waiting_trade.execution_price == Decimal("102.40")


def test_legacy_waiting_order_auto_fills_at_the_latest_observed_price() -> None:
    repository = RecordingPortfolioRepository(portfolio())
    provider = OpenFixtureProvider(Decimal("110"))
    service = PaperTradingService(repository, provider)
    repository.place_order(
        "user-1",
        Decimal("100000000"),
        PaperOrderSubmission(
            idempotency_key="legacy-key-123456",
            side="buy",
            order_type="LO",
            symbol="FPT",
            name="CTCP FPT",
            exchange="HOSE",
            sector="Công nghệ",
            quantity=100,
            limit_price=Decimal("105"),
            reserved_cash=Decimal("10516"),
            reserved_quantity=0,
            provider=provider.slug,
            price_at=datetime(2026, 10, 8, tzinfo=UTC),
            received_at=datetime(2026, 10, 8, tzinfo=UTC),
            delay_class=provider.delay_class,
            initial_status="open",
            expires_at=datetime(2026, 10, 12, tzinfo=UTC),
        ),
        20,
    )
    dashboard = service.dashboard("user-1")

    assert repository.execution is not None
    assert repository.execution.execution_price == Decimal("110")
    orders = dashboard["orders"]
    assert isinstance(orders, list)
    assert isinstance(orders[0], dict)
    assert orders[0]["status"] == "filled"
