"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { matchStockQuery, type StockDirectoryItem } from "@/lib/ticker-matcher";

export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLFormElement>(null);

  const matchResult = useMemo(() => matchStockQuery(query, 4), [query]);
  const items: StockDirectoryItem[] =
    matchResult.exactMatches.length > 0
      ? matchResult.exactMatches
      : matchResult.closestMatches;
  const showDropdown = isOpen && query.trim().length >= 2 && items.length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectStock(symbol: string) {
    setQuery(symbol);
    setIsOpen(false);
    setActiveIndex(-1);
    router.push(`/search?q=${encodeURIComponent(symbol)}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (showDropdown && activeIndex >= 0 && activeIndex < items.length) {
      selectStock(items[activeIndex].symbol);
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsOpen(false);
    setActiveIndex(-1);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <form
      ref={containerRef}
      onSubmit={handleSubmit}
      role="search"
      className="header-search-form relative flex items-center shrink-0"
      aria-label="Tìm kiếm trên hệ thống"
    >
      <div className="relative flex items-center w-36 sm:w-44 lg:w-56 focus-within:w-44 sm:focus-within:w-52 lg:focus-within:w-60 transition-all duration-200">
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Tìm mã hoặc từ khóa..."
          aria-autocomplete="list"
          aria-controls="header-search-suggestions"
          className="w-full h-8 pl-8 pr-7 bg-slate-900/90 hover:bg-slate-900 text-slate-100 placeholder-slate-400 text-xs rounded-lg border border-slate-700/80 focus:border-sky-500 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 transition shadow-inner [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        />
        <button
          type="submit"
          aria-label="Tìm kiếm"
          className="absolute left-2 text-slate-400 hover:text-sky-400 transition cursor-pointer flex items-center justify-center p-0.5"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 1114 0z"
            />
          </svg>
        </button>
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
              setActiveIndex(-1);
            }}
            aria-label="Xóa từ khóa"
            className="absolute right-2 text-slate-400 hover:text-slate-200 text-xs cursor-pointer p-0.5"
          >
            ✕
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          id="header-search-suggestions"
          role="listbox"
          aria-label="Gợi ý mã cổ phiếu"
          className="absolute top-full left-0 right-0 mt-1.5 min-w-[270px] sm:min-w-[310px] rounded-xl border border-slate-700/90 bg-slate-950/95 backdrop-blur-md shadow-2xl z-50 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-900/70">
            {matchResult.isTypo ? (
              <p className="text-[11px] font-semibold text-amber-400 m-0 leading-snug">
                Không tìm thấy mã &ldquo;{query.trim().toUpperCase()}&rdquo; — Gợi ý mã gần đúng:
              </p>
            ) : (
              <p className="text-[11px] font-semibold text-slate-400 m-0">
                Mã cổ phiếu gợi ý
              </p>
            )}
          </div>
          <ul className="divide-y divide-slate-800/60 m-0 p-0 list-none">
            {items.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <li key={item.symbol} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectStock(item.symbol);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 transition cursor-pointer ${
                      isSelected
                        ? "bg-sky-500/15 text-white"
                        : "hover:bg-slate-900/90 text-slate-200"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          {item.symbol}
                        </span>
                        <span className="text-xs font-semibold text-slate-100 truncate">
                          {item.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 m-0 mt-0.5 truncate">
                        {item.exchange} · {item.sector}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold text-sky-400 shrink-0">
                      Xem mã
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </form>
  );
}
