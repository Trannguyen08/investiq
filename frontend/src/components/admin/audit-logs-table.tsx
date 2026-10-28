"use client";

import { useState } from "react";
import type { AdminAuditLogItem } from "@/lib/server/admin-ops-api";
import { AdminDetailModal } from "@/components/admin/admin-detail-modal";

export function AuditLogsTable({ logs }: { logs: AdminAuditLogItem[] }) {
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogItem | null>(null);

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2 className="admin-card-title">Nhật ký kiểm toán an ninh hệ thống (Audit Logs)</h2>
        <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
          Lưu vết bảo mật các hành vi quản trị, đăng nhập và phân quyền
        </span>
      </div>

      <div className="admin-table-container">
        <table className="admin-table-unified">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Loại sự kiện</th>
              <th>Người thực hiện</th>
              <th>Đối tượng tác động</th>
              <th>Kết quả</th>
              <th>Mã Request</th>
              <th style={{ textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {logs.length ? (
              logs.map((item) => (
                <tr key={item.id}>
                  <td>
                    {new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "short",
                      timeStyle: "medium",
                      timeZone: "Asia/Ho_Chi_Minh",
                    }).format(new Date(item.occurred_at))}
                  </td>
                  <td>
                    <code style={{ fontSize: "0.8rem", color: "#0f172a" }}>
                      {item.event_type}
                    </code>
                  </td>
                  <td>
                    {item.actor_email ? (
                      <div>
                        <strong style={{ color: "#0f172a" }}>{item.actor_email}</strong>
                        {item.actor_id && (
                          <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                            {item.actor_id.slice(0, 8)}...
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "#64748b" }}>Hệ thống (System)</span>
                    )}
                  </td>
                  <td>
                    <span style={{ color: "#334155" }}>{item.target ?? "—"}</span>
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${
                        item.outcome === "succeeded" ? "active" : "disabled"
                      }`}
                    >
                      {item.outcome === "succeeded" ? "Thành công" : "Từ chối / Lỗi"}
                    </span>
                  </td>
                  <td>
                    <code style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {item.request_id ? item.request_id.slice(0, 12) : "—"}
                    </code>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="admin-btn-detail"
                      onClick={() => setSelectedLog(item)}
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  style={{ textAlign: "center", color: "#64748b", padding: "2.5rem" }}
                >
                  Không tìm thấy sự kiện kiểm toán nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DETAIL MODAL */}
      {selectedLog && (
        <AdminDetailModal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Chi tiết sự kiện: ${selectedLog.event_type}`}
          isLarge
        >
          <div className="admin-detail-grid" style={{ marginBottom: "1.5rem" }}>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mã bản ghi (Log ID)</span>
              <span className="admin-detail-val">
                <code>{selectedLog.id}</code>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Thời gian phát sinh</span>
              <span className="admin-detail-val">
                {new Date(selectedLog.occurred_at).toLocaleString("vi-VN")}
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Người thực hiện</span>
              <span className="admin-detail-val">
                {selectedLog.actor_email ? (
                  <span>
                    {selectedLog.actor_email} (<code>{selectedLog.actor_id}</code>)
                  </span>
                ) : (
                  "Hệ thống (Tự động)"
                )}
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Kết quả kiểm tra</span>
              <span className="admin-detail-val">
                <span
                  className={`admin-badge ${
                    selectedLog.outcome === "succeeded" ? "active" : "disabled"
                  }`}
                >
                  {selectedLog.outcome === "succeeded" ? "Thành công (Succeeded)" : "Bị chặn / Từ chối (Denied)"}
                </span>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Đối tượng tác động</span>
              <span className="admin-detail-val">{selectedLog.target ?? "N/A"}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mã yêu cầu (Request ID)</span>
              <span className="admin-detail-val">
                <code>{selectedLog.request_id ?? "unknown"}</code>
              </span>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.5rem", color: "#0f172a" }}>
              Dữ liệu chi tiết sự kiện (JSON Payload)
            </h3>
            <div className="admin-json-viewer">
              {JSON.stringify(selectedLog.details, null, 2)}
            </div>
          </div>
        </AdminDetailModal>
      )}
    </div>
  );
}

