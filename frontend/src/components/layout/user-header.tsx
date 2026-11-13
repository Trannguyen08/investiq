"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { HeaderSearch } from "@/components/layout/header-search";

export const userNavigationLinks = [
  ["/", "Tổng quan"],
  ["/market/stocks", "Thị trường"],
  ["/candlestick-prediction", "Dự đoán nến"],
  ["/portfolio", "Danh mục"],
  ["/community", "Cộng đồng"],
  ["/learn", "Chứng khoán căn bản"],
  ["/news", "Tin tức"],
] as const;

export function getUserGreeting(fullName: string): string {
  if (!fullName) return "Xin chào";
  const trimmed = fullName.trim();
  if (trimmed.includes("@")) {
    const localPart = trimmed.split("@")[0];
    return `Xin chào, ${localPart}`;
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Xin chào";
  const shortName = parts[parts.length - 1];
  return `Xin chào, ${shortName}`;
}

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
      className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition whitespace-nowrap ml-1"
    >
      Admin
    </Link>
  );
}

function buildLoginHref(pathname: string, search: string): string {
  if (!pathname || pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot-password") || pathname.startsWith("/verify-email")) {
    return "/login";
  }
  const target = search ? `${pathname}?${search}` : pathname;
  return `/login?next=${encodeURIComponent(target)}`;
}

function AccountMenu() {
  const { status, user, logout } = useAuth();
  const [error, setError] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (status !== "authenticated" || !user) {
    const loginHref = buildLoginHref(pathname, searchParams.toString());
    return (
      <Link
        className="account-link px-3 sm:px-4 py-1.5 text-xs font-bold rounded-lg bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/20 transition whitespace-nowrap"
        href={loginHref}
      >
        Đăng nhập
      </Link>
    );
  }

  async function signOut() {
    setError("");
    try {
      await logout();
      router.push("/login?logout=success");
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Chưa thể đăng xuất.");
    }
  }

  const shortName = user.display_name.trim().includes("@")
    ? user.display_name.trim().split("@")[0]
    : user.display_name.trim();

  return (
    <div className="account-menu flex items-center gap-1.5 shrink-0">
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 shadow-sm">
        <UserAvatar name={user.display_name} url={user.avatar_url} />
        <div className="flex flex-col text-left leading-tight">
          <span className="text-[10px] text-slate-400 font-medium">Xin chào</span>
          <span className="text-xs font-bold text-slate-100 truncate max-w-[100px] sm:max-w-[130px]">
            {shortName}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={signOut}
        title="Đăng xuất"
        aria-label="Đăng xuất"
        className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/50 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition cursor-pointer flex items-center justify-center shrink-0 shadow-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
      {error && <span role="alert" className="sr-only">{error}</span>}
    </div>
  );
}

function MobileMenu() {
  const { status, user, logout } = useAuth();
  const [error, setError] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loginHref = buildLoginHref(pathname, searchParams.toString());
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
            <strong className="text-white text-xs truncate">{getUserGreeting(user.display_name)}</strong>
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
              href={loginHref}
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
        <div className="header-inner max-w-7xl mx-auto px-2 sm:px-4 h-16 flex items-center gap-2 sm:gap-3 lg:gap-4">
          <Link className="brand shrink-0 flex items-center" href="/" aria-label="InvestIQ — trang tổng quan">
            <img src="/investiq-logo.svg" width="118" height="32" alt="InvestIQ" className="h-8 w-auto" />
          </Link>
          <nav className="desktop-nav hidden md:flex items-center gap-0.5 lg:gap-1 shrink-0" aria-label="Điều hướng chính">
            {userNavigationLinks.map(([href, label]) => {
              const active = href === "/" ? pathname === "/" : href.startsWith("/market/") ? pathname.startsWith("/market") : pathname.startsWith(href);
              return (
                <Link
                  className={`nav-link px-2 lg:px-2.5 py-1.5 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1 whitespace-nowrap ${
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
          <div className="flex-1 min-w-0" />
          <HeaderSearch />
          <AccountMenu />
          <AdminPortalShortcut />
          <MobileMenu />
        </div>
      </header>
      <Suspense fallback={null}><AuthMessage /></Suspense>
    </>
  );
}

const shownAuthKeys = new Set<string>();

function AuthMessage() {
  const search = useSearchParams();
  const authParam = search.get("auth");
  const rawMessage = authParam === "register-success"
    ? "Đăng ký thành công. Email xác nhận đã được gửi."
    : authParam === "login-success" ? "Đăng nhập thành công." : "";

  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");

  useEffect(() => {
    if (!rawMessage || !authParam) return;
    if (shownAuthKeys.has(authParam)) return;
    shownAuthKeys.add(authParam);

    setCurrentMessage(rawMessage);
    setVisible(true);
    setClosing(false);

    // Xóa ?auth=... khỏi URL để giữ URL sạch và không bị hiện lại khi refresh
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
    }

    // Tự động ẩn chính xác sau 3 giây (3000ms), hiệu ứng fade-out mượt mà
    const fadeTimer = setTimeout(() => {
      setClosing(true);
    }, 2800);

    const removeTimer = setTimeout(() => {
      setVisible(false);
      setClosing(false);
      setCurrentMessage("");
    }, 3200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [rawMessage, authParam]);

  if (!visible || !currentMessage) return null;

  return (
    <div
      className={`global-toast fixed bottom-4 right-4 z-50 flex items-center justify-between gap-3 text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl transition-all duration-300 ease-in-out ${
        closing ? "opacity-0 translate-y-2 pointer-events-none" : "opacity-100 translate-y-0"
      }`}
      role="status"
    >
      <span>{currentMessage}</span>
      <button
        type="button"
        onClick={() => {
          setClosing(true);
          setTimeout(() => setVisible(false), 200);
        }}
        className="ml-2 text-current opacity-70 hover:opacity-100 transition cursor-pointer text-sm font-bold leading-none"
        aria-label="Đóng thông báo"
      >
        ×
      </button>
    </div>
  );
}
