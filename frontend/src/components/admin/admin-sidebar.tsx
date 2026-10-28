"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAdmin } from "@/app/(admin)/admin/actions";

const navItems = [
  { href: "/admin", label: "Tổng quan", count: null },
  { href: "/admin/users", label: "Quản lý người dùng", count: null },
  { href: "/admin/theses", label: "Theses & Khuyến nghị", count: null },
  { href: "/admin/portfolios", label: "Paper Trading & Lệnh", count: null },
  { href: "/admin/data-pipeline", label: "Dữ liệu & Thu thập tin tức", count: null },
  { href: "/admin/logs", label: "Nhật ký & Giám sát", count: null },
];

export function AdminSidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar-v2" aria-label="Điều hướng quản trị">
      <div className="admin-sidebar-brand">
        <Link className="admin-brand-title" href="/admin">
          InvestIQ <span>Admin</span>
        </Link>
        <span className="admin-brand-badge">Bảng Điều Khiển</span>
      </div>

      <nav className="admin-sidebar-nav">
        <div className="admin-nav-category">Danh mục quản trị</div>
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-link ${isActive ? "active" : ""}`}
            >
              <span>{item.label}</span>
              {item.count !== null && (
                <span className="admin-nav-count">{item.count}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <Link className="admin-back-link" href="/">
          ← Về trang chủ InvestIQ
        </Link>
        <div className="admin-user-profile">
          <span>Đang đăng nhập:</span>
          <strong>{userEmail ?? "Quản trị viên"}</strong>
        </div>
        <form action={logoutAdmin}>
          <button className="admin-logout-btn" type="submit">
            Đăng xuất
          </button>
        </form>
      </div>
    </aside>
  );
}

