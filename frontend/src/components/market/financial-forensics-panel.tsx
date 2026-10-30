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
      <div className="forensics-container empty-state w-full py-12 flex items-center justify-center">
        <div className="forensics-empty-box bg-slate-900/80 border border-slate-800 rounded-2xl p-8 max-w-lg text-center flex flex-col items-center gap-3 shadow-sm">
          <span className="forensics-empty-icon text-3xl" aria-hidden="true">
            🔍
          </span>
          <h3 className="text-base font-bold text-slate-100 m-0">Đang cập nhật chỉ số rủi ro cho {symbol}</h3>
          <p className="text-xs text-slate-400 m-0 leading-relaxed">
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
        return "badge-danger bg-rose-950/70 border-rose-500/40 text-rose-300";
      case "medium":
        return "badge-warning bg-amber-950/70 border-amber-500/40 text-amber-300";
      case "low":
        return "badge-caution bg-sky-950/70 border-sky-500/40 text-sky-300";
      default:
        return "badge-clean bg-emerald-950/70 border-emerald-500/40 text-emerald-300";
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
    <div className="forensics-container w-full flex flex-col gap-6" aria-labelledby="forensics-title">
      {/* Header bar */}
      <div className="forensics-header bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-5 shadow-sm">
        <div className="forensics-title-group flex-1 min-w-[280px]">
          <div className="forensics-badge-row flex items-center gap-2 mb-2">
            <span className="forensics-badge inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              ĐỘC QUYỀN INVESTIQ
            </span>
            <span className="forensics-badge sub inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 uppercase tracking-wider">
              QUANTITATIVE FORENSICS
            </span>
          </div>
          <h2 id="forensics-title" className="forensics-heading text-xl sm:text-2xl font-bold text-slate-100 m-0">
            Tầm soát rủi ro BCTC &amp; Mô hình Altman Z-Score: {symbol}
          </h2>
          <p className="forensics-subheading text-xs sm:text-sm text-slate-400 mt-1 m-0 leading-relaxed">
            Phát hiện dấu hiệu làm đẹp báo cáo tài chính, mất cân đối dòng tiền và áp lực đòn bẩy
            trước khi giá phản ánh.
          </p>
        </div>

        <div className="forensics-health-card flex items-center gap-3.5 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 px-4 shadow-inner">
          <div className="forensics-health-circle relative w-14 h-14 rounded-full bg-slate-900 border-2 border-emerald-500 flex flex-col items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            <span className="health-score-value text-base font-extrabold text-emerald-400 leading-none">{health_score}</span>
            <span className="health-score-max text-[9px] font-semibold text-slate-500">/100</span>
          </div>
          <div className="forensics-health-text flex flex-col">
            <strong className="text-xs font-bold text-slate-200">Điểm sức khỏe BCTC</strong>
            <span className="text-xs font-medium text-emerald-400 mt-0.5">
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
      <div className="forensics-grid-overview grid md:grid-cols-2 gap-5">
        {/* Altman Z-Score Box */}
        <div className={`forensics-card z-score-card zone-${z_zone} bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm`}>
          <div className="card-top border-b border-slate-800 pb-3">
            <span className="card-eyebrow text-xs font-bold text-sky-400 uppercase tracking-wider block mb-1">MÔ HÌNH DỰ BÁO TÀI CHÍNH</span>
            <h3 className="card-title text-base sm:text-lg font-bold text-slate-100 m-0">Chỉ số phá sản Altman Z-Score</h3>
          </div>

          {is_finance ? (
            <div className="z-finance-notice flex items-start gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
              <span className="notice-icon text-lg" aria-hidden="true">
                ℹ️
              </span>
              <div>
                <strong className="text-slate-200 block mb-1">Đặc thù ngành Tài chính / Ngân hàng</strong>
                <p className="text-slate-400 m-0 leading-relaxed">
                  Mô hình Altman Z-Score nguyên bản được thiết kế cho doanh nghiệp sản xuất và thương
                  mại. Nhóm ngân hàng/chứng khoán hoạt động với đòn bẩy tiền gửi đặc thù, vui lòng
                  tham khảo 4 chỉ báo định lượng bên dưới.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="z-score-display flex items-baseline gap-3">
                <span className="z-value text-3xl font-extrabold text-white font-mono">{z_score}</span>
                <span className={`z-badge zone-${z_zone} text-xs font-bold px-2.5 py-1 rounded-full border ${
                  z_zone === "safe"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : z_zone === "grey"
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                }`}>
                  {z_label}
                </span>
              </div>

              {/* Gauge meter */}
              <div className="z-gauge-wrapper flex flex-col gap-2">
                <div className="z-gauge-track relative h-3 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`z-gauge-fill h-full rounded-full transition-all duration-500 ${
                      z_zone === "safe" ? "bg-emerald-400" : z_zone === "grey" ? "bg-amber-400" : "bg-rose-500"
                    }`}
                    style={{ width: `${zGaugePercent}%` }}
                  />
                  <div
                    className="z-gauge-marker absolute top-0 bottom-0 w-1 bg-white shadow-md"
                    style={{ left: `${zGaugePercent}%` }}
                    aria-label={`Mức Z-Score: ${z_score}`}
                  />
                </div>
                <div className="z-gauge-labels flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span className="zone-text text-danger text-rose-400">Nguy cơ cao (&lt; 1.81)</span>
                  <span className="zone-text text-warning text-amber-400">Vùng xám (1.81 - 2.99)</span>
                  <span className="zone-text text-success text-emerald-400">Vùng an toàn (&gt; 2.99)</span>
                </div>
              </div>

              <p className="z-score-explanation text-xs text-slate-400 m-0 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-850">
                {z_zone === "safe"
                  ? "Chỉ số Altman Z-Score nằm trong vùng An toàn. Doanh nghiệp có xác suất rủi ro kiệt quệ tài chính trong 24 tháng tới ở mức rất thấp."
                  : z_zone === "grey"
                    ? "Doanh nghiệp nằm ở Vùng Xám. Áp lực nợ và thanh khoản cần theo dõi thêm các quý tiếp theo."
                    : "CẢNH BÁO: Doanh nghiệp nằm trong Vùng Nguy Cơ. Cơ cấu vốn và dòng tiền đang chịu áp lực căng thẳng."}
              </p>
            </>
          )}
        </div>

        {/* Risk Summary & Recommendation Box */}
        <div className="forensics-card summary-card bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
          <div className="card-top border-b border-slate-800 pb-3">
            <span className="card-eyebrow text-xs font-bold text-sky-400 uppercase tracking-wider block mb-1">TỔNG HỢP &amp; KHUYẾN NGHỊ RỦI RO</span>
            <h3 className="card-title text-base sm:text-lg font-bold text-slate-100 m-0">Kết luận cho Nhà Đầu Tư (F0)</h3>
          </div>

          <div className="summary-status-strip flex flex-wrap gap-2 text-xs font-semibold">
            <div className="status-pill flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300">
              <span className="status-dot dot-red w-2 h-2 rounded-full bg-rose-500" />
              <span>{highFlagsCount} Cảnh báo đỏ</span>
            </div>
            <div className="status-pill flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-300">
              <span className="status-dot dot-yellow w-2 h-2 rounded-full bg-amber-400" />
              <span>{mediumFlagsCount} Lưu ý</span>
            </div>
            <div className="status-pill flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
              <span className="status-dot dot-green w-2 h-2 rounded-full bg-emerald-400" />
              <span>{red_flags.length - highFlagsCount - mediumFlagsCount} Đạt chuẩn</span>
            </div>
          </div>

          <div className="summary-body flex flex-col gap-3">
            <p className="summary-text text-xs sm:text-sm text-slate-300 m-0 leading-relaxed">{risk_summary}</p>
            <div className="recommendation-callout flex items-start gap-3 bg-sky-950/40 border border-sky-900/50 rounded-xl p-3.5 text-xs">
              <span className="callout-icon text-lg" aria-hidden="true">
                💡
              </span>
              <div>
                <strong className="text-sky-300 block mb-1">Khuyến nghị hành động:</strong>
                <p className="text-slate-300 m-0 leading-relaxed">{recommendation}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Quantitative Forensic Red Flags */}
      <div className="forensics-flags-section bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flags-section-header flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <span className="card-eyebrow text-xs font-bold text-sky-400 uppercase tracking-wider block mb-1">BỘ 4 CHỈ SỐ TẦM SOÁT ĐỊNH LƯỢNG</span>
            <h3 className="flags-section-title text-base sm:text-lg font-bold text-slate-100 m-0">Chi tiết 4 Bài Test Rủi Ro Gian Lận &amp; BCTC</h3>
          </div>
          <span className="flags-count-tag text-xs font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">4 Chỉ số cốt lõi</span>
        </div>

        <div className="forensics-flags-grid grid md:grid-cols-2 gap-4">
          {red_flags.map((flag) => {
            const isSelected = selectedFlag?.flag_id === flag.flag_id;
            const detail = getForensicDetail(flag.flag_id, flag.severity, symbol);

            return (
              <article
                key={flag.flag_id}
                className={`forensic-flag-card border rounded-xl p-4 flex flex-col gap-3 transition cursor-pointer ${severityTone(flag.severity)} ${
                  isSelected ? "active ring-2 ring-sky-500/50" : "hover:border-slate-700"
                }`}
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
                <div className="flag-top flex items-center justify-between">
                  <span className={`flag-severity-badge text-[11px] font-bold px-2 py-0.5 rounded-full border ${severityTone(flag.severity)}`}>
                    {severityLabel(flag.severity)}
                  </span>
                  <span className="flag-indicator-val font-mono font-bold text-white text-xs">{flag.indicator_value}</span>
                </div>

                <h4 className="flag-title text-sm sm:text-base font-bold text-white m-0">{flag.title}</h4>
                <p className="flag-desc text-xs text-slate-400 m-0 leading-relaxed">{flag.description}</p>

                <div className="flag-metrics-table bg-slate-950/60 p-2.5 rounded-lg border border-slate-850 flex flex-col gap-1.5 text-xs">
                  <div className="metric-row flex justify-between">
                    <span className="metric-label text-slate-400">Giá trị quan sát:</span>
                    <strong className="metric-val text-white">{flag.indicator_value}</strong>
                  </div>
                  <div className="metric-row flex justify-between">
                    <span className="metric-label text-slate-400">Ngưỡng chuẩn:</span>
                    <strong className="metric-val text-muted text-slate-500">{flag.threshold}</strong>
                  </div>
                </div>

                <div className="flag-implication bg-slate-950/40 p-2.5 rounded-lg border border-slate-850 text-xs">
                  <div className="implication-header flex items-center gap-1.5 mb-1">
                    <span className="implication-icon">⚠️</span>
                    <strong className="implication-label text-slate-300">Hệ quả tiềm ẩn:</strong>
                  </div>
                  <p className="implication-body text-slate-400 m-0 leading-relaxed">{flag.implication}</p>
                </div>

                <div className="flag-footer-cta text-right">
                  <span className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition">{isSelected ? "Thu gọn ▲" : "Chi tiết phân tích ▼"}</span>
                </div>

                {isSelected && (
                  <div className="flag-expanded-panel mt-3 pt-3 border-t border-slate-800 flex flex-col gap-3 text-xs" onClick={(e) => e.stopPropagation()}>
                    <div className="expanded-header">
                      <span className="expanded-kicker text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-0.5">CHẨN ĐOÁN KẾ TOÁN CHUYÊN SÂU</span>
                      <h5 className="expanded-title text-sm font-bold text-white m-0">{detail.methodology}</h5>
                    </div>

                    <div className="expanded-block formula-block bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                      <span className="block-label text-slate-400 font-semibold block mb-1">📐 CÔNG THỨC ĐỊNH LƯỢNG:</span>
                      <code className="block-code font-mono text-sky-300 text-xs">{detail.formula}</code>
                    </div>

                    <div className="expanded-block deepdive-block bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                      <span className="block-label text-slate-400 font-semibold block mb-1">🔍 PHÂN TÍCH RỦI RO &amp; Ý NGHĨA KẾ TOÁN:</span>
                      <p className="block-text text-slate-300 m-0 leading-relaxed">{detail.deepDive}</p>
                    </div>

                    <div className="expanded-block warning-block bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                      <span className="block-label text-slate-400 font-semibold block mb-1">🚨 DẤU HIỆU CẢNH BÁO CẦN LƯU TÂM:</span>
                      <p className="block-text text-amber text-amber-300 m-0 leading-relaxed">{detail.warningSign}</p>
                    </div>

                    <div className="expanded-block checklist-block bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                      <span className="block-label text-slate-400 font-semibold block mb-1">📋 HƯỚNG DẪN SOI TRÊN BCTC QUÝ:</span>
                      <ul className="block-checklist m-0 pl-4 list-disc text-slate-300 space-y-1">
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
      <aside className="forensics-education-footer bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex items-start gap-4 text-xs shadow-sm">
        <div className="edu-icon text-2xl" aria-hidden="true">
          📖
        </div>
        <div className="edu-content">
          <strong className="text-sm font-bold text-slate-200 block mb-1">Tại sao nhà đầu tư cần đọc BCTC Forensic trước khi mua?</strong>
          <p className="text-slate-400 m-0 leading-relaxed">
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
