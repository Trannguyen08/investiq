from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from app.application.dto.portfolio_dto import PlacePaperOrder
from app.application.use_cases.portfolio.simulate_trade import PaperTradingService
from app.domain.entities.holding import PaperHolding
from app.domain.entities.portfolio import PaperPortfolio, PaperTrade
from app.domain.repositories.i_portfolio_repository import PaperExecution
from app.infrastructure.external.market_fixture_provider import FixtureMarketProvider


class RecordingPortfolioRepository:
    def __init__(self, portfolio: PaperPortfolio) -> None:
        self.portfolio = portfolio
        self.execution: PaperExecution | None = None

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
        trades=(),
    )


def test_buy_quote_uses_decimal_fee_and_observed_provider_metadata() -> None:
    repository = RecordingPortfolioRepository(portfolio())
    service = PaperTradingService(repository, FixtureMarketProvider())

    trade = service.place_order(
        "user-1",
        PlacePaperOrder("buy", "FPT", 100, "12345678-1234-4234-8234-123456789012"),
    )

    assert trade.execution_price == Decimal("102.40")
    assert trade.gross_amount == Decimal("10240")
    assert trade.fee_amount == Decimal("15")
    assert repository.execution is not None
    assert repository.execution.tax_amount == 0
    assert repository.execution.provider == "investiq-fixture"
    assert repository.execution.delay_class == "development_fixture"


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
        "invested_cost": "9000",
        "market_value": "10240",
        "total_value": "75010240",
        "realized_pnl": "1000000",
        "unrealized_pnl": "1240",
        "total_pnl": "-24989760",
        "total_return_percent": "-24.99",
        "valuation_partial": False,
        "version": 2,
        "created_at": "2026-10-08T00:00:00Z",
        "updated_at": "2026-10-08T00:00:00Z",
    }
    holdings = dashboard["holdings"]
    assert isinstance(holdings, list)
    assert holdings[0]["average_cost"] == "90"
    assert holdings[0]["unrealized_pnl_percent"] == "13.78"
    assert dashboard["equity_curve"]
    assert dashboard["opportunities"]

