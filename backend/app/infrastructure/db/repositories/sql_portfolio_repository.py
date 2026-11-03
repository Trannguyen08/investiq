"""PostgreSQL paper-trading ledger with row-locked cash and holding invariants."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from decimal import Decimal
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.domain.entities.holding import PaperHolding
from app.domain.entities.portfolio import PaperOrder, PaperPortfolio, PaperTrade
from app.domain.repositories.i_portfolio_repository import (
    HoldingLimitError,
    InsufficientCashError,
    InsufficientSharesError,
    OrderNotCancellableError,
    PaperExecution,
    PaperOrderSubmission,
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

    @staticmethod
    def _order(row: Mapping[str, Any]) -> PaperOrder:
        return PaperOrder(
            id=str(row["id"]),
            idempotency_key=str(row["idempotency_key"]),
            side=str(row["side"]),
            order_type=str(row["order_type"]),
            status=str(row["status"]),
            symbol=str(row["symbol"]),
            name=str(row["instrument_name"]),
            exchange=str(row["exchange"]),
            quantity=int(row["quantity"]),
            filled_quantity=int(row["filled_quantity"]),
            limit_price=Decimal(row["limit_price"]),
            reserved_cash=Decimal(row["reserved_cash"]),
            reserved_quantity=int(row["reserved_quantity"]),
            provider=str(row["provider"]),
            price_at=row["price_at"],
            received_at=row["received_at"],
            delay_class=str(row["delay_class"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            expires_at=row["expires_at"],
            cancelled_at=row["cancelled_at"],
        )

    @staticmethod
    def _order_columns(alias: str = "") -> str:
        prefix = f"{alias}." if alias else ""
        names = (
            "idempotency_key",
            "side",
            "order_type",
            "status",
            "symbol",
            "instrument_name",
            "exchange",
            "quantity",
            "filled_quantity",
            "limit_price",
            "reserved_cash",
            "reserved_quantity",
            "provider",
            "price_at",
            "received_at",
            "delay_class",
            "created_at",
            "updated_at",
            "expires_at",
            "cancelled_at",
        )
        return f"{prefix}id::text AS id, " + ", ".join(f"{prefix}{name}" for name in names)

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
                          created_at, updated_at,
                          COALESCE(is_public, false) AS is_public, nickname
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
            orders = cursor.execute(
                f"""SELECT {self._order_columns()}
                    FROM paper_orders WHERE portfolio_id = %s
                    ORDER BY (status IN ('pending', 'open')) DESC,
                             created_at DESC, id DESC LIMIT 200""",
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
            orders=tuple(self._order(row) for row in orders),
            trades=tuple(self._trade(row) for row in trades),
            is_public=bool(portfolio.get("is_public", False)),
            nickname=str(portfolio["nickname"]) if portfolio.get("nickname") else None,
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
                    raise PortfolioConflictError("Idempotency-Key đã được dùng cho một lệnh khác.")
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
                    int(holding["quantity"]) + execution.quantity if holding else execution.quantity
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
                net_proceeds = execution.gross_amount - execution.fee_amount - execution.tax_amount
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

    def place_order(
        self,
        user_id: str,
        starting_cash: Decimal,
        submission: PaperOrderSubmission,
        max_holdings: int,
    ) -> PaperOrder:
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
                """SELECT id, cash_balance FROM paper_portfolios
                   WHERE user_id = %s FOR UPDATE""",
                (user_id,),
            ).fetchone()
            assert portfolio is not None
            existing = cursor.execute(
                f"""SELECT {self._order_columns()} FROM paper_orders
                    WHERE portfolio_id = %s AND idempotency_key = %s""",
                (portfolio["id"], submission.idempotency_key),
            ).fetchone()
            if existing is not None:
                if (
                    existing["side"] != submission.side
                    or existing["symbol"] != submission.symbol
                    or int(existing["quantity"]) != submission.quantity
                    or Decimal(existing["limit_price"]) != submission.limit_price
                ):
                    raise PortfolioConflictError("Idempotency-Key đã được dùng cho một lệnh khác.")
                return self._order(existing)

            open_count = cursor.execute(
                """SELECT count(*) AS total FROM paper_orders
                   WHERE portfolio_id = %s AND status IN ('pending', 'open')""",
                (portfolio["id"],),
            ).fetchone()
            assert open_count is not None
            if int(open_count["total"]) >= 100:
                raise PortfolioConflictError(
                    "Tài khoản chỉ hỗ trợ tối đa 100 lệnh đang chờ cùng lúc."
                )

            instrument = cursor.execute(
                """INSERT INTO market_instruments (symbol, exchange, name, sector)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT (exchange, symbol) DO UPDATE
                   SET name = EXCLUDED.name, sector = EXCLUDED.sector, updated_at = now()
                   RETURNING id""",
                (
                    submission.symbol,
                    submission.exchange,
                    submission.name,
                    submission.sector,
                ),
            ).fetchone()
            assert instrument is not None
            reserved = cursor.execute(
                """SELECT COALESCE(sum(reserved_cash), 0) AS cash,
                          COALESCE(sum(reserved_quantity) FILTER (
                              WHERE instrument_id = %s
                          ), 0) AS shares
                   FROM paper_orders
                   WHERE portfolio_id = %s AND status IN ('pending', 'open')""",
                (instrument["id"], portfolio["id"]),
            ).fetchone()
            assert reserved is not None
            holding = cursor.execute(
                """SELECT quantity FROM paper_holdings
                   WHERE portfolio_id = %s AND instrument_id = %s FOR UPDATE""",
                (portfolio["id"], instrument["id"]),
            ).fetchone()
            if submission.side == "buy":
                available_cash = Decimal(portfolio["cash_balance"]) - Decimal(reserved["cash"])
                if available_cash < submission.reserved_cash:
                    raise InsufficientCashError(
                        "Số dư khả dụng không đủ vì tiền của lệnh mua đang chờ đã được giữ lại."
                    )
                if holding is None:
                    count_row = cursor.execute(
                        """SELECT count(DISTINCT instrument_id) AS total,
                                  COALESCE(bool_or(instrument_id = %s), false)
                                      AS already_allocated
                           FROM (
                               SELECT instrument_id FROM paper_holdings WHERE portfolio_id = %s
                               UNION
                               SELECT instrument_id FROM paper_orders
                               WHERE portfolio_id = %s AND side = 'buy'
                                 AND status IN ('pending', 'open')
                           ) AS allocated""",
                        (instrument["id"], portfolio["id"], portfolio["id"]),
                    ).fetchone()
                    assert count_row is not None
                    if int(count_row["total"]) >= max_holdings and not bool(
                        count_row["already_allocated"]
                    ):
                        raise HoldingLimitError(
                            f"Danh mục mô phỏng chỉ hỗ trợ tối đa {max_holdings} mã."
                        )
            else:
                available_quantity = (int(holding["quantity"]) if holding is not None else 0) - int(
                    reserved["shares"]
                )
                if available_quantity < submission.quantity:
                    raise InsufficientSharesError(
                        "Số cổ phiếu khả dụng không đủ vì một phần đang được giữ cho lệnh bán chờ."
                    )

            row = cursor.execute(
                f"""INSERT INTO paper_orders
                    (portfolio_id, instrument_id, idempotency_key, side, order_type,
                     status, symbol, instrument_name, exchange, quantity, limit_price,
                     reserved_cash, reserved_quantity, provider, price_at, received_at,
                     delay_class, expires_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s)
                    RETURNING {self._order_columns()}""",
                (
                    portfolio["id"],
                    instrument["id"],
                    submission.idempotency_key,
                    submission.side,
                    submission.order_type,
                    submission.initial_status,
                    submission.symbol,
                    submission.name,
                    submission.exchange,
                    submission.quantity,
                    submission.limit_price,
                    submission.reserved_cash,
                    submission.reserved_quantity,
                    submission.provider,
                    submission.price_at,
                    submission.received_at,
                    submission.delay_class,
                    submission.expires_at,
                ),
            ).fetchone()
            assert row is not None
            return self._order(row)

    def fill_order(
        self,
        user_id: str,
        order_id: str,
        execution: PaperExecution,
        max_holdings: int,
    ) -> tuple[PaperOrder, PaperTrade | None]:
        with (
            self._pool.connection() as connection,
            connection.transaction(),
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            portfolio = cursor.execute(
                """SELECT id, cash_balance, realized_pnl FROM paper_portfolios
                   WHERE user_id = %s FOR UPDATE""",
                (user_id,),
            ).fetchone()
            if portfolio is None:
                raise PortfolioConflictError("Không tìm thấy tài khoản mô phỏng.")
            order = cursor.execute(
                f"""SELECT {self._order_columns()}, instrument_id FROM paper_orders
                    WHERE id = %s AND portfolio_id = %s FOR UPDATE""",
                (order_id, portfolio["id"]),
            ).fetchone()
            if order is None:
                raise PortfolioConflictError("Không tìm thấy lệnh mô phỏng.")
            if order["status"] == "filled":
                trade = cursor.execute(
                    """SELECT id::text AS id, idempotency_key, side, symbol,
                              instrument_name, exchange, quantity, execution_price,
                              gross_amount, fee_rate, fee_amount, tax_rate, tax_amount,
                              cash_effect, realized_pnl, provider, price_at, received_at,
                              delay_class, created_at
                       FROM paper_trades WHERE order_id = %s""",
                    (order_id,),
                ).fetchone()
                return self._order(order), self._trade(trade) if trade else None
            if order["status"] not in {"pending", "open"}:
                return self._order(order), None
            if (
                order["side"] != execution.side
                or order["symbol"] != execution.symbol
                or int(order["quantity"]) != execution.quantity
            ):
                raise PortfolioConflictError("Dữ liệu khớp lệnh không khớp lệnh gốc.")
            holding = cursor.execute(
                """SELECT quantity, total_cost_basis FROM paper_holdings
                   WHERE portfolio_id = %s AND instrument_id = %s FOR UPDATE""",
                (portfolio["id"], order["instrument_id"]),
            ).fetchone()
            realized_pnl: Decimal | None = None
            if execution.side == "buy":
                debit = execution.gross_amount + execution.fee_amount
                if Decimal(portfolio["cash_balance"]) < debit:
                    raise InsufficientCashError("Số dư mô phỏng không đủ để khớp lệnh.")
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
                    int(holding["quantity"]) + execution.quantity if holding else execution.quantity
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
                    (portfolio["id"], order["instrument_id"], new_quantity, new_basis),
                )
                cash_effect = -debit
            else:
                if holding is None or int(holding["quantity"]) < execution.quantity:
                    raise InsufficientSharesError("Không đủ cổ phiếu mô phỏng để khớp lệnh bán.")
                old_quantity = int(holding["quantity"])
                old_basis = Decimal(holding["total_cost_basis"])
                allocated_basis = round_vnd(
                    old_basis * Decimal(execution.quantity) / Decimal(old_quantity)
                )
                net_proceeds = execution.gross_amount - execution.fee_amount - execution.tax_amount
                realized_pnl = net_proceeds - allocated_basis
                remaining_quantity = old_quantity - execution.quantity
                if remaining_quantity == 0:
                    cursor.execute(
                        "DELETE FROM paper_holdings WHERE portfolio_id = %s AND instrument_id = %s",
                        (portfolio["id"], order["instrument_id"]),
                    )
                else:
                    cursor.execute(
                        """UPDATE paper_holdings SET quantity = %s, total_cost_basis = %s,
                                  updated_at = now()
                           WHERE portfolio_id = %s AND instrument_id = %s""",
                        (
                            remaining_quantity,
                            old_basis - allocated_basis,
                            portfolio["id"],
                            order["instrument_id"],
                        ),
                    )
                cash_effect = net_proceeds

            trade = cursor.execute(
                """INSERT INTO paper_trades
                   (portfolio_id, instrument_id, order_id, idempotency_key, side, symbol,
                    instrument_name, exchange, quantity, execution_price, gross_amount,
                    fee_rate, fee_amount, tax_rate, tax_amount, cash_effect, realized_pnl,
                    provider, price_at, received_at, delay_class)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                           %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING id::text AS id, idempotency_key, side, symbol,
                             instrument_name, exchange, quantity, execution_price,
                             gross_amount, fee_rate, fee_amount, tax_rate, tax_amount,
                             cash_effect, realized_pnl, provider, price_at, received_at,
                             delay_class, created_at""",
                (
                    portfolio["id"],
                    order["instrument_id"],
                    order_id,
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
            updated = cursor.execute(
                f"""UPDATE paper_orders SET status = 'filled', filled_quantity = quantity,
                           reserved_cash = 0, reserved_quantity = 0, updated_at = now()
                    WHERE id = %s
                    RETURNING {self._order_columns()}""",
                (order_id,),
            ).fetchone()
            assert updated is not None
            cursor.execute(
                """UPDATE paper_portfolios
                   SET cash_balance = cash_balance + %s,
                       realized_pnl = realized_pnl + %s,
                       version = version + 1, updated_at = now()
                   WHERE id = %s""",
                (cash_effect, realized_pnl or Decimal(), portfolio["id"]),
            )
            return self._order(updated), self._trade(trade)

    def cancel_order(self, user_id: str, order_id: str) -> PaperOrder:
        with (
            self._pool.connection() as connection,
            connection.transaction(),
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = cursor.execute(
                f"""SELECT {self._order_columns()} FROM paper_orders
                    WHERE id = %s AND portfolio_id = (
                        SELECT id FROM paper_portfolios WHERE user_id = %s
                    ) FOR UPDATE""",
                (order_id, user_id),
            ).fetchone()
            if row is None:
                raise PortfolioConflictError("Không tìm thấy lệnh mô phỏng.")
            if row["status"] == "cancelled":
                return self._order(row)
            if row["status"] not in {"pending", "open"}:
                raise OrderNotCancellableError("Chỉ có thể hủy lệnh chưa khớp.")
            updated = cursor.execute(
                f"""UPDATE paper_orders SET status = 'cancelled', cancelled_at = now(),
                           reserved_cash = 0, reserved_quantity = 0, updated_at = now()
                    WHERE id = %s
                    RETURNING {self._order_columns()}""",
                (order_id,),
            ).fetchone()
            assert updated is not None
            return self._order(updated)

    def activate_order(self, user_id: str, order_id: str) -> PaperOrder:
        with (
            self._pool.connection() as connection,
            connection.transaction(),
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = cursor.execute(
                f"""UPDATE paper_orders o SET status = 'open', updated_at = now()
                    FROM paper_portfolios p
                    WHERE o.id = %s AND o.portfolio_id = p.id AND p.user_id = %s
                      AND o.status = 'pending' AND o.expires_at > now()
                    RETURNING {self._order_columns("o")}""",
                (order_id, user_id),
            ).fetchone()
            if row is None:
                raise PortfolioConflictError("Lệnh không còn ở trạng thái chờ xử lý.")
            return self._order(row)

    def expire_orders(self, user_id: str, now: datetime) -> int:
        with self._pool.connection() as connection, connection.transaction():
            result = connection.execute(
                """UPDATE paper_orders o SET status = 'expired', reserved_cash = 0,
                          reserved_quantity = 0, updated_at = now()
                   FROM paper_portfolios p
                   WHERE o.portfolio_id = p.id AND p.user_id = %s
                     AND o.status IN ('pending', 'open') AND o.expires_at <= %s""",
                (user_id, now),
            )
            return result.rowcount

    def set_public_status(
        self, user_id: str, is_public: bool, nickname: str | None = None
    ) -> PaperPortfolio:
        with self._pool.connection() as connection, connection.transaction():
            connection.execute(
                """UPDATE paper_portfolios
                   SET is_public = %s, nickname = %s, updated_at = now()
                   WHERE user_id = %s""",
                (is_public, nickname, user_id),
            )
        return self._load(user_id)

    def get_public_leaderboard(self, limit: int = 10) -> tuple[dict[str, Any], ...]:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            rows = cursor.execute(
                """SELECT p.id::text AS portfolio_id,
                          COALESCE(p.nickname, 'Nhà đầu tư ẩn danh') AS nickname,
                          p.starting_cash,
                          p.cash_balance,
                          p.realized_pnl,
                          ROUND(
                              (p.realized_pnl / NULLIF(p.starting_cash, 0)) * 100, 2
                          ) AS roi_percent,
                          COUNT(DISTINCT h.instrument_id) AS holding_count,
                          COUNT(DISTINCT t.id) AS total_trades,
                          COUNT(DISTINCT CASE WHEN t.realized_pnl > 0 THEN t.id END) AS win_trades
                   FROM paper_portfolios p
                   LEFT JOIN paper_holdings h ON h.portfolio_id = p.id
                   LEFT JOIN paper_trades t ON t.portfolio_id = p.id AND t.side = 'sell'
                   WHERE p.is_public = true
                   GROUP BY p.id, p.nickname, p.starting_cash, p.cash_balance, p.realized_pnl
                   ORDER BY p.realized_pnl DESC, roi_percent DESC
                   LIMIT %s""",
                (limit,),
            ).fetchall()
            return tuple(dict(r) for r in rows)

    def get_public_portfolio(self, portfolio_id: str) -> PaperPortfolio | None:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            portfolio = cursor.execute(
                """SELECT id::text AS id, user_id::text AS user_id, currency,
                          starting_cash, cash_balance, realized_pnl, version,
                          created_at, updated_at,
                          COALESCE(is_public, false) AS is_public, nickname
                   FROM paper_portfolios
                   WHERE id = %s AND is_public = true""",
                (portfolio_id,),
            ).fetchone()
            if portfolio is None:
                return None
            holdings = cursor.execute(
                """SELECT i.symbol, i.name, i.exchange, i.sector,
                          h.quantity, h.total_cost_basis
                   FROM paper_holdings h
                   JOIN market_instruments i ON i.id = h.instrument_id
                   WHERE h.portfolio_id = %s
                   ORDER BY h.updated_at DESC, i.symbol
                   LIMIT 50""",
                (portfolio["id"],),
            ).fetchall()
            trades = cursor.execute(
                """SELECT id::text AS id, idempotency_key, side, symbol,
                          instrument_name, exchange, quantity, execution_price,
                          gross_amount, fee_rate, fee_amount, tax_rate, tax_amount,
                          cash_effect, realized_pnl, provider, price_at, received_at,
                          delay_class, created_at
                   FROM paper_trades WHERE portfolio_id = %s
                   ORDER BY created_at DESC, id DESC LIMIT 50""",
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
            orders=(),
            trades=tuple(self._trade(row) for row in trades),
            is_public=True,
            nickname=str(portfolio["nickname"]) if portfolio.get("nickname") else None,
        )
