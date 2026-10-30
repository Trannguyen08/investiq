"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";

export const userNavigationLinks = [
  ["/", "Tổng quan"],
  ["/market/stocks", "Thị trường"],
  ["/candlestick-prediction", "Dự đoán nến"],
  ["/portfolio", "Danh mục"],
  ["/community", "Cộng đồng"],
  ["/learn", "Chứng khoán căn bản"],
  ["/news", "Tin tức"],
] as const;

function UserAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full object-cover border border-slate-700" />;
  return (
    <span className="account-avatar w-7 h-7 rounded-full bg-sky-600 text-white text-xs font-bold flex items-center justify-center shrink-0 border border-sky-400/30" aria-hidden="true">
      {name.trim().charAt(0).toLocaleUpperCase("vi")}
    </span>
  );
}

function AdminPortalShortcut() {
  const { user, status } = useAuth();
  if (status !== "authenticated" || user?.role !== "admin") return null;
  return (
    <Link
      href="/admin"
      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition whitespace-nowrap ml-1"
    >
      Vào trang Admin
    </Link>
  );
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
    return (
      <Link
        className="account-link px-4 py-1.5 text-xs sm:text-sm font-bold rounded-lg bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/20 transition"
        href="/login"
      >
        Đăng nhập
      </Link>
    );
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
    <div className="account-menu relative" ref={ref}>
      <button
        className="account-trigger flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition cursor-pointer"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UserAvatar name={user.display_name} url={user.avatar_url} />
        <span className="max-w-[120px] truncate">{user.display_name}</span>
        <span aria-hidden="true" className="text-slate-400 text-xs">⌄</span>
      </button>
      {open && (
        <div className="account-dropdown absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 text-xs sm:text-sm" role="menu">
          {user.role === "admin" && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sky-400 hover:bg-slate-800/80 font-bold border-b border-slate-800/80 transition"
            >
              Vào trang quản trị (Admin)
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="w-full text-left px-4 py-2 text-rose-400 hover:bg-slate-800/80 font-semibold transition cursor-pointer"
          >
            Đăng xuất
          </button>
          {error && <p role="alert" className="px-4 py-1 text-xs text-rose-400 m-0">{error}</p>}
        </div>
      )}
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
    <details className="mobile-menu md:hidden relative">
      <summary aria-label="Mở menu" className="p-2 text-slate-300 hover:text-white cursor-pointer list-none flex flex-col gap-1 w-8">
        <span className="block h-0.5 w-full bg-slate-300 rounded"></span>
        <span className="block h-0.5 w-full bg-slate-300 rounded"></span>
        <span className="block h-0.5 w-full bg-slate-300 rounded"></span>
      </summary>
      <nav aria-label="Điều hướng di động" className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 flex flex-col gap-1 z-50 text-sm">
        {user && status === "authenticated" && (
          <div className="mobile-account flex items-center gap-2.5 pb-2 mb-2 border-b border-slate-800 px-2">
            <UserAvatar name={user.display_name} url={user.avatar_url} />
            <strong className="text-white text-xs truncate">{user.display_name}</strong>
          </div>
        )}
        {userNavigationLinks.map(([href, label]) => (
          <Link
            href={href}
            key={href}
            className="px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-semibold transition"
          >
            {label}
          </Link>
        ))}
        <div className="pt-2 mt-2 border-t border-slate-800">
          {user && status === "authenticated" ? (
            <button
              type="button"
              onClick={signOut}
              className="w-full text-left px-3 py-2 text-rose-400 font-semibold text-xs rounded-lg hover:bg-slate-800/80"
            >
              Đăng xuất
            </button>
          ) : (
            <Link
              href="/login"
              className="block text-center py-2 bg-sky-500 text-white font-bold text-xs rounded-lg shadow-sm"
            >
              Đăng nhập
            </Link>
          )}
        </div>
        {error && <p role="alert" className="text-xs text-rose-400 px-2 m-0">{error}</p>}
      </nav>
    </details>
  );
}

export function UserHeader() {
  const pathname = usePathname();
  return (
    <>
      <header className="site-header sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 shadow-md">
        <div className="header-inner max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4 sm:gap-6">
          <Link className="brand shrink-0 flex items-center" href="/" aria-label="InvestIQ — trang tổng quan">
            <img src="/investiq-logo.svg" width="118" height="32" alt="InvestIQ" className="h-8 w-auto" />
          </Link>
          <nav className="desktop-nav hidden md:flex items-center gap-1" aria-label="Điều hướng chính">
            {userNavigationLinks.map(([href, label]) => {
              const active = href === "/" ? pathname === "/" : href.startsWith("/market/") ? pathname.startsWith("/market") : pathname.startsWith(href);
              return (
                <Link
                  className={`nav-link px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    active ? "active bg-slate-800/90 text-sky-400 font-bold shadow-inner" : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                  }`}
                  href={href}
                  key={href}
                  aria-current={active ? "page" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="flex-1" />
          <AccountMenu />
          <AdminPortalShortcut />
          <MobileMenu />
        </div>
      </header>
      <Suspense fallback={null}><AuthMessage /></Suspense>
    </>
  );
}

function AuthMessage() {
  const search = useSearchParams();
  const message = search.get("auth") === "register-success"
    ? "Đăng ký thành công. Email xác nhận đã được gửi."
    : search.get("auth") === "login-success" ? "Đăng nhập thành công." : "";
  return message ? (
    <div className="global-toast fixed bottom-4 right-4 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl" role="status">
      {message}
    </div>
  ) : null;
}
