"""Durable, idempotent authentication email delivery."""

from __future__ import annotations

import json
import smtplib
import ssl
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from typing import Any

from celery import Task
from cryptography.fernet import Fernet, InvalidToken
from psycopg.rows import dict_row

from app.infrastructure.config.settings import settings
from app.infrastructure.db.session import get_pool
from app.workers.celery_app import celery_app


def _claim(job_id: str) -> dict[str, Any] | None:
    now = datetime.now(UTC)
    with (
        get_pool().connection() as connection,
        connection.transaction(),
        connection.cursor(row_factory=dict_row) as cursor,
    ):
        row = cursor.execute(
            """SELECT id, template, encrypted_payload, attempts, deadline_at FROM auth_email_jobs
               WHERE id = %s AND status IN ('pending', 'sending') AND available_at <= %s
                 AND deadline_at > %s AND (locked_until IS NULL OR locked_until < %s)
               FOR UPDATE SKIP LOCKED""",
            (job_id, now, now, now),
        ).fetchone()
        if row is None:
            return None
        cursor.execute(
            """UPDATE auth_email_jobs SET status = 'sending', attempts = attempts + 1,
               locked_until = %s WHERE id = %s""",
            (now + timedelta(seconds=30), job_id),
        )
        return row


def _payload(encrypted: str) -> dict[str, str]:
    key = settings.auth_payload_encryption_key
    if key is None:
        raise RuntimeError("Auth email encryption is not configured")
    try:
        value = json.loads(
            Fernet(key.get_secret_value().encode()).decrypt(encrypted.encode(), ttl=86400)
        )
    except (InvalidToken, ValueError, TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Auth email payload is invalid") from exc
    if not isinstance(value, dict) or not all(
        isinstance(k, str) and isinstance(v, str) for k, v in value.items()
    ):
        raise RuntimeError("Auth email payload is invalid")
    return value


def _message(payload: dict[str, str]) -> EmailMessage:
    template = payload["template"]
    subjects = {
        "registration_otp": "Mã xác minh đăng ký InvestIQ",
        "password_reset_otp": "Mã khôi phục mật khẩu InvestIQ",
        "registration_success": "Đăng ký InvestIQ thành công",
        "password_changed": "Mật khẩu InvestIQ đã được thay đổi",
    }
    if template.endswith("_otp"):
        body = (
            f"Mã xác minh của bạn là {payload['otp']}. "
            "Mã hết hạn sau 90 giây. Không chia sẻ mã này."
        )
    elif template == "registration_success":
        body = (
            f"Chào {payload.get('display_name', 'bạn')}, "
            "tài khoản InvestIQ của bạn đã được tạo thành công."
        )
    else:
        body = (
            "Mật khẩu InvestIQ của bạn vừa được thay đổi. "
            "Nếu không phải bạn, hãy liên hệ hỗ trợ ngay."
        )
    message = EmailMessage()
    message["Subject"] = subjects[template]
    message["From"] = settings.auth_mail_from
    message["To"] = payload["email"]
    message.set_content(body)
    return message


def _send(payload: dict[str, str]) -> None:
    if not settings.auth_smtp_host or not settings.auth_mail_from:
        raise RuntimeError("SMTP is not configured")
    with smtplib.SMTP(settings.auth_smtp_host, settings.auth_smtp_port, timeout=8) as smtp:
        if settings.auth_smtp_starttls:
            smtp.starttls(context=ssl.create_default_context())
        if settings.auth_smtp_username and settings.auth_smtp_password:
            smtp.login(settings.auth_smtp_username, settings.auth_smtp_password.get_secret_value())
        smtp.send_message(_message(payload))


def _finish(job_id: str, status: str, category: str | None = None) -> None:
    with get_pool().connection() as connection, connection.transaction():
        connection.execute(
            """UPDATE auth_email_jobs SET status = %s, locked_until = NULL,
               sent_at = CASE WHEN %s = 'sent' THEN now() ELSE sent_at END,
               last_error_category = %s,
               available_at = CASE WHEN %s = 'pending'
                 THEN now() + interval '30 seconds' ELSE available_at END
               WHERE id = %s""",
            (status, status, category, status, job_id),
        )


@celery_app.task(  # type: ignore[untyped-decorator]
    bind=True, name="investiq.auth.email.send.v1", max_retries=3, acks_late=True
)
def send_auth_email(self: Task, job_id: str) -> str:
    row = _claim(job_id)
    if row is None:
        return "skipped"
    try:
        _send(_payload(str(row["encrypted_payload"])))
    except (RuntimeError, OSError, smtplib.SMTPException) as exc:
        terminal = int(row["attempts"]) + 1 >= 4 or row["deadline_at"] <= datetime.now(
            UTC
        ) + timedelta(seconds=30)
        _finish(job_id, "failed" if terminal else "pending", type(exc).__name__)
        if terminal:
            return "failed"
        raise self.retry(exc=exc, countdown=30) from exc
    _finish(job_id, "sent")
    return "sent"


@celery_app.task(name="investiq.auth.email.dispatch.v1")  # type: ignore[untyped-decorator]
def dispatch_auth_emails() -> int:
    with get_pool().connection() as connection:
        rows = connection.execute(
            """SELECT id FROM auth_email_jobs WHERE status = 'pending' AND available_at <= now()
               AND deadline_at > now() ORDER BY created_at LIMIT 100"""
        ).fetchall()
    for (job_id,) in rows:
        celery_app.send_task(
            "investiq.auth.email.send.v1", args=(str(job_id),), queue="notifications"
        )
    return len(rows)
