"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { DisciplineMetrics } from "@/types/assessment";
import type { PaperDashboard } from "@/types/portfolio";

export function computeDisciplineFromDashboard(dashboard: PaperDashboard): DisciplineMetrics {
  const cashVnd = Number(dashboard.account.available_cash) || 0;
  const holdings = dashboard.holdings || [];
  const trades = dashboard.trades || [];

  const totalStockValue = holdings.reduce((sum, h) => sum + (Number(h.market_value) || 0), 0);
  const totalAssets = cashVnd + totalStockValue || 1;

  // 1. Diversification Score (25%)
  let diversificationScore = 80;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  if (holdings.length === 0) {
    diversificationScore = 70;
    strengths.push("Tài khoản chưa giải ngân, bảo toàn 100% tiền mặt.");
  } else if (holdings.length === 1) {
    diversificationScore = 40;
    weaknesses.push("Tất cả vốn đang dồn vào 1 mã duy nhất (rủi ro tập trung lớn).");
    recommendations.push("Nên phân bổ thành 3 đến 5 mã thuộc các ngành khác nhau để giảm thiểu rủi ro.");
  } else if (holdings.length >= 2 && holdings.length <= 6) {
    const maxVal = Math.max(...holdings.map((h) => Number(h.market_value) || 0));
    const maxRatio = maxVal / totalAssets;
    if (maxRatio <= 0.40) {
      diversificationScore = 95;
      strengths.push(`Danh mục cân đối (${holdings.length} mã), không mã nào chiếm quá 40% tài sản.`);
    } else {
      diversificationScore = 60;
      weaknesses.push(`Có mã chiếm tới ${Math.round(maxRatio * 100)}% danh mục, rủi ro biến động cao.`);
      recommendations.push("Cân nhắc hạ bớt tỷ trọng của mã lớn nhất về dưới 35% danh mục.");
    }
  }

  // 2. Cash Management Score (25%)
  const cashRatio = cashVnd / totalAssets;
  let cashScore = 80;
  if (cashRatio >= 0.10 && cashRatio <= 0.35) {
    cashScore = 95;
    strengths.push(`Duy trì bộ đệm tiền mặt an toàn ${Math.round(cashRatio * 100)}%.`);
  } else if (cashRatio < 0.05 && holdings.length > 0) {
    cashScore = 45;
    weaknesses.push("Gần như All-in 100% cổ phiếu, không còn tiền mặt dự phòng.");
    recommendations.push("Nên giữ ít nhất 10% - 20% tiền mặt để chủ động quản trị rủi ro.");
  } else if (cashRatio > 0.80) {
    cashScore = 75;
    strengths.push("Giữ tỷ lệ tiền mặt rất cao, rủi ro sụt giảm tài sản là cực thấp.");
  }

  // 3. Cut-loss Score (30%)
  let deepLossCount = 0;
  for (const h of holdings) {
    const pnlPct = Number(h.unrealized_pnl_percent) || 0;
    if (pnlPct <= -7.0) deepLossCount++;
  }
  let cutLossScore = 95;
  if (deepLossCount === 1) {
    cutLossScore = 65;
    weaknesses.push("Đang có 1 mã âm quá -7% nhưng chưa cắt lỗ bảo toàn vốn.");
    recommendations.push("Cần dứt khoát cắt lỗ mã âm sâu theo nguyên tắc 7-8% của William O'Neil.");
  } else if (deepLossCount > 1) {
    cutLossScore = 40;
    weaknesses.push(`Đang gồng lỗ ${deepLossCount} mã âm quá -7%, tâm lý gồng lỗ chi phối.`);
    recommendations.push("Cắt lỗ sớm giúp bạn giữ lại 90% vốn để làm lại ở con sóng mới.");
  } else {
    strengths.push("Không có vị thế nào bị âm sâu quá ngưỡng an toàn -7%.");
  }

  // 4. Emotional Pacing Score (20%)
  let pacingScore = 90;
  if (trades.length > 20) {
    pacingScore = 60;
    weaknesses.push("Tần suất mua bán khá dày đặc, có dấu hiệu Overtrading.");
    recommendations.push("Giảm nhịp độ giao dịch, chỉ mở vị thế khi đạt tiêu chuẩn kỹ thuật.");
  } else {
    strengths.push("Giao dịch có chọn lọc, nhịp độ bình tĩnh.");
  }

  const overall = Math.round(
    diversificationScore * 0.25 + cashScore * 0.25 + cutLossScore * 0.30 + pacingScore * 0.20
  );

  let badge = "Kỷ luật thép";
  if (overall < 55) badge = "Cảm xúc chi phối";
  else if (overall < 70) badge = "Cần rèn luyện thêm";
  else if (overall < 85) badge = "Khá chuẩn mực";

  return {
    cut_loss_score: cutLossScore,
    diversification_score: diversificationScore,
    cash_management_score: cashScore,
    emotional_pacing_score: pacingScore,
    overall_discipline_score: overall,
    badge,
    strengths,
    weaknesses,
    recommendations,
  };
}

