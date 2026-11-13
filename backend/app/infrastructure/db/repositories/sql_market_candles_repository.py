"""PostgreSQL persistence for historical market price candles."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from decimal import Decimal

from psycopg_pool import ConnectionPool

from app.domain.entities.market import Candle
from app.infrastructure.db.session import get_pool

logger = logging.getLogger("investiq.market.candles_repo")


class SqlMarketCandlesRepository:
    """Stores and retrieves historical OHLCV candles in PostgreSQL."""

    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool

    def _resolve_pool(self) -> ConnectionPool:
        return self._pool if self._pool is not None else get_pool()

    def upsert_candles(
        self,
        *,
        provider_slug: str,
        provider_name: str,
        symbol: str,
        exchange: str,
        name: str,
        instrument_type: str,
        interval: str,
        candles: Sequence[Candle],
    ) -> int:
        """Upsert market provider, instrument, and candles idempotently."""
        if not candles:
            return 0
        norm_sym = symbol.upper()
        norm_type = "index" if instrument_type == "index" else "stock"
        try:
            pool = self._resolve_pool()
            with pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO market_providers (slug, display_name, delay_class, status)
                    VALUES (%s, %s, 'source_delayed', 'active')
                    ON CONFLICT (slug) DO UPDATE SET
                        display_name = EXCLUDED.display_name,
                        status = 'active',
                        updated_at = now()
                    RETURNING id;
                    """,
                    (provider_slug, provider_name),
                )
                provider_row = cur.fetchone()
                if provider_row is None:
                    return 0
                provider_id = provider_row[0]

                cur.execute(
                    """
                    INSERT INTO market_instruments (
                        symbol, exchange, name, instrument_type, currency, status
                    )
                    VALUES (%s, %s, %s, %s, 'VND', 'active')
                    ON CONFLICT (exchange, symbol) DO UPDATE SET
                        name = EXCLUDED.name,
                        instrument_type = EXCLUDED.instrument_type,
                        status = 'active',
                        updated_at = now()
                    RETURNING id;
                    """,
                    (norm_sym, exchange, name, norm_type),
                )
                inst_row = cur.fetchone()
                if inst_row is None:
                    return 0
                instrument_id = inst_row[0]

                rows = []
                for c in candles:
                    o = max(Decimal("0"), c.open)
                    cl = max(Decimal("0"), c.close)
                    h = max(Decimal("0"), c.high, o, cl)
                    lo = max(Decimal("0"), min(c.low, o, cl))
                    vol = max(Decimal("0"), c.volume)
                    rows.append(
                        (
                            provider_id,
                            instrument_id,
                            interval,
                            c.timestamp,
                            o,
                            h,
                            lo,
                            cl,
                            vol,
                        )
                    )

                cur.executemany(
                    """
                    INSERT INTO market_price_candles (
                        provider_id, instrument_id, interval, open_time,
                        open_price, high_price, low_price, close_price,
                        volume, adjusted
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, false)
                    ON CONFLICT (provider_id, instrument_id, interval, open_time, adjusted)
                    DO UPDATE SET
                        open_price = EXCLUDED.open_price,
                        high_price = EXCLUDED.high_price,
                        low_price = EXCLUDED.low_price,
                        close_price = EXCLUDED.close_price,
                        volume = EXCLUDED.volume,
                        received_at = now();
                    """,
                    rows,
                )
                conn.commit()
            return len(rows)
        except Exception as exc:
            logger.debug(
                "sql_market_candles_upsert_failed",
                extra={"symbol": norm_sym, "interval": interval, "error": str(exc)},
            )
            return 0

    def get_candles(
        self,
        symbol: str,
        interval: str,
        limit: int = 500,
    ) -> tuple[Candle, ...]:
        """Return latest historical candles ordered chronologically."""
        norm_sym = symbol.upper()
        try:
            pool = self._resolve_pool()
            with pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT mpc.open_time, mpc.open_price, mpc.high_price,
                           mpc.low_price, mpc.close_price, mpc.volume
                    FROM market_price_candles mpc
                    JOIN market_instruments mi ON mi.id = mpc.instrument_id
                    WHERE mi.symbol = %s AND mpc.interval = %s AND mpc.adjusted = false
                    ORDER BY mpc.open_time DESC
                    LIMIT %s;
                    """,
                    (norm_sym, interval, max(1, min(limit, 1000))),
                )
                rows = cur.fetchall()
            if not rows:
                return ()
            return tuple(
                Candle(
                    timestamp=row[0],
                    open=Decimal(row[1]),
                    high=Decimal(row[2]),
                    low=Decimal(row[3]),
                    close=Decimal(row[4]),
                    volume=Decimal(row[5]),
                )
                for row in reversed(rows)
            )
        except Exception as exc:
            logger.debug(
                "sql_market_candles_get_failed",
                extra={"symbol": norm_sym, "interval": interval, "error": str(exc)},
            )
            return ()

    def count_candles(self, symbol: str | None = None, interval: str | None = None) -> int:
        """Count persisted market candles, optionally filtered by symbol and interval."""
        try:
            pool = self._resolve_pool()
            clauses: list[str] = []
            params: list[object] = []
            if symbol:
                clauses.append("mi.symbol = %s")
                params.append(symbol.upper())
            if interval:
                clauses.append("mpc.interval = %s")
                params.append(interval)
            where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
            with pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT COUNT(*)
                    FROM market_price_candles mpc
                    JOIN market_instruments mi ON mi.id = mpc.instrument_id
                    {where_sql};
                    """,
                    params,
                )
                row = cur.fetchone()
                return int(row[0]) if row else 0
        except Exception:
            return 0
