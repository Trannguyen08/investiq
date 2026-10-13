from __future__ import annotations

import os
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from psycopg_pool import ConnectionPool

from app.domain.repositories.i_portfolio_repository import (
    InsufficientCashError,
    InsufficientSharesError,
    PaperExecution,
    PaperOrderSubmission,
    PortfolioConflictError,
)
from app.infrastructure.db.base import apply_migrations
from app.infrastructure.db.repositories.sql_portfolio_repository import SqlPortfolioRepository

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")


@pytest.fixture
def repository() -> Generator[tuple[SqlPortfolioRepository, str], None, None]:
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL is required for paper portfolio repository tests")
    apply_migrations(TEST_DATABASE_URL)
    pool = ConnectionPool(TEST_DATABASE_URL, min_size=1, max_size=2, open=True)
    with pool.connection() as connection, connection.transaction():
        connection.execute("TRUNCATE users RESTART IDENTITY CASCADE")
        row = connection.execute(
            """INSERT INTO users (email, display_name, email_verified_at)
               VALUES ('paper@example.com', 'Paper User', now()) RETURNING id"""
        ).fetchone()
        assert row is not None
        user_id = str(row[0])
    try:
        yield SqlPortfolioRepository(pool), user_id
    finally:
        pool.close()


def execution(
    *,
    key: str,
    side: str = "buy",
    quantity: int = 100,
    price: Decimal = Decimal("10000"),
) -> PaperExecution:
    gross = price * quantity
    fee = (gross * Decimal("0.0015")).quantize(Decimal("1"))
    tax_rate = Decimal("0.001") if side == "sell" else Decimal()
    tax = (gross * tax_rate).quantize(Decimal("1"))
    now = datetime(2026, 10, 8, 2, tzinfo=UTC)
    return PaperExecution(
        idempotency_key=key,
        side=side,
        symbol="FPT",
        name="CTCP FPT",
        exchange="HOSE",
        sector="Công nghệ",
        quantity=quantity,
        execution_price=price,
        gross_amount=gross,
        fee_rate=Decimal("0.0015"),
        fee_amount=fee,
        tax_rate=tax_rate,
        tax_amount=tax,
        provider="fixture",
        price_at=now,
        received_at=now,
        delay_class="development_fixture",
    )


def order_submission(
    *,
    key: str,
    side: str = "buy",
    quantity: int = 100,
    limit_price: Decimal = Decimal("10000"),
) -> PaperOrderSubmission:
    now = datetime.now(UTC)
    gross = limit_price * quantity
    fee = (gross * Decimal("0.0015")).quantize(Decimal("1"))
    return PaperOrderSubmission(
        idempotency_key=key,
        side=side,
        order_type="LO",
        symbol="FPT",
        name="CTCP FPT",
        exchange="HOSE",
        sector="Công nghệ",
        quantity=quantity,
        limit_price=limit_price,
        reserved_cash=gross + fee if side == "buy" else Decimal(),
        reserved_quantity=quantity if side == "sell" else 0,
        provider="fixture",
        price_at=now,
        received_at=now,
        delay_class="development_fixture",
        initial_status="open",
        expires_at=now + timedelta(days=1),
    )


def test_trade_ledger_is_idempotent_and_uses_weighted_cost(
    repository: tuple[SqlPortfolioRepository, str],
) -> None:
    repo, user_id = repository
    buy = execution(key="buy-123456789012")

    first = repo.execute(user_id, Decimal("100000000"), buy, 20)
    replay = repo.execute(user_id, Decimal("100000000"), buy, 20)
    sold = repo.execute(
        user_id,
        Decimal("100000000"),
        execution(key="sell-12345678901", side="sell", quantity=40, price=Decimal("12000")),
        20,
    )
    state = repo.get_or_create(user_id, Decimal("100000000"))

    assert replay.id == first.id
    assert len(state.trades) == 2
    assert state.holdings[0].quantity == 60
    assert state.holdings[0].total_cost_basis == Decimal("600900")
    assert sold.realized_pnl == Decimal("78200")
    assert state.realized_pnl == Decimal("78200")
    assert state.cash_balance == Decimal("99477300")


def test_trade_ledger_rejects_conflicts_overspending_and_short_sales(
    repository: tuple[SqlPortfolioRepository, str],
) -> None:
    repo, user_id = repository
    repo.execute(user_id, Decimal("100000000"), execution(key="same-123456789012"), 20)

    with pytest.raises(PortfolioConflictError):
        repo.execute(
            user_id,
            Decimal("100000000"),
            execution(key="same-123456789012", quantity=101),
            20,
        )
    with pytest.raises(InsufficientCashError):
        repo.execute(
            user_id,
            Decimal("100000000"),
            execution(key="large-12345678901", quantity=1_000_000),
            20,
        )
    with pytest.raises(InsufficientSharesError):
        repo.execute(
            user_id,
            Decimal("100000000"),
            execution(key="short-12345678901", side="sell", quantity=101),
            20,
        )


def test_waiting_orders_reserve_and_cancel_cash_and_shares_atomically(
    repository: tuple[SqlPortfolioRepository, str],
) -> None:
    repo, user_id = repository
    first_buy = repo.place_order(
        user_id,
        Decimal("100000000"),
        order_submission(
            key="reserved-buy-12345",
            quantity=5_000,
            limit_price=Decimal("10000"),
        ),
        20,
    )
    with pytest.raises(InsufficientCashError):
        repo.place_order(
            user_id,
            Decimal("100000000"),
            order_submission(
                key="overspend-buy-1234",
                quantity=5_000,
                limit_price=Decimal("10000"),
            ),
            20,
        )
    cancelled = repo.cancel_order(user_id, first_buy.id)
    assert cancelled.status == "cancelled"
    replacement = repo.place_order(
        user_id,
        Decimal("100000000"),
        order_submission(
            key="released-buy-12345",
            quantity=5_000,
            limit_price=Decimal("10000"),
        ),
        20,
    )
    assert replacement.status == "open"

    repo.cancel_order(user_id, replacement.id)
    repo.execute(
        user_id,
        Decimal("100000000"),
        execution(key="owned-shares-12345", quantity=100),
        20,
    )
    sell = repo.place_order(
        user_id,
        Decimal("100000000"),
        order_submission(key="reserved-sell-1234", side="sell", quantity=80),
        20,
    )
    with pytest.raises(InsufficientSharesError):
        repo.place_order(
            user_id,
            Decimal("100000000"),
            order_submission(key="oversell-123456789", side="sell", quantity=21),
            20,
        )
    assert repo.cancel_order(user_id, sell.id).status == "cancelled"


def test_automatic_fill_uses_observed_price_instead_of_legacy_limit(
    repository: tuple[SqlPortfolioRepository, str],
) -> None:
    repo, user_id = repository
    order = repo.place_order(
        user_id,
        Decimal("100000000"),
        order_submission(
            key="automatic-fill-1234",
            quantity=100,
            limit_price=Decimal("10000"),
        ),
        20,
    )

    filled, trade = repo.fill_order(
        user_id,
        order.id,
        execution(key=f"order:{order.id}", quantity=100, price=Decimal("11000")),
        20,
    )
    state = repo.get_or_create(user_id, Decimal("100000000"))

    assert filled.status == "filled"
    assert filled.limit_price == Decimal("10000")
    assert trade is not None
    assert trade.execution_price == Decimal("11000")
    assert state.cash_balance == Decimal("98898350")

