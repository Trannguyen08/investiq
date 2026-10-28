"use client";

import { useState } from "react";
import type { AdminAlertItem } from "@/lib/server/admin-ops-api";
import { AdminDetailModal } from "@/components/admin/admin-detail-modal";
import { IconView, IconCheck, IconX } from "@/components/admin/admin-icons";
import { changeAlertStatusAction } from "@/app/(admin)/admin/actions";

export function AlertsTable({ alerts }: { alerts: AdminAlertItem[] }) {
  const [selectedAlert, setSelectedAlert] = useState<AdminAlertItem | null>(null);

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div>
          <h2 className="admin-card-title">Trung tâm Quản trị Rủi ro & Sự cố</h2>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Tự động phát hiện giao dịch khối lượng lớn, sự cố pipeline và sự kiện truy cập bất thường
          </span>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table-unified">
          <thead>
            <tr>
              <th style={{ width: "110px" }}>Mức độ</th>
              <th>Phân loại</th>
              <th>Nội dung cảnh báo</th>
              <th>Đối tượng liên quan</th>
              <th>Thời gian</th>
              <th style={{ textAlign: "center" }}>Trạng thái</th>
              <th style={{ textAlign: "right", width: "100px" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length ? (
              alerts.map((item) => {
                const sevBadge =
                  item.severity === "high" ? (
                    <span
                      className="admin-badge disabled"
                      style={{ fontWeight: 700, backgroundColor: "#fee2e2", color: "#b91c1c" }}
                    >
                      Nghiêm trọng
                    </span>
                  ) : item.severity === "medium" ? (
                    <span
                      className="admin-badge pending"
                      style={{ fontWeight: 700, backgroundColor: "#fef3c7", color: "#b45309" }}
                    >
                      Trung bình
                    </span>
                  ) : (
                    <span
                      className="admin-badge active"
                      style={{ backgroundColor: "#f1f5f9", color: "#475569" }}
                    >
                      Thấp
                    </span>
                  );

                const statusBadge =
                  item.status === "active" ? (
                    <span className="admin-badge pending">Chờ xử lý</span>
                  ) : item.status === "resolved" ? (
                    <span className="admin-badge active">Đã xử lý</span>
                  ) : (
                    <span className="admin-badge" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>
                      Đã bỏ qua
                    </span>
                  );

                const categoryLabel =
                  item.category === "whale_trade"
                    ? "Lệnh lớn (Whale)"
                    : item.category === "crawler_failure"
                    ? "Sự cố Crawler"
                    : item.category === "security_anomaly"
                    ? "An ninh truy cập"
                    : item.category === "thesis_flag"
                    ? "Báo cáo nội dung"
                    : "Biến động thị trường";

                return (
                  <tr key={item.id}>
                    <td>{sevBadge}</td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          color: "#1e3a8a",
                        }}
                      >
                        {categoryLabel}
                      </span>
                    </td>
                    <td>
                      <div>
                        <strong style={{ fontSize: "0.88rem", color: "#1e293b", display: "block" }}>
                          {item.title}
                        </strong>
                        <span style={{ fontSize: "0.8rem", color: "#64748b", lineHeight: 1.4 }}>
                          {item.description}
                        </span>
                      </div>
                    </td>
                    <td>
                      <code
                        style={{
                          fontSize: "0.78rem",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          padding: "0.15rem 0.4rem",
                          borderRadius: "4px",
                          color: "#334155",
                        }}
                      >
                        {item.entity_type}:{item.entity_id.slice(0, 8)}
                      </code>
                    </td>
                    <td>
                      <time
                        style={{ fontSize: "0.8rem", color: "#64748b", whiteSpace: "nowrap" }}
                        title={item.occurred_at}
                      >
                        {item.occurred_at ? item.occurred_at.slice(0, 16).replace("T", " ") : "—"}
                      </time>
                    </td>
                    <td style={{ textAlign: "center" }}>{statusBadge}</td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          justifyContent: "flex-end",
                        }}
                      >
                        {/* VIEW DETAIL */}
                        <button
                          type="button"
                          className="admin-icon-btn view"
                          title="Xem chi tiết cảnh báo"
                          aria-label={`Xem chi tiết cảnh báo ${item.id}`}
                          onClick={() => setSelectedAlert(item)}
                        >
                          <IconView width={15} height={15} />
                        </button>

                        {/* RESOLVE BUTTON */}
                        {item.status === "active" && (
                          <>
                            <form action={changeAlertStatusAction} style={{ display: "inline" }}>
                              <input type="hidden" name="alert_id" value={item.id} />
                              <input type="hidden" name="status" value="resolved" />
                              <input
                                type="hidden"
                                name="note"
                                value="Xác nhận đã kiểm tra và xử lý an toàn."
                              />
                              <button
                                type="submit"
                                className="admin-icon-btn edit"
                                title="Đánh dấu đã giải quyết"
                                aria-label={`Giải quyết ${item.id}`}
                              >
                                <IconCheck width={15} height={15} />
                              </button>
                            </form>

                            {/* DISMISS BUTTON */}
                            <form action={changeAlertStatusAction} style={{ display: "inline" }}>
                              <input type="hidden" name="alert_id" value={item.id} />
                              <input type="hidden" name="status" value="dismissed" />
                              <button
                                type="submit"
                                className="admin-icon-btn delete"
                                title="Bỏ qua cảnh báo này"
                                aria-label={`Bỏ qua ${item.id}`}
                              >
                                <IconX width={15} height={15} />
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#94a3b8" }}>
                  Hệ thống không ghi nhận cảnh báo rủi ro nào. Trạng thái an toàn.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DETAIL MODAL */}
      {selectedAlert && (
        <AdminDetailModal
          title={`Chi tiết Cảnh báo: ${selectedAlert.title}`}
          isOpen={true}
          onClose={() => setSelectedAlert(null)}
        >
          <div className="admin-detail-grid">
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mã cảnh báo (ID)</span>
              <span className="admin-detail-val">
                <code>{selectedAlert.id}</code>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Tiêu đề</span>
              <span className="admin-detail-val">
                <strong>{selectedAlert.title}</strong>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Phân loại nghiệp vụ</span>
              <span className="admin-detail-val">{selectedAlert.category}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mức độ rủi ro</span>
              <span className="admin-detail-val">
                <strong>{selectedAlert.severity.toUpperCase()}</strong>
              </span>
            </div>
            <div className="admin-detail-item" style={{ gridColumn: "1 / -1" }}>
              <span className="admin-detail-label">Mô tả chi tiết</span>
              <span className="admin-detail-val">{selectedAlert.description}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Đối tượng liên quan</span>
              <span className="admin-detail-val">
                {selectedAlert.entity_type} (<code>{selectedAlert.entity_id}</code>)
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Thời gian phát sinh</span>
              <span className="admin-detail-val">{selectedAlert.occurred_at}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Trạng thái</span>
              <span className="admin-detail-val">{selectedAlert.status}</span>
            </div>
            <div className="admin-detail-item" style={{ gridColumn: "1 / -1" }}>
              <span className="admin-detail-label">Hành động khuyến nghị</span>
              <span className="admin-detail-val" style={{ color: "#2563eb", fontWeight: 600 }}>
                {selectedAlert.action_suggested}
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Thời gian giải quyết</span>
              <span className="admin-detail-val">{selectedAlert.resolved_at ?? "Chưa xử lý"}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Người xử lý</span>
              <span className="admin-detail-val">{selectedAlert.resolved_by ?? "—"}</span>
            </div>
          </div>
        </AdminDetailModal>
      )}
    </div>
  );
}
