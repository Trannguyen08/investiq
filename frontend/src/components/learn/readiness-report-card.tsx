"use client";

import Link from "next/link";
import type { ReadinessEvaluation } from "@/types/assessment";

interface Props {
  evaluation: ReadinessEvaluation;
  onRetake?: () => void;
}

export function ReadinessReportCard({ evaluation, onRetake }: Props) {
  const {
    persona,
    risk_score,
    knowledge_score,
    discipline_score,
    overall_readiness_score,
    readiness_label,
    verdict_summary,
    can_trade_real_money,
    recommended_action,
  } = evaluation;

  return (
    <div
      className="readiness-report-card"
      style={{
        background: "#0b1f33",
        border: "1px solid #1e3f5d",
        borderRadius: "1rem",
        padding: "1.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        color: "#ffffff",
      }}
    >
      {/* Top Banner: Readiness Verdict */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          borderBottom: "1px solid #1e3f5d",
          paddingBottom: "1.25rem",
        }}
      >
        <div>
          <div style={{ fontSize: "0.8rem", color: "#38bdf8", fontWeight: 700, letterSpacing: "0.05em" }}>
            BÁO CÁO ĐÁNH GIÁ MỨC ĐỘ SẴN SÀNG ĐẦU TƯ
          </div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.3rem", color: "#ffffff" }}>
            {persona.title}
          </h2>
          <div style={{ fontSize: "0.9rem", color: "#94a3b8", marginTop: "0.2rem" }}>
            {persona.tagline}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>CHỈ SỐ SẴN SÀNG TOÀN DIỆN</div>
          <div
            style={{
              fontSize: "2.2rem",
              fontWeight: 900,
              color: can_trade_real_money ? "#38e1b0" : "#f43f5e",
              lineHeight: 1.1,
              marginTop: "0.2rem",
            }}
          >
            {overall_readiness_score} <span style={{ fontSize: "1rem", color: "#64748b" }}>/ 100</span>
          </div>
          <div
            style={{
              display: "inline-block",
              marginTop: "0.35rem",
              padding: "0.25rem 0.75rem",
              borderRadius: "1rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: can_trade_real_money ? "rgba(56, 225, 176, 0.15)" : "rgba(244, 63, 94, 0.15)",
              color: can_trade_real_money ? "#38e1b0" : "#f43f5e",
              border: can_trade_real_money ? "1px solid rgba(56, 225, 176, 0.3)" : "1px solid rgba(244, 63, 94, 0.3)",
            }}
          >
            {readiness_label}
          </div>
        </div>
      </div>

      {/* 3 Pillars Score Breakdown */}
      <div>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#94a3b8", marginBottom: "0.75rem" }}>
          3 TRỤ CỘT ĐÁNH GIÁ NĂNG LỰC NHÀ ĐẦU TƯ
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div style={{ background: "#06101d", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #142a42" }}>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Kiến thức căn bản (35%)</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#38bdf8", marginTop: "0.25rem" }}>
              {knowledge_score} <span style={{ fontSize: "0.8rem", color: "#64748b" }}>/ 100</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>Am hiểu thuật ngữ, BCTC &amp; nến</div>
          </div>

          <div style={{ background: "#06101d", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #142a42" }}>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Khẩu vị &amp; Tâm lý rủi ro (30%)</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#38e1b0", marginTop: "0.25rem" }}>
              {risk_score} <span style={{ fontSize: "0.8rem", color: "#64748b" }}>/ 100</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>Khả năng chịu đựng biến động</div>
          </div>

          <div style={{ background: "#06101d", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #142a42" }}>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Kỷ luật thực chiến (35%)</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: discipline_score >= 70 ? "#38e1b0" : "#f59e0b", marginTop: "0.25rem" }}>
              {discipline_score} <span style={{ fontSize: "0.8rem", color: "#64748b" }}>/ 100</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>Kỷ luật cắt lỗ &amp; phân bổ vốn</div>
          </div>
        </div>
      </div>

      {/* Core Verdict Box */}
      <div
        style={{
          background: can_trade_real_money ? "rgba(56, 225, 176, 0.08)" : "rgba(244, 63, 94, 0.08)",
          border: can_trade_real_money ? "1px solid rgba(56, 225, 176, 0.25)" : "1px solid rgba(244, 63, 94, 0.25)",
          padding: "1.25rem",
          borderRadius: "0.75rem",
        }}
      >
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: can_trade_real_money ? "#38e1b0" : "#f43f5e" }}>
          KẾT LUẬN: BẠN CÓ NÊN ĐẦU TƯ TIỀN THẬT LÚC NÀY?
        </div>
        <p style={{ fontSize: "0.95rem", color: "#e2e8f0", lineHeight: 1.6, marginTop: "0.5rem" }}>
          {verdict_summary}
        </p>
        <div style={{ fontSize: "0.85rem", color: "#38bdf8", fontWeight: 600, marginTop: "0.5rem" }}>
          Hành động khuyến nghị: {recommended_action}
        </div>
      </div>

      {/* Persona Strategy & Asset Allocation */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#94a3b8" }}>CHIẾN LƯỢC PHÙ HỢP VỚI BẠN</div>
          <p style={{ fontSize: "0.9rem", color: "#cbd5e1", lineHeight: 1.5 }}>
            {persona.recommended_strategy}
          </p>

          <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            Thời gian cam kết lý tưởng: <strong style={{ color: "#38bdf8" }}>{persona.ideal_time_hours_per_week} giờ / tuần</strong>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#94a3b8" }}>PHÂN BỔ TÀI SẢN KHUYẾN NGHỊ</div>
          {/* Progress bar asset allocation */}
          <div style={{ display: "flex", height: "1.25rem", borderRadius: "0.5rem", overflow: "hidden" }}>
            <div style={{ width: `${persona.asset_allocation.stocks}%`, background: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#06101d" }}>
              {persona.asset_allocation.stocks}%
            </div>
            <div style={{ width: `${persona.asset_allocation.gold}%`, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#06101d" }}>
              {persona.asset_allocation.gold}%
            </div>
            <div style={{ width: `${persona.asset_allocation.savings}%`, background: "#38e1b0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#06101d" }}>
              {persona.asset_allocation.savings}%
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#94a3b8" }}>
            <span style={{ color: "#38bdf8" }}>Cổ phiếu ({persona.asset_allocation.stocks}%)</span>
            <span style={{ color: "#f59e0b" }}>Vàng ({persona.asset_allocation.gold}%)</span>
            <span style={{ color: "#38e1b0" }}>Tiết kiệm ({persona.asset_allocation.savings}%)</span>
          </div>
        </div>
      </div>

      {/* Suitable Instruments */}
      <div>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#94a3b8", marginBottom: "0.5rem" }}>
          CÔNG CỤ TÀI CHÍNH NÊN ƯU TIÊN
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {persona.suitable_instruments.map((inst, idx) => (
            <span
              key={idx}
              style={{
                background: "#06101d",
                border: "1px solid #1e3f5d",
                padding: "0.35rem 0.75rem",
                borderRadius: "0.5rem",
                fontSize: "0.8rem",
                color: "#e2e8f0",
              }}
            >
              {inst}
            </span>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          borderTop: "1px solid #1e3f5d",
          paddingTop: "1.25rem",
        }}
      >
        {onRetake ? (
          <button
            type="button"
            onClick={onRetake}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid #38bdf8",
              background: "transparent",
              color: "#38bdf8",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Làm lại bài khảo sát
          </button>
        ) : (
          <div />
        )}

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link
            href="/learn"
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid #1e3f5d",
              background: "#06101d",
              color: "#e2e8f0",
              fontWeight: 600,
              fontSize: "0.85rem",
              textDecoration: "none",
            }}
          >
            Học thêm kiến thức
          </Link>
          <Link
            href="/portfolio"
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#38bdf8",
              color: "#06101d",
              fontWeight: 700,
              fontSize: "0.85rem",
              textDecoration: "none",
            }}
          >
            Luyện tập đầu tư thử
          </Link>
        </div>
      </div>
    </div>
  );
}
