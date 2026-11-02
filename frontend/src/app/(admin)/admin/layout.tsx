import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { requireAdminSession } from "@/lib/server/admin-auth";
import { currentUser } from "@/lib/server/user-auth";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireAdminSession();
  const user = await currentUser().catch(() => null);

  return (
    <div className="admin-shell-v2">
      <AdminSidebar userEmail={user?.email} />
      <div className="admin-main-wrap">
        <AdminTopbar />
        <main id="main-content" className="admin-content-body">
          {children}
        </main>
      </div>
    </div>
  );
}
