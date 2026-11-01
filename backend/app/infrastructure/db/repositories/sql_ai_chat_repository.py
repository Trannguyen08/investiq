"""PostgreSQL persistence for AI assistant conversations and messages."""

from __future__ import annotations

import json
from typing import Any
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool


class SqlAiChatRepository:
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    def create_conversation(self, user_id: str, title: str = "Hội thoại mới") -> dict[str, Any]:
        with (
            self._pool.connection() as connection,
            connection.transaction(),
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = cursor.execute(
                """
                INSERT INTO ai_conversations (user_id, title)
                VALUES (%s, %s)
                RETURNING id::text AS id, title,
                          created_at::text AS created_at,
                          updated_at::text AS updated_at
                """,
                (user_id, title.strip() or "Hội thoại mới"),
            ).fetchone()
            assert row is not None
            return {**row, "message_count": 0}

    def list_conversations(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            rows = cursor.execute(
                """
                SELECT c.id::text AS id, c.title,
                       c.created_at::text AS created_at,
                       c.updated_at::text AS updated_at,
                       COUNT(m.id)::int AS message_count
                FROM ai_conversations c
                LEFT JOIN ai_messages m ON m.conversation_id = c.id
                WHERE c.user_id = %s
                GROUP BY c.id
                ORDER BY c.updated_at DESC
                LIMIT %s
                """,
                (user_id, limit),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_conversation(self, conversation_id: str, user_id: str) -> dict[str, Any] | None:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = cursor.execute(
                """
                SELECT c.id::text AS id, c.title,
                       c.created_at::text AS created_at,
                       c.updated_at::text AS updated_at,
                       COUNT(m.id)::int AS message_count
                FROM ai_conversations c
                LEFT JOIN ai_messages m ON m.conversation_id = c.id
                WHERE c.id = %s AND c.user_id = %s
                GROUP BY c.id
                """,
                (conversation_id, user_id),
            ).fetchone()
            return dict(row) if row else None

    def update_title(self, conversation_id: str, user_id: str, title: str) -> None:
        with (
            self._pool.connection() as connection,
            connection.transaction(),
            connection.cursor() as cursor,
        ):
            cursor.execute(
                """
                UPDATE ai_conversations
                SET title = %s, updated_at = now()
                WHERE id = %s AND user_id = %s
                """,
                (title.strip()[:200], conversation_id, user_id),
            )

    def delete_conversation(self, conversation_id: str, user_id: str) -> bool:
        with (
            self._pool.connection() as connection,
            connection.transaction(),
            connection.cursor() as cursor,
        ):
            res = cursor.execute(
                """
                DELETE FROM ai_conversations
                WHERE id = %s AND user_id = %s
                """,
                (conversation_id, user_id),
            )
            return bool(cursor.rowcount and cursor.rowcount > 0)

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        widgets: list[dict[str, Any]] | None = None,
        suggested_actions: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        with (
            self._pool.connection() as connection,
            connection.transaction(),
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = cursor.execute(
                """
                INSERT INTO ai_messages (conversation_id, role, content, widgets, suggested_actions)
                VALUES (%s, %s, %s, %s::jsonb, %s::jsonb)
                RETURNING id::text AS id, conversation_id::text AS conversation_id,
                          role, content, widgets, suggested_actions,
                          created_at::text AS created_at
                """,
                (
                    conversation_id,
                    role,
                    content,
                    json.dumps(widgets or []),
                    json.dumps(suggested_actions or []),
                ),
            ).fetchone()
            # Touch parent updated_at
            cursor.execute(
                "UPDATE ai_conversations SET updated_at = now() WHERE id = %s",
                (conversation_id,),
            )
            assert row is not None
            return dict(row)

    def list_messages(self, conversation_id: str, limit: int = 100) -> list[dict[str, Any]]:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            rows = cursor.execute(
                """
                SELECT id::text AS id, conversation_id::text AS conversation_id,
                       role, content, widgets, suggested_actions,
                       created_at::text AS created_at
                FROM ai_messages
                WHERE conversation_id = %s
                ORDER BY created_at ASC
                LIMIT %s
                """,
                (conversation_id, limit),
            ).fetchall()
            return [dict(r) for r in rows]

