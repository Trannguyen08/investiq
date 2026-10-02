"""Durable, idempotent authentication email delivery."""

from __future__ import annotations

import json
import smtplib
import ssl
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from email.utils import format_datetime, make_msgid, parseaddr
from html import escape
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
        "registration_otp": "Mã xác minh email InvestIQ",
        "password_reset_otp": "Mã đặt lại mật khẩu InvestIQ",
        "registration_success": "Tài khoản InvestIQ đã sẵn sàng",
        "password_changed": "Mật khẩu InvestIQ đã được cập nhật",
    }
    if template.endswith("_otp"):
        otp = payload["otp"]
        purpose = "xác minh địa chỉ email" if template == "registration_otp" else "đặt lại mật khẩu"
        heading = "Xác minh địa chỉ email" if template == "registration_otp" else "Đặt lại mật khẩu"
        intro = f"Bạn vừa yêu cầu {purpose} cho tài khoản InvestIQ."
        text_body = (
            f"Xin chào,\n\n{intro}\n\n"
            f"Mã OTP của bạn: {otp}\n\n"
            "Mã có hiệu lực trong 90 giây và chỉ sử dụng được một lần. "
            "Vui lòng không chia sẻ mã này với bất kỳ ai.\n\n"
            "Nếu bạn không thực hiện yêu cầu này, bạn có thể bỏ qua email.\n\n"
            "Trân trọng,\nĐội ngũ InvestIQ"
        )
        otp_block = (
            '<div style="margin:28px 0;padding:20px 16px;background:#eff6ff;'
            'border:1px solid #bfdbfe;border-radius:12px;text-align:center">'
            '<p style="margin:0 0 8px;color:#475569;font-size:13px">MÃ OTP CỦA BẠN</p>'
            f'<p style="margin:0;color:#1d4ed8;font-family:Arial,sans-serif;'
            'font-size:34px;font-weight:700;letter-spacing:10px;padding-left:10px">'
            f'{escape(otp)}</p>'
            '</div>'
        )
        detail = (
            '<p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.6">'
            'Mã có hiệu lực trong <strong>90 giây</strong> và chỉ sử dụng được một lần.</p>'
            '<p style="margin:0;color:#475569;font-size:14px;line-height:1.6">'
            'Vui lòng không chia sẻ mã này với bất kỳ ai. '
            'Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>'
        )
    elif template == "registration_success":
        name = payload.get("display_name", "bạn")
        text_body = (
            f"Xin chào {name},\n\nTài khoản InvestIQ của bạn đã được tạo thành công. "
            "Bạn có thể đăng nhập và bắt đầu sử dụng dịch vụ.\n\n"
            "Trân trọng,\nĐội ngũ InvestIQ"
        )
        heading = "Chào mừng bạn đến với InvestIQ"
        intro = "Địa chỉ email của bạn đã được xác minh và tài khoản hiện đã sẵn sàng."
        otp_block = ""
        detail = (
            '<p style="margin:0;color:#475569;font-size:14px;line-height:1.6">'
            "Bạn có thể đăng nhập để bắt đầu sử dụng InvestIQ.</p>"
        )
    else:
        text_body = (
            "Xin chào,\n\nMật khẩu tài khoản InvestIQ của bạn vừa được cập nhật.\n\n"
            "Nếu bạn không thực hiện thay đổi này, vui lòng đổi lại mật khẩu "
            "và liên hệ bộ phận hỗ trợ.\n\n"
            "Trân trọng,\nĐội ngũ InvestIQ"
        )
        heading = "Mật khẩu đã được cập nhật"
        intro = "Mật khẩu tài khoản InvestIQ của bạn vừa được thay đổi thành công."
        otp_block = ""
        detail = (
            '<p style="margin:0;color:#475569;font-size:14px;line-height:1.6">'
            'Nếu bạn không thực hiện thay đổi này, vui lòng đặt lại mật khẩu '
            'và liên hệ bộ phận hỗ trợ.</p>'
        )

    safe_heading = escape(heading)
    safe_intro = escape(intro)
    html_body = (
        '<!doctype html><html lang="vi"><body style="margin:0;padding:24px;background:#f1f5f9;'
        'font-family:Arial,Helvetica,sans-serif;color:#0f172a">'
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        'style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;'
        'border-radius:16px"><tr><td style="padding:32px 28px">'
        '<p style="margin:0 0 24px;color:#1d4ed8;font-size:20px;font-weight:700">InvestIQ</p>'
        f'<h1 style="margin:0 0 12px;font-size:23px;line-height:1.35">{safe_heading}</h1>'
        f'<p style="margin:0;color:#475569;font-size:15px;line-height:1.7">{safe_intro}</p>'
        f'{otp_block}{detail}'
        '<hr style="height:1px;margin:28px 0 16px;border:0;background:#e2e8f0">'
        '<p style="margin:0;color:#64748b;font-size:12px;line-height:1.6">'
        'Email tự động từ InvestIQ. Vui lòng không trả lời thư này.</p>'
        '</td></tr></table></body></html>'
    )
    message = EmailMessage()
    message["Subject"] = subjects[template]
    message["From"] = settings.auth_mail_from
    message["To"] = payload["email"]
    sender_address = parseaddr(settings.auth_mail_from or "")[1]
    sender_domain = sender_address.rpartition("@")[2] or None
    message["Date"] = format_datetime(datetime.now(UTC))
    message["Message-ID"] = make_msgid(domain=sender_domain)
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
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
