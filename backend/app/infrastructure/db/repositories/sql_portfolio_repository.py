"""PostgreSQL paper-trading ledger with row-locked cash and holding invariants."""

from __future__ import annotations

from collections.abc import Mapping
from decimal import Decimal
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.domain.entities.holding import PaperHolding
from app.domain.entities.portfolio import PaperPortfolio, PaperTrade
from app.domain.repositories.i_portfolio_repository import (
    HoldingLimitError,
    InsufficientCashError,
    InsufficientSharesError,
    PaperExecution,
    PortfolioConflictError,
)
from app.domain.value_objects.money import round_vnd


class SqlPortfolioRepository:
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    @staticmethod
    def _trade(row: Mapping[str, Any]) -> PaperTrade:
        return PaperTrade(
            id=str(row["id"]),
            idempotency_key=str(row["idempotency_key"]),
            side=str(row["side"]),
            symbol=str(row["symbol"]),
            name=str(row["instrument_name"]),
            exchange=str(row["exchange"]),
            quantity=int(row["quantity"]),
            execution_price=Decimal(row["execution_price"]),
            gross_amount=Decimal(row["gross_amount"]),
            fee_rate=Decimal(row["fee_rate"]),
            fee_amount=Decimal(row["fee_amount"]),
            tax_rate=Decimal(row["tax_rate"]),
            tax_amount=Decimal(row["tax_amount"]),
            cash_effect=Decimal(row["cash_effect"]),
            realized_pnl=(
                Decimal(row["realized_pnl"]) if row["realized_pnl"] is not None else None
            ),
            provider=str(row["provider"]),
            price_at=row["price_at"],
            received_at=row["received_at"],
            delay_class=str(row["delay_class"]),
            created_at=row["created_at"],
        )

    def get_or_create(self, user_id: str, starting_cash: Decimal) -> PaperPortfolio:
        with self._pool.connection() as connection, connection.transaction():
            connection.execute(
                """INSERT INTO paper_portfolios (user_id, starting_cash, cash_balance)
                   VALUES (%s, %s, %s) ON CONFLICT (user_id) DO NOTHING""",
                (user_id, starting_cash, starting_cash),
            )
        return self._load(user_id)

    def _load(self, user_id: str) -> PaperPortfolio:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            portfolio = cursor.execute(
                """SELECT id::text AS id, user_id::text AS user_id, currency,
                          starting_cash, cash_balance, realized_pnl, version,
                          created_at, updated_at
                   FROM paper_portfolios WHERE user_id = %s""",
                (user_id,),
            ).fetchone()
            if portfolio is None:
                raise RuntimeError("Paper portfolio was not created")
            holdings = cursor.execute(
                """SELECT i.symbol, i.name, i.exchange, i.sector,
                          h.quantity, h.total_cost_basis
                   FROM paper_holdings h
                   JOIN market_instruments i ON i.id = h.instrument_id
                   WHERE h.portfolio_id = %s
                   ORDER BY h.updated_at DESC, i.symbol
                   LIMIT 20""",
                (portfolio["id"],),
            ).fetchall()
            trades = cursor.execute(
                """SELECT id::text AS id, idempotency_key, side, symbol,
                          instrument_name, exchange, quantity, execution_price,
                          gross_amount, fee_rate, fee_amount, tax_rate, tax_amount,
                          cash_effect, realized_pnl, provider, price_at, received_at,
                          delay_class, created_at
                   FROM paper_trades WHERE portfolio_id = %s
                   ORDER BY created_at DESC, id DESC LIMIT 100""",
                (portfolio["id"],),
            ).fetchall()
        return PaperPortfolio(
            id=str(portfolio["id"]),
            user_id=str(portfolio["user_id"]),
            currency=str(portfolio["currency"]),
            starting_cash=Decimal(portfolio["starting_cash"]),
            cash_balance=Decimal(portfolio["cash_balance"]),
            realized_pnl=Decimal(portfolio["realized_pnl"]),
            version=int(portfolio["version"]),
            created_at=portfolio["created_at"],
            updated_at=portfolio["updated_at"],
            holdings=tuple(
                PaperHolding(
                    symbol=str(row["symbol"]),
                    name=str(row["name"]),
                    exchange=str(row["exchange"]),
                    sector=str(row["sector"]) if row["sector"] is not None else None,
                    quantity=int(row["quantity"]),
                    total_cost_basis=Decimal(row["total_cost_basis"]),
                )
                for row in holdings
            ),
            trades=tuple(self._trade(row) for row in trades),
        )

    def execute(
        self,
        user_id: str,
        starting_cash: Decimal,
        execution: PaperExecution,
        max_holdings: int,
    ) -> PaperTrade:
        with (
            self._pool.connection() as connection,
            connection.transaction(),
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            cursor.execute(
                """INSERT INTO paper_portfolios (user_id, starting_cash, cash_balance)
                   VALUES (%s, %s, %s) ON CONFLICT (user_id) DO NOTHING""",
                (user_id, starting_cash, starting_cash),
            )
            portfolio = cursor.execute(
                """SELECT id, cash_balance, realized_pnl FROM paper_portfolios
                   WHERE user_id = %s FOR UPDATE""",
                (user_id,),
            ).fetchone()
            assert portfolio is not None
            existing = cursor.execute(
                """SELECT id::text AS id, idempotency_key, side, symbol,
                          instrument_name, exchange, quantity, execution_price,
                          gross_amount, fee_rate, fee_amount, tax_rate, tax_amount,
                          cash_effect, realized_pnl, provider, price_at, received_at,
                          delay_class, created_at
                   FROM paper_trades
                   WHERE portfolio_id = %s AND idempotency_key = %s""",
                (portfolio["id"], execution.idempotency_key),
            ).fetchone()
            if existing is not None:
                if (
                    existing["side"] != execution.side
                    or existing["symbol"] != execution.symbol
                    or int(existing["quantity"]) != execution.quantity
                ):
                    raise PortfolioConflictError(
                        "Idempotency-Key đã được dùng cho một lệnh khác."
                    )
                return self._trade(existing)

            instrument = cursor.execute(
                """INSERT INTO market_instruments (symbol, exchange, name, sector)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT (exchange, symbol) DO UPDATE
                   SET name = EXCLUDED.name, sector = EXCLUDED.sector, updated_at = now()
                   RETURNING id""",
                (execution.symbol, execution.exchange, execution.name, execution.sector),
            ).fetchone()
            assert instrument is not None
            holding = cursor.execute(
                """SELECT quantity, total_cost_basis FROM paper_holdings
                   WHERE portfolio_id = %s AND instrument_id = %s FOR UPDATE""",
                (portfolio["id"], instrument["id"]),
            ).fetchone()

            realized_pnl: Decimal | None = None
            if execution.side == "buy":
                debit = execution.gross_amount + execution.fee_amount
                if Decimal(portfolio["cash_balance"]) < debit:
                    raise InsufficientCashError("Số dư mô phỏng không đủ cho lệnh mua này.")
                if holding is None:
                    count_row = cursor.execute(
                        "SELECT count(*) AS total FROM paper_holdings WHERE portfolio_id = %s",
                        (portfolio["id"],),
                    ).fetchone()
                    assert count_row is not None
                    if int(count_row["total"]) >= max_holdings:
                        raise HoldingLimitError(
                            f"Danh mục mô phỏng chỉ hỗ trợ tối đa {max_holdings} mã."
                        )
                new_quantity = (
                    int(holding["quantity"]) + execution.quantity
                    if holding
                    else execution.quantity
                )
                old_basis = Decimal(holding["total_cost_basis"]) if holding else Decimal()
                new_basis = old_basis + debit
                cursor.execute(
                    """INSERT INTO paper_holdings
                       (portfolio_id, instrument_id, quantity, total_cost_basis)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT (portfolio_id, instrument_id) DO UPDATE
                       SET quantity = EXCLUDED.quantity,
                           total_cost_basis = EXCLUDED.total_cost_basis,
                           updated_at = now()""",
                    (portfolio["id"], instrument["id"], new_quantity, new_basis),
                )
                cash_effect = -debit
            else:
                if holding is None or int(holding["quantity"]) < execution.quantity:
                    raise InsufficientSharesError("Không đủ cổ phiếu mô phỏng để bán.")
                old_quantity = int(holding["quantity"])
                old_basis = Decimal(holding["total_cost_basis"])
                allocated_basis = round_vnd(
                    old_basis * Decimal(execution.quantity) / Decimal(old_quantity)
                )
                net_proceeds = (
                    execution.gross_amount - execution.fee_amount - execution.tax_amount
                )
                realized_pnl = net_proceeds - allocated_basis
                remaining_quantity = old_quantity - execution.quantity
                if remaining_quantity == 0:
                    cursor.execute(
                        """DELETE FROM paper_holdings
                           WHERE portfolio_id = %s AND instrument_id = %s""",
                        (portfolio["id"], instrument["id"]),
                    )
                else:
                    cursor.execute(
                        """UPDATE paper_holdings
                           SET quantity = %s, total_cost_basis = %s, updated_at = now()
                           WHERE portfolio_id = %s AND instrument_id = %s""",
                        (
                            remaining_quantity,
                            old_basis - allocated_basis,
                            portfolio["id"],
                            instrument["id"],
                        ),
                    )
                cash_effect = net_proceeds

            trade = cursor.execute(
                """INSERT INTO paper_trades
                   (portfolio_id, instrument_id, idempotency_key, side, symbol,
                    instrument_name, exchange, quantity, execution_price, gross_amount,
                    fee_rate, fee_amount, tax_rate, tax_amount, cash_effect, realized_pnl,
                    provider, price_at, received_at, delay_class)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                           %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING id::text AS id, idempotency_key, side, symbol,
                             instrument_name, exchange, quantity, execution_price,
                             gross_amount, fee_rate, fee_amount, tax_rate, tax_amount,
                             cash_effect, realized_pnl, provider, price_at, received_at,
                             delay_class, created_at""",
                (
                    portfolio["id"],
                    instrument["id"],
                    execution.idempotency_key,
                    execution.side,
                    execution.symbol,
                    execution.name,
                    execution.exchange,
                    execution.quantity,
                    execution.execution_price,
                    execution.gross_amount,
                    execution.fee_rate,
                    execution.fee_amount,
                    execution.tax_rate,
                    execution.tax_amount,
                    cash_effect,
                    realized_pnl,
                    execution.provider,
                    execution.price_at,
                    execution.received_at,
                    execution.delay_class,
                ),
            ).fetchone()
            assert trade is not None
            cursor.execute(
                """UPDATE paper_portfolios
                   SET cash_balance = cash_balance + %s,
                       realized_pnl = realized_pnl + %s,
                       version = version + 1,
                       updated_at = now()
                   WHERE id = %s""",
                (cash_effect, realized_pnl or Decimal(), portfolio["id"]),
            )
            return self._trade(trade)
