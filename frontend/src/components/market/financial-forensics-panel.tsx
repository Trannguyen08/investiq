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

  const getForensicDetail = (flagId: string, severity: string, sym: string) => {
    const id = flagId.toLowerCase();
    if (id.includes("cfo")) {
      return {
        methodology: "Đối chiếu Dòng tiền Thuần từ HĐKD (CFO) với Lợi nhuận Sau thuế (LNST)",
        formula: "Hệ số Đồng pha = CFO / LNST (Chuẩn an toàn > 0.8)",
        deepDive: `Kiểm tra xem lợi nhuận của ${sym} có được bảo chứng bằng tiền mặt thực thu hay chỉ là số liệu kế toán dồn tích (accruals). Nếu LNST dương nhưng CFO liên tục âm, doanh nghiệp đang phải tài trợ vốn cho khách hàng chiếm dụng hoặc ghi nhận doanh thu ảo trước hạn.`,
        warningSign: "CFO âm liên tiếp từ 2 quý trở lên trong khi doanh thu sổ sách vẫn tăng trưởng cao.",
        auditChecklist: [
          "Soi Báo cáo Lưu chuyển tiền tệ mục 'Lưu chuyển tiền thuần từ HĐKD' (Mã 20).",
          "Đối chiếu biến động 'Các khoản phải thu' (Mã 130) trên Bảng cân đối kế toán.",
          "Xem thuyết minh chi tiết về 'Dự phòng nợ phải thu khó đòi' (Mã 137).",
        ],
      };
    }
    if (id.includes("leverage") || id.includes("debt") || id.includes("vốn")) {
      return {
        methodology: "Định lượng Đòn bẩy Nợ vay & Khả năng chi trả Lãi vay (Interest Coverage)",
        formula: "Hệ số Nợ Vay / Vốn Chủ (D/E) & ICR = EBIT / Chi phí Lãi vay (Chuẩn ICR > 3.0x)",
        deepDive: `Đo lường mức độ thâm dụng vốn vay của ${sym}. Doanh nghiệp có tỷ lệ nợ vay cao sẽ chịu áp lực cực lớn khi chu kỳ lãi suất điều chỉnh tăng hoặc khi các khoản trái phiếu doanh nghiệp đến hạn đảo nợ.`,
        warningSign: "Tỷ lệ Nợ vay ngắn hạn chiếm hơn 70% tổng nợ vay hoặc ICR giảm xuống dưới 1.5x.",
        auditChecklist: [
          "Soi cơ cấu Vay ngắn hạn (Mã 320) và Vay dài hạn (Mã 338).",
          "Kiểm tra Thuyết minh mục Trái phiếu phát hành (lãi suất thực tế và tài sản bảo đảm).",
          "Đánh giá tỷ lệ nợ vay ngoại tệ có rủi ro tỷ giá USD/VND hay không.",
        ],
      };
    }
    if (id.includes("pe") || id.includes("valuation") || id.includes("roe") || id.includes("định giá")) {
      return {
        methodology: "Kiểm định Chất lượng Định giá P/E, P/B kết hợp Hiệu quả Sinh lời ROE",
        formula: "Chỉ số PEG = (P/E) / Tốc độ tăng trưởng LNST & Định giá theo Chu kỳ",
        deepDive: `Tầm soát xem ${sym} đang ở vùng định giá hấp dẫn hay đang đối mặt với 'Bẫy giá trị' (Value Trap). Một cổ phiếu có P/E rẻ nhưng ROE liên tục xói mòn thường phản ánh doanh nghiệp đang mất dần lợi thế cạnh tranh cốt lõi (Moat).`,
        warningSign: "P/E giảm do giá giảm mạnh nhưng ROE cũng rơi tự do theo kết quả kinh doanh.",
        auditChecklist: [
          "So sánh P/E và P/B hiện tại với trung vị lịch sử 3 năm và 5 năm của chính doanh nghiệp.",
          "So sánh biên lợi nhuận ròng (Net Margin) với các đối thủ cùng phân khúc.",
          "Kiểm tra xem lợi nhuận đột biến có đến từ thanh lý tài sản một lần hay không.",
        ],
      };
    }
    return {
      methodology: "Kiểm soát Vòng quay Vốn lưu động & Chu kỳ Chuyển đổi Tiền mặt (Cash Conversion Cycle)",
      formula: "Chu kỳ Tiền mặt CCC = Số ngày Tồn kho (DIO) + Số ngày Phải thu (DSO) - Số ngày Phải trả (DPO)",
      deepDive: `Đánh giá tốc độ giải phóng hàng hóa và khả năng quay vòng tiền mặt của ${sym}. Nếu chu kỳ tiền mặt kéo dài bất thường, vốn của cổ đông đang bị chôn chặt trong kho bãi và công nợ đối tác, đe dọa trực tiếp đến thanh khoản ngắn hạn.`,
      warningSign: "Hàng tồn kho tăng vọt đột biến kèm theo doanh số chững lại, vòng quay giảm quá 25%.",
      auditChecklist: [
        "Soi biến động mục 'Hàng tồn kho' (Mã 140) và Thuyết minh Chi phí sản xuất dở dang.",
        "Kiểm tra trích lập 'Dự phòng giảm giá hàng tồn kho' (Mã 149).",
        "Đánh giá tuổi nợ khách hàng và nguy cơ khách hàng lớn mất khả năng thanh toán.",
      ],
    };
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
            const detail = getForensicDetail(flag.flag_id, flag.severity, symbol);

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

                <div className="flag-metrics-table">
                  <div className="metric-row">
                    <span className="metric-label">Giá trị quan sát:</span>
                    <strong className="metric-val">{flag.indicator_value}</strong>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Ngưỡng chuẩn:</span>
                    <strong className="metric-val text-muted">{flag.threshold}</strong>
                  </div>
                </div>

                <div className="flag-implication">
                  <div className="implication-header">
                    <span className="implication-icon">⚠️</span>
                    <strong className="implication-label">Hệ quả tiềm ẩn:</strong>
                  </div>
                  <p className="implication-body">{flag.implication}</p>
                </div>

                <div className="flag-footer-cta">
                  <span>{isSelected ? "Thu gọn ▲" : "Chi tiết phân tích ▼"}</span>
                </div>

                {isSelected && (
                  <div className="flag-expanded-panel" onClick={(e) => e.stopPropagation()}>
                    <div className="expanded-header">
                      <span className="expanded-kicker">CHẨN ĐOÁN KẾ TOÁN CHUYÊN SÂU</span>
                      <h5 className="expanded-title">{detail.methodology}</h5>
                    </div>

                    <div className="expanded-block formula-block">
                      <span className="block-label">📐 CÔNG THỨC ĐỊNH LƯỢNG:</span>
                      <code className="block-code">{detail.formula}</code>
                    </div>

                    <div className="expanded-block deepdive-block">
                      <span className="block-label">🔍 PHÂN TÍCH RỦI RO &amp; Ý NGHĨA KẾ TOÁN:</span>
                      <p className="block-text">{detail.deepDive}</p>
                    </div>

                    <div className="expanded-block warning-block">
                      <span className="block-label">🚨 DẤU HIỆU CẢNH BÁO CẦN LƯU TÂM:</span>
                      <p className="block-text text-amber">{detail.warningSign}</p>
                    </div>

                    <div className="expanded-block checklist-block">
                      <span className="block-label">📋 HƯỚNG DẪN SOI TRÊN BCTC QUÝ:</span>
                      <ul className="block-checklist">
                        {detail.auditChecklist.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
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
