"use client";

import { useState, type FormEvent } from "react";
import type { AdminUser } from "@/lib/server/admin-user-api";
import { AdminDetailModal } from "@/components/admin/admin-detail-modal";

type FormAction = (formData: FormData) => Promise<void>;

export function UsersTable({
  users,
  changeUser,
}: {
  users: AdminUser[];
  changeUser: FormAction;
}) {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  function confirmUpdate(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const data = new FormData(form);
    const role = String(data.get("role") ?? "");
    const status = String(data.get("status") ?? "");
    const actions = [
      role && `vai trò ${role === "admin" ? "quản trị viên" : "người dùng"}`,
      status && `trạng thái ${status === "disabled" ? "đã khóa" : "hoạt động"}`,
    ].filter(Boolean);
    if (!actions.length) {
      event.preventDefault();
      return;
    }
    if (!window.confirm(`Xác nhận đổi ${actions.join(" và ")} cho tài khoản này?`)) {
      event.preventDefault();
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2 className="admin-card-title">Danh sách tài khoản người dùng</h2>
        <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
          Khóa tài khoản sẽ lập tức thu hồi toàn bộ phiên đăng nhập
        </span>
      </div>

      <div className="admin-table-container">
        <table className="admin-table-unified">
          <thead>
            <tr>
              <th>Họ tên & Email</th>
              <th>Phương thức</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Xác minh</th>
              <th>Ngày tạo</th>
              <th>Cập nhật quyền</th>
              <th style={{ textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.length ? (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div>
                      <strong style={{ display: "block", color: "#0f172a" }}>
                        {user.display_name}
                      </strong>
                      <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                        {user.email}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="admin-badge user">
                      {user.provider === "google" ? "Google" : "Email"}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${user.role}`}>
                      {user.role === "admin" ? "Quản trị viên" : "Người dùng"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${
                        user.status === "active" ? "active" : "disabled"
                      }`}
                    >
                      {user.status === "active" ? "Hoạt động" : "Đã khóa"}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        color: user.email_verified_at ? "#15803d" : "#94a3b8",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                      }}
                    >
                      {user.email_verified_at ? "Đã xác minh" : "Chưa xác minh"}
                    </span>
                  </td>
                  <td>
                    {user.created_at
                      ? new Intl.DateTimeFormat("vi-VN", {
                          dateStyle: "medium",
                          timeZone: "Asia/Ho_Chi_Minh",
                        }).format(new Date(user.created_at))
                      : "—"}
                  </td>
                  <td>
                    <form
                      action={changeUser}
                      onSubmit={confirmUpdate}
                      style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}
                    >
                      <input type="hidden" name="user_id" value={user.id} />
                      <select
                        name="role"
                        defaultValue=""
                        className="admin-filter-select"
                        style={{ height: "30px", fontSize: "0.75rem", padding: "0 0.5rem" }}
                        aria-label={`Vai trò mới của ${user.email}`}
                      >
                        <option value="">Giữ vai trò</option>
                        <option value="user">Người dùng</option>
                        <option value="admin">Quản trị viên</option>
                      </select>
                      <select
                        name="status"
                        defaultValue=""
                        className="admin-filter-select"
                        style={{ height: "30px", fontSize: "0.75rem", padding: "0 0.5rem" }}
                        aria-label={`Trạng thái mới của ${user.email}`}
                      >
                        <option value="">Giữ trạng thái</option>
                        <option value="active">Hoạt động</option>
                        <option value="disabled">Khóa tài khoản</option>
                      </select>
                      <button
                        type="submit"
                        className="admin-btn-detail"
                        style={{ padding: "0.2rem 0.6rem" }}
                      >
                        Lưu
                      </button>
                    </form>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="admin-btn-detail"
                      onClick={() => setSelectedUser(user)}
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  style={{ textAlign: "center", color: "#64748b", padding: "2.5rem" }}
                >
                  Không tìm thấy tài khoản người dùng nào phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DETAIL MODAL FOR USER */}
      {selectedUser && (
        <AdminDetailModal
          isOpen={Boolean(selectedUser)}
          onClose={() => setSelectedUser(null)}
          title={`Chi tiết tài khoản: ${selectedUser.display_name}`}
        >
          <div className="admin-detail-grid">
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mã tài khoản (User ID)</span>
              <span className="admin-detail-val">
                <code>{selectedUser.id}</code>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Email</span>
              <span className="admin-detail-val">{selectedUser.email}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Tên hiển thị</span>
              <span className="admin-detail-val">{selectedUser.display_name}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Phương thức đăng nhập</span>
              <span className="admin-detail-val">
                <span className="admin-badge user">
                  {selectedUser.provider === "google" ? "Google OAuth" : "Mật khẩu (Email/Password)"}
                </span>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Vai trò hiện tại</span>
              <span className="admin-detail-val">
                <span className={`admin-badge ${selectedUser.role}`}>
                  {selectedUser.role === "admin" ? "Quản trị viên (Admin)" : "Người dùng (User)"}
                </span>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Trạng thái tài khoản</span>
              <span className="admin-detail-val">
                <span
                  className={`admin-badge ${
                    selectedUser.status === "active" ? "active" : "disabled"
                  }`}
                >
                  {selectedUser.status === "active" ? "Đang hoạt động" : "Đã bị vô hiệu hóa"}
                </span>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Xác minh Email</span>
              <span className="admin-detail-val">
                {selectedUser.email_verified_at
                  ? `Đã xác thực lúc ${new Date(selectedUser.email_verified_at).toLocaleString("vi-VN")}`
                  : "Chưa xác thực OTP"}
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Ngày tham gia hệ thống</span>
              <span className="admin-detail-val">
                {new Date(selectedUser.created_at).toLocaleString("vi-VN")}
              </span>
            </div>
          </div>
        </AdminDetailModal>
      )}
    </div>
  );
}
