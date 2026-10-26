import type { QuarterlyGrowthPoint, StockGrowthData } from "@/types/market";

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
        icon: "🚀",
        color: "#10b981",
        bg: "rgba(16, 185, 129, 0.12)",
        border: "rgba(16, 185, 129, 0.35)",
      };
    case "stable":
      return {
        label: "Tăng trưởng ổn định",
        className: "badge-stable",
        icon: "🛡️",
        color: "#38bdf8",
        bg: "rgba(56, 189, 248, 0.12)",
        border: "rgba(56, 189, 248, 0.35)",
      };
    case "accumulating":
      return {
        label: "Dòng tiền tích lũy",
        className: "badge-accumulating",
        icon: "⚡",
        color: "#f59e0b",
        bg: "rgba(245, 158, 11, 0.12)",
        border: "rgba(245, 158, 11, 0.35)",
      };
    case "cautious":
    default:
      return {
        label: "Cần theo dõi thận trọng",
        className: "badge-cautious",
        icon: "⚠️",
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

  // Find max absolute value to scale bars nicely
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

            // Heights
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
                {/* Revenue Label */}
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
                {/* Profit Label */}
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

                {/* Period label at the bottom */}
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

export function StockGrowthPanel({ growth }: { growth: StockGrowthData }) {
  const badge = healthBadgeConfig(growth.health_status);

  return (
    <div className="stock-growth-panel" data-testid="stock-growth-panel">
      {/* 1. Health Scorecard Header */}
      <section className="growth-hero-card" aria-labelledby="growth-health-heading">
        <div className="growth-hero-top">
          <div className="growth-hero-badge" style={{ backgroundColor: badge.bg, borderColor: badge.border, color: badge.color }}>
            <span className="badge-icon">{badge.icon}</span>
            <span className="badge-text">{badge.label}</span>
          </div>
          <span className="growth-sector-tag">{growth.sector}</span>
        </div>
        <h2 id="growth-health-heading" className="growth-hero-title">
          {growth.health_title}
        </h2>
        <p className="growth-hero-summary">{growth.health_summary}</p>
      </section>

      {/* 2. Capitalization Growth Horizons */}
      <section className="growth-horizon-grid" aria-label="Tăng trưởng vốn hóa theo các mốc thời gian">
        <div className="horizon-card">
          <span className="horizon-label">Tăng trưởng 1 tháng</span>
          <GrowthValuePill value={growth.market_cap_growth_1m} />
          <span className="horizon-hint">So với 22 phiên trước</span>
        </div>
        <div className="horizon-card">
          <span className="horizon-label">Tăng trưởng 3 tháng</span>
          <GrowthValuePill value={growth.market_cap_growth_3m} />
          <span className="horizon-hint">So với quý trước</span>
        </div>
        <div className="horizon-card">
          <span className="horizon-label">Tăng trưởng 6 tháng</span>
          <GrowthValuePill value={growth.market_cap_growth_6m} />
          <span className="horizon-hint">Trung hạn nửa năm</span>
        </div>
        <div className="horizon-card">
          <span className="horizon-label">Tăng trưởng 1 năm</span>
          <GrowthValuePill value={growth.market_cap_growth_1y} />
          <span className="horizon-hint">Chu kỳ kinh doanh 12 tháng</span>
        </div>
      </section>

      {/* 3. Core Valuation & Liquidity Matrix */}
      <section className="growth-metrics-matrix" aria-label="Chỉ số định giá và thanh khoản cốt lõi">
        <div className="matrix-item">
          <span className="matrix-label">Vốn hóa thị trường</span>
          <span className="matrix-value highlight">{growth.market_cap}</span>
        </div>
        <div className="matrix-item">
          <span className="matrix-label">Thanh khoản 20 phiên</span>
          <span className="matrix-value">{growth.volume_growth_20d}</span>
        </div>
        <div className="matrix-item">
          <span className="matrix-label">Chỉ số P/E</span>
          <span className="matrix-value">{growth.pe ? `${growth.pe} lần` : "Đang cập nhật"}</span>
        </div>
        <div className="matrix-item">
          <span className="matrix-label">Chỉ số P/B</span>
          <span className="matrix-value">{growth.pb ? `${growth.pb} lần` : "Đang cập nhật"}</span>
        </div>
        <div className="matrix-item">
          <span className="matrix-label">Lợi nhuận mỗi CP (EPS)</span>
          <span className="matrix-value">{growth.eps ?? "Đang cập nhật"}</span>
        </div>
        <div className="matrix-item">
          <span className="matrix-label">Tỷ suất ROE hiện tại</span>
          <span className="matrix-value highlight-roe">{growth.roe_percent ?? "Đang cập nhật"}</span>
        </div>
      </section>

      {/* 4. Quarterly Growth Bar Chart */}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. 3 Practical F0 Insights */}
      <section className="growth-insights-section" aria-labelledby="growth-insights-heading">
        <h3 id="growth-insights-heading">3 Điểm Nhấn Phân Tích Dành Cho Nhà Đầu Tư</h3>
        <div className="growth-insights-grid">
          {growth.insights.map((insight, idx) => {
            const icons = ["💡", "📊", "🎯"];
            const titles = [
              "Hiệu quả kinh doanh & Sinh lời",
              "Định giá & Vị thế vốn hóa",
              "Dòng tiền thực tế & Khuyến nghị",
            ];
            return (
              <div key={idx} className="insight-card">
                <div className="insight-header">
                  <span className="insight-icon">{icons[idx] ?? "📌"}</span>
                  <strong className="insight-title">{titles[idx] ?? `Điểm nhấn ${idx + 1}`}</strong>
                </div>
                <p className="insight-content">{insight}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
