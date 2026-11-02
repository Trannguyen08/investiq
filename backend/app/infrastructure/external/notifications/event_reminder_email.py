"""Beautiful HTML email template generator and delivery service for corporate event & dividend reminders."""

from __future__ import annotations

import logging
import smtplib
import ssl
from datetime import UTC, datetime
from email.message import EmailMessage
from email.utils import format_datetime, make_msgid, parseaddr
from html import escape
from pathlib import Path
from typing import Any

from app.infrastructure.config.settings import settings

logger = logging.getLogger(__name__)

PREVIEWS_DIR = Path("app/storage/mail_preview")

WEEKDAY_VI = {
    0: "Thứ Hai",
    1: "Thứ Ba",
    2: "Thứ Tư",
    3: "Thứ Năm",
    4: "Thứ Sáu",
    5: "Thứ Bảy",
    6: "Chủ Nhật",
}

EVENT_TYPE_VIETNAMESE = {
    "additional_listing": "Niêm yết bổ sung",
    "shareholder_meeting": "Đại hội cổ đông",
    "cash_dividend": "Cổ tức tiền mặt",
    "stock_dividend": "Cổ tức cổ phiếu",
    "dividend": "Chi trả cổ tức",
    "earnings": "Kết quả kinh doanh / BCTC",
    "insider_trading": "Giao dịch nội bộ",
    "share_issuance": "Phát hành cổ phiếu",
    "rights_issue": "Phát hành quyền mua",
    "corporate_action": "Sự kiện doanh nghiệp",
    "treasury_stock": "Giao dịch cổ phiếu quỹ",
    "listing": "Niêm yết mới",
    "delisting": "Hủy niêm yết",
    "etf_review": "Cơ cấu danh mục ETF",
}

DUMMY_DOMAINS = (
    "@investiq.vn",
    "@example.com",
    "@test.com",
    "@localhost",
    "@mock.com",
    "@sample.com",
    "@temp.com",
)


def format_event_type_vi(raw_type: str) -> str:
    """Translates event type slug into professional Vietnamese."""
    cleaned = (raw_type or "").strip().lower()
    return EVENT_TYPE_VIETNAMESE.get(cleaned, cleaned.replace("_", " ").title())


def parse_and_format_event_date(date_input: Any) -> tuple[str, str]:
    """Parse date and return (full_date_text, short_date) e.g. ('Thứ Hai, ngày 16/11/2026', '16/11/2026')."""
    dt: datetime | None = None
    if isinstance(date_input, datetime):
        dt = date_input
    elif isinstance(date_input, str):
        val = date_input.strip()
        try:
            dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
        except ValueError:
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y"):
                try:
                    dt = datetime.strptime(val.split("T")[0], fmt)
                    break
                except ValueError:
                    pass

    if dt:
        weekday_name = WEEKDAY_VI.get(dt.weekday(), "")
        short_date = dt.strftime("%d/%m/%Y")
        full_date_text = f"{weekday_name}, ngày {short_date}" if weekday_name else f"Ngày {short_date}"
        return full_date_text, short_date

    raw = str(date_input or "Theo lịch công bố")
    return raw, raw


