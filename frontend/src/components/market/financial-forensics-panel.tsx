"use client";

import { useState } from "react";
import type { FinancialForensicsData, ForensicRedFlag } from "@/types/market";

type Props = {
  data: FinancialForensicsData | null | undefined;
  symbol: string;
};

export function FinancialForensicsPanel({ data, symbol }: Props) {
  const [selectedFlag, setSelectedFlag] = useState<ForensicRedFlag | null>(null);

  if (!data) {
    return (
      <div className="forensics-container empty-state">
        <div className="forensics-empty-box">
          <span className="forensics-empty-icon" aria-hidden="true">
            🔍
          </span>
          <h3>Đang cập nhật chỉ số rủi ro cho {symbol}</h3>
          <p>
            Hệ thống phân tích định lượng BCTC và mô hình Altman Z-Score đang thu thập dữ liệu
            cho mã này.
          </p>
        </div>
      </div>
    );
  }

  const { z_score, z_zone, z_label, health_score, red_flags, risk_summary, recommendation, is_finance } = data;

  const zNumeric = parseFloat(z_score) || 0;
  // Compute percentage for Z-score gauge (clamped 0 to 100 for display, 0 to 4.5 scale)
  const zGaugePercent = Math.min(100, Math.max(5, (zNumeric / 4.5) * 100));

  const severityTone = (sev: ForensicRedFlag["severity"]) => {
    switch (sev) {
      case "high":
        return "badge-danger";
      case "medium":
        return "badge-warning";
      case "low":
        return "badge-caution";
      default:
        return "badge-clean";
    }
  };

  const severityLabel = (sev: ForensicRedFlag["severity"]) => {
    switch (sev) {
      case "high":
        return "Cảnh báo cao";
      case "medium":
        return "Lưu ý";
      case "low":
        return "Mức thấp";
      default:
        return "An toàn";
    }
  };

  const highFlagsCount = red_flags.filter((f) => f.severity === "high").length;
  const mediumFlagsCount = red_flags.filter((f) => f.severity === "medium").length;

  return (
    <div className="forensics-container" aria-labelledby="forensics-title">
      {/* Header bar */}
      <div className="forensics-header">
        <div className="forensics-title-group">
          <div className="forensics-badge-row">
            <span className="forensics-badge">ĐỘC QUYỀN INVESTIQ</span>
            <span className="forensics-badge sub">QUANTITATIVE FORENSICS</span>
          </div>
          <h2 id="forensics-title" className="forensics-heading">
            Tầm soát rủi ro BCTC &amp; Mô hình Altman Z-Score: {symbol}
          </h2>
          <p className="forensics-subheading">
            Phát hiện dấu hiệu làm đẹp báo cáo tài chính, mất cân đối dòng tiền và áp lực đòn bẩy
            trước khi giá phản ánh.
          </p>
        </div>

        <div className="forensics-health-card">
          <div className="forensics-health-circle">
            <span className="health-score-value">{health_score}</span>
            <span className="health-score-max">/100</span>
          </div>
          <div className="forensics-health-text">
            <strong>Điểm sức khỏe BCTC</strong>
            <span>
              {health_score >= 80
                ? "Tài chính rất vững vàng"
                : health_score >= 60
                  ? "Sức khỏe trung bình khá"
                  : "Cần thận trọng cao"}
            </span>
          </div>
        </div>
      </div>

      {/* Primary 2-Column: Altman Z-Score + Risk Summary */}
      <div className="forensics-grid-overview">
        {/* Altman Z-Score Box */}
        <div className={`forensics-card z-score-card zone-${z_zone}`}>
          <div className="card-top">
            <span className="card-eyebrow">MÔ HÌNH DỰ BÁO TÀI CHÍNH</span>
            <h3 className="card-title">Chỉ số phá sản Altman Z-Score</h3>
          </div>

          {is_finance ? (
            <div className="z-finance-notice">
              <span className="notice-icon" aria-hidden="true">
                ℹ️
              </span>
              <div>
                <strong>Đặc thù ngành Tài chính / Ngân hàng</strong>
                <p>
                  Mô hình Altman Z-Score nguyên bản được thiết kế cho doanh nghiệp sản xuất và thương
                  mại. Nhóm ngân hàng/chứng khoán hoạt động với đòn bẩy tiền gửi đặc thù, vui lòng
                  tham khảo 4 chỉ báo định lượng bên dưới.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="z-score-display">
                <span className="z-value">{z_score}</span>
                <span className={`z-badge zone-${z_zone}`}>{z_label}</span>
              </div>

              {/* Gauge meter */}
              <div className="z-gauge-wrapper">
                <div className="z-gauge-track">
                  <div className="z-gauge-fill" style={{ width: `${zGaugePercent}%` }} />
                  <div
                    className="z-gauge-marker"
                    style={{ left: `${zGaugePercent}%` }}
                    aria-label={`Mức Z-Score: ${z_score}`}
                  />
                </div>
                <div className="z-gauge-labels">
                  <span className="zone-text text-danger">Nguy cơ cao (&lt; 1.81)</span>
                  <span className="zone-text text-warning">Vùng xám (1.81 - 2.99)</span>
                  <span className="zone-text text-success">Vùng an toàn (&gt; 2.99)</span>
                </div>
              </div>

              <p className="z-score-explanation">
                {z_zone === "safe"
                  ? "Chỉ số Altman Z-Score nằm trong vùng An toàn. Doanh nghiệp có xác suất rủi ro kiệt quệ tài chính trong 24 tháng tới ở mức rất thấp."
                  : z_zone === "grey"
                    ? "Doanh nghiệp nằm ở Vùng Xám. Áp lực nợ và thanh khoản cần theo dõi thêm các quý tiếp theo."
                    : "CẢNH BÁO: Doanh nghiệp nằm trong Vùng Nguy Cơ. Cơ cấu vốn và dòng tiền đang chịu áp lực căng thẳng."}
              </p>
            </>
          )}
        </div>

        {/* Risk Summary & AI Recommendation Box */}
        <div className="forensics-card summary-card">
          <div className="card-top">
            <span className="card-eyebrow">TỔNG HỢP &amp; KHUYẾN NGHỊ RỦI RO</span>
            <h3 className="card-title">Kết luận cho Nhà Đầu Tư (F0)</h3>
          </div>

          <div className="summary-status-strip">
            <div className="status-pill">
              <span className="status-dot dot-red" />
              <span>{highFlagsCount} Cảnh báo đỏ</span>
            </div>
            <div className="status-pill">
              <span className="status-dot dot-yellow" />
              <span>{mediumFlagsCount} Lưu ý</span>
            </div>
            <div className="status-pill">
              <span className="status-dot dot-green" />
              <span>{red_flags.length - highFlagsCount - mediumFlagsCount} Đạt chuẩn</span>
            </div>
          </div>

          <div className="summary-body">
            <p className="summary-text">{risk_summary}</p>
            <div className="recommendation-callout">
              <span className="callout-icon" aria-hidden="true">
                💡
              </span>
              <div>
                <strong>Khuyến nghị hành động:</strong>
                <p>{recommendation}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Quantitative Forensic Red Flags */}
      <div className="forensics-flags-section">
        <div className="flags-section-header">
          <div>
            <span className="card-eyebrow">BỘ 4 CHỈ SỐ TẦM SOÁT ĐỊNH LƯỢNG</span>
            <h3 className="flags-section-title">Chi tiết 4 Bài Test Rủi Ro Gian Lận &amp; BCTC</h3>
          </div>
          <span className="flags-count-tag">4 Chỉ số cốt lõi</span>
        </div>

        <div className="forensics-flags-grid">
          {red_flags.map((flag) => {
            const isSelected = selectedFlag?.flag_id === flag.flag_id;
            return (
              <article
                key={flag.flag_id}
                className={`forensic-flag-card ${severityTone(flag.severity)} ${isSelected ? "active" : ""}`}
                onClick={() => setSelectedFlag(isSelected ? null : flag)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedFlag(isSelected ? null : flag);
                  }
                }}
              >
                <div className="flag-top">
                  <span className={`flag-severity-badge ${severityTone(flag.severity)}`}>
                    {severityLabel(flag.severity)}
                  </span>
                  <span className="flag-indicator-val">{flag.indicator_value}</span>
                </div>

                <h4 className="flag-title">{flag.title}</h4>
                <p className="flag-desc">{flag.description}</p>

                <div className="flag-metrics-row">
                  <div className="metric-col">
                    <span className="metric-label">Giá trị quan sát:</span>
                    <strong className="metric-val">{flag.indicator_value}</strong>
                  </div>
                  <div className="metric-col">
                    <span className="metric-label">Ngưỡng chuẩn:</span>
                    <strong className="metric-val text-muted">{flag.threshold}</strong>
                  </div>
                </div>

                <div className="flag-implication">
                  <span className="implication-label">Hệ quả tiềm ẩn:</span>
                  <p>{flag.implication}</p>
                </div>

                <div className="flag-footer-cta">
                  <span>{isSelected ? "Thu gọn ▲" : "Chi tiết phân tích ▼"}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Educational Notice for Beginners */}
      <aside className="forensics-education-footer">
        <div className="edu-icon" aria-hidden="true">
          📖
        </div>
        <div className="edu-content">
          <strong>Tại sao nhà đầu tư cần đọc BCTC Forensic trước khi mua?</strong>
          <p>
            Rất nhiều cổ phiếu tăng giá mạnh trên sàn nhưng dòng tiền kinh doanh (CFO) lại âm liên
            tục, các khoản phải thu chiếm phần lớn tài sản. Khi chu kỳ tín dụng thắt chặt, doanh
            nghiệp sẽ mất thanh khoản đột ngột. Mô hình Forensics của InvestIQ giúp bạn nhìn xuyên
            qua con số lợi nhuận sổ sách.
          </p>
        </div>
      </aside>
    </div>
  );
}