interface Props {
  initialMetrics?: DisciplineMetrics | null;
  dashboard?: PaperDashboard | null;
}

export function TradingDisciplineCard({ initialMetrics, dashboard }: Props) {
  const hasActivity = Boolean(
    initialMetrics ||
    (dashboard && ((dashboard.trades && dashboard.trades.length > 0) || (dashboard.holdings && dashboard.holdings.length > 0)))
  );

  const metrics = useMemo(() => {
    if (initialMetrics) return initialMetrics;
    if (dashboard) return computeDisciplineFromDashboard(dashboard);
    return null;
  }, [initialMetrics, dashboard]);

  if (!hasActivity) {
    return (
      <div
        className="trading-discipline-card"
        style={{
          background: "#0b1f33",
          border: "1px solid #1e3f5d",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              HỆ THỐNG ĐÁNH GIÁ HÀNH VI ĐẦU TƯ
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", marginTop: "0.15rem" }}>
              Chỉ số Kỷ luật Giao dịch
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <span
              style={{
                display: "inline-block",
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                background: "rgba(148, 163, 184, 0.15)",
                color: "#94a3b8",
                border: "1px solid #475569",
              }}
            >
              Chưa có dữ liệu giao dịch
            </span>
          </div>
        </div>

        {/* 4 Indicators Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
          <div style={{ background: "#06101d", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #142a42" }}>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Kỷ luật cắt lỗ (-7%)</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#94a3b8", marginTop: "0.2rem" }}>
              -- / 100
            </div>
            <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "0.15rem" }}>Chưa có vị thế</div>
          </div>

          <div style={{ background: "#06101d", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #142a42" }}>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Đa dạng hóa danh mục</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#94a3b8", marginTop: "0.2rem" }}>
              -- / 100
            </div>
            <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "0.15rem" }}>Chưa giải ngân</div>
          </div>

          <div style={{ background: "#06101d", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #142a42" }}>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Quản trị tiền mặt</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#94a3b8", marginTop: "0.2rem" }}>
              -- / 100
            </div>
            <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "0.15rem" }}>100% tiền mặt</div>
          </div>

          <div style={{ background: "#06101d", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #142a42" }}>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Kiểm soát nhịp độ</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#94a3b8", marginTop: "0.2rem" }}>
              -- / 100
            </div>
            <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "0.15rem" }}>Chờ lệnh đầu tiên</div>
          </div>
        </div>

        {/* Guidance Notice */}
        <div style={{ color: "#94a3b8", fontSize: "0.82rem", lineHeight: 1.5, background: "rgba(6, 16, 29, 0.6)", padding: "0.6rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #142a42" }}>
          Tài khoản chưa phát sinh giao dịch. Hãy thực hiện lệnh mua/bán mô phỏng đầu tiên tại bảng cổ phiếu bên dưới để hệ thống bắt đầu đo lường 4 chỉ số kỷ luật của bạn.
        </div>

        {/* Link to Readiness Report */}
        <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #142a42", paddingTop: "0.75rem" }}>
          <Link
            href="/learn/readiness"
            style={{
              fontSize: "0.8rem",
              color: "#38bdf8",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Xem Báo cáo Đánh giá Mức độ Sẵn sàng Đầu tư &rarr;
          </Link>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const badgeColor =
    metrics.overall_discipline_score >= 80
      ? "#38e1b0"
      : metrics.overall_discipline_score >= 65
      ? "#38bdf8"
      : metrics.overall_discipline_score >= 50
      ? "#f59e0b"
      : "#f43f5e";

  return (
    <div
      className="trading-discipline-card"
      style={{
        background: "#0b1f33",
        border: "1px solid #1e3f5d",
        borderRadius: "0.75rem",
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        color: "#ffffff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            HỆ THỐNG ĐÁNH GIÁ HÀNH VI ĐẦU TƯ
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", marginTop: "0.15rem" }}>
            Chỉ số Kỷ luật Giao dịch
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <span
            style={{
              display: "inline-block",
              padding: "0.25rem 0.75rem",
              borderRadius: "1rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              background: `rgba(${badgeColor === "#38e1b0" ? "56, 225, 176" : badgeColor === "#38bdf8" ? "56, 189, 248" : badgeColor === "#f59e0b" ? "245, 158, 11" : "244, 63, 94"}, 0.15)`,
              color: badgeColor,
              border: `1px solid ${badgeColor}`,
            }}
          >
            {metrics.badge} ({metrics.overall_discipline_score}/100)
          </span>
        </div>
      </div>

      {/* 4 Indicators Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
        <div style={{ background: "#06101d", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #142a42" }}>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Kỷ luật cắt lỗ (-7%)</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: metrics.cut_loss_score >= 70 ? "#38e1b0" : "#f43f5e", marginTop: "0.2rem" }}>
            {metrics.cut_loss_score} / 100
          </div>
        </div>

        <div style={{ background: "#06101d", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #142a42" }}>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Đa dạng hóa danh mục</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: metrics.diversification_score >= 70 ? "#38e1b0" : "#f59e0b", marginTop: "0.2rem" }}>
            {metrics.diversification_score} / 100
          </div>
        </div>

        <div style={{ background: "#06101d", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #142a42" }}>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Quản trị tiền mặt</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: metrics.cash_management_score >= 70 ? "#38e1b0" : "#38bdf8", marginTop: "0.2rem" }}>
            {metrics.cash_management_score} / 100
          </div>
        </div>

        <div style={{ background: "#06101d", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #142a42" }}>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Kiểm soát nhịp độ</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: metrics.emotional_pacing_score >= 70 ? "#38e1b0" : "#f59e0b", marginTop: "0.2rem" }}>
            {metrics.emotional_pacing_score} / 100
          </div>
        </div>
      </div>

      {/* Observations: Strengths & Recommendations */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.82rem" }}>
        {(metrics.strengths || []).slice(0, 1).map((s, idx) => (
          <div key={`str-${idx}`} style={{ color: "#38e1b0" }}>
            Điểm mạnh: {s}
          </div>
        ))}
        {(metrics.weaknesses || []).slice(0, 1).map((w, idx) => (
          <div key={`weak-${idx}`} style={{ color: "#f43f5e" }}>
            Điểm cần lưu ý: {w}
          </div>
        ))}
      </div>

      {/* Link to Readiness Report */}
      <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #142a42", paddingTop: "0.75rem" }}>
        <Link
          href="/learn/readiness"
          style={{
            fontSize: "0.8rem",
            color: "#38bdf8",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Xem Báo cáo Đánh giá Mức độ Sẵn sàng Đầu tư &rarr;
        </Link>
      </div>
    </div>
  );
}
