import Link from "next/link";
import { changeAdminUser } from "@/app/(admin)/admin/actions";
import { UsersTable } from "@/components/admin/users-table";
import { currentUser, UserAuthError } from "@/lib/server/user-auth";
import { getAdminUsers } from "@/lib/server/admin-user-api";
import { IconSearch, IconReset } from "@/components/admin/admin-icons";
import { AdminAlertMessages, isNextRedirect } from "@/components/admin/admin-page-controls";

type SearchParams = Promise<{
  q?: string;
  role?: string;
  status?: string;
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
    if (isNextRedirect(error)) throw error;
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
  const q = (params.q ?? "").slice(0, 120);
  const cursor = params.cursor ?? "";

  let result = null;
  let listError: string | null = null;
  try {
    result = await getAdminUsers({
      q: q || undefined,
      role: role || undefined,
      status: accountStatus || undefined,
      cursor: cursor || undefined,
      limit: 20,
    });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    listError =
      error instanceof UserAuthError
        ? "Phiên quản trị đã hết hạn."
        : "Không thể tải danh sách tài khoản.";
  }

  if (listError || !result) {
    return (
      <div>
        <div className="admin-view-header">
          <div>
            <h1>Người dùng</h1>
            <p>Quản lý vai trò và trạng thái kích hoạt của từng tài khoản.</p>
          </div>
        </div>
        <p className="admin-alert error" role="alert">
          {listError ?? "Không thể tải danh sách tài khoản."}
        </p>
      </div>
    );
  }

  const pages = Math.max(1, Math.ceil(result.total / Math.max(1, result.limit)));
  const previousUrl = pageUrl(params, result.previous_cursor);
  const nextUrl = pageUrl(params, result.next_cursor);
  const hasFilters = Boolean(q || role || accountStatus);

  return (
    <div>
      <div className="admin-view-header">
        <div>
          <h1>Người dùng</h1>
          <p>Quản lý vai trò và trạng thái kích hoạt của từng tài khoản.</p>
        </div>
        <span className="admin-badge admin" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
          Tổng: {result.total} tài khoản
        </span>
      </div>

      <AdminAlertMessages notice={params.notice} error={params.error} />

      {/* STREAMLINED FILTER BAR */}
      <form className="admin-filter-bar-compact" action="/admin/users" method="get">
        <input
          type="search"
          name="q"
          placeholder="Tìm kiếm theo email hoặc họ tên..."
          maxLength={120}
          defaultValue={q}
        />
        <select name="role" defaultValue={role} aria-label="Lọc theo vai trò">
          <option value="">Tất cả vai trò</option>
          <option value="user">Người dùng</option>
          <option value="admin">Quản trị viên</option>
        </select>
        <select name="status" defaultValue={accountStatus} aria-label="Lọc theo trạng thái">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="disabled">Đã khóa</option>
        </select>
        <button type="submit" title="Tìm kiếm">
          <IconSearch width={14} height={14} />
          <span>Tìm</span>
        </button>
        {hasFilters && (
          <Link href="/admin/users" className="admin-reset-link" title="Xóa bộ lọc">
            <IconReset width={14} height={14} style={{ marginRight: "0.3rem" }} />
            <span>Đặt lại</span>
          </Link>
        )}
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

function pageUrl(params: { q?: string; role?: string; status?: string }, cursor?: string | null) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.role) query.set("role", params.role);
  if (params.status) query.set("status", params.status);
  if (cursor) query.set("cursor", cursor);
  const qs = query.toString();
  return `/admin/users${qs ? `?${qs}` : ""}`;
}
