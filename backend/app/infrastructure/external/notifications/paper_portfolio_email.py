"""Automated HTML Email service for Paper Portfolio Daily Reports with AI Review."""

from __future__ import annotations

import logging
import os
import smtplib
import ssl
from datetime import UTC, datetime
from email.message import EmailMessage
from email.utils import format_datetime, formataddr, make_msgid, parseaddr
from pathlib import Path
from typing import Any

from app.application.use_cases.portfolio.ai_portfolio_advisor import AIPortfolioReview

logger = logging.getLogger(__name__)


def build_paper_portfolio_email_html(
    email: str,
    account_data: dict[str, Any],
    ai_review: AIPortfolioReview,
    report_date_str: str | None = None,
) -> str:
    """Render a premium responsive fintech dark-themed email report with AI feedback."""
    now_str = report_date_str or datetime.now(UTC).strftime("%d/%m/%Y")

    total_val = float(
        account_data.get("total_value") or account_data.get("starting_cash") or 1_000_000_000
    )
    avail_cash = float(account_data.get("available_cash") or account_data.get("cash_balance") or 0)
    total_pnl = float(account_data.get("total_pnl") or account_data.get("unrealized_pnl") or 0)
    total_return_pct = float(
        str(account_data.get("total_return_percent") or "0")
        .replace("%", "")
        .replace("+", "")
        .replace("−", "-")
    )

    pnl_color = "#10b981" if total_pnl >= 0 else "#f43f5e"
    pnl_sign = "+" if total_pnl >= 0 else ""

    # Build holdings table rows
    holdings_rows_html = ""
    if ai_review.holdings_analyzed:
        for h in ai_review.holdings_analyzed:
            h_pnl_color = "#10b981" if h.pnl >= 0 else "#f43f5e"
            h_sign = "+" if h.pnl >= 0 else ""
            holdings_rows_html += f"""
            <tr style="border-bottom: 1px solid #1a3854;">
              <td style="padding: 12px 10px; font-weight: 800; color: #38bdf8; font-size: 13px;">{
                h.symbol
            }</td>
              <td style="padding: 12px 10px; text-align: right; color: #cbd5e1; font-size: 12px;">{
                h.quantity:,} CP</td>
              <td style="padding: 12px 10px; text-align: right; color: #94a3b8; font-size: 12px;">{
                h.average_cost:,.0f} đ</td>
              <td style="padding: 12px 10px; text-align: right; color: #f8fafc; font-weight: 700; font-size: 12px;">{
                h.current_price:,.0f} đ</td>
              <td style="padding: 12px 10px; text-align: right; font-weight: 800; color: {
                h_pnl_color
            }; font-size: 12px;">
                {h_sign}{h.pnl_percent:.1f}%<br>
                <span style="font-size: 10px; font-weight: 600; opacity: 0.85;">{h_sign}{
                h.pnl:,.0f} đ</span>
              </td>
              <td style="padding: 12px 10px; font-size: 11px; color: #cbd5e1; line-height: 1.4;">
                <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px; margin-bottom: 3px; {
                "background: #7f1d1d; color: #fecaca; border: 1px solid #dc2626;"
                if h.risk_level == "high"
                else (
                    "background: #064e3b; color: #a7f3d0; border: 1px solid #059669;"
                    if h.risk_level == "safe"
                    else "background: #1e3a5f; color: #93c5fd; border: 1px solid #2563eb;"
                )
            }">
                  {
                "RỦI RO CAO"
                if h.risk_level == "high"
                else ("AN TOÀN" if h.risk_level == "safe" else "THEO DÕI")
            }
                </span><br>
                {h.recommendation}
              </td>
            </tr>
            """
    else:
        holdings_rows_html = """
        <tr>
          <td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 12px;">
            Hiện danh mục đang giữ 100% tiền mặt, chưa mua cổ phiếu nào.
          </td>
        </tr>
        """

    # Build action items list
    action_items_html = "".join(
        [
            f'<li style="margin-bottom: 8px; color: #e2e8f0; font-size: 12px; line-height: 1.5;">{item}</li>'
            for item in ai_review.action_items
        ]
    )

    score_color = (
        "#10b981"
        if ai_review.portfolio_health_score >= 80
        else ("#f59e0b" if ai_review.portfolio_health_score >= 60 else "#f43f5e")
    )

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>InvestIQ - Báo cáo Kết quả Đầu tư Thử & Nhận xét từ AI</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #06101d;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #f8fafc;
      -webkit-font-smoothing: antialiased;
    }}
    table {{ border-collapse: collapse; }}
    @media only screen and (max-width: 600px) {{
      .email-container {{ width: 100% !important; padding: 12px !important; }}
      .summary-col {{ display: block !important; width: 100% !important; margin-bottom: 10px !important; }}
    }}
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #06101d;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="min-width: 100%;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" class="email-container" width="620" cellpadding="0" cellspacing="0" style="max-width: 620px; width: 100%; background: #0b1f33; border: 1px solid #1e3f5d; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">

          <!-- Header Bar -->
          <tr>
            <td style="padding: 28px 24px 20px; background: linear-gradient(135deg, #091c2d 0%, #0d2840 100%); border-bottom: 1px solid #1a3c5a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; font-size: 10px; font-weight: 800; color: #38e1b0; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">
                      INVESTIQ PAPER TRADING · NHẬT KÝ ĐẦU TƯ THỬ
                    </span>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: -0.02em;">
                      Báo Cáo Danh Mục & Đánh Giá Từ AI
                    </h1>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #8da4b8;">
                      Phiên giao dịch ngày {now_str} · Dành riêng cho {email}
                    </p>
                  </td>
                  <td align="right" valign="top">
                    <div style="background: #082136; border: 1px solid #1c4b72; padding: 6px 12px; border-radius: 12px; text-align: center;">
                      <span style="display: block; font-size: 9px; font-weight: 800; color: #8da6bc; text-transform: uppercase;">Điểm Sức Khỏe</span>
                      <strong style="font-size: 18px; font-weight: 900; color: {score_color};">{ai_review.portfolio_health_score}/100</strong>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Snapshot Summary Cards (3 Columns) -->
          <tr>
            <td style="padding: 20px 24px 10px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Card 1: Total Value -->
                  <td class="summary-col" width="32%" style="background: #081a2b; border: 1px solid #183754; border-radius: 12px; padding: 14px 12px; text-align: left; vertical-align: top;">
                    <span style="font-size: 10px; font-weight: 700; color: #7994ab; text-transform: uppercase; display: block; margin-bottom: 4px;">Tổng Tài Sản</span>
                    <strong style="font-size: 15px; font-weight: 900; color: #ffffff; display: block; line-height: 1.2;">{total_val:,.0f} đ</strong>
                    <span style="font-size: 10px; color: #94a3b8; margin-top: 4px; display: block;">Vốn khởi đầu: 1 Tỷ</span>
                  </td>
                  <td width="2%">&nbsp;</td>
                  <!-- Card 2: Total Return -->
                  <td class="summary-col" width="32%" style="background: #081a2b; border: 1px solid #183754; border-radius: 12px; padding: 14px 12px; text-align: left; vertical-align: top;">
                    <span style="font-size: 10px; font-weight: 700; color: #7994ab; text-transform: uppercase; display: block; margin-bottom: 4px;">Hiệu Suất Sinh Lời</span>
                    <strong style="font-size: 15px; font-weight: 900; color: {pnl_color}; display: block; line-height: 1.2;">
                      {pnl_sign}{total_return_pct:+.2f}%
                    </strong>
                    <span style="font-size: 10px; font-weight: 700; color: {pnl_color}; margin-top: 4px; display: block;">
                      {pnl_sign}{total_pnl:,.0f} đ
                    </span>
                  </td>
                  <td width="2%">&nbsp;</td>
                  <!-- Card 3: Available Cash -->
                  <td class="summary-col" width="32%" style="background: #081a2b; border: 1px solid #183754; border-radius: 12px; padding: 14px 12px; text-align: left; vertical-align: top;">
                    <span style="font-size: 10px; font-weight: 700; color: #7994ab; text-transform: uppercase; display: block; margin-bottom: 4px;">Tiền Mặt Khả Dụng</span>
                    <strong style="font-size: 15px; font-weight: 900; color: #38bdf8; display: block; line-height: 1.2;">{avail_cash:,.0f} đ</strong>
                    <span style="font-size: 10px; color: #94a3b8; margin-top: 4px; display: block;">Chiếm {(avail_cash / total_val * 100):.1f}% tài sản</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section: Holdings Table -->
          <tr>
            <td style="padding: 16px 24px;">
              <div style="border-bottom: 1px solid #1a3854; padding-bottom: 8px; margin-bottom: 12px;">
                <h2 style="margin: 0; font-size: 14px; font-weight: 800; color: #f1f7fb; text-transform: uppercase; letter-spacing: 0.05em;">
                  Chi Tiết Cổ Phiếu Đang Nắm Giữ ({len(ai_review.holdings_analyzed)} mã)
                </h2>
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #081a2b; border: 1px solid #183754; border-radius: 12px; overflow: hidden;">
                <thead>
                  <tr style="background: #0e2942; border-bottom: 1px solid #1a3854;">
                    <th style="padding: 10px; font-size: 11px; font-weight: 800; color: #8da4b8; text-align: left;">Mã</th>
                    <th style="padding: 10px; font-size: 11px; font-weight: 800; color: #8da4b8; text-align: right;">KL</th>
                    <th style="padding: 10px; font-size: 11px; font-weight: 800; color: #8da4b8; text-align: right;">Giá Vốn</th>
                    <th style="padding: 10px; font-size: 11px; font-weight: 800; color: #8da4b8; text-align: right;">Giá Hiện Tại</th>
                    <th style="padding: 10px; font-size: 11px; font-weight: 800; color: #8da4b8; text-align: right;">Lãi / Lỗ</th>
                    <th style="padding: 10px; font-size: 11px; font-weight: 800; color: #8da4b8; text-align: left;">Khuyến Nghị AI</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings_rows_html}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Section: AI ADVISOR INSIGHTS BOX -->
          <tr>
            <td style="padding: 10px 24px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #092033 0%, #061624 100%); border: 1px solid #1d4e78; border-radius: 14px; overflow: hidden; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);">
                <tr>
                  <td style="padding: 16px 18px; border-bottom: 1px solid #1a3d5f; background: rgba(56, 189, 248, 0.06);">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="font-size: 10px; font-weight: 800; color: #38e1b0; text-transform: uppercase; letter-spacing: 0.08em; display: block;">
                            GÓC NHÌN CHUYÊN GIA AI
                          </span>
                          <strong style="font-size: 15px; font-weight: 900; color: #ffffff;">
                            Nhận Xét Toàn Diện Về Kỷ Luật & Quản Trị Rủi Ro
                          </strong>
                        </td>
                        <td align="right">
                          <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; background: #0e3758; border: 1px solid #205c8a; font-size: 11px; font-weight: 700; color: #7dd3fc;">
                            {ai_review.risk_profile}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- 1. Quản trị vốn & Giữ tiền -->
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #142e47;">
                    <div style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-bottom: 4px;">
                      1. Quản Trị Vốn & Tỷ Trọng Tiền Mặt
                    </div>
                    <p style="margin: 0; font-size: 12px; color: #cbd5e1; line-height: 1.55;">
                      {ai_review.capital_allocation_advice}
                    </p>
                  </td>
                </tr>

                <!-- 2. Kỷ luật cắt lỗ -->
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #142e47;">
                    <div style="font-size: 11px; font-weight: 800; color: #fb7185; text-transform: uppercase; margin-bottom: 4px;">
                      2. Kỷ Luật Cắt Lỗ & Bảo Toàn Vốn
                    </div>
                    <p style="margin: 0; font-size: 12px; color: #cbd5e1; line-height: 1.55;">
                      {ai_review.stop_loss_discipline}
                    </p>
                  </td>
                </tr>

                <!-- 3. Chiến lược chốt lời -->
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #142e47;">
                    <div style="font-size: 11px; font-weight: 800; color: #34d399; text-transform: uppercase; margin-bottom: 4px;">
                      3. Chiến Lược Chốt Lời & Khóa Lợi Nhuận
                    </div>
                    <p style="margin: 0; font-size: 12px; color: #cbd5e1; line-height: 1.55;">
                      {ai_review.take_profit_strategy}
                    </p>
                  </td>
                </tr>

                <!-- 4. Kế hoạch hành động cụ thể -->
                <tr>
                  <td style="padding: 14px 18px;">
                    <div style="font-size: 11px; font-weight: 800; color: #fbbf24; text-transform: uppercase; margin-bottom: 6px;">
                      4. Gợi Ý Hành Động Cho Phiên Kế Tiếp
                    </div>
                    <ul style="margin: 0; padding-left: 18px;">
                      {action_items_html}
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 10px 24px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius: 12px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);">
                    <a href="http://localhost:3000/portfolio" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 13px; font-weight: 800; color: #ffffff; text-decoration: none; border-radius: 12px; letter-spacing: -0.01em;">
                      Mở Danh Mục Đầu Tư Thử Trên InvestIQ →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 12px 0 0; font-size: 11px; color: #64748b;">
                Tập luyện giao dịch không rủi ro tài chính · Dữ liệu phản ánh giá quan sát sàn HOSE & HNX
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 24px; background: #071524; border-top: 1px solid #142e47; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 11px; color: #64748b;">
                Báo cáo này được tự động tạo bởi Trợ lý AI InvestIQ nhằm hỗ trợ rèn luyện tư duy kỷ luật và phương pháp đầu tư thực chiến.
              </p>
              <p style="margin: 0; font-size: 10px; color: #475569;">
                &copy; 2026 InvestIQ Platform · Bạn nhận được thư này do đã bật tính năng Báo cáo Danh mục Thử nghiệm Hàng ngày.
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
    return html


