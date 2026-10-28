"use client";

import { usePathname } from "next/navigation";
import { refreshAdminCacheAction } from "@/app/(admin)/admin/actions";

const routeNames: Record<string, string> = {
  "/admin": "Tổng quan",
  "/admin/users": "Quản lý người dùng",
  "/admin/theses": "Theses & Khuyến nghị",
  "/admin/portfolios": "Paper Trading & Lệnh",
  "/admin/data-pipeline": "Dữ liệu & Thu thập tin tức",
  "/admin/logs": "Nhật ký & Giám sát",
};

export function AdminTopbar() {
  const pathname = usePathname();
  const currentTitle =
    routeNames[pathname] ||
    Object.entries(routeNames).find(([p]) => p !== "/admin" && pathname.startsWith(p))?.[1] ||
    "Quản trị";

  return (
    <header className="admin-topbar-v2">
      <div className="admin-breadcrumbs">
        <span>Quản trị</span>
        <span>/</span>
        <span>{currentTitle}</span>
      </div>

      <div className="admin-topbar-actions">
        <div className="admin-system-indicator" title="Các dịch vụ backend, database và cache đang hoạt động">
          <span className="admin-indicator-dot" />
          <span>Hệ thống: Trực tuyến</span>
        </div>
        <form action={refreshAdminCacheAction}>
          <button type="submit" className="admin-btn-detail" title="Làm mới cache dữ liệu hệ thống">
            Làm mới dữ liệu
          </button>
        </form>
      </div>
    </header>
  );
}

