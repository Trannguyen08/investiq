from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest

from app.application.dto.portfolio_dto import PlacePaperOrder
from app.application.use_cases.portfolio.exchange_simulator import (
    ExchangeSimulationStore,
    classify_lot_type,
    compute_t2_settlement_date,
    get_tick_size,
)
from app.application.use_cases.portfolio.simulate_trade import (
    PaperOrderError,
    PaperTradingService,
)
from app.domain.entities.holding import PaperHolding
from app.domain.entities.market import MarketDepthLevel, MarketInstrument
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

    def credit_cash(self, user_id: str, amount: Decimal) -> None:
        self.portfolio = replace(
            self.portfolio,
            cash_balance=self.portfolio.cash_balance + amount,
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


class MultiOrderRepository(RecordingPortfolioRepository):
    """Repository supporting multiple orders and trades for advanced simulation tests."""

    def __init__(self, initial_portfolio: PaperPortfolio) -> None:
        super().__init__(initial_portfolio)
        self._order_seq = 0
        self._trade_seq = 0

    def place_order(
        self,
        _: str,
        __: Decimal,
        submission: PaperOrderSubmission,
        ___: int,
    ) -> PaperOrder:
        self._order_seq += 1
        self.submission = submission
        now = submission.received_at
        order = PaperOrder(
            id=f"order-{self._order_seq}",
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
        self.order = order
        self.portfolio = replace(self.portfolio, orders=(order, *self.portfolio.orders))
        return order

    def fill_order(
        self,
        _: str,
        order_id: str,
        execution: PaperExecution,
        ___: int,
    ) -> tuple[PaperOrder, PaperTrade]:
        self.execution = execution
        updated_orders: list[PaperOrder] = []
        filled_target: PaperOrder | None = None
        for item in self.portfolio.orders:
            if item.id == order_id:
                filled_target = replace(
                    item,
                    status="filled",
                    filled_quantity=item.quantity,
                    reserved_cash=Decimal(),
                    reserved_quantity=0,
                )
                updated_orders.append(filled_target)
            else:
                updated_orders.append(item)
        assert filled_target is not None
        self.order = filled_target
        trade = self.execute("", Decimal(), execution, 0)
        self.portfolio = replace(
            self.portfolio,
            orders=tuple(updated_orders),
            trades=(trade, *self.portfolio.trades),
        )
        return filled_target, trade

    def execute(
        self,
        _: str,
        __: Decimal,
        execution: PaperExecution,
        ___: int,
    ) -> PaperTrade:
        self._trade_seq += 1
        self.execution = execution
        cash_effect = (
            -(execution.gross_amount + execution.fee_amount)
            if execution.side == "buy"
            else (execution.gross_amount - execution.fee_amount - execution.tax_amount)
        )
        trade = PaperTrade(
            id=f"trade-{self._trade_seq}",
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
            cash_effect=cash_effect,
            realized_pnl=Decimal("500") if execution.side == "sell" else None,
            provider=execution.provider,
            price_at=execution.price_at,
            received_at=execution.received_at,
            delay_class=execution.delay_class,
            created_at=execution.received_at,
        )
        return trade


class DepthFixtureProvider(FixtureMarketProvider):
    def __init__(
        self,
        *,
        session: str = "open",
        ask_levels: tuple[MarketDepthLevel, ...] = (),
        bid_levels: tuple[MarketDepthLevel, ...] = (),
        override_price: Decimal | None = None,
    ) -> None:
        self.session = session
        self._ask_levels = ask_levels
        self._bid_levels = bid_levels
        self._override_price = override_price

    def instrument(
        self,
        symbol: str,
        *,
        include_fundamentals: bool = False,
    ) -> MarketInstrument | None:
        item = super().instrument(symbol, include_fundamentals=include_fundamentals)
        if item is None:
            return None
        return replace(
            item,
            price=self._override_price if self._override_price is not None else item.price,
            ask_levels=self._ask_levels,
            bid_levels=self._bid_levels,
        )


def test_option_b_exchange_hours_queues_orders_outside_trading_session_and_fills_in_session() -> None:
    store = ExchangeSimulationStore()
    repo = MultiOrderRepository(portfolio())
    # Weekend Saturday 10:00 UTC (17:00 ICT) -> Outside trading hours
    weekend_clock = datetime(2026, 10, 10, 10, 0, tzinfo=UTC)
    closed_provider = DepthFixtureProvider(session="closed")
    service = PaperTradingService(repo, closed_provider, sim_store=store, clock=weekend_clock)

    service.set_execution_mode("user-1", "exchange_hours")
    assert store.get_mode("user-1") == "exchange_hours"

    order, trade = service.place_order(
        "user-1",
        PlacePaperOrder(
            side="buy",
            symbol="FPT",
            quantity=100,
            order_type="LO",
            limit_price=Decimal("102.40"),
            idempotency_key="weekend-order-key-123456",
        ),
    )

    assert trade is None
    assert order.status == "open"
    assert order.reserved_cash > 0
    meta = store.get_order_meta(order.id)
    assert meta is not None
    assert meta.pending_reason is not None
    assert "cuối tuần" in meta.pending_reason

    # User can force-fill the waiting order or wait for Monday morning session
    filled_order, filled_trade = service.force_fill_order("user-1", order.id)
    assert filled_order.status == "filled"
    assert filled_trade is not None
    assert filled_trade.symbol == "FPT"


def test_improvement_1_vsdc_t2_settlement_tracking_and_cash_advance_with_fee() -> None:
    store = ExchangeSimulationStore()
    now = datetime(2026, 10, 8, 3, 0, tzinfo=UTC)  # Thursday 10:00 ICT
    holding_fpt = PaperHolding(
        symbol="FPT",
        name="CTCP FPT",
        exchange="HOSE",
        sector="Công nghệ",
        quantity=500,
        total_cost_basis=Decimal("45000000"),
    )
    repo = MultiOrderRepository(portfolio(holding_fpt))
    provider = DepthFixtureProvider(session="open", override_price=Decimal("100000"))
    service = PaperTradingService(repo, provider, sim_store=store, clock=now)

    # Execute a Buy and a Sell on Thursday -> Settles on Monday (skipping Sat/Sun)
    settle_dt = compute_t2_settlement_date(now)
    assert settle_dt.astimezone().weekday() < 5

    _, buy_trade = service.place_order(
        "user-1",
        PlacePaperOrder("buy", "HPG", 200, "LO", Decimal("29.15"), "t2-buy-key-12345678"),
    )
    _, sell_trade = service.place_order(
        "user-1",
        PlacePaperOrder("sell", "FPT", 100, "LO", Decimal("100000"), "t2-sell-key-12345678"),
    )
    assert buy_trade is not None
    assert sell_trade is not None

    dash = service.dashboard("user-1")
    sim = dash["exchange_simulation"]
    assert isinstance(sim, dict)
    t2 = sim["t2_settlement"]
    assert isinstance(t2, dict)
    assert t2["pending_buy_shares_by_symbol"]["HPG"] == 200
    receivable = Decimal(str(t2["receivable_cash_t2"]))
    assert receivable > Decimal("9900000")

    # Request cash advance ("Ứng trước tiền bán") at 0.03%/day * 2 days = 0.06%
    adv_res = service.advance_sale_cash("user-1", Decimal("5000000"))
    adv = adv_res["advance"]
    assert isinstance(adv, dict)
    assert adv["gross_amount"] == "5000000"
    assert adv["fee_amount"] == "3000"  # 5,000,000 * 0.0003 * 2 = 3,000 VND
    assert adv["net_received"] == "4997000"


def test_improvement_2_price_band_tick_size_and_odd_lot_validation() -> None:
    store = ExchangeSimulationStore()
    repo = MultiOrderRepository(portfolio())
    provider = DepthFixtureProvider(session="open")
    service = PaperTradingService(repo, provider, sim_store=store)

    # Check tick size rules on HOSE vs HNX
    assert get_tick_size("HOSE", Decimal("9500")) == Decimal("10")
    assert get_tick_size("HOSE", Decimal("28500")) == Decimal("50")
    assert get_tick_size("HOSE", Decimal("102000")) == Decimal("100")
    assert get_tick_size("HNX", Decimal("18700")) == Decimal("100")

    # Check lot classification
    assert classify_lot_type(100) == "even"
    assert classify_lot_type(45) == "odd"
    assert classify_lot_type(150) == "mixed"

    # Mixed lot (e.g. 150 shares) rejected in strict mode
    with pytest.raises(PaperOrderError) as exc_mixed:
        service.place_order(
            "user-1",
            PlacePaperOrder(
                side="buy",
                symbol="FPT",
                quantity=150,
                order_type="LO",
                limit_price=Decimal("102.40"),
                idempotency_key="mixed-lot-key-123456",
                strict_rules=True,
            ),
        )
    assert exc_mixed.value.code == "MIXED_LOT_NOT_ALLOWED"

    # Odd lot (1-99 shares) with MP order rejected (odd lots only allow LO)
    with pytest.raises(PaperOrderError) as exc_odd_mp:
        service.place_order(
            "user-1",
            PlacePaperOrder(
                side="buy",
                symbol="FPT",
                quantity=25,
                order_type="MP",
                limit_price=Decimal("102.40"),
                idempotency_key="odd-mp-key-12345678",
                strict_rules=True,
            ),
        )
    assert exc_odd_mp.value.code == "ODD_LOT_ONLY_LO"

    # Out of ceiling/floor price band rejected (FPT ref 100.80 -> ceiling 107.86, floor 93.74)
    with pytest.raises(PaperOrderError) as exc_band:
        service.place_order(
            "user-1",
            PlacePaperOrder(
                side="buy",
                symbol="FPT",
                quantity=100,
                order_type="LO",
                limit_price=Decimal("120.00"),
                idempotency_key="band-err-key-123456",
                strict_rules=True,
            ),
        )
    assert exc_band.value.code == "PRICE_OUT_OF_BAND"

    # Invalid tick size rejected (FPT > 50 -> tick is 0.10 in thousand-VND unit; 102.43 is invalid)
    with pytest.raises(PaperOrderError) as exc_tick:
        service.place_order(
            "user-1",
            PlacePaperOrder(
                side="buy",
                symbol="FPT",
                quantity=100,
                order_type="LO",
                limit_price=Decimal("102.43"),
                idempotency_key="tick-err-key-123456",
                strict_rules=True,
            ),
        )
    assert exc_tick.value.code == "INVALID_TICK_SIZE"


def test_improvement_3_orderbook_3_level_depth_slippage_and_partial_fill() -> None:
    store = ExchangeSimulationStore()
    repo = MultiOrderRepository(portfolio())
    # Ask 1: 102.40 (vol 100), Ask 2: 102.50 (vol 200), Ask 3: 102.60 (vol 100) -> Total depth 400
    ask_book = (
        MarketDepthLevel(price=Decimal("102.40"), volume=Decimal("100")),
        MarketDepthLevel(price=Decimal("102.50"), volume=Decimal("200")),
        MarketDepthLevel(price=Decimal("102.60"), volume=Decimal("100")),
    )
    provider = DepthFixtureProvider(session="open", ask_levels=ask_book)
    service = PaperTradingService(repo, provider, sim_store=store)

    # Buy 500 shares with limit 102.60 using 3-level orderbook depth:
    # Fills 400 shares across 3 levels: (100*102.40 + 200*102.50 + 100*102.60)/400 = 102.50
    # Leaves 100 shares unfilled as a resting open child order!
    filled_order, trade = service.place_order(
        "user-1",
        PlacePaperOrder(
            side="buy",
            symbol="FPT",
            quantity=500,
            order_type="LO",
            limit_price=Decimal("102.60"),
            idempotency_key="depth-sweep-key-123456",
            use_orderbook_depth=True,
        ),
    )

    assert trade is not None
    assert filled_order.status == "filled"
    assert filled_order.quantity == 400
    assert trade.quantity == 400
    assert trade.execution_price == Decimal("102.50")

    meta = store.get_order_meta(filled_order.id)
    assert meta is not None
    assert meta.slippage_vnd == Decimal("0.10")
    assert meta.slippage_bps > Decimal("0")

    # Verify child resting order for the remaining 100 shares was created
    open_orders = [o for o in repo.portfolio.orders if o.status == "open"]
    assert len(open_orders) == 1
    assert open_orders[0].quantity == 100
    assert open_orders[0].limit_price == Decimal("102.60")


def test_improvement_4_order_types_mp_ato_atc_and_anti_lookahead_quarantine() -> None:
    store = ExchangeSimulationStore()
    repo = MultiOrderRepository(portfolio())
    ask_book = (
        MarketDepthLevel(price=Decimal("102.40"), volume=Decimal("300")),
        MarketDepthLevel(price=Decimal("102.50"), volume=Decimal("300")),
    )
    now = datetime(2026, 10, 8, 2, 5, tzinfo=UTC)  # 09:05 ICT (Inside ATO 09:00-09:15)
    provider = DepthFixtureProvider(session="open", ask_levels=ask_book)
    service = PaperTradingService(repo, provider, sim_store=store, clock=now)

    # 1. MP order sweeps Ask 1 and Ask 2 without needing limit price check
    mp_order, mp_trade = service.place_order(
        "user-1",
        PlacePaperOrder(
            side="buy",
            symbol="FPT",
            quantity=400,
            order_type="MP",
            limit_price=Decimal("102.40"),
            idempotency_key="mp-order-key-12345678",
            use_orderbook_depth=True,
        ),
    )
    assert mp_trade is not None
    assert mp_order.status == "filled"
    mp_meta = store.get_order_meta(mp_order.id)
    assert mp_meta is not None
    assert mp_meta.display_order_type == "MP"

    # 2. Non-marketable LO order (limit 100.00 < Best Ask 102.40) rests in orderbook with 60s quarantine
    waiting_order, waiting_trade = service.place_order(
        "user-1",
        PlacePaperOrder(
            side="buy",
            symbol="FPT",
            quantity=100,
            order_type="LO",
            limit_price=Decimal("100.00"),
            idempotency_key="low-lo-order-key-123456",
            execution_mode="exchange_hours",
        ),
    )
    assert waiting_trade is None
    assert waiting_order.status == "open"
    wait_meta = store.get_order_meta(waiting_order.id)
    assert wait_meta is not None
    assert wait_meta.quarantine_until == now + timedelta(seconds=60)

    # Even if price drops to 99.50 within 10 seconds, quarantine prevents look-ahead fill
    early_provider = DepthFixtureProvider(
        session="open",
        override_price=Decimal("99.50"),
        ask_levels=(MarketDepthLevel(price=Decimal("99.50"), volume=Decimal("500")),),
    )
    early_service = PaperTradingService(
        repo,
        early_provider,
        sim_store=store,
        clock=now + timedelta(seconds=10),
    )
    early_service.set_execution_mode("user-1", "exchange_hours")
    early_dash = early_service.dashboard("user-1")
    early_orders = early_dash["orders"]
    assert isinstance(early_orders, list)
    open_ids = [o["id"] for o in early_orders if isinstance(o, dict) and o["status"] == "open"]
    assert waiting_order.id in open_ids

    # After 65 seconds (> 60s quarantine), order fills automatically when price <= limit_price
    post_quarantine_service = PaperTradingService(
        repo,
        early_provider,
        sim_store=store,
        clock=now + timedelta(seconds=65),
    )
    post_dash = post_quarantine_service.dashboard("user-1")
    post_orders = post_dash["orders"]
    assert isinstance(post_orders, list)
    filled_ids = [o["id"] for o in post_orders if isinstance(o, dict) and o["status"] == "filled"]
    assert waiting_order.id in filled_ids


def test_improvement_5_conditional_stop_loss_and_take_profit_auto_triggers() -> None:
    store = ExchangeSimulationStore()
    holding_fpt = PaperHolding(
        symbol="FPT",
        name="CTCP FPT",
        exchange="HOSE",
        sector="Công nghệ",
        quantity=200,
        total_cost_basis=Decimal("20000"),
    )
    repo = MultiOrderRepository(portfolio(holding_fpt))
    # Price drops to 94.00, hitting Stop-Loss at 95.00
    drop_provider = DepthFixtureProvider(session="open", override_price=Decimal("94.00"))
    service = PaperTradingService(repo, drop_provider, sim_store=store)

    service.upsert_conditional_trigger(
        user_id="user-1",
        symbol="FPT",
        stop_loss_price=Decimal("95.00"),
        take_profit_price=Decimal("115.00"),
        quantity=200,
    )

    triggers = store.list_triggers("user-1")
    assert len(triggers) == 1
    assert triggers[0].status == "triggered"
    assert triggers[0].trigger_reason is not None
    assert "Cắt lỗ tự động" in triggers[0].trigger_reason
    assert repo.execution is not None
    assert repo.execution.side == "sell"
    assert repo.execution.quantity == 200
    assert repo.execution.execution_price == Decimal("94.00")


def test_place_order_stop_loss_and_take_profit_validation() -> None:
    store = ExchangeSimulationStore()
    repo = MultiOrderRepository(portfolio())
    provider = DepthFixtureProvider(session="open", override_price=Decimal("20000"))
    service = PaperTradingService(repo, provider, sim_store=store)

    # 1. Stop loss >= buy price (20000)
    with pytest.raises(PaperOrderError) as exc_sl:
        service.place_order(
            "user-1",
            PlacePaperOrder(
                idempotency_key="key-sl",
                symbol="HPG",
                side="buy",
                order_type="LO",
                quantity=100,
                limit_price=Decimal("20000"),
                stop_loss_price=Decimal("21000"),
            ),
        )
    assert exc_sl.value.code == "INVALID_STOP_LOSS"
    assert "phải nhỏ hơn giá đặt mua" in exc_sl.value.message

    # 2. Take profit <= buy price (20000)
    with pytest.raises(PaperOrderError) as exc_tp:
        service.place_order(
            "user-1",
            PlacePaperOrder(
                idempotency_key="key-tp",
                symbol="HPG",
                side="buy",
                order_type="LO",
                quantity=100,
                limit_price=Decimal("20000"),
                take_profit_price=Decimal("19000"),
            ),
        )
    assert exc_tp.value.code == "INVALID_TAKE_PROFIT"
    assert "phải lớn hơn giá đặt mua" in exc_tp.value.message

    # 3. Stop loss >= Take profit
    with pytest.raises(PaperOrderError) as exc_range:
        service.place_order(
            "user-1",
            PlacePaperOrder(
                idempotency_key="key-range",
                symbol="HPG",
                side="buy",
                order_type="LO",
                quantity=100,
                limit_price=Decimal("20000"),
                stop_loss_price=Decimal("18000"),
                take_profit_price=Decimal("18000"),
            ),
        )
    assert exc_range.value.code == "INVALID_TRIGGER_RANGE"


def test_set_execution_mode_fast_cache_update() -> None:
    store = ExchangeSimulationStore()
    repo = MultiOrderRepository(portfolio())
    provider = DepthFixtureProvider(session="open", override_price=Decimal("20000"))
    service = PaperTradingService(repo, provider, sim_store=store)

    # Warm cache
    initial_dash = service.dashboard("user-1")
    assert isinstance(initial_dash["exchange_simulation"], dict)
    assert initial_dash["exchange_simulation"]["execution_mode"] == "instant"

    # Toggle mode to exchange_hours
    updated_dash = service.set_execution_mode("user-1", "exchange_hours")
    assert isinstance(updated_dash["exchange_simulation"], dict)
    assert updated_dash["exchange_simulation"]["execution_mode"] == "exchange_hours"
    assert store.get_mode("user-1") == "exchange_hours"
