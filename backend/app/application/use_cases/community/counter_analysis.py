"""Evidence-linked AI Counter-Analysis generator for community investment theses."""

from __future__ import annotations

from collections.abc import Sequence
from decimal import Decimal
from typing import Any


def generate_counter_analysis(
    *,
    thesis: dict[str, Any],
    news_items: Sequence[dict[str, Any]],
    financial_statement: dict[str, Any] | None,
    current_price: Decimal | None,
) -> dict[str, Any]:
    """Build structured, source-linked counter-arguments challenging a thesis."""
    symbol = str(thesis.get("symbol") or "").upper()
    stance = str(thesis.get("stance") or "bullish").lower()
    target_price = Decimal(str(thesis.get("target_price") or "0"))
    stop_loss_price = Decimal(str(thesis.get("stop_loss_price") or "0"))
    entry_price = Decimal(str(thesis.get("entry_price") or "0"))

    counter_points: list[dict[str, Any]] = []

    # 1. Price action & Risk/Reward asymmetry check
    if current_price and current_price > 0 and target_price > 0 and stop_loss_price > 0:
        if stance == "bullish":
            upside_pct = float((target_price - current_price) / current_price * Decimal("100"))
            downside_pct = float((current_price - stop_loss_price) / current_price * Decimal("100"))
            if upside_pct <= 5.0:
                counter_points.append(
                    {
                        "title": "Dư địa tăng đến giá mục tiêu đã thu hẹp",
                        "detail": (
                            f"Giá hiện tại ({current_price:,.0f} đ) chỉ còn cách giá mục tiêu "
                            f"({target_price:,.0f} đ) khoảng {upside_pct:.1f}%, trong khi rủi ro "
                            f"tới mốc cắt lỗ ({stop_loss_price:,.0f} đ) là {downside_pct:.1f}%."
                        ),
                        "evidence_type": "price_action",
                        "source_url": None,
                    }
                )
            elif entry_price > 0 and current_price < entry_price:
                drawdown = float((entry_price - current_price) / entry_price * Decimal("100"))
                counter_points.append(
                    {
                        "title": "Diễn biến giá hiện đang đi ngược luận điểm",
                        "detail": (
                            f"{symbol} đang giảm {drawdown:.1f}% so với giá lúc công bố "
                            f"({entry_price:,.0f} đ → {current_price:,.0f} đ), cần kiểm tra lại "
                            f"điều kiện vô hiệu tại {stop_loss_price:,.0f} đ."
                        ),
                        "evidence_type": "price_action",
                        "source_url": None,
                    }
                )
        else:
            downside_target_pct = float(
                (current_price - target_price) / current_price * Decimal("100")
            )
            counter_points.append(
                {
                    "title": "Rủi ro phục hồi kỹ thuật ngược vị thế",
                    "detail": (
                        f"Với quan điểm {stance}, khoảng cách tới mục tiêu ({target_price:,.0f} đ) "
                        f"là {downside_target_pct:.1f}%; lực cầu bắt đáy quanh vùng hỗ trợ có thể "
                        f"đẩy giá vượt mốc phòng thủ {stop_loss_price:,.0f} đ."
                    ),
                    "evidence_type": "price_action",
                    "source_url": None,
                }
            )

    # 2. Contrarian news evidence from PostgreSQL articles
    target_sentiment = "negative" if stance == "bullish" else "positive"
    opposing_news = [
        n
        for n in news_items
        if str(n.get("sentiment") or n.get("sentiment_label") or "").lower() == target_sentiment
    ]
    for article in opposing_news[:2]:
        title = str(article.get("title") or "Tin tức liên quan")
        source = str(article.get("source_name") or article.get("source_slug") or "Nguồn tin")
        url = article.get("canonical_url") or article.get("url")
        counter_points.append(
            {
                "title": f"Tín hiệu tin tức trái chiều ({source})",
                "detail": f'Bài viết "{title}" ghi nhận sắc thái {target_sentiment} cho {symbol}.',
                "evidence_type": "news",
                "source_url": str(url) if url else None,
            }
        )

    # 3. Financial statement stress check
    if financial_statement:
        charts = financial_statement.get("charts") or []
        if isinstance(charts, list) and len(charts) >= 2:
            latest_q = charts[0]
            prev_q = charts[1]
            rev_now = latest_q.get("revenue_billion")
            rev_prev = prev_q.get("revenue_billion")
            profit_now = latest_q.get("profit_billion")
            profit_prev = prev_q.get("profit_billion")
            if (
                isinstance(rev_now, (int, float))
                and isinstance(rev_prev, (int, float))
                and rev_prev > 0
                and rev_now < rev_prev
                and stance == "bullish"
            ):
                chg = ((rev_now - rev_prev) / rev_prev) * 100.0
                counter_points.append(
                    {
                        "title": "Doanh thu kỳ gần nhất giảm tốc so với kỳ liền trước",
                        "detail": (
                            f"Doanh thu kỳ {latest_q.get('period')} đạt {rev_now:,.1f} tỷ "
                            f"({chg:+.1f}% so với {prev_q.get('period')}: {rev_prev:,.1f} tỷ), "
                            "cần theo dõi biên lợi nhuận nếu kỳ vọng tăng trưởng cao."
                        ),
                        "evidence_type": "financials",
                        "source_url": None,
                    }
                )
            elif (
                isinstance(profit_now, (int, float))
                and isinstance(profit_prev, (int, float))
                and profit_now > profit_prev
                and stance == "bearish"
            ):
                counter_points.append(
                    {
                        "title": "Lợi nhuận sau thuế kỳ gần nhất vẫn tăng trưởng",
                        "detail": (
                            f"LNST kỳ {latest_q.get('period')} đạt {profit_now:,.1f} tỷ, cao hơn "
                            f"kỳ trước ({profit_prev:,.1f} tỷ), tạo nền tảng cơ bản hỗ trợ giá."
                        ),
                        "evidence_type": "financials",
                        "source_url": None,
                    }
                )

    if not counter_points:
        counter_points.append(
            {
                "title": "Cần thêm bằng chứng định lượng và đa dạng nguồn xác thực",
                "detail": (
                    f"Chưa phát hiện tin tức trái chiều nổi bật cho {symbol} trong dữ liệu gần đây. "
                    "Nhà đầu tư nên đối chiếu thêm biến động VN-Index và thanh khoản ngành trước khi giải ngân."
                ),
                "evidence_type": "general",
                "source_url": None,
            }
        )

    return {
        "thesis_id": str(thesis.get("id") or ""),
        "symbol": symbol,
        "challenged_stance": stance,
        "counter_points": counter_points,
        "disclaimer": (
            "Phân tích phản biện được tổng hợp tự động từ dữ liệu giá, tin tức và BCTC lưu trong "
            "hệ thống; chỉ phục vụ tham khảo, không phải khuyến nghị đầu tư."
        ),
    }