def render_event_reminder_html(
    symbol: str,
    event_title: str,
    event_type: str,
    event_date_str: str,
    days_left: int = 1,
    notes: str | None = None,
    source_name: str | None = "HoSE / CafeF",
    app_url: str = "http://localhost:3000",
) -> str:
    """Renders a responsive, luxury-themed HTML email for event and dividend reminders."""
    safe_symbol = escape(symbol.upper())
    safe_title = escape(event_title)
    event_type_vi = format_event_type_vi(event_type)
    safe_type = escape(event_type_vi)

    full_date_text, short_date = parse_and_format_event_date(event_date_str)
    safe_full_date = escape(full_date_text)
    safe_short_date = escape(short_date)

    safe_source = escape(source_name or "HoSE / Công bố thông tin")
    safe_notes = escape(
        notes
        or "Nhà đầu tư lưu ý: Để được nhận quyền (cổ tức hoặc biểu quyết), quý khách cần sở hữu cổ phiếu trước ngày giao dịch không hưởng quyền (GDKHQ). Vào ngày GDKHQ, thị giá sẽ được điều chỉnh kỹ thuật tương ứng."
    )

    days_badge_text = (
        "Sự kiện sẽ diễn ra trong ngày mai (còn 1 ngày)"
        if days_left <= 1
        else f"Sự kiện sẽ diễn ra sau {days_left} ngày"
    )

    event_link = f"{app_url}/market/events?symbol={safe_symbol}"
    stock_link = f"{app_url}/market/stocks/{safe_symbol}"

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>InvestIQ - Nhắc lịch sự kiện: {safe_symbol}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #06101d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #06101d; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #0b1f33; border: 1px solid #1a3854; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 28px 32px; background: linear-gradient(135deg, #091a2b 0%, #0d2842 100%); border-bottom: 1px solid #1c3e5e;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 800; color: #38e1b0; letter-spacing: -0.02em;">InvestIQ</span>
                    <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background-color: rgba(56, 189, 248, 0.12); padding: 3px 8px; border-radius: 6px; margin-left: 8px; vertical-align: middle; border: 1px solid rgba(56, 189, 248, 0.25);">MARKET ALERTS</span>
                  </td>
                  <td align="right">
                    <span style="font-size: 12px; color: #94a3b8;">Nhắc nhở thông minh</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Notification Hero -->
          <tr>
            <td style="padding: 32px 32px 20px;">
              <!-- Urgent Badge -->
              <div style="display: inline-block; padding: 6px 14px; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 20px; color: #fbbf24; font-size: 12px; font-weight: 700; margin-bottom: 18px;">
                {days_badge_text}
              </div>

              <!-- Main Title -->
              <h1 style="margin: 0 0 16px; font-size: 21px; line-height: 1.4; color: #f8fafc; font-weight: 750;">
                Nhắc lịch: {safe_symbol} · {safe_title}
              </h1>

              <!-- BIG EVENT DATE HIGHLIGHT BOX -->
              <table width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #0d2b47 0%, #081d33 100%); border: 1.5px solid #0284c7; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 18px rgba(2, 132, 199, 0.2);">
                <tr>
                  <td style="padding: 18px 20px; text-align: center;">
                    <span style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 4px;">
                      NGÀY DIỄN RA SỰ KIỆN CHÍNH THỨC
                    </span>
                    <strong style="font-size: 22px; font-weight: 900; color: #ffffff; display: block; letter-spacing: -0.01em; margin: 6px 0;">
                      {safe_full_date}
                    </strong>
                    <span style="font-size: 12px; color: #94a3b8; display: block;">
                      Mốc thời gian theo lịch công bố chính thức của doanh nghiệp niêm yết
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                Hệ thống InvestIQ trân trọng thông báo sự kiện bạn quan tâm sắp diễn ra vào ngày <strong style="color: #ffffff;">{safe_short_date}</strong>. Vui lòng kiểm tra lại vị thế và chiến lược nắm giữ trước phiên giao dịch.
              </p>

              <!-- Event Details Box -->
              <table width="100%" cellspacing="0" cellpadding="0" style="background-color: #071726; border: 1px solid #1a3854; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #142a3f;">
                    <table width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="45%" style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Mã chứng khoán</td>
                        <td width="55%" align="right" style="font-size: 16px; font-weight: 800; color: #38e1b0;">{safe_symbol}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #142a3f;">
                    <table width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="45%" style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Loại sự kiện</td>
                        <td width="55%" align="right" style="font-size: 14px; font-weight: 700; color: #38bdf8;">{safe_type}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #142a3f;">
                    <table width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="45%" style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Ngày diễn ra / GDKHQ</td>
                        <td width="55%" align="right" style="font-size: 15px; font-weight: 800; color: #f1f5f9;">{safe_full_date}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px;">
                    <table width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="45%" style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Nguồn dữ liệu</td>
                        <td width="55%" align="right" style="font-size: 13px; font-weight: 600; color: #94a3b8;">{safe_source}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Investor Guidance Card -->
              <div style="background-color: rgba(30, 58, 90, 0.35); border-left: 3px solid #38bdf8; padding: 14px 18px; border-radius: 4px 8px 8px 4px; margin-bottom: 28px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #cbd5e1;">
                  {safe_notes}
                </p>
              </div>

              <!-- Action CTA Button -->
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{stock_link}" target="_blank" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800; border-radius: 10px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); letter-spacing: 0.02em;">
                      Mở chi tiết mã {safe_symbol} trên InvestIQ &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #071524; border-top: 1px solid #142a3f; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #64748b; line-height: 1.5;">
                Bạn nhận được email này vì đã đăng ký tính năng nhắc lịch sự kiện trên nền tảng InvestIQ.
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; 2026 InvestIQ Financial Intelligence. Mọi quyền được bảo lưu.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def is_dummy_or_test_email(email: str) -> bool:
    """Detect test/dummy email addresses that must not be sent to real internet SMTP to avoid bounces."""
    cleaned = (email or "").strip().lower()
    if not cleaned or "@" not in cleaned:
        return True
    if any(cleaned.endswith(d) for d in DUMMY_DOMAINS):
        return True
    if cleaned.startswith("investor@") or cleaned.startswith("tester@") or cleaned.startswith("dummy@"):
        return True
    return False


