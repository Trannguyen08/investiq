"use client";

import { useState } from "react";
import type { AdminThesisItem } from "@/lib/server/admin-ops-api";
import { AdminDetailModal } from "@/components/admin/admin-detail-modal";
import { changeThesisStatus, removeThesisAction } from "@/app/(admin)/admin/actions";
import { IconView, IconTrash, IconCheck } from "@/components/admin/admin-icons";

export function ThesesTable({ theses }: { theses: AdminThesisItem[] }) {
  const [selectedThesis, setSelectedThesis] = useState<AdminThesisItem | null>(null);

  const statusLabels: Record<string, string> = {
    active: "Đang theo dõi",
    hit_target: "Chạm mục tiêu",
    stopped_out: "Cắt lỗ",
    expired: "Hết hạn",
  };

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div>
          <h2 className="admin-card-title">Danh sách bài phân tích & khuyến nghị</h2>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Kiểm duyệt nội dung, quản lý rủi ro và xác thực tỷ lệ thành công của khuyến nghị
          </span>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table-unified">
          <thead>
            <tr>
              <th>Mã CP</th>
              <th>Tiêu đề & Tác giả</th>
              <th>Vị thế</th>
              <th>Giá vào</th>
              <th>Mục tiêu</th>
              <th>Cắt lỗ</th>
              <th>Trạng thái</th>
              <th>Ngày đăng</th>
              <th style={{ textAlign: "right", width: "80px" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {theses.length ? (
              theses.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong style={{ fontSize: "0.95rem", color: "#2563eb" }}>
                      {item.symbol}
                    </strong>
                  </td>
                  <td>
                    <div>
                      <div style={{ fontWeight: 700, color: "#0f172a", maxWidth: "280px", whiteSpace: "normal" }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Bởi {item.author_name} {item.author_email ? `(${item.author_email})` : ""}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`admin-badge ${item.stance}`}>
                      {item.stance === "bullish"
                        ? "Tăng (Bullish)"
                        : item.stance === "bearish"
                        ? "Giảm (Bearish)"
                        : "Trung lập"}
                    </span>
                  </td>
                  <td>{item.entry_price.toLocaleString("vi-VN")} ₫</td>
                  <td>
                    <span style={{ color: "#16a34a", fontWeight: 600 }}>
                      {item.target_price.toLocaleString("vi-VN")} ₫
                    </span>
                  </td>
                  <td>
                    <span style={{ color: "#dc2626", fontWeight: 600 }}>
                      {item.stop_loss_price.toLocaleString("vi-VN")} ₫
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${item.status}`}>
                      {statusLabels[item.status] ?? item.status}
                    </span>
                  </td>
                  <td>
                    {new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "Asia/Ho_Chi_Minh",
                    }).format(new Date(item.created_at))}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                      <button
                        type="button"
                        className="admin-icon-btn primary"
                        title="Xem chi tiết & Kiểm duyệt"
                        aria-label="Xem chi tiết"
                        onClick={() => setSelectedThesis(item)}
                      >
                        <IconView width={15} height={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={9}
                  style={{ textAlign: "center", color: "#64748b", padding: "2.5rem" }}
                >
                  Không tìm thấy bài phân tích nào phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DETAIL MODAL */}
      {selectedThesis && (
        <AdminDetailModal
          isOpen={Boolean(selectedThesis)}
          onClose={() => setSelectedThesis(null)}
          title={`Chi tiết khuyến nghị: ${selectedThesis.symbol} - ${selectedThesis.title}`}
          isLarge
          footerActions={
            <form
              action={removeThesisAction}
              onSubmit={(e) => {
                if (!window.confirm("Bạn có chắc chắn muốn xóa khuyến nghị này khỏi hệ thống?")) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="thesis_id" value={selectedThesis.id} />
              <button
                type="submit"
                className="admin-btn-danger"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              >
                <IconTrash width={14} height={14} />
                <span>Xóa bài phân tích</span>
              </button>
            </form>
          }
        >
          <div className="admin-detail-grid">
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mã khuyến nghị</span>
              <span className="admin-detail-val">
                <code>{selectedThesis.id}</code>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Tác giả</span>
              <span className="admin-detail-val">
                {selectedThesis.author_name} ({selectedThesis.author_email ?? "Ẩn danh"})
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Cổ phiếu & Vị thế</span>
              <span className="admin-detail-val">
                <strong>{selectedThesis.symbol}</strong> -{" "}
                <span className={`admin-badge ${selectedThesis.stance}`}>
                  {selectedThesis.stance.toUpperCase()}
                </span>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Thời hạn nắm giữ</span>
              <span className="admin-detail-val">{selectedThesis.horizon_months} tháng</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Giá vào lệnh (Entry Price)</span>
              <span className="admin-detail-val">
                <strong>{selectedThesis.entry_price.toLocaleString("vi-VN")} ₫</strong>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Giá mục tiêu (Target) / Cắt lỗ (Stop Loss)</span>
              <span className="admin-detail-val">
                <span style={{ color: "#16a34a", fontWeight: 700 }}>
                  {selectedThesis.target_price.toLocaleString("vi-VN")} ₫
                </span>{" "}
                /{" "}
                <span style={{ color: "#dc2626", fontWeight: 700 }}>
                  {selectedThesis.stop_loss_price.toLocaleString("vi-VN")} ₫
                </span>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Trạng thái hiện tại</span>
              <span className="admin-detail-val">
                <span className={`admin-badge ${selectedThesis.status}`}>
                  {statusLabels[selectedThesis.status] ?? selectedThesis.status}
                </span>
                {selectedThesis.outcome_roi !== null && (
                  <span style={{ marginLeft: "0.5rem", fontWeight: 700, color: selectedThesis.outcome_roi >= 0 ? "#16a34a" : "#dc2626" }}>
                    (ROI: {selectedThesis.outcome_roi > 0 ? `+${selectedThesis.outcome_roi}%` : `${selectedThesis.outcome_roi}%`})
                  </span>
                )}
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Lượt bình chọn (Upvotes)</span>
              <span className="admin-detail-val">{selectedThesis.upvotes}</span>
            </div>
            <div className="admin-detail-item col-span-2">
              <span className="admin-detail-label">Yếu tố xúc tác (Catalysts)</span>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                {selectedThesis.catalysts && selectedThesis.catalysts.length > 0 ? (
                  selectedThesis.catalysts.map((cat, i) => (
                    <span key={i} className="admin-badge user" style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                      {cat}
                    </span>
                  ))
                ) : (
                  <span style={{ color: "#94a3b8", fontSize: "0.82rem" }}>Không có yếu tố xúc tác ghi nhận.</span>
                )}
              </div>
            </div>
            <div className="admin-detail-item col-span-2">
              <span className="admin-detail-label">Nội dung luận điểm phân tích</span>
              <div
                style={{
                  background: "#f8fafc",
                  padding: "1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  whiteSpace: "pre-wrap",
                  lineHeight: "1.6",
                  fontSize: "0.85rem",
                  color: "#1e293b",
                  maxHeight: "220px",
                  overflowY: "auto",
                }}
              >
                {selectedThesis.thesis_body}
              </div>
            </div>
            <div className="admin-detail-item col-span-2" style={{ borderTop: "1px solid #f1f5f9", paddingTop: "1rem" }}>
              <span className="admin-detail-label">Cập nhật trạng thái kiểm duyệt</span>
              <form action={changeThesisStatus} style={{ display: "flex", gap: "0.6rem", marginTop: "0.5rem", alignItems: "center" }}>
                <input type="hidden" name="thesis_id" value={selectedThesis.id} />
                <select name="status" defaultValue={selectedThesis.status} className="admin-filter-select">
                  <option value="active">Đang theo dõi (Active)</option>
                  <option value="hit_target">Chạm mục tiêu (Hit Target)</option>
                  <option value="stopped_out">Cắt lỗ (Stopped Out)</option>
                  <option value="expired">Hết hạn (Expired)</option>
                </select>
                <input
                  type="text"
                  name="note"
                  placeholder="Ghi chú kiểm duyệt của admin..."
                  className="admin-filter-input"
                  style={{ flex: 1 }}
                />
                <button type="submit" className="admin-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                  <IconCheck width={14} height={14} />
                  <span>Cập nhật</span>
                </button>
              </form>
            </div>
          </div>
        </AdminDetailModal>
      )}
    </div>
  );
}
