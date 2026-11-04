"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="header-search-form relative flex items-center shrink-0"
      aria-label="Tìm kiếm trên hệ thống"
    >
      <div className="relative flex items-center w-36 sm:w-44 lg:w-56 focus-within:w-44 sm:focus-within:w-52 lg:focus-within:w-60 transition-all duration-200">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm mã hoặc từ khóa..."
          className="w-full h-8 pl-8 pr-7 bg-slate-900/90 hover:bg-slate-900 text-slate-100 placeholder-slate-400 text-xs rounded-lg border border-slate-700/80 focus:border-sky-500 focus:outline-none transition shadow-inner"
        />
        <button
          type="submit"
          aria-label="Tìm kiếm"
          className="absolute left-2 text-slate-400 hover:text-sky-400 transition cursor-pointer flex items-center justify-center p-0.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 1114 0z" />
          </svg>
        </button>
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Xóa từ khóa"
            className="absolute right-2 text-slate-400 hover:text-slate-200 text-xs cursor-pointer p-0.5"
          >
            ✕
          </button>
        )}
      </div>
    </form>
  );
}