def send_event_reminder_email(
    to_email: str,
    symbol: str,
    event_title: str,
    event_type: str,
    event_date_str: str,
    days_left: int = 1,
    notes: str | None = None,
    source_name: str | None = "HoSE / CafeF",
    app_url: str = "http://localhost:3000",
) -> tuple[bool, str]:
    """Sends a formatted reminder email. If SMTP is not set or email is dummy, persists HTML preview."""
    full_date_text, short_date = parse_and_format_event_date(event_date_str)
    event_type_vi = format_event_type_vi(event_type)

    html_content = render_event_reminder_html(
        symbol=symbol,
        event_title=event_title,
        event_type=event_type,
        event_date_str=event_date_str,
        days_left=days_left,
        notes=notes,
        source_name=source_name,
        app_url=app_url,
    )

    text_body = (
        f"InvestIQ - Nhắc nhở sự kiện {symbol}\n\n"
        f"Mã chứng khoán: {symbol}\n"
        f"Sự kiện: {event_title}\n"
        f"Loại sự kiện: {event_type_vi}\n"
        f"Thời gian diễn ra: {full_date_text} (còn {days_left} ngày)\n\n"
        f"Chi tiết xem tại: {app_url}/market/stocks/{symbol}\n"
    )

    # 1. Chặn gửi SMTP với email dummy/test để KHÔNG BAO GIỜ bị Mail Delivery Subsystem bounce
    if is_dummy_or_test_email(to_email):
        logger.info("Skipping SMTP delivery for dummy/test email: %s", to_email)
        try:
            PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)
            filename = f"reminder_{symbol}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
            (PREVIEWS_DIR / filename).write_text(html_content, encoding="utf-8")
        except Exception:
            pass
        return True, f"Bản xem trước email nhắc nhở đã được lưu thành công cho {to_email} (Test/Dev mode)."

    # 2. Gửi qua SMTP cấu hình thực tế
    if settings.auth_smtp_host and settings.auth_mail_from:
        try:
            message = EmailMessage()
            # Tiêu đề email bao gồm cả ngày diễn ra cụ thể để người dùng biết ngay
            message["Subject"] = f"[InvestIQ] Nhắc lịch sự kiện: {symbol} - {event_title} ({short_date})"
            message["From"] = settings.auth_mail_from
            message["To"] = to_email

            sender_address = parseaddr(settings.auth_mail_from or "")[1]
            sender_domain = sender_address.rpartition("@")[2] or None
            message["Date"] = format_datetime(datetime.now(UTC))
            message["Message-ID"] = make_msgid(domain=sender_domain)
            message.set_content(text_body)
            message.add_alternative(html_content, subtype="html")

            with smtplib.SMTP(settings.auth_smtp_host, settings.auth_smtp_port, timeout=8) as smtp:
                if settings.auth_smtp_starttls:
                    smtp.starttls(context=ssl.create_default_context())
                if settings.auth_smtp_username and settings.auth_smtp_password:
                    smtp.login(
                        settings.auth_smtp_username,
                        settings.auth_smtp_password.get_secret_value(),
                    )
                smtp.send_message(message)

            logger.info("event_reminder_email_sent_smtp", extra={"to": to_email, "symbol": symbol})
            return True, "Email đã được gửi thành công qua SMTP"
        except Exception as exc:
            logger.warning(
                "event_reminder_smtp_failed_fallback_log",
                extra={"to": to_email, "error": str(exc)},
            )

    # 3. Fallback lưu bản xem trước
    try:
        PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"reminder_{symbol}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        (PREVIEWS_DIR / filename).write_text(html_content, encoding="utf-8")
        logger.info("event_reminder_saved_preview", extra={"path": str(PREVIEWS_DIR / filename)})
        return True, f"Email nhắc nhở đã được tạo và lưu bản xem trước tại {filename}"
    except Exception as exc:
        logger.error("event_reminder_preview_failed", extra={"error": str(exc)})
        return False, str(exc)
