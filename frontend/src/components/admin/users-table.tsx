"use client";

import type { FormEvent } from "react";

import type { AdminUser } from "@/lib/server/admin-user-api";

type FormAction = (formData: FormData) => Promise<void>;

export function UsersTable({ users, changeUser }: { users: AdminUser[]; changeUser: FormAction }) {
  function confirmUpdate(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const data = new FormData(form);
    const role = String(data.get("role") ?? "");
    const status = String(data.get("status") ?? "");
    const actions = [role && `vai trò ${role === "admin" ? "quản trị viên" : "người dùng"}`, status && `trạng thái ${status === "disabled" ? "đã khóa" : "hoạt động"}`].filter(Boolean);
    if (!actions.length) {
      event.preventDefault();
      return;
    }
    if (!window.confirm(`Xác nhận đổi ${actions.join(" và ")} cho tài khoản này?`)) event.preventDefault();
  }

  return (
    <section className="admin-section" aria-labelledby="users-heading">
      <div className="section-heading"><div><p className="eyebrow">Users</p><h2 id="users-heading">Danh sách tài khoản</h2></div></div>
      <div className="admin-table-wrap">
        <table className="admin-table users-table">
          <thead><tr><th>Tài khoản</th><th>Phương thức</th><th>Vai trò</th><th>Trạng thái</th><th>Xác minh</th><th>Ngày tạo</th><th>Cập nhật</th></tr></thead>
          <tbody>
            {users.length ? users.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.display_name}</strong><span className="user-email">{user.email}</span></td>
                <td>{user.provider === "google" ? "Google" : "Email"}</td>
                <td><span className={`admin-status ${user.role}`}>{user.role === "admin" ? "Quản trị" : "Người dùng"}</span></td>
                <td><span className={`admin-status ${user.status}`}>{user.status === "active" ? "Hoạt động" : "Đã khóa"}</span></td>
                <td>{user.email_verified_at ? "Đã xác minh" : "Chưa xác minh"}</td>
                <td>{user.created_at ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(user.created_at)) : "—"}</td>
                <td>
                  <form action={changeUser} onSubmit={confirmUpdate} className="user-update-form">
                    <input type="hidden" name="user_id" value={user.id} />
                    <label className="visually-hidden" htmlFor={`role-${user.id}`}>Vai trò mới của {user.email}</label>
                    <select id={`role-${user.id}`} name="role" defaultValue=""><option value="">Giữ vai trò</option><option value="user">Người dùng</option><option value="admin">Quản trị viên</option></select>
                    <label className="visually-hidden" htmlFor={`status-${user.id}`}>Trạng thái mới của {user.email}</label>
                    <select id={`status-${user.id}`} name="status" defaultValue=""><option value="">Giữ trạng thái</option><option value="active">Hoạt động</option><option value="disabled">Khóa tài khoản</option></select>
                    <button className="secondary-button" type="submit">Lưu</button>
                  </form>
                </td>
              </tr>
            )) : <tr><td colSpan={7} className="table-empty">Không tìm thấy tài khoản phù hợp.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="admin-footnote">Khóa tài khoản sẽ thu hồi toàn bộ phiên đăng nhập đang hoạt động.</p>
    </section>
  );
}
