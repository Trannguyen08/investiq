"""PostgreSQL repository for community investment theses and analyst reputation."""

from __future__ import annotations

from collections.abc import Mapping
from decimal import Decimal
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.domain.entities.thesis import AnalystReputation, InvestmentThesis
from app.domain.repositories.i_thesis_repository import IThesisRepository


class SqlThesisRepository(IThesisRepository):
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    @staticmethod
    def _map_thesis(row: Mapping[str, Any]) -> InvestmentThesis:
        catalysts_raw = row.get("catalysts")
        catalysts = tuple(catalysts_raw) if isinstance(catalysts_raw, list) else ()
        return InvestmentThesis(
            id=str(row["id"]),
            user_id=str(row["user_id"]),
            author_name=str(row["author_name"]),
            symbol=str(row["symbol"]),
            stance=str(row["stance"]),
            entry_price=Decimal(str(row["entry_price"])),
            target_price=Decimal(str(row["target_price"])),
            stop_loss_price=Decimal(str(row["stop_loss_price"])),
            horizon_months=int(row["horizon_months"]),
            title=str(row["title"]),
            thesis_body=str(row["thesis_body"]),
            catalysts=catalysts,
            status=str(row["status"]),
            outcome_roi=Decimal(str(row["outcome_roi"]))
            if row.get("outcome_roi") is not None
            else None,
            closed_at=row.get("closed_at"),
            closed_price=Decimal(str(row["closed_price"]))
            if row.get("closed_price") is not None
            else None,
            upvotes=int(row.get("upvotes", 0)),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

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
        with (
            self._pool.connection() as connection,
            connection.transaction(),
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = cursor.execute(
                """INSERT INTO investment_theses (
                       user_id, author_name, symbol, stance, entry_price,
                       target_price, stop_loss_price, horizon_months, title,
                       thesis_body, catalysts, status, created_at, updated_at
                   ) VALUES (
                       %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active', now(), now()
                   ) RETURNING *""",
                (
                    user_id,
                    author_name,
                    symbol.upper(),
                    stance,
                    entry_price,
                    target_price,
                    stop_loss_price,
                    horizon_months,
                    title,
                    thesis_body,
                    list(catalysts),
                ),
            ).fetchone()
            if row is None:
                raise RuntimeError("Failed to create investment thesis")
            return self._map_thesis(row)

    def list_all(
        self,
        symbol: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[InvestmentThesis, ...]:
        query = "SELECT * FROM investment_theses WHERE 1=1"
        params: list[Any] = []

        if symbol:
            query += " AND symbol = %s"
            params.append(symbol.upper())
        if status:
            query += " AND status = %s"
            params.append(status)

        query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            rows = cursor.execute(query, params).fetchall()
            return tuple(self._map_thesis(r) for r in rows)

    def get_by_id(self, thesis_id: str) -> InvestmentThesis | None:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = cursor.execute(
                "SELECT * FROM investment_theses WHERE id = %s",
                (thesis_id,),
            ).fetchone()
            return self._map_thesis(row) if row else None

    def update_evaluation(
        self,
        thesis_id: str,
        status: str,
        outcome_roi: Decimal,
        closed_price: Decimal,
    ) -> InvestmentThesis:
        with (
            self._pool.connection() as connection,
            connection.transaction(),
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = cursor.execute(
                """UPDATE investment_theses
                   SET status = %s, outcome_roi = %s, closed_price = %s,
                       closed_at = now(), updated_at = now()
                   WHERE id = %s
                   RETURNING *""",
                (status, outcome_roi, closed_price, thesis_id),
            ).fetchone()
            if row is None:
                raise ValueError(f"Thesis {thesis_id} not found")
            return self._map_thesis(row)

    def upvote(self, thesis_id: str) -> int:
        with (
            self._pool.connection() as connection,
            connection.transaction(),
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = cursor.execute(
                """UPDATE investment_theses
                   SET upvotes = upvotes + 1, updated_at = now()
                   WHERE id = %s
                   RETURNING upvotes""",
                (thesis_id,),
            ).fetchone()
            return int(row["upvotes"]) if row else 0

    def get_leaderboard(self, limit: int = 10) -> tuple[AnalystReputation, ...]:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            rows = cursor.execute(
                """SELECT user_id::text AS user_id,
                          author_name,
                          COUNT(*) AS total_theses,
                          COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_theses,
                          COUNT(CASE WHEN status = 'hit_target' THEN 1 END) AS successful_theses,
                          COUNT(CASE WHEN status = 'stopped_out' THEN 1 END) AS stopped_theses,
                          COALESCE(
                              ROUND(
                                  COUNT(CASE WHEN status = 'hit_target' THEN 1 END)::numeric /
                                  NULLIF(
                                      COUNT(
                                          CASE
                                              WHEN status IN ('hit_target', 'stopped_out') THEN 1
                                          END
                                      ),
                                      0
                                  ) * 100,
                                  2
                              ),
                              0.0
                          ) AS win_rate_percent,
                          COALESCE(ROUND(AVG(outcome_roi), 2), 0.0) AS avg_roi_percent
                   FROM investment_theses
                   GROUP BY user_id, author_name
                   ORDER BY successful_theses DESC, win_rate_percent DESC, total_theses DESC
                   LIMIT %s""",
                (limit,),
            ).fetchall()

            result: list[AnalystReputation] = []
            for r in rows:
                win_rate = Decimal(str(r["win_rate_percent"]))
                total = int(r["total_theses"])
                if win_rate >= 70 and total >= 5:
                    tier = "Grandmaster"
                elif win_rate >= 55 and total >= 3:
                    tier = "Senior Analyst"
                elif total >= 2:
                    tier = "Active Analyst"
                else:
                    tier = "Rising Star"

                result.append(
                    AnalystReputation(
                        user_id=str(r["user_id"]),
                        author_name=str(r["author_name"]),
                        total_theses=total,
                        active_theses=int(r["active_theses"]),
                        successful_theses=int(r["successful_theses"]),
                        stopped_theses=int(r["stopped_theses"]),
                        win_rate_percent=win_rate,
                        avg_roi_percent=Decimal(str(r["avg_roi_percent"])),
                        rank_tier=tier,
                    )
                )
            return tuple(result)

    def list_by_user(self, user_id: str) -> tuple[InvestmentThesis, ...]:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            rows = cursor.execute(
                "SELECT * FROM investment_theses WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
            return tuple(self._map_thesis(r) for r in rows)
