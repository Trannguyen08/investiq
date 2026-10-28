"""PostgreSQL repository for admin analytics, content moderation, and system monitoring."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.schemas.admin_ops import (
    AdminAlertItem,
    AdminAlertPage,
    AdminAnalyticsResponse,
    AdminAuditLogItem,
    AdminAuditLogPage,
    AdminMarketInstrumentItem,
    AdminMarketInstrumentPage,
    AdminOverviewResponse,
    AdminPortfolioDetail,
    AdminPortfolioItem,
    AdminPortfolioPage,
    AdminThesisItem,
    AdminThesisPage,
    AssetAllocationSummary,
    ExchangeLiquidityItem,
    PortfolioHoldingItem,
    PortfolioTradeItem,
    RecentAuditItem,
    SectorThesisItem,
    SourceStat,
    TopTradedSymbol,
    TopTraderItem,
    UserGrowthPoint,
)

_START_TIME = datetime.now(UTC)
_INSTRUMENT_OVERRIDES: dict[str, dict[str, Any]] = {}
_ALERT_RESOLUTIONS: dict[str, dict[str, Any]] = {}


class SqlAdminRepository:
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    def get_overview(self) -> AdminOverviewResponse:
        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # 1. User metrics
            user_row = (
                cur.execute(
                    """
                SELECT
                    count(*)::int AS total_users,
                    count(*) FILTER (WHERE status = 'active')::int AS active_users,
                    count(*) FILTER (WHERE status = 'disabled')::int AS disabled_users,
                    count(*) FILTER (WHERE role = 'admin')::int AS admin_users,
                    count(*) FILTER (WHERE created_at >= CURRENT_DATE)::int
                        AS new_users_today,
                    count(*) FILTER (WHERE created_at >= (NOW() - INTERVAL '7 days'))::int
                        AS new_users_7d,
                    count(*) FILTER (WHERE created_at >= (NOW() - INTERVAL '30 days'))::int
                        AS new_users_30d
                FROM users;
                """
                ).fetchone()
                or {}
            )

            # 2. Paper trading metrics
            portfolio_row = (
                cur.execute(
                    """
                SELECT
                    count(*)::int AS total_portfolios,
                    coalesce(sum(starting_cash), 0)::float AS total_starting_cash_vnd,
                    coalesce(sum(cash_balance), 0)::float AS total_cash_balance_vnd,
                    coalesce(sum(realized_pnl), 0)::float AS total_realized_pnl_vnd
                FROM paper_portfolios;
                """
                ).fetchone()
                or {}
            )

            trades_count_row = (
                cur.execute("SELECT count(*)::int AS total_trades FROM paper_trades;").fetchone()
                or {}
            )

            # Top 5 traded symbols
            top_symbols_rows = cur.execute(
                """
                SELECT
                    symbol,
                    count(*)::int AS trades_count,
                    coalesce(sum(gross_amount), 0)::float AS total_volume_vnd
                FROM paper_trades
                GROUP BY symbol
                ORDER BY trades_count DESC, total_volume_vnd DESC
                LIMIT 5;
                """
            ).fetchall()

            # 3. Theses / Community metrics
            theses_row = (
                cur.execute(
                    """
                SELECT
                    count(*)::int AS total_theses,
                    count(*) FILTER (WHERE status = 'active')::int AS active_theses,
                    count(*) FILTER (WHERE status = 'hit_target')::int AS hit_target_theses,
                    count(*) FILTER (WHERE status = 'stopped_out')::int AS stopped_out_theses,
                    count(*) FILTER (WHERE stance = 'bullish')::int AS bullish_theses,
                    count(*) FILTER (WHERE stance = 'bearish')::int AS bearish_theses,
                    count(*) FILTER (WHERE stance = 'neutral')::int AS neutral_theses
                FROM investment_theses;
                """
                ).fetchone()
                or {}
            )

            total_closed = (theses_row.get("hit_target_theses") or 0) + (
                theses_row.get("stopped_out_theses") or 0
            )
            win_rate = (
                round(
                    ((theses_row.get("hit_target_theses") or 0) / total_closed) * 100,
                    1,
                )
                if total_closed > 0
                else 0.0
            )

            # 4. News Pipeline metrics
            news_count_row = (
                cur.execute(
                    "SELECT count(*)::int AS total_news_articles FROM news_articles;"
                ).fetchone()
                or {}
            )

            sources_rows = cur.execute(
                """
                SELECT
                    s.slug AS source_slug,
                    s.name,
                    s.status,
                    s.last_success_at,
                    coalesce(a.count, 0)::int AS article_count
                FROM news_sources s
                LEFT JOIN (
                    SELECT source_id, count(*) AS count
                    FROM news_articles
                    GROUP BY source_id
                ) a ON a.source_id = s.id
                ORDER BY s.name;
                """
            ).fetchall()

            sentiments_rows = cur.execute(
                """
                SELECT
                    label,
                    count(*)::int AS count
                FROM sentiment_analyses
                WHERE is_current
                GROUP BY label;
                """
            ).fetchall()

            sentiment_map = {"positive": 0, "negative": 0, "neutral": 0}
            for row in sentiments_rows:
                lab = str(row["label"])
                if lab in sentiment_map:
                    sentiment_map[lab] = int(row["count"])

            # 5. Activity chart (last 7 days of signups and trades)
            days_series = [
                (datetime.now(UTC).date() - timedelta(days=i)).isoformat() for i in range(6, -1, -1)
            ]
            chart_signups = cur.execute(
                """
                SELECT created_at::date::text AS day, count(*)::int AS count
                FROM users
                WHERE created_at >= (CURRENT_DATE - INTERVAL '6 days')
                GROUP BY created_at::date;
                """
            ).fetchall()
            signup_by_day = {r["day"]: r["count"] for r in chart_signups}

            chart_trades = cur.execute(
                """
                SELECT created_at::date::text AS day, count(*)::int AS count
                FROM paper_trades
                WHERE created_at >= (CURRENT_DATE - INTERVAL '6 days')
                GROUP BY created_at::date;
                """
            ).fetchall()
            trade_by_day = {r["day"]: r["count"] for r in chart_trades}

            activity_chart = [
                UserGrowthPoint(
                    date=day,
                    new_users=signup_by_day.get(day, 0),
                    trades_count=trade_by_day.get(day, 0),
                )
                for day in days_series
            ]

            # 6. Recent audits
            recent_audits_rows = cur.execute(
                """
                SELECT
                    a.id::text,
                    a.occurred_at::text,
                    u.email AS actor_email,
                    a.event_type,
                    coalesce(a.details->>'target', a.details->>'slug', a.event_type) AS target,
                    a.outcome
                FROM auth_audit_events a
                LEFT JOIN users u ON u.id = a.actor_user_id
                ORDER BY a.occurred_at DESC
                LIMIT 5;
                """
            ).fetchall()

            uptime = int((datetime.now(UTC) - _START_TIME).total_seconds())

            active_sources_count = sum(1 for s in sources_rows if s["status"] == "active")

            return AdminOverviewResponse(
                total_users=user_row.get("total_users", 0),
                active_users=user_row.get("active_users", 0),
                disabled_users=user_row.get("disabled_users", 0),
                admin_users=user_row.get("admin_users", 0),
                new_users_today=user_row.get("new_users_today", 0),
                new_users_7d=user_row.get("new_users_7d", 0),
                new_users_30d=user_row.get("new_users_30d", 0),
                total_portfolios=portfolio_row.get("total_portfolios", 0),
                total_trades=trades_count_row.get("total_trades", 0),
                total_starting_cash_vnd=portfolio_row.get("total_starting_cash_vnd", 0.0),
                total_cash_balance_vnd=portfolio_row.get("total_cash_balance_vnd", 0.0),
                total_realized_pnl_vnd=portfolio_row.get("total_realized_pnl_vnd", 0.0),
                top_traded_symbols=[TopTradedSymbol(**r) for r in top_symbols_rows],
                total_theses=theses_row.get("total_theses", 0),
                active_theses=theses_row.get("active_theses", 0),
                hit_target_theses=theses_row.get("hit_target_theses", 0),
                stopped_out_theses=theses_row.get("stopped_out_theses", 0),
                theses_win_rate=win_rate,
                bullish_theses=theses_row.get("bullish_theses", 0),
                bearish_theses=theses_row.get("bearish_theses", 0),
                neutral_theses=theses_row.get("neutral_theses", 0),
                total_news_articles=news_count_row.get("total_news_articles", 0),
                active_news_sources=active_sources_count,
                total_news_sources=len(sources_rows),
                news_sources_stats=[
                    SourceStat(
                        source_slug=r["source_slug"],
                        name=r["name"],
                        article_count=r["article_count"],
                        status=r["status"],
                        last_success_at=str(r["last_success_at"]) if r["last_success_at"] else None,
                    )
                    for r in sources_rows
                ],
                news_sentiment_breakdown=sentiment_map,
                db_connected=True,
                redis_connected=True,
                uptime_seconds=uptime,
                activity_chart=activity_chart,
                recent_audits=[
                    RecentAuditItem(
                        id=str(r["id"]),
                        occurred_at=str(r["occurred_at"]),
                        actor_email=r["actor_email"],
                        event_type=r["event_type"],
                        target=r["target"],
                        outcome=r["outcome"],
                    )
                    for r in recent_audits_rows
                ],
            )

    def list_theses(
        self,
        symbol: str | None = None,
        status: str | None = None,
        stance: str | None = None,
        q: str | None = None,
        limit: int = 20,
        page: int = 1,
    ) -> AdminThesisPage:
        offset = max(0, (page - 1) * limit)
        conditions: list[str] = []
        params: list[Any] = []

        if symbol:
            conditions.append("t.symbol = %s")
            params.append(symbol.upper().strip())
        if status:
            conditions.append("t.status = %s")
            params.append(status.strip())
        if stance:
            conditions.append("t.stance = %s")
            params.append(stance.strip())
        if q:
            conditions.append("(t.title ILIKE %s OR t.author_name ILIKE %s OR u.email ILIKE %s)")
            like_val = f"%{q.strip()}%"
            params.extend([like_val, like_val, like_val])

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            count_sql = f"""
                SELECT count(*)::int AS total
                FROM investment_theses t
                LEFT JOIN users u ON u.id = t.user_id
                {where_clause};
            """
            count_row = cur.execute(count_sql, tuple(params)).fetchone()
            total = int(count_row["total"]) if count_row else 0

            data_sql = f"""
                SELECT
                    t.id::text,
                    t.user_id::text,
                    t.author_name,
                    u.email AS author_email,
                    t.symbol,
                    t.stance,
                    t.entry_price::float,
                    t.target_price::float,
                    t.stop_loss_price::float,
                    t.horizon_months,
                    t.title,
                    t.thesis_body,
                    t.catalysts,
                    t.status,
                    t.outcome_roi::float,
                    t.closed_at::text,
                    t.closed_price::float,
                    t.upvotes,
                    t.created_at::text,
                    t.updated_at::text
                FROM investment_theses t
                LEFT JOIN users u ON u.id = t.user_id
                {where_clause}
                ORDER BY t.created_at DESC
                LIMIT %s OFFSET %s;
            """
            rows = cur.execute(data_sql, (*params, limit, offset)).fetchall()

        items = [AdminThesisItem(**r) for r in rows]
        total_pages = max(1, (total + limit - 1) // limit)
        return AdminThesisPage(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )

    def get_thesis(self, thesis_id: str) -> AdminThesisItem | None:
        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            row = cur.execute(
                """
                SELECT
                    t.id::text,
                    t.user_id::text,
                    t.author_name,
                    u.email AS author_email,
                    t.symbol,
                    t.stance,
                    t.entry_price::float,
                    t.target_price::float,
                    t.stop_loss_price::float,
                    t.horizon_months,
                    t.title,
                    t.thesis_body,
                    t.catalysts,
                    t.status,
                    t.outcome_roi::float,
                    t.closed_at::text,
                    t.closed_price::float,
                    t.upvotes,
                    t.created_at::text,
                    t.updated_at::text
                FROM investment_theses t
                LEFT JOIN users u ON u.id = t.user_id
                WHERE t.id = %s;
                """,
                (thesis_id,),
            ).fetchone()
            if not row:
                return None
            return AdminThesisItem(**row)

    def update_thesis_status(
        self,
        thesis_id: str,
        status: str,
        actor_id: str,
        note: str | None = None,
        request_id: str = "unknown",
    ) -> AdminThesisItem | None:
        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                UPDATE investment_theses
                SET status = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING id;
                """,
                (status, thesis_id),
            )
            cur.execute(
                """
                INSERT INTO auth_audit_events
                    (actor_user_id, event_type, outcome, request_id, details)
                VALUES (%s, 'thesis.status_update', 'succeeded', %s, %s::jsonb);
                """,
                (
                    actor_id,
                    request_id,
                    json.dumps({"thesis_id": thesis_id, "new_status": status, "note": note}),
                ),
            )
        return self.get_thesis(thesis_id)

    def delete_thesis(self, thesis_id: str, actor_id: str, request_id: str = "unknown") -> bool:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "DELETE FROM investment_theses WHERE id = %s RETURNING id;",
                (thesis_id,),
            )
            deleted = cur.fetchone() is not None
            if deleted:
                cur.execute(
                    """
                    INSERT INTO auth_audit_events
                        (actor_user_id, event_type, outcome, request_id, details)
                    VALUES (%s, 'thesis.deleted', 'succeeded', %s, %s::jsonb);
                    """,
                    (actor_id, request_id, json.dumps({"thesis_id": thesis_id})),
                )
            return deleted

    def list_portfolios(
        self, q: str | None = None, limit: int = 20, page: int = 1
    ) -> AdminPortfolioPage:
        offset = max(0, (page - 1) * limit)
        conditions: list[str] = []
        params: list[Any] = []

        if q:
            conditions.append(
                "(u.email ILIKE %s OR u.display_name ILIKE %s OR p.nickname ILIKE %s)"
            )
            val = f"%{q.strip()}%"
            params.extend([val, val, val])

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            count_sql = f"""
                SELECT count(*)::int AS total
                FROM paper_portfolios p
                JOIN users u ON u.id = p.user_id
                {where_clause};
            """
            count_row = cur.execute(count_sql, tuple(params)).fetchone()
            total = int(count_row["total"]) if count_row else 0

            data_sql = f"""
                SELECT
                    p.id::text,
                    p.user_id::text,
                    u.email AS user_email,
                    u.display_name AS user_name,
                    p.starting_cash::float,
                    p.cash_balance::float,
                    p.realized_pnl::float,
                    p.is_public,
                    p.nickname,
                    (SELECT count(*)::int FROM paper_holdings h
                     WHERE h.portfolio_id = p.id) AS holdings_count,
                    (SELECT count(*)::int FROM paper_trades t
                     WHERE t.portfolio_id = p.id) AS trades_count,
                    p.created_at::text,
                    p.updated_at::text
                FROM paper_portfolios p
                JOIN users u ON u.id = p.user_id
                {where_clause}
                ORDER BY p.updated_at DESC
                LIMIT %s OFFSET %s;
            """
            rows = cur.execute(data_sql, (*params, limit, offset)).fetchall()

        items = [AdminPortfolioItem(**r) for r in rows]
        total_pages = max(1, (total + limit - 1) // limit)
        return AdminPortfolioPage(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )

    def get_portfolio_detail(self, portfolio_id: str) -> AdminPortfolioDetail | None:
        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            portfolio_row = cur.execute(
                """
                SELECT
                    p.id::text,
                    p.user_id::text,
                    u.email AS user_email,
                    u.display_name AS user_name,
                    p.starting_cash::float,
                    p.cash_balance::float,
                    p.realized_pnl::float,
                    p.is_public,
                    p.nickname,
                    (SELECT count(*)::int FROM paper_holdings h
                     WHERE h.portfolio_id = p.id) AS holdings_count,
                    (SELECT count(*)::int FROM paper_trades t
                     WHERE t.portfolio_id = p.id) AS trades_count,
                    p.created_at::text,
                    p.updated_at::text
                FROM paper_portfolios p
                JOIN users u ON u.id = p.user_id
                WHERE p.id = %s;
                """,
                (portfolio_id,),
            ).fetchone()
            if not portfolio_row:
                return None

            holdings_rows = cur.execute(
                """
                SELECT
                    m.symbol,
                    h.quantity,
                    h.total_cost_basis::float,
                    (h.total_cost_basis / NULLIF(h.quantity, 0))::float AS avg_price,
                    h.updated_at::text
                FROM paper_holdings h
                JOIN market_instruments m ON m.id = h.instrument_id
                WHERE h.portfolio_id = %s
                ORDER BY h.total_cost_basis DESC;
                """,
                (portfolio_id,),
            ).fetchall()

            trades_rows = cur.execute(
                """
                SELECT
                    t.id::text,
                    t.symbol,
                    t.side,
                    t.quantity,
                    t.execution_price::float,
                    t.gross_amount::float,
                    t.fee_amount::float,
                    t.tax_amount::float,
                    t.realized_pnl::float,
                    t.created_at::text
                FROM paper_trades t
                WHERE t.portfolio_id = %s
                ORDER BY t.created_at DESC
                LIMIT 20;
                """,
                (portfolio_id,),
            ).fetchall()

            return AdminPortfolioDetail(
                portfolio=AdminPortfolioItem(**portfolio_row),
                holdings=[PortfolioHoldingItem(**r) for r in holdings_rows],
                recent_trades=[PortfolioTradeItem(**r) for r in trades_rows],
            )

    def list_audit_logs(
        self,
        category: str | None = None,
        outcome: str | None = None,
        limit: int = 25,
        page: int = 1,
    ) -> AdminAuditLogPage:
        offset = max(0, (page - 1) * limit)
        conditions: list[str] = []
        params: list[Any] = []

        if outcome:
            conditions.append("a.outcome = %s")
            params.append(outcome.strip())
        if category:
            conditions.append("a.event_type ILIKE %s")
            params.append(f"%{category.strip()}%")

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            count_sql = f"""
                SELECT count(*)::int AS total
                FROM auth_audit_events a
                {where_clause};
            """
            count_row = cur.execute(count_sql, tuple(params)).fetchone()
            total = int(count_row["total"]) if count_row else 0

            data_sql = f"""
                SELECT
                    a.id::text,
                    'auth' AS source_type,
                    a.occurred_at::text,
                    a.actor_user_id::text AS actor_id,
                    u.email AS actor_email,
                    a.event_type,
                    coalesce(a.details->>'target', a.details->>'slug', a.event_type) AS target,
                    a.outcome,
                    a.request_id,
                    coalesce(a.details, '{{}}'::jsonb) AS details
                FROM auth_audit_events a
                LEFT JOIN users u ON u.id = a.actor_user_id
                {where_clause}
                ORDER BY a.occurred_at DESC
                LIMIT %s OFFSET %s;
            """
            rows = cur.execute(data_sql, (*params, limit, offset)).fetchall()

        items = [AdminAuditLogItem(**r) for r in rows]
        total_pages = max(1, (total + limit - 1) // limit)
        return AdminAuditLogPage(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )

    def get_audit_log_detail(self, log_id: str) -> AdminAuditLogItem | None:
        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            row = cur.execute(
                """
                SELECT
                    a.id::text,
                    'auth' AS source_type,
                    a.occurred_at::text,
                    a.actor_user_id::text AS actor_id,
                    u.email AS actor_email,
                    a.event_type,
                    coalesce(a.details->>'target', a.details->>'slug', a.event_type) AS target,
                    a.outcome,
                    a.request_id,
                    coalesce(a.details, '{{}}'::jsonb) AS details
                FROM auth_audit_events a
                LEFT JOIN users u ON u.id = a.actor_user_id
                WHERE a.id::text = %s;
                """,
                (log_id,),
            ).fetchone()
            if not row:
                return None
            return AdminAuditLogItem(**row)

    def list_market_instruments(
        self,
        symbol: str | None = None,
        exchange: str | None = None,
        sector: str | None = None,
        status: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> AdminMarketInstrumentPage:
        from app.api.v1.market_data import get_market_provider

        try:
            raw_instruments = get_market_provider().instruments()
        except Exception:
            raw_instruments = ()

        items: list[AdminMarketInstrumentItem] = []
        for inst in raw_instruments:
            override = _INSTRUMENT_OVERRIDES.get(inst.symbol, {})
            t_status = override.get("trading_status", "normal")
            pt_enabled = override.get("paper_trading_enabled", True)

            if symbol and symbol.upper() not in inst.symbol.upper():
                continue
            if exchange and exchange.upper() != inst.exchange.upper():
                continue
            if sector and sector.lower() not in (inst.sector or "").lower():
                continue
            if status and status != t_status:
                continue

            items.append(
                AdminMarketInstrumentItem(
                    symbol=inst.symbol,
                    name=inst.name,
                    exchange=inst.exchange,
                    sector=inst.sector,
                    price=float(inst.price),
                    reference_price=float(inst.reference_price),
                    ceiling_price=float(inst.ceiling_price),
                    floor_price=float(inst.floor_price),
                    volume=float(inst.volume),
                    matched_value=float(inst.matched_value),
                    pe=float(inst.pe) if inst.pe is not None else None,
                    pb=float(inst.pb) if inst.pb is not None else None,
                    market_cap=float(inst.market_cap) if inst.market_cap is not None else None,
                    is_vn30=bool(inst.is_vn30),
                    trading_status=t_status,
                    paper_trading_enabled=pt_enabled,
                )
            )

        total = len(items)
        total_market_cap = sum(x.market_cap or 0 for x in items)
        total_matched_val = sum(x.matched_value for x in items)

        offset = max(0, (page - 1) * limit)
        paginated_items = items[offset : offset + limit]
        total_pages = max(1, (total + limit - 1) // limit)

        return AdminMarketInstrumentPage(
            items=paginated_items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
            total_market_cap_vnd=total_market_cap,
            total_matched_value_vnd=total_matched_val,
        )

    def update_market_instrument_status(
        self,
        symbol: str,
        trading_status: str | None,
        paper_trading_enabled: bool | None,
        actor_id: str,
        request_id: str = "unknown",
    ) -> AdminMarketInstrumentItem | None:
        sym = symbol.upper()
        if sym not in _INSTRUMENT_OVERRIDES:
            _INSTRUMENT_OVERRIDES[sym] = {"trading_status": "normal", "paper_trading_enabled": True}

        if trading_status is not None:
            _INSTRUMENT_OVERRIDES[sym]["trading_status"] = trading_status
        if paper_trading_enabled is not None:
            _INSTRUMENT_OVERRIDES[sym]["paper_trading_enabled"] = paper_trading_enabled

        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO auth_audit_events
                    (actor_user_id, event_type, outcome, request_id, details)
                VALUES (%s, 'market.instrument_status_update', 'succeeded', %s, %s::jsonb);
                """,
                (
                    actor_id,
                    request_id,
                    json.dumps(
                        {
                            "symbol": sym,
                            "trading_status": _INSTRUMENT_OVERRIDES[sym]["trading_status"],
                            "paper_trading_enabled": _INSTRUMENT_OVERRIDES[sym][
                                "paper_trading_enabled"
                            ],
                        }
                    ),
                ),
            )

        res = self.list_market_instruments(symbol=sym, limit=1)
        return res.items[0] if res.items else None

    def list_alerts(
        self,
        severity: str | None = None,
        status: str | None = None,
        category: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> AdminAlertPage:
        all_alerts: list[AdminAlertItem] = []

        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # 1. Whale Trades
            trade_rows = cur.execute(
                """
                SELECT
                    pt.id::text,
                    pt.symbol,
                    pt.side,
                    pt.quantity::int,
                    pt.execution_price::float,
                    pt.gross_amount::float,
                    pt.created_at::text,
                    u.display_name AS user_name,
                    u.email AS user_email
                FROM paper_trades pt
                JOIN paper_portfolios pp ON pp.id = pt.portfolio_id
                JOIN users u ON u.id = pp.user_id
                WHERE pt.quantity >= 2000 OR pt.gross_amount >= 50000000
                ORDER BY pt.created_at DESC
                LIMIT 15;
                """
            ).fetchall()

            for r in trade_rows:
                alert_id = f"whale_{r['id']}"
                res = _ALERT_RESOLUTIONS.get(alert_id, {})
                cur_status = res.get("status", "active")
                sev = "high" if r["gross_amount"] >= 200_000_000 else "medium"
                desc = (
                    f"Nhà đầu tư {r['user_name']} ({r['user_email']}) đặt lệnh "
                    f"{r['side'].upper()} {r['quantity']:,} {r['symbol']} "
                    f"trị giá {r['gross_amount']:,.0f} VND."
                )
                all_alerts.append(
                    AdminAlertItem(
                        id=alert_id,
                        category="whale_trade",
                        severity=sev,
                        title=f"Lệnh lớn: {r['side'].upper()} {r['quantity']:,} {r['symbol']}",
                        description=desc,
                        entity_type="trade",
                        entity_id=r["id"],
                        occurred_at=r["created_at"],
                        status=cur_status,
                        resolved_at=res.get("resolved_at"),
                        resolved_by=res.get("resolved_by"),
                        action_suggested="Kiểm tra tính minh bạch và giới hạn ký quỹ tài khoản.",
                    )
                )

            # 2. Crawler failures
            crawl_rows = cur.execute(
                """
                SELECT
                    cr.id::text,
                    cr.source_id::text,
                    cr.status,
                    cr.error_code,
                    cr.failed_count,
                    cr.started_at::text,
                    s.name AS source_name
                FROM crawl_runs cr
                LEFT JOIN news_sources s ON s.id = cr.source_id
                WHERE cr.status IN ('failed', 'degraded') OR cr.failed_count > 0
                ORDER BY cr.started_at DESC
                LIMIT 10;
                """
            ).fetchall()

            for cr in crawl_rows:
                alert_id = f"crawl_{cr['id']}"
                res = _ALERT_RESOLUTIONS.get(alert_id, {})
                cur_status = res.get("status", "active")
                err_text = cr["error_code"] or "TIMEOUT"
                all_alerts.append(
                    AdminAlertItem(
                        id=alert_id,
                        category="crawler_failure",
                        severity="high" if cr["status"] == "failed" else "medium",
                        title=f"Lỗi Crawler: {cr['source_name'] or 'Nguồn tin'}",
                        description=(
                            f"Tiến trình thu thập bị gián đoạn với mã lỗi {err_text} "
                            f"({cr['failed_count']} bài lỗi)."
                        ),
                        entity_type="crawler",
                        entity_id=cr["id"],
                        occurred_at=cr["started_at"],
                        status=cur_status,
                        resolved_at=res.get("resolved_at"),
                        resolved_by=res.get("resolved_by"),
                        action_suggested="Kiểm tra cấu hình parser RSS/HTML và kết nối mạng.",
                    )
                )

            # 3. Security anomalies
            audit_rows = cur.execute(
                """
                SELECT
                    a.id::text,
                    a.event_type,
                    a.outcome,
                    a.actor_user_id::text,
                    u.email AS actor_email,
                    a.occurred_at::text,
                    coalesce(a.details->>'reason', a.details->>'ip', a.event_type) AS reason
                FROM auth_audit_events a
                LEFT JOIN users u ON u.id = a.actor_user_id
                WHERE a.outcome IN ('denied', 'failed')
                ORDER BY a.occurred_at DESC
                LIMIT 10;
                """
            ).fetchall()

            for ar in audit_rows:
                alert_id = f"sec_{ar['id']}"
                res = _ALERT_RESOLUTIONS.get(alert_id, {})
                cur_status = res.get("status", "active")
                actor_desc = ar["actor_email"] or "Khách ẩn danh"
                all_alerts.append(
                    AdminAlertItem(
                        id=alert_id,
                        category="security_anomaly",
                        severity="medium",
                        title=f"Truy cập thất bại: {ar['event_type']}",
                        description=(
                            f"Yêu cầu từ {actor_desc} bị từ chối ({ar['outcome']}). "
                            f"Lý do: {ar['reason']}."
                        ),
                        entity_type="user",
                        entity_id=ar["actor_user_id"] or ar["id"],
                        occurred_at=ar["occurred_at"],
                        status=cur_status,
                        resolved_at=res.get("resolved_at"),
                        resolved_by=res.get("resolved_by"),
                        action_suggested="Theo dõi tần suất đăng nhập từ địa chỉ IP nghi vấn.",
                    )
                )

        all_alerts.sort(key=lambda x: x.occurred_at, reverse=True)

        filtered: list[AdminAlertItem] = []
        for a in all_alerts:
            if severity and a.severity != severity:
                continue
            if status and a.status != status:
                continue
            if category and a.category != category:
                continue
            filtered.append(a)

        high_count = sum(1 for a in all_alerts if a.severity == "high" and a.status == "active")
        medium_count = sum(1 for a in all_alerts if a.severity == "medium" and a.status == "active")
        low_count = sum(1 for a in all_alerts if a.severity == "low" and a.status == "active")
        active_count = sum(1 for a in all_alerts if a.status == "active")

        total = len(filtered)
        offset = max(0, (page - 1) * limit)
        paginated_items = filtered[offset : offset + limit]
        total_pages = max(1, (total + limit - 1) // limit)

        return AdminAlertPage(
            items=paginated_items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
            high_count=high_count,
            medium_count=medium_count,
            low_count=low_count,
            active_count=active_count,
        )

    def update_alert_status(
        self,
        alert_id: str,
        new_status: str,
        actor_id: str,
        note: str | None = None,
        request_id: str = "unknown",
    ) -> bool:
        _ALERT_RESOLUTIONS[alert_id] = {
            "status": new_status,
            "resolved_at": datetime.now(UTC).isoformat(),
            "resolved_by": actor_id,
            "note": note,
        }

        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO auth_audit_events
                    (actor_user_id, event_type, outcome, request_id, details)
                VALUES (%s, 'alert.status_update', 'succeeded', %s, %s::jsonb);
                """,
                (
                    actor_id,
                    request_id,
                    json.dumps({"alert_id": alert_id, "status": new_status, "note": note}),
                ),
            )
        return True

    def get_analytics(self) -> AdminAnalyticsResponse:
        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # 1. Top traders
            trader_rows = cur.execute(
                """
                SELECT
                    pp.id::text,
                    pp.user_id::text,
                    u.display_name AS user_name,
                    u.email AS user_email,
                    pp.nickname,
                    pp.starting_cash::float,
                    pp.cash_balance::float,
                    pp.realized_pnl::float,
                    CASE WHEN pp.starting_cash > 0
                        THEN round((pp.realized_pnl / pp.starting_cash * 100)::numeric, 2)::float
                        ELSE 0.0
                    END AS roi_percent,
                    coalesce(
                        round(
                            (count(pt.id) FILTER (WHERE pt.realized_pnl > 0)::numeric
                             / NULLIF(
                                 count(pt.id) FILTER (WHERE pt.side = 'sell'), 0
                             ) * 100)::numeric,
                            1
                        )::float,
                        0.0
                    ) AS win_rate,
                    count(pt.id)::int AS total_trades,
                    (SELECT count(*)::int FROM paper_holdings ph
                     WHERE ph.portfolio_id = pp.id AND ph.quantity > 0) AS holdings_count
                FROM paper_portfolios pp
                JOIN users u ON u.id = pp.user_id
                LEFT JOIN paper_trades pt ON pt.portfolio_id = pp.id
                GROUP BY
                    pp.id, pp.user_id, u.display_name, u.email,
                    pp.nickname, pp.starting_cash, pp.cash_balance, pp.realized_pnl
                ORDER BY pp.realized_pnl DESC, roi_percent DESC
                LIMIT 10;
                """
            ).fetchall()

            top_traders = [
                TopTraderItem(
                    rank=idx + 1,
                    user_id=r["user_id"],
                    user_name=r["user_name"],
                    user_email=r["user_email"],
                    nickname=r["nickname"],
                    starting_cash=r["starting_cash"],
                    cash_balance=r["cash_balance"],
                    realized_pnl=r["realized_pnl"],
                    roi_percent=r["roi_percent"],
                    win_rate=r["win_rate"],
                    total_trades=r["total_trades"],
                    holdings_count=r["holdings_count"],
                )
                for idx, r in enumerate(trader_rows)
            ]

            # 2. Asset Allocation
            cash_row = (
                cur.execute(
                    """
                    SELECT coalesce(sum(cash_balance), 0)::float AS total_cash
                    FROM paper_portfolios;
                    """
                ).fetchone()
                or {}
            )
            equity_row = (
                cur.execute(
                    """
                    SELECT coalesce(sum(quantity * avg_price), 0)::float AS total_equity
                    FROM paper_holdings WHERE quantity > 0;
                    """
                ).fetchone()
                or {}
            )

            total_cash = float(cash_row.get("total_cash", 0))
            total_equity = float(equity_row.get("total_equity", 0))
            total_assets = max(1.0, total_cash + total_equity)
            cash_share = round((total_cash / total_assets) * 100, 1)
            equity_share = round((total_equity / total_assets) * 100, 1)

            asset_alloc = AssetAllocationSummary(
                total_cash_vnd=total_cash,
                total_equity_vnd=total_equity,
                cash_share_percent=cash_share,
                equity_share_percent=equity_share,
            )

            # 3. Sector Theses Performance
            sector_rows = cur.execute(
                """
                SELECT
                    coalesce(mi.sector, 'Khác') AS sector,
                    count(t.id)::int AS theses_count,
                    coalesce(
                        round(
                            (count(t.id) FILTER (WHERE t.status = 'hit_target')::numeric
                             / NULLIF(count(t.id) FILTER (
                                 WHERE t.status IN ('hit_target', 'stopped_out')
                             ), 0) * 100)::numeric,
                            1
                        )::float,
                        0.0
                    ) AS win_rate,
                    count(t.id) FILTER (WHERE t.stance = 'bullish')::int AS bullish_count,
                    count(t.id) FILTER (WHERE t.stance = 'bearish')::int AS bearish_count
                FROM investment_theses t
                LEFT JOIN market_instruments mi ON mi.symbol = t.symbol
                GROUP BY coalesce(mi.sector, 'Khác')
                ORDER BY theses_count DESC;
                """
            ).fetchall()

            sector_theses = [
                SectorThesisItem(
                    sector=r["sector"],
                    theses_count=r["theses_count"],
                    win_rate=r["win_rate"],
                    bullish_count=r["bullish_count"],
                    bearish_count=r["bearish_count"],
                )
                for r in sector_rows
            ]

            # 4. Exchange Liquidity from instruments
            from app.api.v1.market_data import get_market_provider

            try:
                insts = get_market_provider().instruments()
            except Exception:
                insts = ()

            exchange_map: dict[str, dict[str, Any]] = {}
            total_matched = 0.0
            for it in insts:
                ex = it.exchange.upper()
                if ex not in exchange_map:
                    exchange_map[ex] = {"count": 0, "value": 0.0}
                exchange_map[ex]["count"] += 1
                exchange_map[ex]["value"] += float(it.matched_value)
                total_matched += float(it.matched_value)

            exchange_liquidity = [
                ExchangeLiquidityItem(
                    exchange=ex,
                    total_symbols=data["count"],
                    total_value_vnd=data["value"],
                    share_percent=round((data["value"] / max(1.0, total_matched)) * 100, 1),
                )
                for ex, data in sorted(
                    exchange_map.items(), key=lambda x: x[1]["value"], reverse=True
                )
            ]

            avg_roi = 0.0
            if top_traders:
                avg_roi = round(sum(t.roi_percent for t in top_traders) / len(top_traders), 2)

            return AdminAnalyticsResponse(
                generated_at=datetime.now(UTC).isoformat(),
                top_traders=top_traders,
                exchange_liquidity=exchange_liquidity,
                asset_allocation=asset_alloc,
                sector_theses=sector_theses,
                total_capital_deployed_vnd=total_equity,
                average_portfolio_roi=avg_roi,
            )
