"""PostgreSQL repository for admin analytics, content moderation, and system monitoring."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.schemas.admin_ops import (
    AdminAuditLogItem,
    AdminAuditLogPage,
    AdminOverviewResponse,
    AdminPortfolioDetail,
    AdminPortfolioItem,
    AdminPortfolioPage,
    AdminThesisItem,
    AdminThesisPage,
    PortfolioHoldingItem,
    PortfolioTradeItem,
    RecentAuditItem,
    SourceStat,
    TopTradedSymbol,
    UserGrowthPoint,
)

_START_TIME = datetime.now(UTC)


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
