"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";

const links = [
  ["/", "Tổng quan"],
  ["/market", "Thị trường"],
  ["/portfolio", "Danh mục"],
  ["/predictions", "Dự báo AI"],
  ["/backtesting", "Kiểm thử chiến lược"],
  ["/news", "Tin tức"],
] as const;

function UserAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt="" referrerPolicy="no-referrer" />;
  return <span className="account-avatar" aria-hidden="true">{name.trim().charAt(0).toLocaleUpperCase("vi")}</span>;
}

function AccountMenu() {
  const { status, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  if (status !== "authenticated" || !user) {
    return <Link className="account-link" href="/login">Đăng nhập</Link>;
  }

  async function signOut() {
    setError("");
    try {
      await logout();
      setOpen(false);
      router.push("/login?logout=success");
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Chưa thể đăng xuất.");
    }
  }

  return (
    <div className="account-menu" ref={ref}>
      <button className="account-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open}>
        <UserAvatar name={user.display_name} url={user.avatar_url} />
        <span>{user.display_name}</span><span aria-hidden="true">⌄</span>
      </button>
      {open && <div className="account-dropdown" role="menu"><button type="button" role="menuitem" onClick={signOut}>Đăng xuất</button>{error && <p role="alert">{error}</p>}</div>}
    </div>
  );
}

function MobileMenu() {
  const { status, user, logout } = useAuth();
  const [error, setError] = useState("");
  const router = useRouter();
  async function signOut() {
    setError("");
    try { await logout(); router.push("/login?logout=success"); router.refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : "Chưa thể đăng xuất."); }
  }
  return (
    <details className="mobile-menu">
      <summary aria-label="Mở menu"><span /><span /><span /></summary>
      <nav aria-label="Điều hướng di động">
        {user && status === "authenticated" && <div className="mobile-account"><UserAvatar name={user.display_name} url={user.avatar_url} /><strong>{user.display_name}</strong></div>}
        {links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        {user && status === "authenticated" ? <button type="button" onClick={signOut}>Đăng xuất</button> : <Link href="/login">Đăng nhập</Link>}
        {error && <p role="alert">{error}</p>}
      </nav>
    </details>
  );
}

export function UserHeader() {
  const pathname = usePathname();
  return (
    <>
      <header className="site-header"><div className="header-inner">
        <Link className="brand" href="/" aria-label="InvestIQ — trang tổng quan"><img src="/investiq-logo.svg" width="118" height="32" alt="InvestIQ" /></Link>
        <nav className="desktop-nav" aria-label="Điều hướng chính">{links.map(([href, label]) => { const active = href === "/" ? pathname === "/" : pathname.startsWith(href); return <Link className={active ? "nav-link active" : "nav-link"} href={href} key={href} aria-current={active ? "page" : undefined}>{label}</Link>; })}</nav>
        <form action="/market" className="header-search" role="search"><input type="hidden" name="tab" value="stocks" /><label className="sr-only" htmlFor="header-search">Tìm mã cổ phiếu hoặc công ty</label><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m21 21-4.4-4.4m2.4-5.1A7.5 7.5 0 1 1 4 11.5a7.5 7.5 0 0 1 15 0Z" /></svg><input id="header-search" name="q" placeholder="Tìm mã cổ phiếu, công ty" /></form>
        <AccountMenu /><MobileMenu />
      </div></header>
      <Suspense fallback={null}><AuthMessage /></Suspense>
    </>
  );
}

function AuthMessage() {
  const search = useSearchParams();
  const message = search.get("auth") === "register-success"
    ? "Đăng ký thành công. Email xác nhận đã được gửi."
    : search.get("auth") === "login-success" ? "Đăng nhập thành công." : "";
  return message ? <div className="global-toast" role="status">{message}</div> : null;
}
