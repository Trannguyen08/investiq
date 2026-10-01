export default function AdminUsersLoading() {
  return (
    <main id="main-content" className="admin-page" aria-busy="true" aria-live="polite">
      <header className="admin-hero">
        <div>
          <p className="eyebrow">Account administration</p>
          <h1>Đang tải tài khoản</h1>
          <p>Đang xác minh quyền quản trị và tải danh sách người dùng.</p>
        </div>
      </header>
    </main>
  );
}
