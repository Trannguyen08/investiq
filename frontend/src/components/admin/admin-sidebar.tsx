"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAdmin } from "@/app/(admin)/admin/actions";

interface NavGroup {
  category: string;
  items: {
    href: string;
    label: string;
    count?: number | null;
  }[];
}

const navGroups: NavGroup[] = [
  {
    category: "Tổng quan & Phân tích",
    items: [
      { href: "/admin", label: "Tổng quan", count: null },
      { href: "/admin/analytics", label: "Báo cáo & Thống kê", count: null },
    ],
  },
  {
    category: "Nghiệp vụ thị trường",
    items: [
      { href: "/admin/users", label: "Quản lý người dùng", count: null },
      { href: "/admin/theses", label: "Theses & Khuyến nghị", count: null },
      { href: "/admin/portfolios", label: "Paper Trading & Lệnh", count: null },
      { href: "/admin/market", label: "Mã cổ phiếu & Thị trường", count: null },
    ],
  },
  {
    category: "Dữ liệu & An ninh",
    items: [
      { href: "/admin/data-pipeline", label: "Dữ liệu & Thu thập tin tức", count: null },
      { href: "/admin/alerts", label: "Cảnh báo & Quản trị rủi ro", count: null },
      { href: "/admin/logs", label: "Nhật ký & Giám sát", count: null },
      { href: "/admin/system", label: "Cấu hình & Hệ thống", count: null },
    ],
  },
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
        {navGroups.map((group, groupIndex) => (
          <div key={group.category} style={{ marginTop: groupIndex > 0 ? "0.85rem" : "0" }}>
            <div className="admin-nav-category">{group.category}</div>
            {group.items.map((item) => {
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
                  {item.count !== null && item.count !== undefined && (
                    <span className="admin-nav-count">{item.count}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
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
