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

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  let account: Awaited<ReturnType<typeof currentUser>> | null = null;
  let authError: string | null = null;
  try {
    account = await currentUser();
  } catch (error) {
    authError = error instanceof UserAuthError ? "Hãy đăng nhập bằng tài khoản quản trị để tiếp tục." : "Không thể xác minh phiên quản trị.";
  }
  if (authError) return <main id="main-content" className="admin-page"><p className="admin-alert error" role="alert">{authError}</p></main>;
  if (!account) return <main id="main-content" className="admin-page"><p className="admin-alert error" role="alert">Không thể xác minh phiên quản trị.</p></main>;
  if (account.role !== "admin") {
    return <main id="main-content" className="admin-page"><p className="admin-alert error" role="alert">Tài khoản hiện tại không có quyền quản lý người dùng.</p></main>;
  }

  const role = params.role === "user" || params.role === "admin" ? params.role : "";
  const accountStatus = params.status === "active" || params.status === "disabled" ? params.status : "";
  const provider = params.provider === "password" || params.provider === "google" ? params.provider : "";
  const q = (params.q ?? "").slice(0, 120);
  const cursor = params.cursor && params.cursor.length <= 512 ? params.cursor : undefined;

  let result: Awaited<ReturnType<typeof getAdminUsers>> | null = null;
  let loadError: string | null = null;
  try {
    result = await getAdminUsers({ q, role, status: accountStatus, provider, limit: 25, cursor });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Không thể tải danh sách tài khoản.";
  }
  if (loadError || !result) {
    return <main id="main-content" className="admin-page"><header className="admin-hero"><div><p className="eyebrow">Account administration</p><h1>Quản lý tài khoản</h1></div></header><p className="admin-alert error" role="alert">{loadError ?? "Không thể tải danh sách tài khoản."}</p></main>;
  }
  const pages = Math.max(1, Math.ceil(result.total / result.limit));
  const previousUrl = pageUrl(params, result.previous_cursor);
  const nextUrl = pageUrl(params, result.next_cursor);
  return (
      <main id="main-content" className="admin-page">
        <header className="admin-hero">
          <div>
            <p className="eyebrow">Account administration</p>
            <h1>Quản lý tài khoản</h1>
            <p>Tìm kiếm, cập nhật vai trò và trạng thái truy cập của người dùng.</p>
          </div>
          <div className="admin-metrics"><span><strong>{result.total}</strong> tài khoản</span><span><strong>{result.page}/{pages}</strong> trang</span></div>
        </header>
        {params.notice && <p className="admin-alert success" role="status">{params.notice}</p>}
        {params.error && <p className="admin-alert error" role="alert">{params.error}</p>}
        <section className="admin-section" aria-label="Bộ lọc tài khoản">
          <form className="user-filter-form" action="/admin/users" method="get">
            <label>Tìm theo email hoặc tên<input type="search" name="q" maxLength={120} defaultValue={q} /></label>
            <label>Vai trò<select name="role" defaultValue={role}><option value="">Tất cả</option><option value="user">Người dùng</option><option value="admin">Quản trị viên</option></select></label>
            <label>Trạng thái<select name="status" defaultValue={accountStatus}><option value="">Tất cả</option><option value="active">Hoạt động</option><option value="disabled">Đã khóa</option></select></label>
            <label>Đăng nhập<select name="provider" defaultValue={provider}><option value="">Tất cả</option><option value="password">Email</option><option value="google">Google</option></select></label>
            <button className="primary-button" type="submit">Lọc tài khoản</button>
          </form>
        </section>
        <UsersTable users={result.items} changeUser={changeAdminUser} />
        <nav className="user-pagination" aria-label="Phân trang tài khoản">
          {result.previous_cursor ? <Link className="secondary-button" href={previousUrl}>Trang trước</Link> : <span />}
          <span>Trang {result.page} / {pages}</span>
          {result.next_cursor ? <Link className="secondary-button" href={nextUrl}>Trang sau</Link> : <span />}
        </nav>
      </main>
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
