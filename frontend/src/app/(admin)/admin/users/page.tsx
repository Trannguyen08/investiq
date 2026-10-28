import Link from "next/link";

import { changeAdminUser } from "@/app/(admin)/admin/actions";
import { UsersTable } from "@/components/admin/users-table";
import { currentUser, UserAuthError } from "@/lib/server/user-auth";
import { getAdminUsers } from "@/lib/server/admin-user-api";

type SearchParams = Promise<{
  q?: string;
  role?: string;
  status?: string;
  provider?: string;
  cursor?: string;
  notice?: string;
  error?: string;
}>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  let account: Awaited<ReturnType<typeof currentUser>> | null = null;
  let authError: string | null = null;
  try {
    account = await currentUser();
  } catch (error) {
    authError =
      error instanceof UserAuthError
        ? "Hãy đăng nhập bằng tài khoản quản trị để tiếp tục."
        : "Không thể xác minh phiên quản trị.";
  }
  if (authError || !account) {
    return (
      <div>
        <p className="admin-alert error" role="alert">
          {authError ?? "Không thể xác minh phiên quản trị."}
        </p>
      </div>
    );
  }
  if (account.role !== "admin") {
    return (
      <div>
        <p className="admin-alert error" role="alert">
          Tài khoản hiện tại không có quyền quản lý người dùng.
        </p>
      </div>
    );
  }

  const role =
    params.role === "user" || params.role === "admin" ? params.role : "";
  const accountStatus =
    params.status === "active" || params.status === "disabled"
      ? params.status
      : "";
  const provider =
    params.provider === "password" || params.provider === "google"
      ? params.provider
      : "";
  const q = (params.q ?? "").slice(0, 120);
  const cursor =
    params.cursor && params.cursor.length <= 512 ? params.cursor : undefined;

  let result: Awaited<ReturnType<typeof getAdminUsers>> | null = null;
  let loadError: string | null = null;
  try {
    result = await getAdminUsers({
      q,
      role,
      status: accountStatus,
      provider,
      limit: 20,
      cursor,
    });
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Không thể tải danh sách tài khoản.";
  }

  if (loadError || !result) {
    return (
      <div>
        <div className="admin-view-header">
          <div>
            <h1>Quản lý tài khoản</h1>
            <p>Tìm kiếm, cập nhật vai trò và trạng thái truy cập của người dùng.</p>
          </div>
        </div>
        <p className="admin-alert error" role="alert">
          {loadError ?? "Không thể tải danh sách tài khoản."}
        </p>
      </div>
    );
  }

  const pages = Math.max(1, Math.ceil(result.total / result.limit));
  const previousUrl = pageUrl(params, result.previous_cursor);
  const nextUrl = pageUrl(params, result.next_cursor);

  return (
    <div>
      <div className="admin-view-header">
        <div>
          <h1>Quản lý người dùng</h1>
          <p>
            Tìm kiếm, phân quyền tài khoản và kiểm soát quyền truy cập hệ thống.
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <span className="admin-badge admin" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
            Tổng: {result.total} người dùng
          </span>
        </div>
      </div>

      {params.notice && (
        <p className="admin-alert success" role="status">
          {params.notice}
        </p>
      )}
      {params.error && (
        <p className="admin-alert error" role="alert">
          {params.error}
        </p>
      )}

      {/* FILTER BAR */}
      <form className="admin-filter-bar" action="/admin/users" method="get" style={{ borderRadius: "0.5rem", marginBottom: "1rem" }}>
        <input
          type="search"
          name="q"
          placeholder="Tìm theo email hoặc họ tên..."
          maxLength={120}
          defaultValue={q}
          className="admin-filter-input"
          style={{ minWidth: "240px", flex: 1 }}
        />
        <select name="role" defaultValue={role} className="admin-filter-select">
          <option value="">Tất cả vai trò</option>
          <option value="user">Người dùng</option>
          <option value="admin">Quản trị viên</option>
        </select>
        <select name="status" defaultValue={accountStatus} className="admin-filter-select">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="disabled">Đã khóa</option>
        </select>
        <select name="provider" defaultValue={provider} className="admin-filter-select">
          <option value="">Tất cả đăng nhập</option>
          <option value="password">Email</option>
          <option value="google">Google</option>
        </select>
        <button type="submit" className="admin-btn-primary">
          Lọc dữ liệu
        </button>
      </form>

      <UsersTable users={result.items} changeUser={changeAdminUser} />

      <nav className="admin-pagination-bar" aria-label="Phân trang tài khoản" style={{ borderRadius: "0.5rem" }}>
        <span>
          Đang xem trang <strong>{result.page}</strong> / {pages} (Tổng {result.total} tài khoản)
        </span>
        <div className="admin-pagination-controls">
          {result.previous_cursor ? (
            <Link className="admin-btn-detail" href={previousUrl}>
              Trang trước
            </Link>
          ) : (
            <button type="button" className="admin-btn-detail" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
              Trang trước
            </button>
          )}
          {result.next_cursor ? (
            <Link className="admin-btn-detail" href={nextUrl}>
              Trang sau
            </Link>
          ) : (
            <button type="button" className="admin-btn-detail" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
              Trang sau
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}

function pageUrl(params: Awaited<SearchParams>, cursor?: string | null) {
  const query = new URLSearchParams();
  for (const key of ["q", "role", "status", "provider"] as const) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  if (cursor) query.set("cursor", cursor);
  return `/admin/users?${query.toString()}`;
}
