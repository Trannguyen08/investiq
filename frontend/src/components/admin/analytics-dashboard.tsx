"use client";

import { useState } from "react";
import type { AdminAnalyticsResponse, TopTraderItem } from "@/lib/server/admin-ops-api";
import { AdminDetailModal } from "@/components/admin/admin-detail-modal";
import { IconView, IconDownload, IconTrendingUp } from "@/components/admin/admin-icons";

const vndFormat = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

export function AnalyticsDashboard({ data }: { data: AdminAnalyticsResponse }) {
  const [selectedTrader, setSelectedTrader] = useState<TopTraderItem | null>(null);

  function exportCsv() {
    const headers = [
      "Hạng",
      "Tên nhà đầu tư",
      "Email",
      "Biệt danh",
      "Vốn ban đầu (VND)",
      "Số dư tiền mặt (VND)",
      "Lãi đã chốt (VND)",
      "Hiệu suất ROI (%)",
      "Tỷ lệ thắng (%)",
      "Tổng số lệnh",
      "Số mã nắm giữ",
    ];

    const rows = data.top_traders.map((t) => [
      t.rank,
      `"${t.user_name.replace(/"/g, '""')}"`,
      `"${t.user_email}"`,
      `"${t.nickname || ""}"`,
      t.starting_cash,
      t.cash_balance,
      t.realized_pnl,
      t.roi_percent,
      t.win_rate,
      t.total_trades,
      t.holdings_count,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `InvestIQ_Top_Traders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportJson() {
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", jsonStr);
    link.setAttribute("download", `InvestIQ_Analytics_Report_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* 4 KPI CARDS */}
      <div className="admin-overview-grid">
        <div className="admin-metric-card-v2" style={{ borderLeft: "4px solid #2563eb" }}>
          <div className="metric-header-v2">
            <span className="metric-label-v2">Vốn giải ngân thị trường</span>
            <span className="metric-badge-v2 up">Cổ phiếu</span>
          </div>
          <div className="metric-value-v2">
            {(data.total_capital_deployed_vnd / 1_000_000_000).toFixed(1)} Tỷ VND
          </div>
          <div className="metric-sub-v2">
            Giá trị thực nắm giữ trong các danh mục ảo
          </div>
        </div>

        <div className="admin-metric-card-v2" style={{ borderLeft: "4px solid #10b981" }}>
          <div className="metric-header-v2">
            <span className="metric-label-v2">Tỷ trọng Tiền mặt / Cổ</span>
            <span className="metric-badge-v2 neutral">Phân bổ</span>
          </div>
          <div className="metric-value-v2">
            {data.asset_allocation.cash_share_percent}% / {data.asset_allocation.equity_share_percent}%
          </div>
          <div className="metric-sub-v2">
            Tiền mặt: {vndFormat.format(data.asset_allocation.total_cash_vnd)} ₫
          </div>
        </div>

        <div className="admin-metric-card-v2" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="metric-header-v2">
            <span className="metric-label-v2">ROI bình quân Top Trader</span>
            <span className="metric-badge-v2 up">
              <IconTrendingUp width={12} height={12} />
              {data.average_portfolio_roi > 0 ? "+" : ""}
              {data.average_portfolio_roi}%
            </span>
          </div>
          <div className="metric-value-v2">
            {data.average_portfolio_roi > 0 ? "+" : ""}
            {data.average_portfolio_roi}%
          </div>
          <div className="metric-sub-v2">
            Tính trên 10 tài khoản có hiệu suất cao nhất
          </div>
        </div>

        <div className="admin-metric-card-v2" style={{ borderLeft: "4px solid #8b5cf6" }}>
          <div className="metric-header-v2">
            <span className="metric-label-v2">Xuất dữ liệu hệ thống</span>
            <span className="metric-badge-v2 neutral">Định kỳ</span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={exportCsv}
              className="admin-btn-action-primary"
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.7rem", flex: 1 }}
            >
              <IconDownload width={13} height={13} />
              <span>Xuất CSV</span>
            </button>
            <button
              type="button"
              onClick={exportJson}
              className="admin-btn-action-secondary"
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.7rem", flex: 1 }}
            >
              <IconDownload width={13} height={13} />
              <span>Xuất JSON</span>
            </button>
          </div>
          <div className="metric-sub-v2" style={{ marginTop: "0.4rem" }}>
            Cập nhật lúc: {data.generated_at.slice(11, 16)} UTC
          </div>
        </div>
      </div>

      {/* TOP TRADERS LEADERBOARD TABLE */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">Bảng Xếp Hạng Top Nhà Đầu Tư (Leaderboard)</h2>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Xếp hạng theo lãi ròng thực tế đã chốt và tỷ lệ sinh lời trên vốn ban đầu
            </span>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="admin-btn-action-secondary"
            style={{ fontSize: "0.8rem" }}
          >
            <IconDownload width={14} height={14} />
            <span>Tải CSV</span>
          </button>
        </div>

        <div className="admin-table-container">
          <table className="admin-table-unified">
            <thead>
              <tr>
                <th style={{ width: "60px", textAlign: "center" }}>Hạng</th>
                <th>Nhà đầu tư</th>
                <th>Biệt danh</th>
                <th style={{ textAlign: "right" }}>Vốn ban đầu</th>
                <th style={{ textAlign: "right" }}>Số dư hiện tại</th>
                <th style={{ textAlign: "right" }}>Lãi đã chốt</th>
                <th style={{ textAlign: "right" }}>Hiệu suất (ROI)</th>
                <th style={{ textAlign: "right" }}>Tỷ lệ thắng</th>
                <th style={{ textAlign: "center" }}>Tổng lệnh</th>
                <th style={{ textAlign: "right", width: "80px" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.top_traders.length ? (
                data.top_traders.map((t) => {
                  const rankBadge =
                    t.rank === 1 ? (
                      <span
                        style={{
                          backgroundColor: "#fef08a",
                          color: "#854d0e",
                          fontWeight: 800,
                          fontSize: "0.85rem",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "12px",
                          border: "1px solid #fde047",
                        }}
                      >
                        #1
                      </span>
                    ) : t.rank === 2 ? (
                      <span
                        style={{
                          backgroundColor: "#e2e8f0",
                          color: "#334155",
                          fontWeight: 800,
                          fontSize: "0.85rem",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "12px",
                          border: "1px solid #cbd5e1",
                        }}
                      >
                        #2
                      </span>
                    ) : t.rank === 3 ? (
                      <span
                        style={{
                          backgroundColor: "#fed7aa",
                          color: "#9a3412",
                          fontWeight: 800,
                          fontSize: "0.85rem",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "12px",
                          border: "1px solid #fdba74",
                        }}
                      >
                        #3
                      </span>
                    ) : (
                      <span style={{ color: "#64748b", fontWeight: 600 }}>#{t.rank}</span>
                    );

                  const isProfit = t.realized_pnl > 0;
                  const isLoss = t.realized_pnl < 0;

                  return (
                    <tr key={t.user_id}>
                      <td style={{ textAlign: "center" }}>{rankBadge}</td>
                      <td>
                        <div>
                          <strong style={{ color: "#1e293b", fontSize: "0.9rem", display: "block" }}>
                            {t.user_name}
                          </strong>
                          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                            {t.user_email}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.84rem", color: "#475569" }}>
                          {t.nickname ?? "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontSize: "0.84rem" }}>
                        {vndFormat.format(t.starting_cash)} ₫
                      </td>
                      <td style={{ textAlign: "right", fontSize: "0.84rem" }}>
                        {vndFormat.format(t.cash_balance)} ₫
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <strong
                          style={{
                            color: isProfit ? "#16a34a" : isLoss ? "#dc2626" : "#64748b",
                          }}
                        >
                          {isProfit ? "+" : ""}
                          {vndFormat.format(t.realized_pnl)} ₫
                        </strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className={`admin-badge ${t.roi_percent >= 0 ? "active" : "disabled"}`}
                          style={{ fontWeight: 700 }}
                        >
                          {t.roi_percent >= 0 ? "+" : ""}
                          {t.roi_percent}%
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontSize: "0.84rem", fontWeight: 600 }}>
                        {t.win_rate}%
                      </td>
                      <td style={{ textAlign: "center", fontSize: "0.84rem", color: "#64748b" }}>
                        {t.total_trades}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="admin-icon-btn view"
                          title="Xem chi tiết nhà đầu tư"
                          aria-label={`Xem hồ sơ ${t.user_name}`}
                          onClick={() => setSelectedTrader(t)}
                        >
                          <IconView width={15} height={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#94a3b8" }}>
                    Chưa có giao dịch chốt lời nào được thực hiện trong hệ thống.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2 CHARTS: EXCHANGE LIQUIDITY & SECTOR THESES */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* EXCHANGE LIQUIDITY */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">Thanh khoản theo Sàn giao dịch</h2>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Tỷ trọng giá trị khớp lệnh giữa HOSE, HNX và UPCoM
              </span>
            </div>
          </div>
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {data.exchange_liquidity.map((ex) => (
              <div key={ex.exchange}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "#1e3a8a" }}>
                    Sàn {ex.exchange} ({ex.total_symbols} mã)
                  </span>
                  <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "#2563eb" }}>
                    {vndFormat.format(ex.total_value_vnd)} ₫ ({ex.share_percent}%)
                  </span>
                </div>
                <div
                  style={{
                    height: "8px",
                    borderRadius: "4px",
                    backgroundColor: "#e2e8f0",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${ex.share_percent}%`,
                      backgroundColor:
                        ex.exchange === "HOSE"
                          ? "#2563eb"
                          : ex.exchange === "HNX"
                          ? "#06b6d4"
                          : "#8b5cf6",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTOR THESES PERFORMANCE */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">Hiệu suất Luận điểm theo Ngành</h2>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Tỷ lệ khuyến nghị thành công (Target Hit %) theo từng nhóm ngành
              </span>
            </div>
          </div>
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {data.sector_theses.length ? (
              data.sector_theses.slice(0, 5).map((sec) => (
                <div key={sec.sector}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.86rem", fontWeight: 600, color: "#334155" }}>
                      {sec.sector} ({sec.theses_count} bài)
                    </span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#16a34a" }}>
                      Win Rate: {sec.win_rate}% (
                      <span style={{ color: "#16a34a" }}>{sec.bullish_count} Mua</span> /{" "}
                      <span style={{ color: "#dc2626" }}>{sec.bearish_count} Bán</span>)
                    </span>
                  </div>
                  <div
                    style={{
                      height: "8px",
                      borderRadius: "4px",
                      backgroundColor: "#e2e8f0",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(5, sec.win_rate))}%`,
                        backgroundColor: "#10b981",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "#94a3b8", textAlign: "center", padding: "1.5rem" }}>
                Chưa có đủ dữ liệu luận điểm đóng để thống kê theo ngành.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedTrader && (
        <AdminDetailModal
          title={`Hồ sơ Nhà Đầu Tư: ${selectedTrader.user_name} (Hạng #${selectedTrader.rank})`}
          isOpen={true}
          onClose={() => setSelectedTrader(null)}
        >
          <div className="admin-detail-grid">
            <div className="admin-detail-item">
              <span className="admin-detail-label">Thứ hạng Leaderboard</span>
              <span className="admin-detail-val">
                <strong style={{ color: "#2563eb" }}>#{selectedTrader.rank}</strong>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mã định danh (User ID)</span>
              <span className="admin-detail-val">
                <code>{selectedTrader.user_id}</code>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Họ và tên</span>
              <span className="admin-detail-val">{selectedTrader.user_name}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Địa chỉ email</span>
              <span className="admin-detail-val">{selectedTrader.user_email}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Biệt danh thi đấu</span>
              <span className="admin-detail-val">{selectedTrader.nickname ?? "Chưa công khai"}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Vốn khởi điểm ban đầu</span>
              <span className="admin-detail-val">{vndFormat.format(selectedTrader.starting_cash)} ₫</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Số dư tiền mặt hiện tại</span>
              <span className="admin-detail-val">{vndFormat.format(selectedTrader.cash_balance)} ₫</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Lợi nhuận ròng đã chốt</span>
              <span className="admin-detail-val">
                <strong>{vndFormat.format(selectedTrader.realized_pnl)} ₫</strong>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Hiệu suất sinh lời (ROI)</span>
              <span className="admin-detail-val">
                <strong style={{ color: selectedTrader.roi_percent >= 0 ? "#16a34a" : "#dc2626" }}>
                  {selectedTrader.roi_percent >= 0 ? "+" : ""}{selectedTrader.roi_percent}%
                </strong>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Tỷ lệ thắng (Win Rate)</span>
              <span className="admin-detail-val">{selectedTrader.win_rate}%</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Tổng số lệnh đã khớp</span>
              <span className="admin-detail-val">{selectedTrader.total_trades} lệnh</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Số mã đang nắm giữ</span>
              <span className="admin-detail-val">{selectedTrader.holdings_count} mã</span>
            </div>
          </div>
        </AdminDetailModal>
      )}
    </div>
  );
}
