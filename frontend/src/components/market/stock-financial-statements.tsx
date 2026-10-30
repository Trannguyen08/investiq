"use client";

import { useMemo, useState } from "react";
import type { FinancialStatementsData } from "@/types/market";

type StockFinancialStatementsProps = {
  symbol: string;
  initialQuarterData?: FinancialStatementsData | null;
  initialYearData?: FinancialStatementsData | null;
};

type StatementTab = "overview" | "income" | "balance" | "cashflow";

export function StockFinancialStatements({
  symbol,
  initialQuarterData,
  initialYearData,
}: StockFinancialStatementsProps) {
  const [periodType, setPeriodType] = useState<"quarter" | "year">("quarter");
  const [activeTab, setActiveTab] = useState<StatementTab>("overview");
  const [metricSearch, setMetricSearch] = useState("");

  const activeData = periodType === "quarter" ? initialQuarterData : (initialYearData || initialQuarterData);
  const periods = activeData?.periods || [];
  const charts = activeData?.charts || [];

  // Metrics for active tab
  const currentMetrics = useMemo(() => {
    if (!activeData) return [];
    if (activeTab === "income") return activeData.income_statement || [];
    if (activeTab === "balance") return activeData.balance_sheet || [];
    if (activeTab === "cashflow") return activeData.cash_flow || [];
    return [];
  }, [activeData, activeTab]);

  const filteredMetrics = useMemo(() => {
    if (!metricSearch.trim()) return currentMetrics;
    const q = metricSearch.trim().toLowerCase();
    return currentMetrics.filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q));
  }, [currentMetrics, metricSearch]);

  const formatBillion = (val: number | null | undefined) => {
    if (val === null || val === undefined || !Number.isFinite(val)) return "-";
    // Convert raw VND (e.g. 47301623136) to tỷ VND (47.301 tỷ)
    const inBillion = val > 1e7 ? val / 1e9 : val;
    return new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }).format(inBillion);
  };

  const calculateGrowthPct = (latest: number | null, prev: number | null) => {
    if (latest === null || prev === null || prev === 0) return null;
    return Math.round(((latest - prev) / Math.abs(prev)) * 1000) / 10;
  };

  return (
    <div className="financial-statements-panel" aria-labelledby="fs-panel-title">
      {/* Top Controls: Period Type Switcher + Statement Tabs */}
      <div className="fs-controls-bar">
        <div className="fs-period-switcher" role="radiogroup" aria-label="Chu kỳ báo cáo tài chính">
          <button
            type="button"
            className={`fs-period-btn ${periodType === "quarter" ? "active" : ""}`}
            onClick={() => setPeriodType("quarter")}
          >
            📊 Theo Quý (Gần nhất)
          </button>
          <button
            type="button"
            className={`fs-period-btn ${periodType === "year" ? "active" : ""}`}
            onClick={() => setPeriodType("year")}
          >
            📅 Theo Năm (Nhiều năm)
          </button>
        </div>

        <nav className="fs-statement-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            className={`fs-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Trực quan &amp; Tăng trưởng
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "income"}
            className={`fs-tab-btn ${activeTab === "income" ? "active" : ""}`}
            onClick={() => setActiveTab("income")}
          >
            Kết quả kinh doanh
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "balance"}
            className={`fs-tab-btn ${activeTab === "balance" ? "active" : ""}`}
            onClick={() => setActiveTab("balance")}
          >
            Cân đối kế toán
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "cashflow"}
            className={`fs-tab-btn ${activeTab === "cashflow" ? "active" : ""}`}
            onClick={() => setActiveTab("cashflow")}
          >
            Lưu chuyển tiền tệ
          </button>
        </nav>
      </div>

      {/* Overview Charts Tab */}
      {activeTab === "overview" && (
        <div className="fs-overview-section">
          {charts.length > 0 ? (
            <>
              {/* Chart 1: Revenue & Profit Comparison */}
              <div className="fs-chart-card">
                <div className="fs-chart-title-row">
                  <div>
                    <h3 id="fs-panel-title">Doanh thu &amp; Lợi nhuận sau thuế của {symbol}</h3>
                    <p>So sánh quy mô doanh thu và lợi nhuận ròng qua các kỳ (Đơn vị: Tỷ VNĐ)</p>
                  </div>
                  <div className="fs-chart-legend">
                    <span className="legend-item legend-rev">Doanh thu thuần</span>
                    <span className="legend-item legend-profit">Lợi nhuận ròng</span>
                  </div>
                </div>

                <div className="fs-visual-chart-wrap">
                  <div className="fs-bar-columns-grid">
                    {charts.map((item) => {
                      const maxRev = Math.max(...charts.map((c) => c.revenue_billion || 0), 10);
                      const revHeight = item.revenue_billion ? Math.max(10, Math.round((item.revenue_billion / maxRev) * 100)) : 0;
                      const profitHeight = item.net_profit_billion ? Math.max(8, Math.round((item.net_profit_billion / maxRev) * 100)) : 0;

                      return (
                        <div key={item.period} className="fs-period-column">
                          <div className="fs-bar-pair">
                            {/* Revenue Bar */}
                            <div className="fs-bar-single bar-revenue" title={`Doanh thu: ${item.revenue_billion} tỷ`}>
                              <div className="fs-bar-val">{item.revenue_billion ?? "-"}</div>
                              <div className="fs-bar-body" style={{ height: `${revHeight}%` }} />
                            </div>
                            {/* Profit Bar */}
                            <div className="fs-bar-single bar-profit" title={`Lợi nhuận: ${item.net_profit_billion} tỷ`}>
                              <div className="fs-bar-val">{item.net_profit_billion ?? "-"}</div>
                              <div className="fs-bar-body" style={{ height: `${profitHeight}%` }} />
                            </div>
                          </div>
                          <span className="fs-col-period">{item.period}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Chart 2: Margins Trend (Gross Margin & Net Margin %) */}
              <div className="fs-chart-card">
                <div className="fs-chart-title-row">
                  <div>
                    <h3>Biên lợi nhuận gộp &amp; Biên lợi nhuận ròng (%)</h3>
                    <p>Hiệu quả sinh lời trên mỗi đồng doanh thu thu về</p>
                  </div>
                  <div className="fs-chart-legend">
                    <span className="legend-item legend-gross-m">Biên lãi gộp</span>
                    <span className="legend-item legend-net-m">Biên lãi ròng</span>
                  </div>
                </div>

                <div className="fs-margin-tiles-row">
                  {charts.map((item) => (
                    <div key={item.period} className="fs-margin-tile">
                      <strong className="fs-margin-period">{item.period}</strong>
                      <div className="fs-margin-stat">
                        <span>Biên gộp:</span>
                        <b className="val-gross">{item.gross_margin_percent !== null ? `${item.gross_margin_percent}%` : "--"}</b>
                      </div>
                      <div className="fs-margin-stat">
                        <span>Biên ròng:</span>
                        <b className="val-net">{item.net_margin_percent !== null ? `${item.net_margin_percent}%` : "--"}</b>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 3: Capital & Debt Structure */}
              <div className="fs-chart-card">
                <div className="fs-chart-title-row">
                  <div>
                    <h3>Cơ cấu Nguồn vốn: Nợ phải trả vs Vốn chủ sở hữu</h3>
                    <p>Mức độ đòn bẩy tài chính và độ an toàn cấu trúc vốn (Tỷ VNĐ)</p>
                  </div>
                </div>

                <div className="fs-structure-grid">
                  {charts.map((item) => {
                    const debt = item.total_debt_billion || 0;
                    const eq = item.equity_billion || 0;
                    const total = debt + eq || 1;
                    const debtPct = Math.round((debt / total) * 100);
                    const eqPct = 100 - debtPct;

                    return (
                      <div key={item.period} className="fs-structure-card">
                        <span className="fs-struct-period">{item.period}</span>
                        <div className="fs-struct-stacked-bar">
                          <div className="bar-part-eq" style={{ width: `${eqPct}%` }} title={`Vốn CSH: ${eq} tỷ (${eqPct}%)`} />
                          <div className="bar-part-debt" style={{ width: `${debtPct}%` }} title={`Nợ: ${debt} tỷ (${debtPct}%)`} />
                        </div>
                        <div className="fs-struct-legend-row">
                          <small className="text-eq">VCSH: {eq} tỷ ({eqPct}%)</small>
                          <small className="text-debt">Nợ: {debt} tỷ ({debtPct}%)</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="market-empty compact">
              <p>Chưa có dữ liệu biểu đồ tài chính cho chu kỳ này.</p>
            </div>
          )}
        </div>
      )}

      {/* Statement Tables (Income / Balance / Cashflow) */}
      {activeTab !== "overview" && (
        <div className="fs-table-section">
          <div className="fs-table-toolbar">
            <input
              type="text"
              placeholder="Lọc chỉ tiêu (Doanh thu, Chi phí, Nợ, Lợi nhuận...)"
              value={metricSearch}
              onChange={(e) => setMetricSearch(e.target.value)}
              className="fs-metric-search-input"
              aria-label="Tìm chỉ tiêu báo cáo tài chính"
            />
            <span className="fs-table-unit-note">Đơn vị: Tỷ VNĐ</span>
          </div>

          {filteredMetrics.length > 0 ? (
            <div className="fs-table-wrapper">
              <table className="fs-data-table">
                <thead>
                  <tr>
                    <th scope="col" className="fs-th-metric">Chỉ tiêu tài chính</th>
                    {periods.map((p) => (
                      <th key={p} scope="col" className="fs-th-period">{p}</th>
                    ))}
                    <th scope="col" className="fs-th-growth">Tăng trưởng</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMetrics.map((m) => {
                    const latestVal = m.values[0] ?? null;
                    const prevVal = m.values[1] ?? null;
                    const growth = calculateGrowthPct(latestVal, prevVal);
                    const isPositive = growth !== null && growth > 0;
                    const isNegative = growth !== null && growth < 0;

                    return (
                      <tr key={m.code}>
                        <td className="fs-td-metric">
                          <strong>{m.name}</strong>
                          <span className="fs-metric-code">{m.code}</span>
                        </td>
                        {periods.map((_, idx) => (
                          <td key={idx} className="fs-td-val">
                            {formatBillion(m.values[idx])}
                          </td>
                        ))}
                        <td className="fs-td-growth">
                          {growth !== null ? (
                            <span className={`growth-tag ${isPositive ? "positive" : isNegative ? "negative" : "neutral"}`}>
                              {isPositive ? `+${growth}%` : `${growth}%`}
                            </span>
                          ) : (
                            <span className="growth-tag neutral">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="market-empty compact">
              <p>Không tìm thấy chỉ tiêu nào phù hợp với từ khóa.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
