"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function NewsFilterForm({ sources }: { sources: { slug: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const lastNavigation = useRef<string | null>(null);
  const current = searchParams.toString();

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (current === lastNavigation.current) {
      lastNavigation.current = null;
      return;
    }
    if (!formRef.current) return;
    const fields = formRef.current.elements;
    for (const name of ["q", "source", "symbol", "window_days", "sentiment"] as const) {
      const field = fields.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
        field.value = searchParams.get(name) ?? (name === "window_days" ? "7" : "");
      }
    }
  }, [current, searchParams]);

  function update(form: HTMLFormElement, delayed: boolean) {
    if (timer.current) clearTimeout(timer.current);
    const apply = () => {
      const params = new URLSearchParams();
      for (const [key, value] of new FormData(form)) {
        if (typeof value === "string" && value.trim()) params.set(key, value.trim());
      }
      const value = params.get("q");
      if (value && value.trim().length < 2) params.delete("q");
      if (params.get("window_days") === "7") params.delete("window_days");
      const symbol = params.get("symbol");
      if (symbol && /^(HOSE|HNX|UPCOM):[A-Z0-9]{1,12}$/.test(symbol.toUpperCase())) {
        params.set("symbol", symbol.toUpperCase());
      } else {
        params.delete("symbol");
      }
      const query = params.toString();
      if (query !== current) {
        lastNavigation.current = query;
        router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
      }
    };
    if (delayed) timer.current = setTimeout(apply, 350);
    else apply();
  }

  return (
    <form ref={formRef} action="/news" className="news-filters" role="search" onChange={(event) => {
      const target = event.target;
      update(event.currentTarget, target instanceof HTMLInputElement && target.name === "q");
    }} onSubmit={(event) => { event.preventDefault(); update(event.currentTarget, false); }}>
      <label className="search-wide"><span className="sr-only">Tìm kiếm tin</span><input name="q" defaultValue={searchParams.get("q") ?? ""} placeholder="Tìm tiêu đề, nội dung hoặc doanh nghiệp…" maxLength={200} /></label>
      <label><span>Nguồn</span><select name="source" defaultValue={searchParams.get("source") ?? ""}><option value="">Tất cả nguồn</option>{sources.map((source) => <option value={source.slug} key={source.slug}>{source.name}</option>)}</select></label>
      <label><span>Mã chứng khoán</span><input name="symbol" defaultValue={searchParams.get("symbol") ?? ""} placeholder="HOSE:FPT" pattern="(HOSE|HNX|UPCOM):[A-Za-z0-9]{1,12}" /></label>
      <label><span>Thời gian</span><select name="window_days" defaultValue={searchParams.get("window_days") ?? "7"}><option value="1">24 giờ qua</option><option value="7">7 ngày qua</option><option value="30">30 ngày qua</option><option value="90">90 ngày qua</option></select></label>
      <label><span>Sắc thái toàn bài</span><select name="sentiment" defaultValue={searchParams.get("sentiment") ?? ""}><option value="">Tất cả</option><option value="positive">Tích cực</option><option value="negative">Tiêu cực</option><option value="neutral">Trung tính</option><option value="mixed">Trái chiều</option><option value="unknown">Chưa đủ cơ sở</option></select></label>
      {(searchParams.get("q") || searchParams.get("source") || searchParams.get("symbol") || searchParams.get("sentiment") || (searchParams.get("window_days") ?? "7") !== "7") && <Link className="clear-filters" href="/news">Xóa lọc</Link>}
    </form>
  );
}
