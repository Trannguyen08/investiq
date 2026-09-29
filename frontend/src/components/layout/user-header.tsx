"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/", "Tổng quan"],
  ["/portfolio", "Danh mục"],
  ["/predictions", "Dự báo AI"],
  ["/backtesting", "Kiểm thử chiến lược"],
  ["/news", "Tin tức"],
] as const;

export function UserHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/" aria-label="InvestIQ — trang tổng quan">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/investiq-logo.svg" width="118" height="32" alt="InvestIQ" />
        </Link>
        <nav className="desktop-nav" aria-label="Điều hướng chính">
          {links.map(([href, label]) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link className={active ? "nav-link active" : "nav-link"} href={href} key={href} aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            );
          })}
        </nav>
        <form action="/news" className="header-search" role="search">
          <label className="sr-only" htmlFor="header-search">Tìm mã cổ phiếu hoặc tin tức</label>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m21 21-4.4-4.4m2.4-5.1A7.5 7.5 0 1 1 4 11.5a7.5 7.5 0 0 1 15 0Z" /></svg>
          <input id="header-search" name="q" placeholder="Tìm mã cổ phiếu, tin tức" />
        </form>
        <Link className="account-link" href="/login">Đăng nhập</Link>
        <details className="mobile-menu">
          <summary aria-label="Mở menu"><span /><span /><span /></summary>
          <nav aria-label="Điều hướng di động">
            {links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
            <Link href="/login">Đăng nhập</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
