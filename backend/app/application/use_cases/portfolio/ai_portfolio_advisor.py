"""AI Portfolio Advisor Engine.

Provides objective, educational, and actionable feedback on paper portfolio positions,
focusing on capital preservation, stop-loss discipline, profit-taking, and risk allocation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class HoldingAnalysis:
    symbol: str
    name: str
    quantity: int
    average_cost: float
    current_price: float
    market_value: float
    pnl: float
    pnl_percent: float
    weight_percent: float
    risk_level: str  # "high", "moderate", "safe"
    recommendation: str


@dataclass
class AIPortfolioReview:
    portfolio_health_score: int  # 0 to 100
    risk_profile: str  # "Thận trọng", "Cân bằng", "Tăng trưởng cao", "Rủi ro cao"
    capital_allocation_advice: str
    stop_loss_discipline: str
    take_profit_strategy: str
    overall_verdict: str
    action_items: list[str]
    holdings_analyzed: list[HoldingAnalysis]


def generate_ai_portfolio_review(
    account_data: dict[str, Any],
    holdings_data: list[dict[str, Any]],
    trades_data: list[dict[str, Any]] | None = None,
) -> AIPortfolioReview:
    """Analyze paper portfolio and produce structured AI advisor insights."""
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

    cash_ratio = (avail_cash / total_val) * 100 if total_val > 0 else 100.0

    # Phân tích từng mã cổ phiếu
    analyzed_holdings: list[HoldingAnalysis] = []
    deep_loss_symbols: list[tuple[str, float]] = []
    mild_loss_symbols: list[tuple[str, float]] = []
    big_gain_symbols: list[tuple[str, float]] = []
    moderate_gain_symbols: list[tuple[str, float]] = []
    overweight_symbols: list[tuple[str, float]] = []

    for h in holdings_data:
        sym = str(h.get("symbol", "")).upper()
        name = str(h.get("name", sym))
        qty = int(h.get("quantity") or 0)
        avg_cost = float(h.get("average_cost") or 0)
        curr_price = float(h.get("current_price") or avg_cost)
        mkt_val = float(h.get("market_value") or (qty * curr_price))
        pnl = float(h.get("unrealized_pnl") or ((curr_price - avg_cost) * qty))
        pnl_pct_raw = (
            str(h.get("unrealized_pnl_percent") or "0")
            .replace("%", "")
            .replace("+", "")
            .replace("−", "-")
        )
        try:
            pnl_pct = float(pnl_pct_raw)
        except ValueError:
            pnl_pct = ((curr_price - avg_cost) / avg_cost * 100) if avg_cost > 0 else 0.0

        weight = (mkt_val / total_val * 100) if total_val > 0 else 0.0

        # Đánh giá rủi ro và khuyến nghị từng mã
        risk = "moderate"
        advice = "Nắm giữ quan sát diễn biến giá."

        if weight > 35.0:
            overweight_symbols.append((sym, weight))

        if pnl_pct <= -7.0:
            deep_loss_symbols.append((sym, pnl_pct))
            risk = "high"
            advice = f"Cắt lỗ dứt khoát hoặc hạ 50% vị thế. Đang lỗ {pnl_pct:.1f}%, vượt ngưỡng an toàn chuẩn (7-8%)."
        elif -7.0 < pnl_pct <= -3.0:
            mild_loss_symbols.append((sym, pnl_pct))
            risk = "moderate"
            advice = f"Đặt chặn lỗ nghiêm ngặt tại {avg_cost * 0.93:,.0f} đ (-7%). Đang lỗ nhẹ {pnl_pct:.1f}%."
        elif pnl_pct >= 15.0:
            big_gain_symbols.append((sym, pnl_pct))
            risk = "safe"
            advice = f"Cân nhắc hiện thực hóa 30-50% lợi nhuận (+{pnl_pct:.1f}%), nâng chặn lãi (trailing stop) để bảo toàn thành quả."
        elif 5.0 <= pnl_pct < 15.0:
            moderate_gain_symbols.append((sym, pnl_pct))
            risk = "safe"
            advice = f"Đà tăng tốt (+{pnl_pct:.1f}%), để lãi tiếp tục chạy theo xu hướng, chưa cần vội bán non."

        analyzed_holdings.append(
            HoldingAnalysis(
                symbol=sym,
                name=name,
                quantity=qty,
                average_cost=avg_cost,
                current_price=curr_price,
                market_value=mkt_val,
                pnl=pnl,
                pnl_percent=pnl_pct,
                weight_percent=weight,
                risk_level=risk,
                recommendation=advice,
            )
        )

    # 1. Quản trị Vốn & Phân Bổ Tiền Mặt
    if not analyzed_holdings:
        capital_advice = (
            f"Tài khoản hiện đang giữ 100% tiền mặt ({avail_cash:,.0f} đ). "
            "Đây là trạng thái an toàn tuyệt đối nhưng chưa tối ưu hiệu suất vốn. "
            "Bạn có thể bắt đầu giải ngân thử nghiệm với 15-20% tài khoản vào các cổ phiếu đầu ngành VN30 có nền giá tích lũy tốt."
        )
        risk_profile = "Thận trọng cao (100% Cash)"
        health_score = 75
    elif cash_ratio > 60.0:
        capital_advice = (
            f"Tỷ lệ tiền mặt hiện ở mức cao ({cash_ratio:.1f}%). Bạn đang có bộ đệm an toàn rất vững chắc. "
            "Với số vốn giả lập dồi dào, bạn hoàn toàn chủ động khi thị trường có nhịp điều chỉnh chiết khấu hấp dẫn để giải ngân theo từng đợt."
        )
        risk_profile = "Thận trọng"
        health_score = 85
    elif 20.0 <= cash_ratio <= 60.0:
        capital_advice = (
            f"Tỷ trọng tiền mặt đạt mức tối ưu ({cash_ratio:.1f}% tổng tài sản). "
            "Cơ cấu này đảm bảo sự cân bằng lý tưởng giữa khả năng sinh lời từ cổ phiếu và sự linh hoạt của dòng tiền dự phòng."
        )
        risk_profile = "Cân bằng lý tưởng"
        health_score = 90
    else:
        capital_advice = (
            f"Tỷ lệ tiền mặt đang khá thấp ({cash_ratio:.1f}%), gần như 'Full Cổ'. "
            "Trong đầu tư thực chiến, việc cạn tiền mặt làm mất đi vị thế phòng thủ khi thị trường chung biến động bất ngờ. "
            "Khuyến nghị bạn nên duy trì tối thiểu 15-20% tiền mặt để sẵn sàng ứng phó."
        )
        risk_profile = "Tấn công mạo hiểm (Full Stock)"
        health_score = 70

    if overweight_symbols:
        top_sym, top_wt = overweight_symbols[0]
        capital_advice += (
            f" Lưu ý: Mã {top_sym} đang chiếm tỷ trọng quá lớn ({top_wt:.1f}% danh mục). "
            "Rủi ro tập trung (Concentration Risk) đang hiện hữu, nên hạ dần tỷ trọng dưới 30% để phân tán rủi ro."
        )
        health_score = max(50, health_score - 10)

    # 2. Kỷ luật Cắt lỗ & Bảo Toàn Vốn
    if deep_loss_symbols:
        loss_details = ", ".join([f"{s} ({p:.1f}%)" for s, p in deep_loss_symbols])
        stop_loss_advice = (
            f"CẢNH BÁO BẢO TOÀN VỐN: Bạn đang có mã lỗ vượt mức an toàn: {loss_details}. "
            "Quy tắc vàng của các bậc thầy đầu tư chứng khoán (William O'Neil, Mark Minervini) là tuyệt đối không để khoản lỗ vượt quá 7-8%. "
            "Một khoản lỗ -10% chỉ cần +11% để hòa vốn, nhưng nếu để trượt xuống -30% thì bạn phải kiếm lại +43% mới về điểm xuất phát. "
            "Hãy rèn luyện phản xạ cắt lỗ không do dự để bảo vệ nguồn vốn quý giá."
        )
        health_score = max(40, health_score - 20)
    elif mild_loss_symbols:
        loss_details = ", ".join([f"{s} ({p:.1f}%)" for s, p in mild_loss_symbols])
        stop_loss_advice = (
            f"VÙNG QUAN SÁT CẢNH GIÁC: Các mã {loss_details} đang chịu mức điều chỉnh nhẹ dưới 7%. "
            "Hãy đặt sẵn ngưỡng dừng lỗ tự động tại -7% so với giá mua. Nếu giá thủng hỗ trợ, hãy dứt khoát kích hoạt lệnh bán thay vì ôm hy vọng."
        )
        health_score = max(60, health_score - 5)
    else:
        stop_loss_advice = (
            "KỶ LUẬT KIỂM SOÁT TỐT: Danh mục hiện tại không có mã nào vi phạm ngưỡng cắt lỗ. "
            "Tất cả các vị thế đều nằm trong vùng an toàn hoặc đang sinh lời. Hãy duy trì sự tỉnh táo và tiếp tục tuân thủ mốc chặn lỗ -7% cho mọi lệnh mua mới."
        )

    # 3. Chiến lược Chốt lời & Quản trị Lòng tham
    if big_gain_symbols:
        gain_details = ", ".join([f"{s} (+{p:.1f}%)" for s, p in big_gain_symbols])
        take_profit_advice = (
            f"HIỆN THỰC HÓA THÀNH QUẢ: Các mã {gain_details} đang có mức sinh lời rất ấn tượng (>15%). "
            "Thị trường chứng khoán luôn có chu kỳ; lợi nhuận chỉ thực sự là của bạn khi đã chốt vào tiền mặt. "
            "Chiến lược khuyên dùng: Bán chốt lời 30% - 50% khối lượng để bỏ túi lợi nhuận, giữ phần còn lại và nâng mức chặn lãi (Trailing Stop) theo đường MA20 để tối đa hóa xu hướng."
        )
    elif moderate_gain_symbols:
        gain_details = ", ".join([f"{s} (+{p:.1f}%)" for s, p in moderate_gain_symbols])
        take_profit_advice = (
            f"XU HƯỚNG TĂNG ĐƯỢC DUY TRÌ: Các mã {gain_details} đang tăng trưởng ổn định (5% - 15%). "
            "Hãy kiên nhẫn để lãi tiếp tục chạy (Let your winners run), không nên chốt non khi cổ phiếu chưa có tín hiệu suy yếu hoặc phân phối khối lượng lớn."
        )
    else:
        take_profit_advice = (
            "CÁC VỊ THẾ ĐANG TRONG GIAI ĐOẠN KHỞI ĐỘNG: Danh mục chưa có vị thế nào chạm mốc mục tiêu ngắn hạn (+15% đến +20%). "
            "Hãy tiếp tục kiên nhẫn theo dõi hành động giá và khối lượng giao dịch trong các phiên tới."
        )

    # 4. Kế hoạch hành động cụ thể cho phiên kế tiếp
    action_items = []
    if deep_loss_symbols:
        action_items.append(
            f"Xem xét bán hạ tỷ trọng hoặc cắt dứt điểm các mã {', '.join([s[0] for s in deep_loss_symbols])} để giải phóng dòng tiền."
        )
    if big_gain_symbols:
        action_items.append(
            f"Cân nhắc đặt lệnh chốt lời một phần (1/3 vị thế) cho mã {big_gain_symbols[0][0]} để khóa lợi nhuận."
        )
    if cash_ratio < 15.0:
        action_items.append(
            "Bán bớt vị thế yếu nhất để tăng tỷ lệ tiền mặt dự phòng lên tối thiểu 20%."
        )
    elif cash_ratio > 70.0 and len(analyzed_holdings) < 3:
        action_items.append(
            "Lọc thêm 1-2 cổ phiếu thuộc nhóm ngành khác (Ngân hàng, Thép, Bán lẻ) để đa dạng hóa danh mục."
        )
    else:
        action_items.append(
            "Tiếp tục nắm giữ các mã đang vận động tích cực trên đường trung bình MA20."
        )

    # Tóm tắt chung
    verdict = (
        f"Danh mục mô phỏng hiện đạt điểm sức khỏe {health_score}/100 với hồ sơ rủi ro '{risk_profile}'. "
        f"Tổng tài sản ghi nhận {total_val:,.0f} đ ({'+' if total_pnl >= 0 else ''}{total_pnl:,.0f} đ, tương ứng {total_return_pct:+.2f}%). "
        "Hãy coi số tiền giả định này như tiền mồ hôi nước mắt của chính bạn ngoài đời thực để trui rèn kỷ luật và tâm lý giao dịch vững vàng."
    )

    return AIPortfolioReview(
        portfolio_health_score=health_score,
        risk_profile=risk_profile,
        capital_allocation_advice=capital_advice,
        stop_loss_discipline=stop_loss_advice,
        take_profit_strategy=take_profit_advice,
        overall_verdict=verdict,
        action_items=action_items,
        holdings_analyzed=analyzed_holdings,
    )
