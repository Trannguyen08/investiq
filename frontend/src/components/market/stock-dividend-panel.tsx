"use client";

import { useMemo, useState } from "react";
import type { DividendItem, DividendSummary } from "@/types/market";

type StockDividendPanelProps = {
  symbol: string;
  summary: DividendSummary;
  events: DividendItem[];
};

export function StockDividendPanel({ symbol, summary, events }: StockDividendPanelProps) {
  const [filterType, setFilterType] = useState<"all" | "cash" | "stock">("all");

  const filteredEvents = useMemo(() => {
    if (filterType === "cash") {
      return events.filter((e) => e.type === "cash");
    }
    if (filterType === "stock") {
      return events.filter((e) => e.type === "stock" || e.type === "bonus" || e.type === "issuance");
    }
    return events;
  }, [events, filterType]);

  // Aggregate cash payouts by year for visual bar chart
  const annualCashPayouts = useMemo(() => {
    const yearsMap: Record<string, number> = {};
    for (const e of events) {
      if (e.type === "cash" && e.cash_value) {
        const year = (e.ex_date || e.event_date || "").slice(0, 4);
        if (year && year.length === 4 && Number(year) >= 2015) {
          yearsMap[year] = (yearsMap[year] || 0) + e.cash_value;
        }
      }
    }
    const sortedYears = Object.keys(yearsMap).sort();
    const maxVal = Math.max(...Object.values(yearsMap), 1000);
    return sortedYears.map((year) => ({
      year,
      totalCash: yearsMap[year],
      heightPercent: Math.min(100, Math.max(12, Math.round((yearsMap[year] / maxVal) * 100))),
    }));
  }, [events]);

  return (
    <div className="stock-dividend-panel w-full py-2 text-slate-100 font-sans" aria-labelledby="dividend-panel-heading">
      {/* KPI Cards */}
      <div className="dividend-kpi-grid grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="dividend-kpi-card bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <span className="dividend-kpi-label text-xs font-semibold text-slate-400 uppercase tracking-wider">Tỷ suất cổ tức (Yield)</span>
          <strong className="dividend-kpi-value text-accent text-xl sm:text-2xl font-black text-emerald-400 my-1">
            {summary.dividend_yield_percent !== null ? `${summary.dividend_yield_percent}%` : "Theo thị giá"}
          </strong>
          <small className="dividend-kpi-hint text-[11px] text-slate-500">Dựa trên thị giá niêm yết hiện tại</small>
        </div>

        <div className="dividend-kpi-card bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <span className="dividend-kpi-label text-xs font-semibold text-slate-400 uppercase tracking-wider">Tần suất chi trả</span>
          <strong className="dividend-kpi-value text-xl sm:text-2xl font-black text-sky-400 my-1">{summary.frequency}</strong>
          <small className="dividend-kpi-hint text-[11px] text-slate-500">Lịch sử trả cổ tức định kỳ</small>
        </div>

        <div className="dividend-kpi-card bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <span className="dividend-kpi-label text-xs font-semibold text-slate-400 uppercase tracking-wider">Đợt trả gần nhất</span>
          <strong className="dividend-kpi-value text-xl sm:text-2xl font-black text-purple-400 my-1 truncate">
            {summary.latest_payout_ratio || "Đang cập nhật"}
          </strong>
          <small className="dividend-kpi-hint text-[11px] text-slate-500">
            Ngày GDKHQ: {summary.latest_event_date || "Gần đây"}
          </small>
        </div>

        <div className="dividend-kpi-card bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <span className="dividend-kpi-label text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng số đợt chi trả</span>
          <strong className="dividend-kpi-value text-xl sm:text-2xl font-black text-amber-400 my-1">{summary.total_events || events.length} đợt</strong>
          <small className="dividend-kpi-hint text-[11px] text-slate-500">Toàn bộ lịch sử niêm yết</small>
        </div>
      </div>

      {/* Visual Chart: Annual Cash Dividend Payout History */}
      {annualCashPayouts.length > 0 && (
        <section className="dividend-chart-card bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 mb-6 shadow-xl">
          <div className="dividend-chart-header mb-5">
            <div>
              <h3 id="dividend-panel-heading" className="text-base sm:text-lg font-bold text-white m-0">Lịch sử chi trả cổ tức tiền mặt qua các năm</h3>
              <p className="text-xs sm:text-sm text-slate-400 m-0 mt-0.5">Mức cổ tức tiền mặt hàng năm tính bằng Đồng/cổ phiếu (VNĐ/cp)</p>
            </div>
          </div>
          <div className="dividend-bar-chart-container overflow-x-auto pb-2">
            <div className="dividend-bars-row flex items-end justify-around gap-2 min-w-[500px] h-48 px-4 pt-6 bg-slate-950/80 rounded-xl border border-slate-800/80">
              {annualCashPayouts.map((item) => (
                <div key={item.year} className="dividend-bar-col flex-1 max-w-[55px] flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="dividend-bar-value text-[10px] font-bold text-emerald-400 opacity-80 group-hover:opacity-100 transition whitespace-nowrap">
                    {new Intl.NumberFormat("vi-VN").format(item.totalCash)} đ
                  </div>
                  <div className="dividend-bar-track w-full bg-slate-900 rounded-t-lg h-32 flex items-end justify-center p-0.5 border-b border-slate-800">
                    <div
                      className="dividend-bar-fill bg-gradient-to-t from-emerald-600 to-teal-400 hover:from-emerald-500 hover:to-teal-300 rounded-t-md w-full transition-all"
                      style={{ height: `${item.heightPercent}%` }}
                      title={`Năm ${item.year}: ${new Intl.NumberFormat("vi-VN").format(item.totalCash)} đ/cp`}
                    />
                  </div>
                  <span className="dividend-bar-label text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition">{item.year}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Historical Dividend Table */}
      <section className="dividend-history-card bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl overflow-hidden">
        <div className="dividend-table-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white m-0">Chi tiết các đợt chia cổ tức &amp; phát hành của {symbol}</h3>
            <p className="text-xs sm:text-sm text-slate-400 m-0 mt-0.5">Số liệu ghi nhận đầy đủ từ ngày giao dịch không hưởng quyền (GDKHQ) và ngày thực hiện.</p>
          </div>
          <div className="dividend-filter-pills flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto shrink-0" role="radiogroup">
            <button
              type="button"
              className={`dividend-pill-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filterType === "all" ? "active bg-sky-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setFilterType("all")}
            >
              Tất cả ({events.length})
            </button>
            <button
              type="button"
              className={`dividend-pill-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filterType === "cash" ? "active bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setFilterType("cash")}
            >
              💵 Tiền mặt
            </button>
            <button
              type="button"
              className={`dividend-pill-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filterType === "stock" ? "active bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setFilterType("stock")}
            >
              📜 Cổ phiếu &amp; Quyền
            </button>
          </div>
        </div>

        {filteredEvents.length > 0 ? (
          <div className="dividend-table-wrapper overflow-x-auto rounded-xl border border-slate-800">
            <table className="dividend-table w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                  <th scope="col" className="py-3 px-4 font-bold">Ngày GDKHQ</th>
                  <th scope="col" className="py-3 px-4 font-bold">Hình thức</th>
                  <th scope="col" className="py-3 px-4 font-bold">Tỷ lệ / Giá trị</th>
                  <th scope="col" className="py-3 px-4 font-bold">Nội dung chi tiết</th>
                  <th scope="col" className="py-3 px-4 font-bold">Ngày thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredEvents.map((e, index) => {
                  const isCash = e.type === "cash";
                  return (
                    <tr key={`${e.id || "div"}-${e.ex_date || ""}-${index}`} className="hover:bg-slate-800/40 transition">
                      <td className="dividend-date-cell py-3.5 px-4 font-bold text-white whitespace-nowrap">
                        <strong>{e.ex_date || e.event_date || "--"}</strong>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`dividend-type-badge text-xs font-bold px-2 py-0.5 rounded ${
                          isCash ? "badge-cash bg-emerald-950 text-emerald-400 border border-emerald-800/60" : "badge-stock bg-purple-950 text-purple-400 border border-purple-800/60"
                        }`}>
                          {isCash ? "Tiền mặt" : e.type === "bonus" ? "Thưởng cp" : e.type === "issuance" ? "Phát hành" : "Cổ phiếu"}
                        </span>
                      </td>
                      <td className="dividend-ratio-cell py-3.5 px-4 whitespace-nowrap">
                        <strong className="text-slate-100 font-extrabold">{e.ratio || (e.cash_value ? `${e.cash_value.toLocaleString("vi-VN")} đ` : "--")}</strong>
                        {e.cash_value && isCash && (
                          <small className="dividend-sub-val block text-[11px] text-emerald-400/90 font-medium">({e.cash_value.toLocaleString("vi-VN")} đ/cp)</small>
                        )}
                      </td>
                      <td className="dividend-title-cell py-3.5 px-4 text-slate-300 max-w-md">{e.title}</td>
                      <td className="dividend-paydate-cell py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {e.payout_date || e.record_date || "Theo thông báo"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="market-empty compact bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
            <p className="text-xs sm:text-sm m-0">Không có dữ liệu cổ tức nào thuộc bộ lọc này.</p>
          </div>
        )}
      </section>
    </div>
  );
}
