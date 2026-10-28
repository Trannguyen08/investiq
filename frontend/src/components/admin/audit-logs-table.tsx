"use client";

import { useState } from "react";
import type { AdminAuditLogItem } from "@/lib/server/admin-ops-api";
import { AdminDetailModal } from "@/components/admin/admin-detail-modal";
import { IconView } from "@/components/admin/admin-icons";

export function AuditLogsTable({ logs }: { logs: AdminAuditLogItem[] }) {
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogItem | null>(null);

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div>
          <h2 className="admin-card-title">Nhật ký kiểm toán an ninh hệ thống (Audit Logs)</h2>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Lưu vết bảo mật bất biến các hành vi quản trị, đăng nhập và phân quyền
          </span>
        </div>
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
              <th style={{ textAlign: "right", width: "80px" }}>Thao tác</th>
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
                      {item.outcome === "succeeded" ? "Thành công" : "Từ chối"}
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
                      className="admin-icon-btn primary"
                      title="Xem chi tiết sự kiện kiểm toán"
                      aria-label="Xem chi tiết"
                      onClick={() => setSelectedLog(item)}
                    >
                      <IconView width={15} height={15} />
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
          title={`Chi tiết sự kiện kiểm toán: ${selectedLog.event_type}`}
        >
          <div className="admin-detail-grid">
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mã định danh sự kiện</span>
              <span className="admin-detail-val">
                <code>{selectedLog.id}</code>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Nguồn sự kiện</span>
              <span className="admin-detail-val">
                <span className="admin-badge admin">{selectedLog.source_type}</span>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Thời gian xảy ra</span>
              <span className="admin-detail-val">
                {new Date(selectedLog.occurred_at).toLocaleString("vi-VN")}
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Tài khoản thực hiện</span>
              <span className="admin-detail-val">
                {selectedLog.actor_email ?? selectedLog.actor_id ?? "Hệ thống"}
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Loại sự kiện (Event Type)</span>
              <span className="admin-detail-val">
                <code>{selectedLog.event_type}</code>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Đối tượng tác động</span>
              <span className="admin-detail-val">{selectedLog.target ?? "N/A"}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Kết quả xử lý</span>
              <span className="admin-detail-val">
                <span
                  className={`admin-badge ${
                    selectedLog.outcome === "succeeded" ? "active" : "disabled"
                  }`}
                >
                  {selectedLog.outcome === "succeeded" ? "Thành công" : "Bị chặn / Lỗi"}
                </span>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mã phiên truy vấn (Request ID)</span>
              <span className="admin-detail-val">
                <code>{selectedLog.request_id}</code>
              </span>
            </div>
            <div className="admin-detail-item col-span-2">
              <span className="admin-detail-label">Dữ liệu chi tiết đính kèm (JSON Payload)</span>
              <pre className="admin-json-viewer">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>
          </div>
        </AdminDetailModal>
      )}
    </div>
  );
}
