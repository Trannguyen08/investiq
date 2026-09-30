import { loginAdmin } from "@/app/(admin)/admin/actions";
import { adminAuthConfigured } from "@/lib/server/admin-auth";

type SearchParams = Promise<{ error?: string }>;

export default async function AdminLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const configured = adminAuthConfigured();
  return (
    <main id="main-content" className="admin-login-page">
      <section className="admin-login-card">
        <p className="eyebrow">Restricted workspace</p>
        <h1>InvestIQ Administration</h1>
        <p>Đăng nhập để quản lý nguồn crawl và vòng đời dữ liệu News.</p>
        {!configured && <p className="admin-alert error" role="alert">Admin UI chưa được cấu hình trên server.</p>}
        {params.error && <p className="admin-alert error" role="alert">Mật khẩu quản trị không hợp lệ.</p>}
        <form action={loginAdmin}>
          <label>Mật khẩu quản trị<input name="password" type="password" autoComplete="current-password" required disabled={!configured} /></label>
          <button className="primary-button" type="submit" disabled={!configured}>Đăng nhập</button>
        </form>
      </section>
    </main>
  );
}