def build_paper_portfolio_email_text(
    email: str,
    account_data: dict[str, Any],
    ai_review: AIPortfolioReview,
    report_date_str: str | None = None,
) -> str:
    """Render a clean, structured plaintext alternative to prevent email spam flags."""
    now_str = report_date_str or datetime.now(UTC).strftime("%d/%m/%Y")
    total_val = float(
        account_data.get("total_value") or account_data.get("starting_cash") or 1_000_000_000
    )
    avail_cash = float(account_data.get("available_cash") or account_data.get("cash_balance") or 0)
    total_pnl = float(account_data.get("total_pnl") or account_data.get("unrealized_pnl") or 0)
    total_return_pct = float(
        str(account_data.get("total_return_percent") or "0")
        .replace("%", "")
        .replace("+", "")
        .replace("−", "-")
    )
    pnl_sign = "+" if total_pnl >= 0 else ""

    lines = [
        "INVESTIQ PAPER TRADING - BÁO CÁO DANH MỤC & NHẬN XÉT AI",
        f"Phiên giao dịch: {now_str} | Dành riêng cho: {email}",
        "=" * 50,
        f"Tổng tài sản: {total_val:,.0f} đ",
        f"Hiệu suất: {pnl_sign}{total_return_pct:.2f}% ({pnl_sign}{total_pnl:,.0f} đ)",
        f"Tiền mặt khả dụng: {avail_cash:,.0f} đ",
        f"Điểm sức khỏe danh mục: {ai_review.portfolio_health_score}/100",
        f"Khẩu vị rủi ro: {ai_review.risk_profile}",
        "-" * 50,
        f"DANH SÁCH CỔ PHIẾU ({len(ai_review.holdings_analyzed)} mã):",
    ]
    if ai_review.holdings_analyzed:
        for h in ai_review.holdings_analyzed:
            h_sign = "+" if h.pnl >= 0 else ""
            lines.append(
                f"- {h.symbol}: {h.quantity:,} CP | Giá vốn: {h.average_cost:,.0f} đ | Hiện tại: {h.current_price:,.0f} đ | Lãi/Lỗ: {h_sign}{h.pnl_percent:.1f}% ({h_sign}{h.pnl:,.0f} đ) | {h.recommendation}"
            )
    else:
        lines.append("- Hiện danh mục đang giữ 100% tiền mặt, chưa mua cổ phiếu nào.")

    lines.extend(
        [
            "-" * 50,
            "ĐÁNH GIÁ TỪ TRỢ LÝ AI:",
            ai_review.overall_verdict,
            "",
            "HÀNH ĐỘNG ĐỀ XUẤT:",
        ]
    )
    for item in ai_review.action_items:
        lines.append(f"* {item}")

    lines.extend(
        [
            "",
            "=" * 50,
            "Báo cáo này được tự động tạo bởi InvestIQ Platform.",
            "Bạn nhận được thư này do đã bật tính năng Báo cáo Danh mục Thử nghiệm Hàng ngày.",
            "© 2026 InvestIQ Platform · support@investiq.vn",
        ]
    )
    return "\n".join(lines)


