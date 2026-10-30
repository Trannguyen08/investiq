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
    <div className="stock-dividend-panel" aria-labelledby="dividend-panel-heading">
      {/* KPI Cards */}
      <div className="dividend-kpi-grid">
        <div className="dividend-kpi-card">
          <span className="dividend-kpi-label">Tỷ suất cổ tức (Yield)</span>
          <strong className="dividend-kpi-value text-accent">
            {summary.dividend_yield_percent !== null ? `${summary.dividend_yield_percent}%` : "Theo thị giá"}
          </strong>
          <small className="dividend-kpi-hint">Dựa trên thị giá niêm yết hiện tại</small>
        </div>

        <div className="dividend-kpi-card">
          <span className="dividend-kpi-label">Tần suất chi trả</span>
          <strong className="dividend-kpi-value">{summary.frequency}</strong>
          <small className="dividend-kpi-hint">Lịch sử trả cổ tức định kỳ</small>
        </div>

        <div className="dividend-kpi-card">
          <span className="dividend-kpi-label">Đợt trả gần nhất</span>
          <strong className="dividend-kpi-value">
            {summary.latest_payout_ratio || "Đang cập nhật"}
          </strong>
          <small className="dividend-kpi-hint">
            Ngày GDKHQ: {summary.latest_event_date || "Gần đây"}
          </small>
        </div>

        <div className="dividend-kpi-card">
          <span className="dividend-kpi-label">Tổng số đợt chi trả</span>
          <strong className="dividend-kpi-value">{summary.total_events || events.length} đợt</strong>
          <small className="dividend-kpi-hint">Toàn bộ lịch sử niêm yết</small>
        </div>
      </div>

      {/* Visual Chart: Annual Cash Dividend Payout History */}
      {annualCashPayouts.length > 0 && (
        <section className="dividend-chart-card">
          <div className="dividend-chart-header">
            <div>
              <h3 id="dividend-panel-heading">Lịch sử chi trả cổ tức tiền mặt qua các năm</h3>
              <p>Mức cổ tức tiền mặt hàng năm tính bằng Đồng/cổ phiếu (VNĐ/cp)</p>
            </div>
          </div>
          <div className="dividend-bar-chart-container">
            <div className="dividend-bars-row">
              {annualCashPayouts.map((item) => (
                <div key={item.year} className="dividend-bar-col">
                  <div className="dividend-bar-value">
                    {new Intl.NumberFormat("vi-VN").format(item.totalCash)} đ
                  </div>
                  <div className="dividend-bar-track">
                    <div
                      className="dividend-bar-fill"
                      style={{ height: `${item.heightPercent}%` }}
                      title={`Năm ${item.year}: ${new Intl.NumberFormat("vi-VN").format(item.totalCash)} đ/cp`}
                    />
                  </div>
                  <span className="dividend-bar-label">{item.year}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Historical Dividend Table */}
      <section className="dividend-history-card">
        <div className="dividend-table-header-row">
          <div>
            <h3>Chi tiết các đợt chia cổ tức &amp; phát hành của {symbol}</h3>
            <p>Số liệu ghi nhận đầy đủ từ ngày giao dịch không hưởng quyền (GDKHQ) và ngày thực hiện.</p>
          </div>
          <div className="dividend-filter-pills" role="radiogroup">
            <button
              type="button"
              className={`dividend-pill-btn ${filterType === "all" ? "active" : ""}`}
              onClick={() => setFilterType("all")}
            >
              Tất cả ({events.length})
            </button>
            <button
              type="button"
              className={`dividend-pill-btn ${filterType === "cash" ? "active" : ""}`}
              onClick={() => setFilterType("cash")}
            >
              💵 Tiền mặt
            </button>
            <button
              type="button"
              className={`dividend-pill-btn ${filterType === "stock" ? "active" : ""}`}
              onClick={() => setFilterType("stock")}
            >
              📜 Cổ phiếu &amp; Quyền
            </button>
          </div>
        </div>

        {filteredEvents.length > 0 ? (
          <div className="dividend-table-wrapper">
            <table className="dividend-table">
              <thead>
                <tr>
                  <th scope="col">Ngày GDKHQ</th>
                  <th scope="col">Hình thức</th>
                  <th scope="col">Tỷ lệ / Giá trị</th>
                  <th scope="col">Nội dung chi tiết</th>
                  <th scope="col">Ngày thực hiện</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => {
                  const isCash = e.type === "cash";
                  return (
                    <tr key={e.id}>
                      <td className="dividend-date-cell">
                        <strong>{e.ex_date || e.event_date || "--"}</strong>
                      </td>
                      <td>
                        <span className={`dividend-type-badge ${isCash ? "badge-cash" : "badge-stock"}`}>
                          {isCash ? "Tiền mặt" : e.type === "bonus" ? "Thưởng cp" : e.type === "issuance" ? "Phát hành" : "Cổ phiếu"}
                        </span>
                      </td>
                      <td className="dividend-ratio-cell">
                        <strong>{e.ratio || (e.cash_value ? `${e.cash_value.toLocaleString("vi-VN")} đ` : "--")}</strong>
                        {e.cash_value && isCash && (
                          <small className="dividend-sub-val">({e.cash_value.toLocaleString("vi-VN")} đ/cp)</small>
                        )}
                      </td>
                      <td className="dividend-title-cell">{e.title}</td>
                      <td className="dividend-paydate-cell">
                        {e.payout_date || e.record_date || "Theo thông báo"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="market-empty compact">
            <p>Không có dữ liệu cổ tức nào thuộc bộ lọc này.</p>
          </div>
        )}
      </section>
    </div>
  );
}

