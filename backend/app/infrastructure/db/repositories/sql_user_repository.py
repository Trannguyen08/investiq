"""PostgreSQL authentication repository with transaction-owned invariants."""

from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.domain.entities.user import User
from app.domain.repositories.i_user_repository import DuplicateEmailError, PasswordResetAccountError


class SqlUserRepository:
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    @staticmethod
    def _user(row: dict[str, Any], provider: str | None = None) -> User:
        return User(
            id=str(row["id"]),
            email=str(row["email"]),
            display_name=str(row["display_name"]),
            role=str(row["role"]),
            status=str(row["status"]),
            email_verified_at=row["email_verified_at"],
            provider=provider or str(row.get("provider") or "password"),
            avatar_url=row.get("avatar_url"),
        )

    def _find_email(self, connection: Connection[Any], email: str) -> dict[str, Any] | None:
        with connection.cursor(row_factory=dict_row) as cursor:
            return cursor.execute(
                """SELECT u.id, u.email, u.display_name, u.password_hash, u.role, u.status,
                      u.email_verified_at,
                      COALESCE(
                        i.provider,
                        CASE WHEN u.password_hash IS NULL THEN 'google' ELSE 'password' END
                      ) AS provider,
                      i.avatar_url
               FROM users u
               LEFT JOIN LATERAL (
                 SELECT provider, avatar_url FROM user_identities
                 WHERE user_id = u.id ORDER BY (provider = 'password') DESC LIMIT 1
               ) i ON true
               WHERE u.email = %s""",
                (email,),
            ).fetchone()

    def find_user_by_email(self, email: str) -> tuple[User, str | None] | None:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = cursor.execute("SELECT * FROM users WHERE email = %s", (email,)).fetchone()
            return (self._user(row), row["password_hash"]) if row else None

    def authenticate(self, email: str) -> tuple[User, str | None] | None:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = self._find_email(cursor.connection, email)
            return (self._user(row), row["password_hash"]) if row else None

    def find_google_user(self, subject: str) -> User | None:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = cursor.execute(
                """SELECT u.*, i.provider, i.avatar_url FROM user_identities i
                   JOIN users u ON u.id = i.user_id
                   WHERE i.provider = 'google' AND i.provider_subject = %s""",
                (subject,),
            ).fetchone()
            return self._user(row) if row else None

    def list_admin_users(
        self,
        query: str,
        role: str | None,
        account_status: str | None,
        provider: str | None,
        limit: int,
        pagination_cursor: tuple[datetime, str, str] | None,
    ) -> tuple[list[dict[str, Any]], int]:
        filters = ["(%s = '' OR u.email ILIKE %s OR u.display_name ILIKE %s)"]
        params: list[object] = [query, f"%{query}%", f"%{query}%"]
        if role:
            filters.append("u.role = %s")
            params.append(role)
        if account_status:
            filters.append("u.status = %s")
            params.append(account_status)
        if provider:
            filters.append(
                """(CASE WHEN EXISTS (
                       SELECT 1 FROM user_identities pi
                       WHERE pi.user_id = u.id AND pi.provider = 'google'
                   ) THEN 'google' ELSE 'password' END) = %s"""
            )
            params.append(provider)
        where = " AND ".join(filters)
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            total_row = cursor.execute(
                f"SELECT count(*) AS total FROM users u WHERE {where}", params
            ).fetchone()
            assert total_row is not None
            total = total_row["total"]
            cursor_clause = ""
            row_params = list(params)
            order = "DESC"
            if pagination_cursor:
                comparison = ">" if pagination_cursor[2] == "before" else "<"
                cursor_clause = f" AND (u.created_at, u.id) {comparison} (%s, %s)"
                row_params.extend((pagination_cursor[0], pagination_cursor[1]))
                if pagination_cursor[2] == "before":
                    order = "ASC"
            fetched_rows = cursor.execute(
                f"""SELECT u.id::text AS id, u.email, u.display_name, u.role, u.status,
                          CASE WHEN EXISTS (
                            SELECT 1 FROM user_identities i
                            WHERE i.user_id = u.id AND i.provider = 'google'
                          ) THEN 'google' ELSE 'password' END AS provider,
                          u.email_verified_at, u.created_at
                   FROM users u WHERE {where}{cursor_clause}
                   ORDER BY u.created_at {order}, u.id {order} LIMIT %s""",
                [*row_params, limit],
            ).fetchall()
        rows = fetched_rows
        if pagination_cursor and pagination_cursor[2] == "before":
            rows.reverse()
        return list(rows), int(total)

    def update_admin_user(
        self,
        *,
        actor_id: str,
        target_id: str,
        role: str | None,
        account_status: str | None,
        request_id: str,
    ) -> dict[str, Any] | None:
        rejection: str | None = None
        updated: dict[str, Any] | None = None
        with (
            self._pool.connection() as connection,
            connection.transaction(),
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            # Serialize admin removals so concurrent updates cannot remove the last active admin.
            connection.execute("SELECT pg_advisory_xact_lock(731994120)")
            target = cursor.execute(
                "SELECT id, role, status FROM users WHERE id = %s FOR UPDATE", (target_id,)
            ).fetchone()
            if target is None:
                return None
            outcome = "succeeded"
            action = {"role": role, "status": account_status}
            if target_id == actor_id:
                outcome = "rejected"
                self._admin_audit(connection, actor_id, target_id, action, outcome, request_id)
                rejection = "You cannot change your own account"
            else:
                new_role = role or target["role"]
                new_status = account_status or target["status"]
                removes_active_admin = (
                    target["role"] == "admin"
                    and target["status"] == "active"
                    and (new_role != "admin" or new_status != "active")
                )
                active_admin_row = (
                    cursor.execute(
                        """SELECT count(*) AS total FROM users
                           WHERE role = 'admin' AND status = 'active'"""
                    ).fetchone()
                    if removes_active_admin
                    else None
                )
                active_admins = int(active_admin_row["total"]) if active_admin_row else 2
                if removes_active_admin and active_admins <= 1:
                    self._admin_audit(
                        connection, actor_id, target_id, action, "rejected", request_id
                    )
                    rejection = "The last active administrator cannot be removed"
                else:
                    row = cursor.execute(
                        """UPDATE users SET role = %s, status = %s, updated_at = now()
                           WHERE id = %s
                           RETURNING id::text AS id, email, display_name, role, status,
                                     email_verified_at, created_at""",
                        (new_role, new_status, target_id),
                    ).fetchone()
                    if new_status == "disabled" and target["status"] != "disabled":
                        connection.execute(
                            """UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now())
                               WHERE user_id = %s""",
                            (target_id,),
                        )
                        connection.execute(
                            """UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now())
                               WHERE session_id IN (
                                   SELECT id FROM auth_sessions WHERE user_id = %s
                               )""",
                            (target_id,),
                        )
                    self._admin_audit(connection, actor_id, target_id, action, outcome, request_id)
                    assert row is not None
                    google_identity = cursor.execute(
                        """SELECT 1 FROM user_identities
                           WHERE user_id = %s AND provider = 'google'""",
                        (target_id,),
                    ).fetchone()
                    row["provider"] = "google" if google_identity else "password"
                    updated = dict(row)
        if rejection:
            raise ValueError(rejection)
        return updated

    @staticmethod
    def _admin_audit(
        connection: Connection[Any],
        actor_id: str,
        target_id: str,
        action: Mapping[str, object],
        outcome: str,
        request_id: str,
    ) -> None:
        connection.execute(
            """INSERT INTO auth_audit_events
               (actor_user_id, event_type, outcome, request_id, details)
               VALUES (%s, 'admin_user_update', %s, %s, %s::jsonb)""",
            (actor_id, outcome, request_id, json.dumps({"target_user_id": target_id, **action})),
        )

    @staticmethod
    def _email_job(
        connection: Connection[Any],
        template: str,
        payload: str,
        deadline: datetime,
        challenge_id: str | None = None,
    ) -> str:
        row = connection.execute(
            """INSERT INTO auth_email_jobs
               (challenge_id, template, encrypted_payload, deadline_at)
               VALUES (%s, %s, %s, %s) RETURNING id""",
            (challenge_id, template, payload, deadline),
        ).fetchone()
        assert row is not None
        return str(row[0])

    def create_registration_challenge(
        self,
        *,
        pre_auth_id: str,
        email: str,
        display_name: str,
        password_hash: str,
        otp_digest: str,
        expires_at: datetime,
        resend_at: datetime,
        encrypted_mail_payload: str,
    ) -> tuple[str, str]:
        with self._pool.connection() as connection, connection.transaction():
            existing = connection.execute(
                "SELECT 1 FROM users WHERE email = %s", (email,)
            ).fetchone()
            if existing:
                raise DuplicateEmailError(email)
            connection.execute(
                """UPDATE auth_challenges SET consumed_at = now(), updated_at = now()
                   WHERE pre_auth_id = %s AND purpose = 'registration' AND consumed_at IS NULL""",
                (pre_auth_id,),
            )
            row = connection.execute(
                """INSERT INTO auth_challenges
                   (pre_auth_id, purpose, email, display_name, password_hash, otp_digest,
                    deliverable, expires_at, resend_available_at)
                   VALUES (%s, 'registration', %s, %s, %s, %s, %s, %s, %s)
                   RETURNING id""",
                (
                    pre_auth_id,
                    email,
                    display_name,
                    password_hash,
                    otp_digest,
                    True,
                    expires_at,
                    resend_at,
                ),
            ).fetchone()
            assert row is not None
            job_id = self._email_job(
                connection,
                "registration_otp",
                encrypted_mail_payload,
                expires_at,
                str(row[0]),
            )
            return str(row[0]), job_id

    def resend_challenge(
        self,
        *,
        challenge_id: str,
        pre_auth_id: str,
        purpose: str,
        otp_digest: str,
        expires_at: datetime,
        resend_at: datetime,
        encrypted_mail_payload: str,
    ) -> str:
        template = "registration_otp" if purpose == "registration" else "password_reset_otp"
        with self._pool.connection() as connection, connection.transaction():
            row = connection.execute(
                """UPDATE auth_challenges SET otp_digest = %s, generation = generation + 1,
                   attempts = 0, expires_at = %s, resend_available_at = %s, updated_at = now()
                   WHERE id = %s AND pre_auth_id = %s AND purpose = %s AND consumed_at IS NULL
                     AND resend_available_at <= now()
                   RETURNING id, deliverable""",
                (otp_digest, expires_at, resend_at, challenge_id, pre_auth_id, purpose),
            ).fetchone()
            if row is None:
                raise ValueError("Challenge cannot be resent yet")
            if row[1] is False:
                return ""
            return self._email_job(
                connection, template, encrypted_mail_payload, expires_at, challenge_id
            )

    def challenge_status(self, challenge_id: str, pre_auth_id: str) -> dict[str, object] | None:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            return cursor.execute(
                """SELECT c.id, c.purpose, c.email, c.display_name, c.expires_at,
                          c.resend_available_at, c.consumed_at,
                          COALESCE(j.status, 'queued') AS delivery_status
                   FROM auth_challenges c
                   LEFT JOIN LATERAL (
                     SELECT status FROM auth_email_jobs
                     WHERE challenge_id = c.id ORDER BY created_at DESC LIMIT 1
                   ) j ON true
                   WHERE c.id = %s AND c.pre_auth_id = %s""",
                (challenge_id, pre_auth_id),
            ).fetchone()

    @staticmethod
    def _lock_challenge(
        connection: Connection[Any],
        challenge_id: str,
        pre_auth_id: str,
        purpose: str,
        otp_digest: str,
        now: datetime,
    ) -> dict[str, Any] | None:
        with connection.cursor(row_factory=dict_row) as cursor:
            row = cursor.execute(
                """SELECT * FROM auth_challenges WHERE id = %s AND pre_auth_id = %s
                   AND purpose = %s FOR UPDATE""",
                (challenge_id, pre_auth_id, purpose),
            ).fetchone()
        if (
            row is None
            or row["consumed_at"] is not None
            or row["expires_at"] <= now
            or row["attempts"] >= 5
        ):
            return None
        if row["otp_digest"] != otp_digest:
            connection.execute(
                """UPDATE auth_challenges SET attempts = attempts + 1,
                   updated_at = now() WHERE id = %s""",
                (challenge_id,),
            )
            return None
        return row

    def verify_registration(
        self,
        challenge_id: str,
        pre_auth_id: str,
        otp_digest: str,
        now: datetime,
        encrypted_mail_payload: str,
    ) -> User | None:
        with self._pool.connection() as connection, connection.transaction():
            row = self._lock_challenge(
                connection, challenge_id, pre_auth_id, "registration", otp_digest, now
            )
            if row is None:
                return None
            user_row = connection.execute(
                """INSERT INTO users (email, display_name, password_hash, email_verified_at)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT (email) DO NOTHING
                   RETURNING id, email, display_name, role, status, email_verified_at""",
                (row["email"], row["display_name"], row["password_hash"], now),
            ).fetchone()
            if user_row is None:
                raise DuplicateEmailError(str(row["email"]))
            connection.execute(
                """INSERT INTO user_identities (user_id, provider, provider_subject)
                   VALUES (%s, 'password', %s)""",
                (user_row[0], row["email"]),
            )
            connection.execute(
                "UPDATE auth_challenges SET consumed_at = %s WHERE id = %s", (now, challenge_id)
            )
            self._email_job(
                connection, "registration_success", encrypted_mail_payload, now + timedelta(days=1)
            )
            user = User(
                str(user_row[0]),
                str(user_row[1]),
                str(user_row[2]),
                str(user_row[3]),
                str(user_row[4]),
                user_row[5],
            )
            return user

    def create_session(
        self,
        user: User,
        *,
        provider: str,
        refresh_hash: str,
        expires_at: datetime,
        idle_expires_at: datetime,
        session_id: str,
    ) -> None:
        with self._pool.connection() as connection, connection.transaction():
            connection.execute(
                """INSERT INTO auth_sessions
                   (id, user_id, provider, remember_session, idle_expires_at, absolute_expires_at)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (session_id, user.id, provider, True, idle_expires_at, expires_at),
            )
            connection.execute(
                """INSERT INTO refresh_tokens (session_id, token_hash, expires_at)
                   VALUES (%s, %s, %s)""",
                (session_id, refresh_hash, expires_at),
            )

    def rotate_refresh(
        self, token_hash: str, new_hash: str, now: datetime, expires_at: datetime
    ) -> User | None:
        with self._pool.connection() as connection, connection.transaction():
            with connection.cursor(row_factory=dict_row) as cursor:
                row = cursor.execute(
                    """SELECT r.id AS refresh_id, r.used_at, r.revoked_at AS token_revoked,
                              r.expires_at AS token_expires, s.id AS session_id, s.revoked_at,
                              s.idle_expires_at, s.absolute_expires_at, s.remember_session,
                              s.provider, u.*,
                              COALESCE(i.provider_display_name, u.display_name) AS display_name,
                              i.avatar_url
                       FROM refresh_tokens r JOIN auth_sessions s ON s.id = r.session_id
                       JOIN users u ON u.id = s.user_id
                       LEFT JOIN user_identities i ON i.user_id = u.id AND i.provider = s.provider
                       WHERE r.token_hash = %s FOR UPDATE OF r, s""",
                    (token_hash,),
                ).fetchone()
            if row is None:
                return None
            if row["used_at"] or row["token_revoked"]:
                connection.execute(
                    "UPDATE auth_sessions SET revoked_at = %s WHERE id = %s",
                    (now, row["session_id"]),
                )
                return None
            if (
                row["revoked_at"]
                or row["token_expires"] <= now
                or row["absolute_expires_at"] <= now
                or row["idle_expires_at"] <= now
                or row["status"] != "active"
            ):
                return None
            connection.execute(
                "UPDATE refresh_tokens SET used_at = %s WHERE id = %s", (now, row["refresh_id"])
            )
            bounded_expiry = min(expires_at, row["absolute_expires_at"])
            connection.execute(
                """INSERT INTO refresh_tokens
                   (session_id, token_hash, parent_id, expires_at)
                   VALUES (%s, %s, %s, %s)""",
                (row["session_id"], new_hash, row["refresh_id"], bounded_expiry),
            )
            idle_window = timedelta(days=30) if row["remember_session"] else timedelta(hours=2)
            idle = min(now + idle_window, row["absolute_expires_at"])
            connection.execute(
                "UPDATE auth_sessions SET last_seen_at = %s, idle_expires_at = %s WHERE id = %s",
                (now, idle, row["session_id"]),
            )
            return self._user(row)

    def active_session_user(self, session_id: str, user_id: str, now: datetime) -> User | None:
        with (
            self._pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            row = cursor.execute(
                """SELECT u.*, s.provider,
                          COALESCE(i.provider_display_name, u.display_name) AS display_name,
                          i.avatar_url FROM auth_sessions s
                   JOIN users u ON u.id = s.user_id
                   LEFT JOIN user_identities i ON i.user_id = u.id AND i.provider = s.provider
                   WHERE s.id = %s AND u.id = %s AND s.revoked_at IS NULL
                     AND s.idle_expires_at > %s AND s.absolute_expires_at > %s
                     AND u.status = 'active'""",
                (session_id, user_id, now, now),
            ).fetchone()
            return self._user(row) if row else None

    def revoke_session(self, session_id: str, now: datetime) -> None:
        with self._pool.connection() as connection, connection.transaction():
            connection.execute(
                "UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, %s) WHERE id = %s",
                (now, session_id),
            )
            connection.execute(
                """UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, %s)
                   WHERE session_id = %s""",
                (now, session_id),
            )

    def request_password_reset(
        self,
        *,
        pre_auth_id: str,
        email: str,
        otp_digest: str,
        expires_at: datetime,
        resend_at: datetime,
        encrypted_mail_payload: str,
    ) -> tuple[str | None, str | None]:
        with self._pool.connection() as connection, connection.transaction():
            row = connection.execute(
                "SELECT id, password_hash FROM users WHERE email = %s AND status = 'active'",
                (email,),
            ).fetchone()
            if row is None:
                raise PasswordResetAccountError("EMAIL_NOT_FOUND")
            if row[1] is None:
                raise PasswordResetAccountError("GOOGLE_ONLY_ACCOUNT")
            connection.execute(
                """UPDATE auth_challenges SET consumed_at = now()
                   WHERE pre_auth_id = %s AND purpose = 'password_reset'
                     AND consumed_at IS NULL""",
                (pre_auth_id,),
            )
            challenge = connection.execute(
                """INSERT INTO auth_challenges
                   (pre_auth_id, purpose, email, otp_digest, expires_at, resend_available_at)
                   VALUES (%s, 'password_reset', %s, %s, %s, %s) RETURNING id""",
                (pre_auth_id, email, otp_digest, expires_at, resend_at),
            ).fetchone()
            assert challenge is not None
            job_id = self._email_job(
                connection,
                "password_reset_otp",
                encrypted_mail_payload,
                expires_at,
                str(challenge[0]),
            )
            return str(challenge[0]), job_id

    def verify_reset_otp(
        self,
        challenge_id: str,
        pre_auth_id: str,
        otp_digest: str,
        now: datetime,
        grant_hash: str,
        grant_expires_at: datetime,
    ) -> str | None:
        with self._pool.connection() as connection, connection.transaction():
            row = self._lock_challenge(
                connection, challenge_id, pre_auth_id, "password_reset", otp_digest, now
            )
            if row is None:
                return None
            user = connection.execute(
                """SELECT id FROM users WHERE email = %s
                   AND password_hash IS NOT NULL AND status = 'active'""",
                (row["email"],),
            ).fetchone()
            if user is None:
                return None
            grant = connection.execute(
                """INSERT INTO password_reset_grants
                   (user_id, challenge_id, grant_hash, expires_at)
                   VALUES (%s, %s, %s, %s) RETURNING id""",
                (user[0], challenge_id, grant_hash, grant_expires_at),
            ).fetchone()
            connection.execute(
                "UPDATE auth_challenges SET consumed_at = %s WHERE id = %s", (now, challenge_id)
            )
            assert grant is not None
            return str(grant[0])

    def complete_password_reset(
        self,
        grant_hash: str,
        password_hash: str,
        now: datetime,
        encrypted_mail_payload: str,
    ) -> str | None:
        with self._pool.connection() as connection, connection.transaction():
            row = connection.execute(
                """SELECT g.id, g.user_id, u.email FROM password_reset_grants g
                   JOIN users u ON u.id = g.user_id
                   WHERE g.grant_hash = %s AND g.consumed_at IS NULL
                     AND g.expires_at > %s FOR UPDATE OF g""",
                (grant_hash, now),
            ).fetchone()
            if row is None:
                return None
            connection.execute(
                "UPDATE users SET password_hash = %s, updated_at = %s WHERE id = %s",
                (password_hash, now, row[1]),
            )
            connection.execute(
                "UPDATE password_reset_grants SET consumed_at = %s WHERE id = %s", (now, row[0])
            )
            connection.execute(
                "UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, %s) WHERE user_id = %s",
                (now, row[1]),
            )
            connection.execute(
                """UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, %s)
                   WHERE session_id IN
                     (SELECT id FROM auth_sessions WHERE user_id = %s)""",
                (now, row[1]),
            )
            return self._email_job(
                connection,
                "password_changed",
                encrypted_mail_payload,
                now + timedelta(days=1),
            )

    def reset_grant_email(self, grant_hash: str, now: datetime) -> str | None:
        with self._pool.connection() as connection:
            row = connection.execute(
                """SELECT u.email FROM password_reset_grants g
                   JOIN users u ON u.id = g.user_id
                   WHERE g.grant_hash = %s AND g.consumed_at IS NULL
                     AND g.expires_at > %s""",
                (grant_hash, now),
            ).fetchone()
            return str(row[0]) if row else None

    def record_audit(
        self,
        event_type: str,
        outcome: str,
        actor_user_id: str | None = None,
        request_id: str | None = None,
    ) -> None:
        with self._pool.connection() as connection, connection.transaction():
            connection.execute(
                """INSERT INTO auth_audit_events
                   (actor_user_id, event_type, outcome, request_id)
                   VALUES (%s, %s, %s, %s)""",
                (actor_user_id, event_type, outcome, request_id),
            )

    def create_google_user_or_login(
        self,
        *,
        subject: str,
        email: str,
        display_name: str,
        avatar_url: str | None,
        encrypted_mail_payload: str,
    ) -> tuple[User | None, str | None]:
        with self._pool.connection() as connection, connection.transaction():
            with connection.cursor(row_factory=dict_row) as cursor:
                identity = cursor.execute(
                    """SELECT u.*, i.avatar_url, i.provider FROM user_identities i
                       JOIN users u ON u.id = i.user_id
                       WHERE i.provider = 'google' AND i.provider_subject = %s
                       FOR UPDATE OF i""",
                    (subject,),
                ).fetchone()
            if identity:
                connection.execute(
                    """UPDATE user_identities SET provider_display_name = %s, avatar_url = %s
                       WHERE provider = 'google' AND provider_subject = %s""",
                    (display_name, avatar_url, subject),
                )
                identity["display_name"] = display_name
                identity["avatar_url"] = avatar_url
                return self._user(identity), None
            if connection.execute("SELECT 1 FROM users WHERE email = %s", (email,)).fetchone():
                return None, None
            row = connection.execute(
                """INSERT INTO users (email, display_name, email_verified_at) VALUES (%s, %s, now())
                   RETURNING id, email, display_name, role, status, email_verified_at""",
                (email, display_name),
            ).fetchone()
            assert row is not None
            connection.execute(
                """INSERT INTO user_identities
                   (user_id, provider, provider_subject, provider_display_name, avatar_url)
                   VALUES (%s, 'google', %s, %s, %s)""",
                (row[0], subject, display_name, avatar_url),
            )
            job_id = self._email_job(
                connection,
                "registration_success",
                encrypted_mail_payload,
                datetime.now(row[5].tzinfo) + timedelta(days=1),
            )
            return User(
                str(row[0]),
                str(row[1]),
                str(row[2]),
                str(row[3]),
                str(row[4]),
                row[5],
                "google",
                avatar_url,
            ), job_id
