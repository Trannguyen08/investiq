"""Repository for paper portfolio daily report subscriptions."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from psycopg_pool import ConnectionPool

logger = logging.getLogger(__name__)

_MEM_STORE: dict[str, dict[str, Any]] = {}


class SqlPaperReportRepository:
    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool

    def get_subscription(self, user_id: str) -> dict[str, Any] | None:
        if self._pool is None:
            return _MEM_STORE.get(user_id)
        try:
            with self._pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                        SELECT id, user_id, email, is_active, last_sent_at, created_at, updated_at
                        FROM paper_portfolio_daily_reports
                        WHERE user_id = %s;
                        """,
                    (user_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return {
                    "id": str(row[0]),
                    "user_id": str(row[1]),
                    "email": str(row[2]),
                    "is_active": bool(row[3]),
                    "last_sent_at": row[4],
                    "created_at": row[5],
                    "updated_at": row[6],
                }
        except Exception as exc:
            logger.warning("Failed to fetch paper report sub from DB, using fallback: %s", exc)
            return _MEM_STORE.get(user_id)

    def upsert_subscription(
        self, user_id: str, email: str, is_active: bool = True
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        record = {
            "id": str(uuid4()),
            "user_id": user_id,
            "email": email.strip().lower(),
            "is_active": is_active,
            "last_sent_at": None,
            "created_at": now,
            "updated_at": now,
        }
        _MEM_STORE[user_id] = record

        if self._pool is None:
            return record

        try:
            with self._pool.connection() as conn, conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO paper_portfolio_daily_reports (user_id, email, is_active, updated_at)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (user_id) DO UPDATE
                        SET email = EXCLUDED.email,
                            is_active = EXCLUDED.is_active,
                            updated_at = EXCLUDED.updated_at
                        RETURNING id, user_id, email, is_active, last_sent_at, created_at, updated_at;
                        """,
                        (user_id, email.strip().lower(), is_active, now),
                    )
                    row = cur.fetchone()
                    conn.commit()
                    if row:
                        return {
                            "id": str(row[0]),
                            "user_id": str(row[1]),
                            "email": str(row[2]),
                            "is_active": bool(row[3]),
                            "last_sent_at": row[4],
                            "created_at": row[5],
                            "updated_at": row[6],
                        }
        except Exception as exc:
            logger.warning("Failed to upsert paper report sub in DB: %s", exc)

        return record

    def list_active_subscriptions(self) -> list[dict[str, Any]]:
        if self._pool is None:
            return [sub for sub in _MEM_STORE.values() if sub.get("is_active")]
        try:
            with self._pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                        SELECT id, user_id, email, is_active, last_sent_at, created_at, updated_at
                        FROM paper_portfolio_daily_reports
                        WHERE is_active = TRUE;
                        """
                )
                rows = cur.fetchall()
                return [
                    {
                        "id": str(r[0]),
                        "user_id": str(r[1]),
                        "email": str(r[2]),
                        "is_active": bool(r[3]),
                        "last_sent_at": r[4],
                        "created_at": r[5],
                        "updated_at": r[6],
                    }
                    for r in rows
                ]
        except Exception as exc:
            logger.warning("Failed to list active paper report subs from DB: %s", exc)
            return [sub for sub in _MEM_STORE.values() if sub.get("is_active")]

    def mark_sent(self, user_id: str, sent_at: datetime | None = None) -> None:
        target_time = sent_at or datetime.now(UTC)
        if user_id in _MEM_STORE:
            _MEM_STORE[user_id]["last_sent_at"] = target_time

        if self._pool is None:
            return

        try:
            with self._pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                        UPDATE paper_portfolio_daily_reports
                        SET last_sent_at = %s, updated_at = %s
                        WHERE user_id = %s;
                        """,
                    (target_time, target_time, user_id),
                )
                conn.commit()
        except Exception as exc:
            logger.warning("Failed to mark paper report sent in DB: %s", exc)


def get_paper_report_repository() -> SqlPaperReportRepository:
    from app.infrastructure.db.session import get_pool

    try:
        pool = get_pool()
        return SqlPaperReportRepository(pool)
    except Exception:
        return SqlPaperReportRepository(None)
