"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export function ScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPopStateRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Lắng nghe sự kiện popstate (khi người dùng bấm nút Back hoặc Forward trên Chrome)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Thiết lập scrollRestoration của browser sang manual để tránh Chrome tự cuộn về 0
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const handlePopState = () => {
      isPopStateRef.current = true;
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Lắng nghe sự kiện scroll để lưu vị trí cuộn trang hiện tại vào sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      // Bỏ qua lưu vị trí nếu vừa kích hoạt popstate đang trong quá trình khôi phục
      if (isPopStateRef.current) return;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        const key = `investiq:scroll:${window.location.pathname}${window.location.search}`;
        sessionStorage.setItem(key, String(window.scrollY));
      }, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Khi route thay đổi (đặc biệt khi nhấn Back)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isPop = isPopStateRef.current;
    isPopStateRef.current = false;

    if (!isPop) return;

    const key = `investiq:scroll:${pathname}${searchParams ? `?${searchParams.toString()}` : ""}`;
    const savedYStr = sessionStorage.getItem(key);
    if (!savedYStr) return;

    const targetY = parseInt(savedYStr, 10);
    if (isNaN(targetY) || targetY <= 0) return;

    // Khôi phục vị trí cuộn một cách kiên trì khi DOM hydrate xong
    let attempts = 0;
    const maxAttempts = 25; // Thử tối đa trong ~1.5 giây

    const attemptScroll = () => {
      attempts++;
      const currentScrollHeight = document.documentElement.scrollHeight;
      const canScrollToTarget = currentScrollHeight >= targetY;

      if (canScrollToTarget || attempts >= maxAttempts) {
        window.scrollTo({ top: targetY, behavior: "instant" });
        // Kiểm tra lại sau 50ms để phòng trường hợp DOM tiếp tục nở ra
        setTimeout(() => {
          if (Math.abs(window.scrollY - targetY) > 50) {
            window.scrollTo({ top: targetY, behavior: "instant" });
          }
        }, 50);
      } else {
        requestAnimationFrame(attemptScroll);
      }
    };

    requestAnimationFrame(attemptScroll);
  }, [pathname, searchParams]);

  return null;
}
