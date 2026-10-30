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
    <div className="financial-statements-panel w-full py-2 text-slate-100 font-sans" aria-labelledby="fs-panel-title">
      {/* Top Controls: Period Type Switcher + Statement Tabs */}
      <div className="fs-controls-bar flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="fs-period-switcher flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-inner" role="radiogroup" aria-label="Chu kỳ báo cáo tài chính">
          <button
            type="button"
            className={`fs-period-btn px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
              periodType === "quarter" ? "active bg-sky-500 text-white shadow-sm font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setPeriodType("quarter")}
          >
            📊 Theo Quý (Gần nhất)
          </button>
          <button
            type="button"
            className={`fs-period-btn px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
              periodType === "year" ? "active bg-sky-500 text-white shadow-sm font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setPeriodType("year")}
          >
            📅 Theo Năm (Nhiều năm)
          </button>
        </div>

        <nav className="fs-statement-tabs flex flex-wrap items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-inner" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            className={`fs-tab-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === "overview" ? "active bg-slate-800 text-sky-400 font-bold shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("overview")}
          >
            Trực quan &amp; Tăng trưởng
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "income"}
            className={`fs-tab-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === "income" ? "active bg-slate-800 text-sky-400 font-bold shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("income")}
          >
            Kết quả kinh doanh
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "balance"}
            className={`fs-tab-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === "balance" ? "active bg-slate-800 text-sky-400 font-bold shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("balance")}
          >
            Cân đối kế toán
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "cashflow"}
            className={`fs-tab-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === "cashflow" ? "active bg-slate-800 text-sky-400 font-bold shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("cashflow")}
          >
            Lưu chuyển tiền tệ
          </button>
        </nav>
      </div>

      {/* Overview Charts Tab */}
      {activeTab === "overview" && (
        <div className="fs-overview-section space-y-6">
          {charts.length > 0 ? (
            <>
              {/* Chart 1: Revenue & Profit Comparison */}
              <div className="fs-chart-card bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
                <div className="fs-chart-title-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 id="fs-panel-title" className="text-base sm:text-lg font-bold text-white m-0">Doanh thu &amp; Lợi nhuận sau thuế của {symbol}</h3>
                    <p className="text-xs sm:text-sm text-slate-400 m-0 mt-0.5">So sánh quy mô doanh thu và lợi nhuận ròng qua các kỳ (Đơn vị: Tỷ VNĐ)</p>
                  </div>
                  <div className="fs-chart-legend flex items-center gap-3 text-xs">
                    <span className="legend-item legend-rev flex items-center gap-1.5 text-blue-400 font-semibold">
                      <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></span> Doanh thu thuần
                    </span>
                    <span className="legend-item legend-profit flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> Lợi nhuận ròng
                    </span>
                  </div>
                </div>

                <div className="fs-visual-chart-wrap overflow-x-auto pb-2">
                  <div className="fs-bar-columns-grid flex items-end justify-between gap-4 min-w-[550px] h-52 px-4 pt-6 bg-slate-950/80 rounded-xl border border-slate-800/80">
                    {charts.map((item) => {
                      const maxRev = Math.max(...charts.map((c) => c.revenue_billion || 0), 10);
                      const revHeight = item.revenue_billion ? Math.max(10, Math.round((item.revenue_billion / maxRev) * 100)) : 0;
                      const profitHeight = item.net_profit_billion ? Math.max(8, Math.round((item.net_profit_billion / maxRev) * 100)) : 0;

                      return (
                        <div key={item.period} className="fs-period-column flex-1 max-w-[65px] flex flex-col items-center gap-1.5 h-full justify-end group">
                          <div className="fs-bar-pair w-full flex items-end justify-center gap-1.5 h-36">
                            {/* Revenue Bar */}
                            <div className="fs-bar-single bar-revenue flex-1 bg-slate-900 rounded-t h-full flex flex-col justify-end items-center" title={`Doanh thu: ${item.revenue_billion} tỷ`}>
                              <div className="fs-bar-val text-[9px] font-bold text-blue-400 truncate opacity-80 group-hover:opacity-100">{item.revenue_billion ?? "-"}</div>
                              <div className="fs-bar-body bg-blue-500 w-full rounded-t transition-all group-hover:bg-blue-400" style={{ height: `${revHeight}%` }} />
                            </div>
                            {/* Profit Bar */}
                            <div className="fs-bar-single bar-profit flex-1 bg-slate-900 rounded-t h-full flex flex-col justify-end items-center" title={`Lợi nhuận: ${item.net_profit_billion} tỷ`}>
                              <div className="fs-bar-val text-[9px] font-bold text-emerald-400 truncate opacity-80 group-hover:opacity-100">{item.net_profit_billion ?? "-"}</div>
                              <div className="fs-bar-body bg-emerald-500 w-full rounded-t transition-all group-hover:bg-emerald-400" style={{ height: `${profitHeight}%` }} />
                            </div>
                          </div>
                          <span className="fs-col-period text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition">{item.period}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Chart 2: Margins Trend (Gross Margin & Net Margin %) */}
              <div className="fs-chart-card bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
                <div className="fs-chart-title-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white m-0">Biên lợi nhuận gộp &amp; Biên lợi nhuận ròng (%)</h3>
                    <p className="text-xs sm:text-sm text-slate-400 m-0 mt-0.5">Hiệu quả sinh lời trên mỗi đồng doanh thu thu về</p>
                  </div>
                  <div className="fs-chart-legend flex items-center gap-3 text-xs">
                    <span className="legend-item legend-gross-m flex items-center gap-1.5 text-amber-400 font-semibold">
                      <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm"></span> Biên lãi gộp
                    </span>
                    <span className="legend-item legend-net-m flex items-center gap-1.5 text-purple-400 font-semibold">
                      <span className="w-2.5 h-2.5 bg-purple-500 rounded-sm"></span> Biên lãi ròng
                    </span>
                  </div>
                </div>

                <div className="fs-margin-tiles-row grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {charts.map((item) => (
                    <div key={item.period} className="fs-margin-tile bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1.5 shadow-sm">
                      <strong className="fs-margin-period text-xs font-bold text-slate-200 border-b border-slate-800/80 pb-1">{item.period}</strong>
                      <div className="fs-margin-stat flex items-center justify-between text-xs">
                        <span className="text-slate-400">Biên gộp:</span>
                        <b className="val-gross text-amber-400 font-bold">{item.gross_margin_percent !== null ? `${item.gross_margin_percent}%` : "--"}</b>
                      </div>
                      <div className="fs-margin-stat flex items-center justify-between text-xs">
                        <span className="text-slate-400">Biên ròng:</span>
                        <b className="val-net text-purple-400 font-bold">{item.net_margin_percent !== null ? `${item.net_margin_percent}%` : "--"}</b>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 3: Capital & Debt Structure */}
              <div className="fs-chart-card bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
                <div className="fs-chart-title-row mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-white m-0">Cơ cấu Nguồn vốn: Nợ phải trả vs Vốn chủ sở hữu</h3>
                  <p className="text-xs sm:text-sm text-slate-400 m-0 mt-0.5">Mức độ đòn bẩy tài chính và độ an toàn cấu trúc vốn (Tỷ VNĐ)</p>
                </div>

                <div className="fs-structure-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {charts.map((item) => {
                    const debt = item.total_debt_billion || 0;
                    const eq = item.equity_billion || 0;
                    const total = debt + eq || 1;
                    const debtPct = Math.round((debt / total) * 100);
                    const eqPct = 100 - debtPct;

                    return (
                      <div key={item.period} className="fs-structure-card bg-slate-950/80 border border-slate-800 rounded-xl p-4 shadow-sm">
                        <span className="fs-struct-period text-xs font-bold text-slate-200">{item.period}</span>
                        <div className="fs-struct-stacked-bar h-4 w-full bg-slate-900 rounded-full overflow-hidden flex my-2 border border-slate-800">
                          <div className="bar-part-eq bg-teal-500 h-full transition-all" style={{ width: `${eqPct}%` }} title={`Vốn CSH: ${eq} tỷ (${eqPct}%)`} />
                          <div className="bar-part-debt bg-rose-500 h-full transition-all" style={{ width: `${debtPct}%` }} title={`Nợ: ${debt} tỷ (${debtPct}%)`} />
                        </div>
                        <div className="fs-struct-legend-row flex items-center justify-between text-[11px] font-semibold">
                          <small className="text-eq text-teal-400">VCSH: {eq} tỷ ({eqPct}%)</small>
                          <small className="text-debt text-rose-400">Nợ: {debt} tỷ ({debtPct}%)</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="market-empty compact bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
              <p className="text-xs sm:text-sm m-0">Chưa có dữ liệu biểu đồ tài chính cho chu kỳ này.</p>
            </div>
          )}
        </div>
      )}

      {/* Statement Tables (Income / Balance / Cashflow) */}
      {activeTab !== "overview" && (
        <div className="fs-table-section bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
          <div className="fs-table-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <input
              type="text"
              placeholder="Lọc chỉ tiêu (Doanh thu, Chi phí, Nợ, Lợi nhuận...)"
              value={metricSearch}
              onChange={(e) => setMetricSearch(e.target.value)}
              className="fs-metric-search-input bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-4 py-2 w-full sm:w-80 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-500"
              aria-label="Tìm chỉ tiêu báo cáo tài chính"
            />
            <span className="fs-table-unit-note text-xs text-slate-400 font-semibold self-end sm:self-auto">Đơn vị: Tỷ VNĐ</span>
          </div>

          {filteredMetrics.length > 0 ? (
            <div className="fs-table-wrapper overflow-x-auto rounded-xl border border-slate-800">
              <table className="fs-data-table w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                    <th scope="col" className="fs-th-metric py-3 px-4 font-bold min-w-[220px]">Chỉ tiêu tài chính</th>
                    {periods.map((p) => (
                      <th key={p} scope="col" className="fs-th-period py-3 px-4 font-bold text-right min-w-[100px]">{p}</th>
                    ))}
                    <th scope="col" className="fs-th-growth py-3 px-4 font-bold text-center min-w-[100px]">Tăng trưởng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredMetrics.map((m) => {
                    const latestVal = m.values[0] ?? null;
                    const prevVal = m.values[1] ?? null;
                    const growth = calculateGrowthPct(latestVal, prevVal);
                    const isPositive = growth !== null && growth > 0;
                    const isNegative = growth !== null && growth < 0;

                    return (
                      <tr key={m.code} className="hover:bg-slate-800/40 transition">
                        <td className="fs-td-metric py-3 px-4">
                          <strong className="text-white block font-semibold">{m.name}</strong>
                          <span className="fs-metric-code text-[11px] text-slate-500 font-mono">{m.code}</span>
                        </td>
                        {periods.map((_, idx) => (
                          <td key={idx} className="fs-td-val py-3 px-4 text-right font-medium text-slate-200">
                            {formatBillion(m.values[idx])}
                          </td>
                        ))}
                        <td className="fs-td-growth py-3 px-4 text-center">
                          {growth !== null ? (
                            <span className={`growth-tag inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              isPositive
                                ? "positive bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                                : isNegative
                                ? "negative bg-rose-950 text-rose-400 border border-rose-800/60"
                                : "neutral bg-slate-800 text-slate-400"
                            }`}>
                              {isPositive ? `+${growth}%` : `${growth}%`}
                            </span>
                          ) : (
                            <span className="growth-tag neutral text-slate-500">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="market-empty compact bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
              <p className="text-xs sm:text-sm m-0">Không tìm thấy chỉ tiêu nào phù hợp với từ khóa.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
