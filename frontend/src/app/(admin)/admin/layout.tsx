import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAdmin } from "@/app/(admin)/admin/actions";
import { requireAdminSession } from "@/lib/server/admin-auth";

const links = [
  ["/admin", "Overview"],
  ["/admin/users", "Users"],
  ["/admin/data-pipeline", "Data pipeline"],
  ["/admin/ml-models", "ML models"],
  ["/admin/content", "Content"],
  ["/admin/logs", "Logs"],
] as const;

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAdminSession();
  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <Link className="admin-brand" href="/admin/data-pipeline">InvestIQ <span>Admin</span></Link>
        <nav className="admin-navigation" aria-label="Admin navigation">
          {links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <form action={logoutAdmin}><button className="secondary-button" type="submit">Đăng xuất</button></form>
      </header>
      {children}
    </div>
  );
}
