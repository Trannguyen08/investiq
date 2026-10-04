"""PostgreSQL persistence for user-owned watchlists."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool


class WatchlistConflictError(ValueError):
    pass


class WatchlistNotFoundError(ValueError):
    pass


class SqlWatchlistRepository:
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    def list(self, user_id: str) -> list[dict[str, object]]:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            rows = cursor.execute(
                """SELECT w.id::text AS id, w.name, w.position, w.version,
                          w.created_at, w.updated_at,
                          COALESCE(
                            jsonb_agg(
                              jsonb_build_object(
                                'symbol', i.symbol,
                                'name', i.name,
                                'exchange', i.exchange,
                                'sector', i.sector,
                                'position', wi.position,
                                'added_at', wi.created_at
                              ) ORDER BY wi.position, wi.created_at
                            ) FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb
                          ) AS items
                   FROM watchlists w
                   LEFT JOIN watchlist_items wi ON wi.watchlist_id = w.id
                   LEFT JOIN market_instruments i ON i.id = wi.instrument_id
                   WHERE w.user_id = %s
                   GROUP BY w.id
                   ORDER BY w.position, w.created_at
                   LIMIT 50""",
                (user_id,),
            ).fetchall()
            return [self._watchlist(row) for row in rows]

    def create(self, user_id: str, name: str) -> dict[str, object]:
        try:
            with (
                self._pool.connection() as connection,
                connection.transaction(),
                connection.cursor(row_factory=dict_row) as cursor,
            ):
                row = cursor.execute(
                    """INSERT INTO watchlists (user_id, name, position)
                       VALUES (%s, %s, (
                         SELECT COALESCE(max(position), -1) + 1 FROM watchlists WHERE user_id = %s
                       ))
                       RETURNING id::text AS id, name, position, version, created_at, updated_at""",
                    (user_id, name.strip(), user_id),
                ).fetchone()
                assert row is not None
                return self._watchlist({**row, "items": []})
        except UniqueViolation as exc:
            raise WatchlistConflictError("Tên watchlist đã tồn tại") from exc

    def delete(self, user_id: str, watchlist_id: str) -> bool:
        with self._pool.connection() as connection, connection.transaction():
            result = connection.execute(
                "DELETE FROM watchlists WHERE id = %s AND user_id = %s",
                (watchlist_id, user_id),
            )
            return result.rowcount > 0

    def add_item(
        self,
        user_id: str,
        watchlist_id: str,
        instrument: Mapping[str, str],
    ) -> None:
        with (
            self._pool.connection() as connection,
            connection.transaction(),
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            owned = cursor.execute(
                "SELECT id FROM watchlists WHERE id = %s AND user_id = %s FOR UPDATE",
                (watchlist_id, user_id),
            ).fetchone()
            if not owned:
                raise WatchlistNotFoundError("Không tìm thấy watchlist")
            row = cursor.execute(
                """INSERT INTO market_instruments (symbol, exchange, name, sector)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT (exchange, symbol) DO UPDATE
                   SET name = EXCLUDED.name, sector = EXCLUDED.sector, updated_at = now()
                   RETURNING id""",
                (
                    instrument["symbol"],
                    instrument["exchange"],
                    instrument["name"],
                    instrument["sector"],
                ),
            ).fetchone()
            assert row is not None
            inserted = cursor.execute(
                """INSERT INTO watchlist_items (watchlist_id, instrument_id, position)
                   VALUES (%s, %s, (
                     SELECT COALESCE(max(position), -1) + 1
                     FROM watchlist_items WHERE watchlist_id = %s
                   )) ON CONFLICT (watchlist_id, instrument_id) DO NOTHING""",
                (watchlist_id, row["id"], watchlist_id),
            )
            if inserted.rowcount:
                cursor.execute(
                    "UPDATE watchlists SET version = version + 1, updated_at = now() WHERE id = %s",
                    (watchlist_id,),
                )

    def remove_item(self, user_id: str, watchlist_id: str, symbol: str) -> bool:
        with self._pool.connection() as connection, connection.transaction():
            result = connection.execute(
                """DELETE FROM watchlist_items wi USING watchlists w, market_instruments i
                   WHERE wi.watchlist_id = w.id AND wi.instrument_id = i.id
                     AND w.id = %s AND w.user_id = %s AND i.symbol = %s""",
                (watchlist_id, user_id, symbol),
            )
            if result.rowcount:
                connection.execute(
                    "UPDATE watchlists SET version = version + 1, updated_at = now() WHERE id = %s",
                    (watchlist_id,),
                )
            return result.rowcount > 0

    @staticmethod
    def _watchlist(row: Mapping[str, Any]) -> dict[str, object]:
        return {
            "id": str(row["id"]),
            "name": str(row["name"]),
            "position": int(row["position"]),
            "version": int(row["version"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "items": list(row.get("items") or []),
        }
