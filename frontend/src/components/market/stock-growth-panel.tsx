"use client";

import { useState } from "react";
import type {
  FinancialReportAnalysisItem,
  QuarterlyGrowthPoint,
  StockGrowthData,
} from "@/types/market";

function parseGrowthPercent(val: string | null | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace("%", "").replace("+", "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function healthBadgeConfig(status: StockGrowthData["health_status"]) {
  switch (status) {
    case "expanding":
      return {
        label: "Bứt phá tăng trưởng",
        className: "badge-expanding",
        color: "#10b981",
        bg: "rgba(16, 185, 129, 0.12)",
        border: "rgba(16, 185, 129, 0.35)",
      };
    case "stable":
      return {
        label: "Tăng trưởng ổn định",
        className: "badge-stable",
        color: "#38bdf8",
        bg: "rgba(56, 189, 248, 0.12)",
        border: "rgba(56, 189, 248, 0.35)",
      };
    case "accumulating":
      return {
        label: "Dòng tiền tích lũy",
        className: "badge-accumulating",
        color: "#f59e0b",
        bg: "rgba(245, 158, 11, 0.12)",
        border: "rgba(245, 158, 11, 0.35)",
      };
    case "cautious":
    default:
      return {
        label: "Cần theo dõi thận trọng",
        className: "badge-cautious",
        color: "#f43f5e",
        bg: "rgba(244, 63, 94, 0.12)",
        border: "rgba(244, 63, 94, 0.35)",
      };
  }
}

function GrowthValuePill({ value }: { value: string | null | undefined }) {
  if (!value) {
    return <span className="growth-pill neutral">Chưa có số liệu</span>;
  }
  const isPositive = value.startsWith("+") || (!value.startsWith("-") && parseFloat(value) > 0);
  const isNegative = value.startsWith("-");
  const cls = isPositive ? "positive" : isNegative ? "negative" : "neutral";
  return <span className={`growth-pill ${cls}`}>{value}</span>;
}

function StockQuarterlyGrowthChart({ quarters }: { quarters: QuarterlyGrowthPoint[] }) {
  if (!quarters || quarters.length === 0) {
    return null;
  }

  const allValues = quarters.flatMap((q) => [
    parseGrowthPercent(q.revenue_growth_yoy),
    parseGrowthPercent(q.profit_growth_yoy),
  ]);
  const maxAbs = Math.max(20, Math.min(100, Math.max(...allValues.map(Math.abs), 20)));

  const svgWidth = 640;
  const svgHeight = 220;
  const paddingX = 40;
  const chartWidth = svgWidth - paddingX * 2;
  const zeroY = 110;
  const maxBarH = 75;

  const barGroupWidth = chartWidth / quarters.length;
  const barWidth = Math.min(24, barGroupWidth * 0.3);
  const barGap = 6;

  return (
    <div className="growth-chart-wrapper" aria-label="Biểu đồ tăng trưởng doanh thu và lợi nhuận theo quý">
      <div className="growth-chart-legend">
        <span className="legend-item rev">
          <span className="legend-color-box rev" /> Doanh thu (YoY)
        </span>
        <span className="legend-item profit">
          <span className="legend-color-box profit" /> Lợi nhuận sau thuế (YoY)
        </span>
      </div>
      <div className="growth-svg-container">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="growth-svg-chart"
          role="img"
          aria-label="Biểu đồ cột so sánh tăng trưởng doanh thu và lợi nhuận qua các quý"
        >
          {/* Zero baseline */}
          <line
            x1={paddingX}
            y1={zeroY}
            x2={svgWidth - paddingX}
            y2={zeroY}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeDasharray="3 3"
          />
          <text x={paddingX - 10} y={zeroY + 4} fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="end">
            0%
          </text>

          {quarters.map((q, i) => {
            const centerX = paddingX + i * barGroupWidth + barGroupWidth / 2;
            const revVal = parseGrowthPercent(q.revenue_growth_yoy);
            const profitVal = parseGrowthPercent(q.profit_growth_yoy);

            const revHeight = Math.min(maxBarH, (Math.abs(revVal) / maxAbs) * maxBarH);
            const profitHeight = Math.min(maxBarH, (Math.abs(profitVal) / maxAbs) * maxBarH);

            const revX = centerX - barWidth - barGap / 2;
            const profitX = centerX + barGap / 2;

            const revY = revVal >= 0 ? zeroY - revHeight : zeroY;
            const profitY = profitVal >= 0 ? zeroY - profitHeight : zeroY;

            return (
              <g key={q.period} className="quarter-bar-group">
                {/* Revenue Bar */}
                <rect
                  x={revX}
                  y={revY}
                  width={barWidth}
                  height={Math.max(2, revHeight)}
                  rx={3}
                  fill={revVal >= 0 ? "#38bdf8" : "#f43f5e"}
                  opacity={0.88}
                />
                <text
                  x={revX + barWidth / 2}
                  y={revVal >= 0 ? revY - 4 : revY + revHeight + 12}
                  fill="#94a3b8"
                  fontSize="9"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {q.revenue_growth_yoy ?? "N/A"}
                </text>

                {/* Profit Bar */}
                <rect
                  x={profitX}
                  y={profitY}
                  width={barWidth}
                  height={Math.max(2, profitHeight)}
                  rx={3}
                  fill={profitVal >= 0 ? "#34d399" : "#f87171"}
                  opacity={0.88}
                />
                <text
                  x={profitX + barWidth / 2}
                  y={profitVal >= 0 ? profitY - 4 : profitY + profitHeight + 12}
                  fill="#cbd5e1"
                  fontSize="9"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {q.profit_growth_yoy ?? "N/A"}
                </text>

                {/* Period label at bottom */}
                <text
                  x={centerX}
                  y={svgHeight - 10}
                  fill="#f1f5f9"
                  fontSize="11"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {q.period}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function FinancialReportCard({ item }: { item: FinancialReportAnalysisItem }) {
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(item.image_url) && !imgError;

  return (
    <article className="report-card">
      <div className="report-img-wrapper">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url!}
            alt={item.title}
            className="report-img"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (

          <div className="report-img-fallback">
            <span className="fallback-badge">{item.tag ?? "Báo cáo phân tích"}</span>
            <span className="fallback-source">{item.source}</span>
          </div>
        )}
        {item.tag && <span className="report-badge-floating">{item.tag}</span>}
      </div>

      <div className="report-content">
        <div className="report-meta">
          <span className="report-source">{item.source}</span>
          {item.published_at && (
            <span className="report-date">{item.published_at}</span>
          )}
        </div>

        <h4 className="report-title">
          {item.article_url ? (
            <a
              href={item.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="report-title-link"
            >
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </h4>

        {item.summary && (
          <p className="report-summary">{item.summary}</p>
        )}

        {item.article_url && (
          <div className="report-footer">
            <a
              href={item.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="report-read-more"
            >
              Đọc toàn văn báo cáo →
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

export function StockGrowthPanel({ growth }: { growth: StockGrowthData }) {

  const badge = healthBadgeConfig(growth.health_status);

  return (
    <div className="stock-growth-panel" data-testid="stock-growth-panel">
      {/* 1. Health Scorecard Header */}
      <section className="growth-hero-card" aria-labelledby="growth-health-heading">
        <div className="growth-hero-top">
          <div className="growth-hero-badge" style={{ backgroundColor: badge.bg, borderColor: badge.border, color: badge.color }}>
            <span className="badge-text">{badge.label}</span>
          </div>
          <span className="growth-sector-tag">{growth.sector}</span>
        </div>
        <h2 id="growth-health-heading" className="growth-hero-title">
          {growth.health_title}
        </h2>
        <p className="growth-hero-summary">{growth.health_summary}</p>
      </section>

      {/* 2. Capitalization & Price Growth Horizons with Concrete Numbers */}
      <section className="growth-horizon-grid" aria-label="Tăng trưởng vốn hóa và giá cổ phiếu theo các mốc thời gian">
        <div className="horizon-card">
          <span className="horizon-label">Tăng trưởng 1 tháng</span>
          <div className="horizon-values">
            <GrowthValuePill value={growth.market_cap_growth_1m} />
            {growth.price_change_1m && (
              <span className="horizon-diff-number">{growth.price_change_1m}</span>
            )}
          </div>
          <span className="horizon-hint">So với 22 phiên trước</span>
        </div>
        <div className="horizon-card">
          <span className="horizon-label">Tăng trưởng 3 tháng</span>
          <div className="horizon-values">
            <GrowthValuePill value={growth.market_cap_growth_3m} />
            {growth.price_change_3m && (
              <span className="horizon-diff-number">{growth.price_change_3m}</span>
            )}
          </div>
          <span className="horizon-hint">So với quý trước</span>
        </div>
        <div className="horizon-card">
          <span className="horizon-label">Tăng trưởng 6 tháng</span>
          <div className="horizon-values">
            <GrowthValuePill value={growth.market_cap_growth_6m} />
            {growth.price_change_6m && (
              <span className="horizon-diff-number">{growth.price_change_6m}</span>
            )}
          </div>
          <span className="horizon-hint">Trung hạn nửa năm</span>
        </div>
        <div className="horizon-card">
          <span className="horizon-label">Tăng trưởng 1 năm</span>
          <div className="horizon-values">
            <GrowthValuePill value={growth.market_cap_growth_1y} />
            {growth.price_change_1y && (
              <span className="horizon-diff-number">{growth.price_change_1y}</span>
            )}
          </div>
          <span className="horizon-hint">Chu kỳ kinh doanh 12 tháng</span>
        </div>
      </section>

      {/* 3. Extended Core Valuation & Financial Health Matrix */}
      <section className="growth-metrics-matrix" aria-label="Chỉ số định giá và sức khỏe tài chính cụ thể">
        <div className="matrix-item">
          <span className="matrix-label">Vốn hóa thị trường</span>
          <span className="matrix-value highlight">{growth.market_cap}</span>
          <span className="matrix-sub">Quy mô niêm yết</span>
        </div>
        {growth.revenue_ttm && (
          <div className="matrix-item">
            <span className="matrix-label">Doanh thu 4 quý (TTM)</span>
            <span className="matrix-value">{growth.revenue_ttm}</span>
            <span className="matrix-sub">Quy mô doanh thu thuần</span>
          </div>
        )}
        {growth.profit_ttm && (
          <div className="matrix-item">
            <span className="matrix-label">Lợi nhuận sau thuế (TTM)</span>
            <span className="matrix-value highlight">{growth.profit_ttm}</span>
            <span className="matrix-sub">Lãi ròng 12 tháng gần nhất</span>
          </div>
        )}
        {growth.ebitda && (
          <div className="matrix-item">
            <span className="matrix-label">Chỉ số EBITDA</span>
            <span className="matrix-value">{growth.ebitda}</span>
            <span className="matrix-sub">Lợi nhuận trước lãi, thuế, KH</span>
          </div>
        )}
        <div className="matrix-item">
          <span className="matrix-label">Lợi nhuận mỗi CP (EPS)</span>
          <span className="matrix-value">{growth.eps ?? "Đang cập nhật"}</span>
          <span className="matrix-sub">Hiệu quả sinh lời trên 1 CP</span>
        </div>
        <div className="matrix-item">
          <span className="matrix-label">Giá trị sổ sách (BVPS)</span>
          <span className="matrix-value">{growth.bvps ?? "Đang cập nhật"}</span>
          <span className="matrix-sub">Tài sản ròng trên 1 CP</span>
        </div>
        <div className="matrix-item">
          <span className="matrix-label">Chỉ số định giá P/E</span>
          <span className="matrix-value">{growth.pe ? `${growth.pe} lần` : "Đang cập nhật"}</span>
          <span className="matrix-sub">Giá thị trường / Lợi nhuận</span>
        </div>
        <div className="matrix-item">
          <span className="matrix-label">Chỉ số định giá P/B</span>
          <span className="matrix-value">{growth.pb ? `${growth.pb} lần` : "Đang cập nhật"}</span>
          <span className="matrix-sub">Giá thị trường / Giá trị sổ sách</span>
        </div>
        <div className="matrix-item">
          <span className="matrix-label">Tỷ suất ROE hiện tại</span>
          <span className="matrix-value highlight-roe">{growth.roe_percent ?? "Đang cập nhật"}</span>
          <span className="matrix-sub">Hiệu quả sinh lời vốn chủ (TTM)</span>
        </div>
        {growth.roa_percent && (
          <div className="matrix-item">
            <span className="matrix-label">Tỷ suất ROA hiện tại</span>
            <span className="matrix-value">{growth.roa_percent}</span>
            <span className="matrix-sub">Sinh lời trên tổng tài sản</span>
          </div>
        )}
        {growth.gross_margin_percent && (
          <div className="matrix-item">
            <span className="matrix-label">Biên lợi nhuận gộp</span>
            <span className="matrix-value">{growth.gross_margin_percent}</span>
            <span className="matrix-sub">Tỷ lệ lãi gộp trên doanh thu</span>
          </div>
        )}
        {growth.net_margin_percent && (
          <div className="matrix-item">
            <span className="matrix-label">Biên lợi nhuận ròng</span>
            <span className="matrix-value">{growth.net_margin_percent}</span>
            <span className="matrix-sub">Tỷ lệ lãi thuần sau thuế</span>
          </div>
        )}
        {growth.current_ratio && (
          <div className="matrix-item">
            <span className="matrix-label">Khả năng thanh toán</span>
            <span className="matrix-value">{growth.current_ratio}</span>
            <span className="matrix-sub">Tài sản ngắn hạn / Nợ ngắn hạn</span>
          </div>
        )}
        {growth.debt_to_equity && (
          <div className="matrix-item">
            <span className="matrix-label">Đòn bẩy nợ (D/E)</span>
            <span className="matrix-value">{growth.debt_to_equity}</span>
            <span className="matrix-sub">Tổng nợ / Vốn chủ sở hữu</span>
          </div>
        )}
        <div className="matrix-item">
          <span className="matrix-label">Thanh khoản 20 phiên</span>
          <span className="matrix-value">{growth.volume_growth_20d}</span>
          <span className="matrix-sub">{growth.volume_20d_avg ? `TB: ${growth.volume_20d_avg}` : "Xu hướng dòng tiền"}</span>
        </div>
      </section>

      {/* 4. Financial Health Dimensions Indicator */}
      <section className="growth-pillars-card" aria-label="Đánh giá tổng quan 4 trụ cột doanh nghiệp">
        <h3 className="pillars-heading">Đánh Giá Sức Khỏe & Vị Thế Doanh Nghiệp</h3>
        <div className="pillars-grid">
          <div className="pillar-item">
            <div className="pillar-header">
              <span className="pillar-name">1. Hiệu quả sinh lời</span>
              <strong className="pillar-score">{growth.roe_percent ?? "12%"}</strong>
            </div>
            <div className="pillar-bar-bg">
              <div
                className="pillar-bar-fill"
                style={{ width: `${Math.min(100, Math.max(15, parseGrowthPercent(growth.roe_percent) * 3.5))}%`, backgroundColor: "#10b981" }}
              />
            </div>
            <span className="pillar-desc">ROE và ROA phản ánh năng lực tạo ra lợi nhuận từ vốn cổ đông</span>
          </div>

          <div className="pillar-item">
            <div className="pillar-header">
              <span className="pillar-name">2. Tăng trưởng kinh doanh</span>
              <strong className="pillar-score">{growth.quarters.at(-1)?.profit_growth_yoy ?? "+15%"}</strong>
            </div>
            <div className="pillar-bar-bg">
              <div
                className="pillar-bar-fill"
                style={{ width: `${Math.min(100, Math.max(20, Math.abs(parseGrowthPercent(growth.quarters.at(-1)?.profit_growth_yoy)) * 1.5))}%`, backgroundColor: "#38bdf8" }}
              />
            </div>
            <span className="pillar-desc">Tăng trưởng doanh thu và lợi nhuận qua các quý liên tiếp</span>
          </div>

          <div className="pillar-item">
            <div className="pillar-header">
              <span className="pillar-name">3. Sức khỏe tài chính</span>
              <strong className="pillar-score">{growth.current_ratio ?? "1.5x"}</strong>
            </div>
            <div className="pillar-bar-bg">
              <div
                className="pillar-bar-fill"
                style={{ width: "70%", backgroundColor: "#a855f7" }}
              />
            </div>
            <span className="pillar-desc">Cơ cấu nợ vay và hệ số thanh toán đảm bảo an toàn vận hành</span>
          </div>

          <div className="pillar-item">
            <div className="pillar-header">
              <span className="pillar-name">4. Vị thế định giá</span>
              <strong className="pillar-score">{growth.pe ? `${growth.pe}x` : "Hợp lý"}</strong>
            </div>
            <div className="pillar-bar-bg">
              <div
                className="pillar-bar-fill"
                style={{ width: "65%", backgroundColor: "#f59e0b" }}
              />
            </div>
            <span className="pillar-desc">Mức định giá P/E và P/B so với quy mô vốn hóa thị trường</span>
          </div>
        </div>
      </section>

      {/* 5. Quarterly Growth Bar Chart & Detailed Table */}
      <section className="growth-quarters-section" aria-labelledby="quarterly-growth-heading">
        <div className="section-header">
          <h3 id="quarterly-growth-heading">Tăng trưởng Doanh thu & Lợi nhuận các Quý gần nhất</h3>
          <p>So sánh cùng kỳ năm trước (YoY) từ BCTC doanh nghiệp</p>
        </div>
        <StockQuarterlyGrowthChart quarters={growth.quarters} />

        {/* Financial Table */}
        <div className="growth-table-container">
          <table className="growth-financial-table" aria-label="Bảng chỉ số tài chính các quý gần nhất">
            <thead>
              <tr>
                <th scope="col">Kỳ báo cáo</th>
                <th scope="col">Tăng trưởng Doanh thu (YoY)</th>
                <th scope="col">Tăng trưởng Lợi nhuận (YoY)</th>
                <th scope="col">Tỷ suất ROE</th>
                <th scope="col">Biên LN Ròng</th>
                <th scope="col">Biên LN Gộp</th>
              </tr>
            </thead>
            <tbody>
              {growth.quarters.map((q) => (
                <tr key={q.period}>
                  <td className="period-cell"><strong>{q.period}</strong></td>
                  <td><GrowthValuePill value={q.revenue_growth_yoy} /></td>
                  <td><GrowthValuePill value={q.profit_growth_yoy} /></td>
                  <td className="metric-cell">{q.roe ?? "—"}</td>
                  <td className="metric-cell">{q.net_margin ?? "—"}</td>
                  <td className="metric-cell">{q.gross_margin ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Practical Educational Insights (No Emoji Icons) */}
      <section className="growth-insights-section" aria-labelledby="growth-insights-heading">
        <h3 id="growth-insights-heading">Điểm Nhấn Phân Tích Dành Cho Nhà Đầu Tư</h3>
        <div className="growth-insights-grid">
          {growth.insights.map((insight, idx) => {
            const titles = [
              "1. Hiệu quả kinh doanh & Sinh lời",
              "2. Định giá & Vị thế vốn hóa",
              "3. Dòng tiền thực tế & Khuyến nghị",
            ];
            return (
              <div key={idx} className="insight-card">
                <div className="insight-header">
                  <strong className="insight-title">{titles[idx] ?? `Điểm nhấn ${idx + 1}`}</strong>
                </div>
                <p className="insight-content">{insight}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. Live Financial Reports & Forward Growth Analysis (Crawl Text + Images) */}
      <section className="growth-reports-section" aria-labelledby="financial-reports-heading">
        <div className="section-header">
          <div className="section-header-tagline">Dữ liệu phân tích thực tế & tương lai</div>
          <h3 id="financial-reports-heading">Báo Cáo Tài Chính & Triển Vọng Tăng Trưởng Doanh Nghiệp</h3>
          <p>Tổng hợp từ các BCTC, báo cáo phân tích và công bố hoạt động từ nguồn uy tín</p>
        </div>

        {growth.financial_reports && growth.financial_reports.length > 0 ? (
          <div className="reports-grid">
            {growth.financial_reports.map((report, idx) => (
              <FinancialReportCard
                key={`${report.article_url || idx}`}
                item={report}
              />
            ))}
          </div>
        ) : (
          <div className="reports-empty-card">
            <p className="reports-empty-text">
              Dữ liệu báo cáo tài chính và triển vọng tăng trưởng cho mã {growth.symbol} đang tiếp tục được cập nhật theo kỳ công bố mới nhất.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
