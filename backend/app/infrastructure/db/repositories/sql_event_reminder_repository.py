"""PostgreSQL and in-memory fallback repository for corporate event email reminders."""

from __future__ import annotations

import builtins
import logging
from datetime import UTC, datetime, timedelta
from threading import RLock
from typing import Any
from uuid import uuid4

from psycopg.rows import dict_row

from app.infrastructure.db.session import get_pool

logger = logging.getLogger(__name__)


class SqlEventReminderRepository:
    """Manages event reminder registrations and retrieval."""

    def __init__(self) -> None:
        self._lock = RLock()
        # In-memory backup in case PostgreSQL connection pool is busy or unavailable
        self._memory_store: dict[str, dict[str, Any]] = {}

    def create(
        self,
        email: str,
        event_id: str,
        symbol: str,
        event_title: str,
        event_type: str,
        event_at: datetime,
        days_before: int = 1,
    ) -> dict[str, Any]:
        reminder_id = str(uuid4())
        clean_email = email.strip().lower()
        now = datetime.now(UTC)

        item = {
            "id": reminder_id,
            "email": clean_email,
            "event_id": event_id,
            "symbol": symbol.strip().upper(),
            "event_title": event_title.strip(),
            "event_type": event_type,
            "event_at": event_at,
            "days_before": days_before,
            "status": "pending",
            "created_at": now,
        }

        # 1. Memory store
        with self._lock:
            self._memory_store[reminder_id] = item

        # 2. Database persistence
        try:
            pool = get_pool()
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO event_reminders (
                            id, email, event_id, symbol, event_title, event_type, event_at, days_before, status, created_at, updated_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            reminder_id,
                            clean_email,
                            event_id,
                            item["symbol"],
                            item["event_title"],
                            event_type,
                            event_at,
                            days_before,
                            "pending",
                            now,
                            now,
                        ),
                    )
                conn.commit()
        except Exception as exc:
            logger.warning("db_save_reminder_failed_using_memory", extra={"error": str(exc)})

        return item

    def list(self, email: str | None = None) -> list[dict[str, Any]]:
        clean_email = email.strip().lower() if email else None
        results: list[dict[str, Any]] = []

        try:
            pool = get_pool()
            with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
                    if clean_email:
                        cur.execute(
                            """
                            SELECT id::text, email, event_id, symbol, event_title, event_type, event_at, days_before, status, created_at
                            FROM event_reminders
                            WHERE email = %s AND status != 'cancelled'
                            ORDER BY event_at ASC
                            """,
                            (clean_email,),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT id::text, email, event_id, symbol, event_title, event_type, event_at, days_before, status, created_at
                            FROM event_reminders
                            WHERE status != 'cancelled'
                            ORDER BY event_at ASC LIMIT 100
                            """
                        )
                    rows = cur.fetchall()
                    for r in rows:
                        results.append(dict(r))
            return results
        except Exception as exc:
            logger.warning("db_list_reminders_failed_using_memory", extra={"error": str(exc)})

        with self._lock:
            items = list(self._memory_store.values())
            if clean_email:
                items = [i for i in items if i["email"] == clean_email]
            return [i for i in items if i.get("status") != "cancelled"]

    def delete(self, reminder_id: str) -> bool:
        with self._lock:
            if reminder_id in self._memory_store:
                self._memory_store[reminder_id]["status"] = "cancelled"

        try:
            pool = get_pool()
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE event_reminders SET status = 'cancelled', updated_at = now() WHERE id = %s",
                        (reminder_id,),
                    )
                conn.commit()
            return True
        except Exception as exc:
            logger.warning("db_delete_reminder_failed", extra={"error": str(exc)})
            return True

    def get_due_reminders(self, window_hours: int = 48) -> builtins.list[dict[str, Any]]:
        """Returns pending reminders where the event date is within the reminder window."""
        due_items: list[dict[str, Any]] = []
        now = datetime.now(UTC)
        deadline = now + timedelta(hours=window_hours)

        try:
            pool = get_pool()
            with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(
                        """
                        SELECT id::text, email, event_id, symbol, event_title, event_type, event_at, days_before, status, created_at
                        FROM event_reminders
                        WHERE status = 'pending'
                          AND event_at <= %s
                          AND event_at >= %s
                        ORDER BY event_at ASC LIMIT 50
                        """,
                        (deadline, now),
                    )
                    rows = cur.fetchall()
                    for r in rows:
                        due_items.append(dict(r))
            return due_items
        except Exception as exc:
            logger.warning("db_get_due_reminders_failed_using_memory", extra={"error": str(exc)})

        with self._lock:
            for item in self._memory_store.values():
                if item.get("status") == "pending" and now <= item["event_at"] <= deadline:
                    due_items.append(item)
        return due_items

    def mark_sent(self, reminder_id: str) -> None:
        now = datetime.now(UTC)
        with self._lock:
            if reminder_id in self._memory_store:
                self._memory_store[reminder_id]["status"] = "sent"

        try:
            pool = get_pool()
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE event_reminders SET status = 'sent', sent_at = %s, updated_at = %s WHERE id = %s",
                        (now, now, reminder_id),
                    )
                conn.commit()
        except Exception as exc:
            logger.warning("db_mark_sent_failed", extra={"error": str(exc)})

    def get_pending_by_event_id(self, event_id: str) -> builtins.list[dict[str, Any]]:
        """Returns all pending reminders for a specific event."""
        results: builtins.list[dict[str, Any]] = []
        try:
            pool = get_pool()
            with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    SELECT id::text, email, event_id, symbol, event_title, event_type, event_at, days_before, status, created_at
                    FROM event_reminders
                    WHERE event_id = %s AND status = 'pending'
                    """,
                    (event_id,),
                )
                for r in cur.fetchall():
                    results.append(dict(r))
            return results
        except Exception as exc:
            logger.warning("db_get_pending_by_event_id_failed_using_memory", extra={"error": str(exc)})

        with self._lock:
            for item in self._memory_store.values():
                if item.get("event_id") == event_id and item.get("status") == "pending":
                    results.append(item)
        return results

    def cancel_reminders_for_event(self, event_id: str, reason: str = "source_not_found") -> int:
        """Cancels all pending reminders for a specific event with an explanation."""
        cancelled_count = 0
        with self._lock:
            for item in self._memory_store.values():
                if item.get("event_id") == event_id and item.get("status") == "pending":
                    item["status"] = "cancelled"
                    item["cancellation_reason"] = reason
                    cancelled_count += 1

        try:
            pool = get_pool()
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE event_reminders SET status = 'cancelled', updated_at = now() WHERE event_id = %s AND status = 'pending'",
                        (event_id,),
                    )
                    db_count = cur.rowcount
                conn.commit()
            return max(cancelled_count, db_count)
        except Exception as exc:
            logger.warning("db_cancel_reminders_for_event_failed", extra={"error": str(exc)})
            return cancelled_count


_reminder_repo: SqlEventReminderRepository | None = None
_repo_lock = RLock()


def get_event_reminder_repository() -> SqlEventReminderRepository:
    global _reminder_repo
    if _reminder_repo is None:
        with _repo_lock:
            if _reminder_repo is None:
                _reminder_repo = SqlEventReminderRepository()
    return _reminder_repo