DUMMY_DOMAINS = (
    "@investiq.vn",
    "@example.com",
    "@test.com",
    "@localhost",
    "@mock.com",
    "@sample.com",
    "@temp.com",
)


def is_dummy_or_test_email(email: str) -> bool:
    cleaned = (email or "").strip().lower()
    if not cleaned or "@" not in cleaned:
        return True
    if any(cleaned.endswith(d) for d in DUMMY_DOMAINS):
        return True
    return bool(
        cleaned.startswith("investor@")
        or cleaned.startswith("tester@")
        or cleaned.startswith("user_")
    )


def send_paper_portfolio_daily_email(
    to_email: str,
    account_data: dict[str, Any],
    ai_review: AIPortfolioReview,
    report_date_str: str | None = None,
) -> tuple[bool, str]:
    """Send paper portfolio performance & AI review email via SMTP or save preview to disk."""
    html_content = build_paper_portfolio_email_html(
        email=to_email,
        account_data=account_data,
        ai_review=ai_review,
        report_date_str=report_date_str,
    )

    # 1. Luôn lưu bản preview HTML vào thư mục storage trong môi trường dev
    storage_dir = Path("app/storage/mail_preview")
    try:
        storage_dir.mkdir(parents=True, exist_ok=True)
        filename = f"paper_portfolio_report_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}_{to_email.replace('@', '_at_')}.html"
        preview_file = storage_dir / filename
        preview_file.write_text(html_content, encoding="utf-8")
        logger.info("Saved paper portfolio report mail preview to %s", preview_file)
    except Exception as exc:
        logger.warning("Could not save mail preview to disk: %s", exc)

    # 2. Chặn gửi SMTP với email dummy/test để KHÔNG BAO GIỜ bị Mail Delivery Subsystem bounce
    if is_dummy_or_test_email(to_email):
        logger.info("Skipping SMTP delivery for dummy/test email: %s", to_email)
        return (
            True,
            f"Báo cáo AI danh mục đã được tạo thành công và lưu bản xem trước cho {to_email} (Test/Dev mode).",
        )

    # 3. Gửi qua SMTP nếu có cấu hình
    from app.infrastructure.config.settings import settings

    smtp_host = settings.auth_smtp_host or os.getenv("SMTP_HOST") or os.getenv("INVESTIQ_SMTP_HOST")
    smtp_port = settings.auth_smtp_port or int(
        os.getenv("SMTP_PORT") or os.getenv("INVESTIQ_SMTP_PORT") or 587
    )
    smtp_user = (
        settings.auth_smtp_username or os.getenv("SMTP_USER") or os.getenv("INVESTIQ_SMTP_USER")
    )
    smtp_password = (
        (settings.auth_smtp_password.get_secret_value() if settings.auth_smtp_password else None)
        or os.getenv("SMTP_PASSWORD")
        or os.getenv("INVESTIQ_SMTP_PASSWORD")
    )
    sender_email = settings.auth_mail_from or os.getenv("SMTP_FROM") or "no-reply@investiq.vn"

    if not smtp_host:
        return (
            True,
            f"Báo cáo AI danh mục đã được tạo thành công và lưu bản xem trước cho {to_email} (Dev Mode).",
        )

    text_content = build_paper_portfolio_email_text(
        email=to_email,
        account_data=account_data,
        ai_review=ai_review,
        report_date_str=report_date_str,
    )

    try:
        raw_name, raw_address = parseaddr(sender_email)
        sender_address = raw_address if raw_address else "no-reply@investiq.vn"
        display_name = raw_name if raw_name else "InvestIQ"
        formatted_from = formataddr((display_name, sender_address))
        sender_domain = sender_address.rpartition("@")[2] or "investiq.vn"

        now_utc = datetime.now(UTC)
        formatted_date = report_date_str or now_utc.strftime("%d/%m/%Y")

        message = EmailMessage()
        message["Subject"] = f"[InvestIQ] Báo cáo danh mục đầu tư & đánh giá AI ({formatted_date})"
        message["From"] = formatted_from
        message["To"] = to_email
        message["Reply-To"] = formataddr(("InvestIQ Support", sender_address))
        message["Date"] = format_datetime(now_utc)
        message["Message-ID"] = make_msgid(domain=sender_domain)
        message["X-Mailer"] = "InvestIQ Notification Service 1.0"
        message["Auto-Submitted"] = "auto-generated"
        message["Precedence"] = "bulk"
        message["List-Unsubscribe"] = f"<mailto:{sender_address}?subject=unsubscribe>"

        # Set text/plain first, then attach text/html alternative (RFC 2046 compliant to prevent spam)
        message.set_content(text_content)
        message.add_alternative(html_content, subtype="html")

        with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
            if settings.auth_smtp_starttls:
                server.starttls(context=ssl.create_default_context())
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.send_message(message, from_addr=sender_address, to_addrs=[to_email])

        return True, f"Báo cáo AI danh mục đã được gửi thành công đến {to_email}."
    except Exception as exc:
        logger.error("Failed to send paper portfolio email via SMTP: %s", exc)
        return False, f"Lỗi gửi email: {exc}"
