"use client";

import { useTransition } from "react";
import type { AdminMarketPipelineStatus } from "@/lib/server/admin-ops-api";
import { clearMarketDataCacheAction, syncMarketDividendsAction } from "@/app/(admin)/admin/actions";
import { IconRefresh, IconZap, IconCheck } from "@/components/admin/admin-icons";

export function MarketDataPipelinePanel({
  pipeline,
}: {
  pipeline: AdminMarketPipelineStatus;
}) {
  const [isSyncing, startSyncTransition] = useTransition();
  const [isClearing, startClearTransition] = useTransition();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "2rem" }}>
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">Thu thập Dữ liệu Thị trường & Doanh nghiệp</h2>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Giám sát tình trạng hoạt động của Crawler Lịch Cổ tức, Báo cáo tài chính và điều phối bộ đệm dữ liệu.
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <form
              action={() => {
                startSyncTransition(async () => {
                  await syncMarketDividendsAction();
                });
              }}
            >
              <button
                type="submit"
                disabled={isSyncing}
                className="admin-btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              >
                <IconZap size={14} />
                {isSyncing ? "Đang đồng bộ..." : "Đồng bộ Lịch Cổ tức Ngay"}
              </button>
            </form>

            <form
              action={() => {
                startClearTransition(async () => {
                  await clearMarketDataCacheAction();
                });
              }}
            >
              <button
                type="submit"
                disabled={isClearing}
                className="admin-btn-secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              >
                <IconRefresh size={14} />
                {isClearing ? "Đang xóa..." : "Xóa Bộ đệm Cache"}
              </button>
            </form>
          </div>
        </div>

        {/* 2 Crawler Status Cards */}
        <div
          className="admin-kpi-grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", padding: "1.25rem" }}
        >
          {pipeline.crawlers.map((crawler) => (
            <div key={crawler.id} className="admin-kpi-card-v2 green">
              <div className="admin-kpi-header">
                <span className="admin-kpi-label">{crawler.name}</span>
                <span className="admin-kpi-trend up" style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                  <IconCheck size={12} />
                  Hoạt động
                </span>
              </div>
              <div className="admin-kpi-value" style={{ fontSize: "1.2rem", fontWeight: 600 }}>
                {crawler.source}
              </div>
              <div className="admin-kpi-sub" style={{ marginTop: "0.5rem", lineHeight: "1.5" }}>
                <div>• {crawler.detail}</div>
                <div>
                  • Bộ nhớ đệm: <b>{crawler.cache_entries}</b> mã (TTL {crawler.cache_ttl_seconds / 60} phút)
                </div>
                {crawler.last_synced_at && (
                  <div>
                    • Lần đồng bộ gần nhất:{" "}
                    <b>{new Date(crawler.last_synced_at).toLocaleTimeString("vi-VN")}</b>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Crawled Dividend Events Sample */}
        {pipeline.recent_events_sample && pipeline.recent_events_sample.length > 0 && (
          <div style={{ padding: "0 1.25rem 1.25rem 1.25rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#1e293b", marginBottom: "0.75rem" }}>
              Mẫu sự kiện cổ tức gần nhất thu thập từ CafeF / Vnstock
            </h3>
            <div className="admin-table-container">
              <table className="admin-table-unified">
                <thead>
                  <tr>
                    <th>Mã CP</th>
                    <th>Ngày GDKHQ</th>
                    <th>Hình thức chia</th>
                    <th>Tỷ lệ / Giá trị</th>
                    <th>Tiêu đề thông báo</th>
                    <th>Nguồn dữ liệu</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.recent_events_sample.map((evt, idx) => (
                    <tr key={evt.id || idx}>
                      <td>
                        <strong style={{ color: "#2563eb", fontFamily: "monospace" }}>
                          {evt.symbol}
                        </strong>
                      </td>
                      <td>{evt.ex_date || evt.event_date || "—"}</td>
                      <td>
                        <span
                          className={`admin-tag ${
                            evt.type === "cash"
                              ? "green"
                              : evt.type === "stock"
                              ? "blue"
                              : "amber"
                          }`}
                        >
                          {evt.type === "cash"
                            ? "Tiền mặt"
                            : evt.type === "stock"
                            ? "Cổ phiếu"
                            : "Thưởng/Quyền"}
                        </span>
                      </td>
                      <td>
                        <strong>
                          {evt.cash_value ? `${evt.cash_value.toLocaleString("vi-VN")} đ/cp` : evt.ratio || "—"}
                        </strong>
                      </td>
                      <td style={{ maxWidth: "320px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {evt.title}
                      </td>
                      <td>
                        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{evt.source || "CafeF"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
