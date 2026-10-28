"use client";

import { useState } from "react";
import type { AdminOverviewData, RecentAuditItem } from "@/lib/server/admin-ops-api";
import { AdminDetailModal } from "@/components/admin/admin-detail-modal";

function formatCurrency(vnd: number): string {
  if (vnd >= 1_000_000_000) {
    return `${(vnd / 1_000_000_000).toFixed(1)} tỷ`;
  }
  if (vnd >= 1_000_000) {
    return `${(vnd / 1_000_000).toFixed(1)} tr`;
  }
  return new Intl.NumberFormat("vi-VN").format(vnd) + " ₫";
}

export function AdminOverviewDashboard({ data }: { data: AdminOverviewData }) {
  const [selectedAudit, setSelectedAudit] = useState<RecentAuditItem | null>(null);
  const [chartMetric, setChartMetric] = useState<"both" | "users" | "trades">("both");

  // SVG Area Chart calculations for 7-day activity
  const chartPoints = data.activity_chart || [];
  const maxVal = Math.max(
    ...chartPoints.map((p) => Math.max(p.new_users, p.trades_count)),
    5
  );
  const chartWidth = 640;
  const chartHeight = 200;
  const paddingX = 40;
  const paddingY = 25;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;

  const pointsUsers = chartPoints.map((p, idx) => {
    const x = paddingX + (idx / Math.max(chartPoints.length - 1, 1)) * plotWidth;
    const y = chartHeight - paddingY - (p.new_users / maxVal) * plotHeight;
    return { x, y, val: p.new_users, date: p.date };
  });

  const pointsTrades = chartPoints.map((p, idx) => {
    const x = paddingX + (idx / Math.max(chartPoints.length - 1, 1)) * plotWidth;
    const y = chartHeight - paddingY - (p.trades_count / maxVal) * plotHeight;
    return { x, y, val: p.trades_count, date: p.date };
  });

  const userPathD = pointsUsers.reduce(
    (acc, pt, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`,
    ""
  );
  const userAreaD = pointsUsers.length
    ? `${userPathD} L ${pointsUsers[pointsUsers.length - 1].x} ${chartHeight - paddingY} L ${pointsUsers[0].x} ${chartHeight - paddingY} Z`
    : "";

  const tradePathD = pointsTrades.reduce(
    (acc, pt, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`,
    ""
  );

  // Donut chart calculations for Stance distribution
  const totalTheses = Math.max(data.total_theses, 1);
  const bullishPct = Math.round((data.bullish_theses / totalTheses) * 100);
  const bearishPct = Math.round((data.bearish_theses / totalTheses) * 100);
  const neutralPct = Math.max(0, 100 - bullishPct - bearishPct);

  // Circumference for r=40 is ~251.3
  const circumference = 2 * Math.PI * 40;
  const bullishOffset = 0;
  const bullishLength = (bullishPct / 100) * circumference;
  const bearishOffset = -bullishLength;
  const bearishLength = (bearishPct / 100) * circumference;
  const neutralOffset = -(bullishLength + bearishLength);
  const neutralLength = (neutralPct / 100) * circumference;

  // Sentiment calculations
  const totalSentiment =
    (data.news_sentiment_breakdown?.positive || 0) +
    (data.news_sentiment_breakdown?.neutral || 0) +
    (data.news_sentiment_breakdown?.negative || 0) || 1;
  const posPct = Math.round(
    ((data.news_sentiment_breakdown?.positive || 0) / totalSentiment) * 100
  );
  const negPct = Math.round(
    ((data.news_sentiment_breakdown?.negative || 0) / totalSentiment) * 100
  );
  const neuPct = Math.max(0, 100 - posPct - negPct);

  return (
    <div>
      <div className="admin-view-header">
        <div>
          <h1>Tổng quan hệ thống</h1>
          <p>Báo cáo chỉ số hoạt động, phân tích dữ liệu thị trường và giám sát an ninh hệ thống.</p>
        </div>
      </div>

      {/* 4 CORE KPI CARDS */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-label">Người dùng hệ thống</div>
          <div className="admin-kpi-value">{data.total_users.toLocaleString()}</div>
          <div className="admin-kpi-sub">
            Hoạt động: <strong>{data.active_users}</strong> | Đăng ký 7 ngày:{" "}
            <strong>+{data.new_users_7d}</strong>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-label">Paper Trading & Lệnh</div>
          <div className="admin-kpi-value">{data.total_portfolios.toLocaleString()}</div>
          <div className="admin-kpi-sub">
            Khớp lệnh: <strong>{data.total_trades}</strong> | Vốn ảo:{" "}
            <strong>{formatCurrency(data.total_starting_cash_vnd)}</strong>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-label">Khuyến nghị Theses</div>
          <div className="admin-kpi-value">{data.total_theses.toLocaleString()}</div>
          <div className="admin-kpi-sub">
            Đang theo dõi: <strong>{data.active_theses}</strong> | Tỷ lệ thắng:{" "}
            <strong>{data.theses_win_rate}%</strong>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-label">Tin tức thị trường</div>
          <div className="admin-kpi-value">{data.total_news_articles.toLocaleString()}</div>
          <div className="admin-kpi-sub">
            Nguồn crawl: <strong>{data.active_news_sources}/{data.total_news_sources}</strong> đang hoạt động
          </div>
        </div>
      </div>

      {/* CHARTS GRID */}
      <div className="admin-charts-grid">
        {/* CHART 1: Activity timeline */}
        <div className="admin-chart-box col-8">
          <div className="admin-chart-header">
            <div>
              <h2 className="admin-chart-title">Hoạt động hệ thống 7 ngày qua</h2>
              <p className="admin-chart-desc">Số lượng tài khoản mới đăng ký và số lượt đặt lệnh mô phỏng</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className={`admin-btn-detail ${chartMetric === "both" ? "admin-btn-primary" : ""}`}
                style={chartMetric === "both" ? { background: "#2563eb", color: "#fff" } : {}}
                onClick={() => setChartMetric("both")}
              >
                Tất cả
              </button>
              <button
                type="button"
                className={`admin-btn-detail ${chartMetric === "users" ? "admin-btn-primary" : ""}`}
                style={chartMetric === "users" ? { background: "#2563eb", color: "#fff" } : {}}
                onClick={() => setChartMetric("users")}
              >
                Người dùng
              </button>
              <button
                type="button"
                className={`admin-btn-detail ${chartMetric === "trades" ? "admin-btn-primary" : ""}`}
                style={chartMetric === "trades" ? { background: "#2563eb", color: "#fff" } : {}}
                onClick={() => setChartMetric("trades")}
              >
                Lệnh giao dịch
              </button>
            </div>
          </div>

          <div style={{ width: "100%", overflowX: "auto" }}>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: "100%", height: "auto" }}>
              <defs>
                <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="#e2e8f0" />
              <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} stroke="#f1f5f9" strokeDasharray="4 4" />
              <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="#f1f5f9" strokeDasharray="4 4" />

              {/* User Area and Line */}
              {(chartMetric === "both" || chartMetric === "users") && (
                <>
                  <path d={userAreaD} fill="url(#userGrad)" />
                  <path d={userPathD} fill="none" stroke="#2563eb" strokeWidth="2.5" />
                  {pointsUsers.map((p, i) => (
                    <circle key={`u-${i}`} cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                  ))}
                </>
              )}

              {/* Trade Line */}
              {(chartMetric === "both" || chartMetric === "trades") && (
                <>
                  <path d={tradePathD} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeDasharray="4 4" />
                  {pointsTrades.map((p, i) => (
                    <circle key={`t-${i}`} cx={p.x} cy={p.y} r="3.5" fill="#ffffff" stroke="#16a34a" strokeWidth="2" />
                  ))}
                </>
              )}

              {/* Dates labels */}
              {pointsUsers.map((p, i) => (
                <text
                  key={`lbl-${i}`}
                  x={p.x}
                  y={chartHeight - 6}
                  fontSize="11"
                  textAnchor="middle"
                  fill="#64748b"
                >
                  {p.date.slice(5)}
                </text>
              ))}
            </svg>
          </div>

          <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: "12px", height: "3px", background: "#2563eb" }} />
              <span>Người dùng mới đăng ký</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: "12px", height: "3px", background: "#16a34a" }} />
              <span>Lệnh giao dịch mô phỏng</span>
            </div>
          </div>
        </div>

        {/* CHART 2: Stance distribution donut */}
        <div className="admin-chart-box col-4">
          <div className="admin-chart-header">
            <div>
              <h2 className="admin-chart-title">Vị thế Theses</h2>
              <p className="admin-chart-desc">Tỷ lệ quan điểm thị trường</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", height: "170px" }}>
            <svg viewBox="0 0 100 100" style={{ width: "150px", height: "150px", transform: "rotate(-90deg)" }}>
              {/* Bullish segment */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#2563eb"
                strokeWidth="14"
                strokeDasharray={`${bullishLength} ${circumference}`}
                strokeDashoffset={bullishOffset}
              />
              {/* Bearish segment */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#eab308"
                strokeWidth="14"
                strokeDasharray={`${bearishLength} ${circumference}`}
                strokeDashoffset={bearishOffset}
              />
              {/* Neutral segment */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#94a3b8"
                strokeWidth="14"
                strokeDasharray={`${neutralLength} ${circumference}`}
                strokeDashoffset={neutralOffset}
              />
            </svg>
            <div style={{ position: "absolute", textAlign: "center" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>{data.total_theses}</div>
              <div style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Bài viết</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem", fontSize: "0.8rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2563eb" }} />
              <span>Bullish ({bullishPct}%)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#eab308" }} />
              <span>Bearish ({bearishPct}%)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#94a3b8" }} />
              <span>Neutral ({neutralPct}%)</span>
            </div>
          </div>
        </div>

        {/* CHART 3: Top traded symbols in paper trading */}
        <div className="admin-chart-box col-6">
          <div className="admin-chart-header">
            <div>
              <h2 className="admin-chart-title">Top cổ phiếu giao dịch ảo nhiều nhất</h2>
              <p className="admin-chart-desc">Theo số lượng lệnh và giá trị giao dịch</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {data.top_traded_symbols && data.top_traded_symbols.length > 0 ? (
              data.top_traded_symbols.map((item, idx) => {
                const maxTrades = data.top_traded_symbols[0]?.trades_count || 1;
                const widthPct = Math.round((item.trades_count / maxTrades) * 100);

                return (
                  <div key={item.symbol} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>
                        #{idx + 1} {item.symbol}
                      </span>
                      <span style={{ color: "#64748b" }}>
                        {item.trades_count} lệnh ({formatCurrency(item.total_volume_vnd)})
                      </span>
                    </div>
                    <div style={{ height: "6px", width: "100%", background: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${widthPct}%`, background: "#2563eb", borderRadius: "9999px" }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Chưa có lệnh giao dịch mô phỏng nào được ghi nhận.</p>
            )}
          </div>
        </div>

        {/* CHART 4: News crawler sources stats & sentiment */}
        <div className="admin-chart-box col-6">
          <div className="admin-chart-header">
            <div>
              <h2 className="admin-chart-title">Nguồn tin tức & Tâm lý bài báo</h2>
              <p className="admin-chart-desc">Thống kê phân bổ nguồn crawl và phân tích tâm lý</p>
            </div>
          </div>

          {/* Sentiment bar */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.35rem" }}>
              <span style={{ color: "#166534" }}>Tích cực: {posPct}%</span>
              <span style={{ color: "#475569" }}>Trung lập: {neuPct}%</span>
              <span style={{ color: "#991b1b" }}>Tiêu cực: {negPct}%</span>
            </div>
            <div style={{ display: "flex", height: "8px", borderRadius: "9999px", overflow: "hidden" }}>
              <div style={{ width: `${posPct}%`, background: "#22c55e" }} />
              <div style={{ width: `${neuPct}%`, background: "#cbd5e1" }} />
              <div style={{ width: `${negPct}%`, background: "#ef4444" }} />
            </div>
          </div>

          {/* Source breakdown list */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {data.news_sources_stats.map((src) => (
              <div
                key={src.source_slug}
                style={{
                  padding: "0.6rem 0.85rem",
                  background: "#f8fafc",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0f172a" }}>{src.name}</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{src.article_count} bài báo</div>
                </div>
                <span className={`admin-badge ${src.status === "active" ? "active" : "neutral"}`}>
                  {src.status === "active" ? "Hoạt động" : "Tạm dừng"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RECENT AUDIT ACTIVITY TABLE (UNIFIED TABLE FORMAT) */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Nhật ký hoạt động hệ thống gần nhất</h2>
          <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Ghi nhận tự động từ cơ sở dữ liệu</span>
        </div>

        <div className="admin-table-container">
          <table className="admin-table-unified">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Tài khoản thực hiện</th>
                <th>Thao tác</th>
                <th>Đối tượng</th>
                <th>Kết quả</th>
                <th style={{ textAlign: "right" }}>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_audits && data.recent_audits.length > 0 ? (
                data.recent_audits.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.occurred_at).toLocaleString("vi-VN")}</td>
                    <td>{item.actor_email ?? "Hệ thống"}</td>
                    <td>
                      <code>{item.event_type}</code>
                    </td>
                    <td>{item.target ?? "-"}</td>
                    <td>
                      <span className={`admin-badge ${item.outcome === "succeeded" ? "active" : "disabled"}`}>
                        {item.outcome === "succeeded" ? "Thành công" : "Từ chối"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="admin-btn-detail"
                        onClick={() => setSelectedAudit(item)}
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
                    Chưa có nhật ký hoạt động nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL FOR AUDIT LOG */}
      {selectedAudit && (
        <AdminDetailModal
          isOpen={Boolean(selectedAudit)}
          onClose={() => setSelectedAudit(null)}
          title="Chi tiết sự kiện kiểm toán"
        >
          <div className="admin-detail-grid">
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mã sự kiện</span>
              <span className="admin-detail-val"><code>{selectedAudit.id}</code></span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Thời gian</span>
              <span className="admin-detail-val">{new Date(selectedAudit.occurred_at).toLocaleString("vi-VN")}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Tài khoản</span>
              <span className="admin-detail-val">{selectedAudit.actor_email ?? "Hệ thống (System)"}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Hành động</span>
              <span className="admin-detail-val"><code>{selectedAudit.event_type}</code></span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Đối tượng</span>
              <span className="admin-detail-val">{selectedAudit.target ?? "N/A"}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Kết quả</span>
              <span className="admin-detail-val">
                <span className={`admin-badge ${selectedAudit.outcome === "succeeded" ? "active" : "disabled"}`}>
                  {selectedAudit.outcome === "succeeded" ? "Thành công" : "Bị từ chối"}
                </span>
              </span>
            </div>
          </div>
        </AdminDetailModal>
      )}
    </div>
  );
}

