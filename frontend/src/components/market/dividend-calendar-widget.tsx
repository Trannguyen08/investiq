"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DividendItem } from "@/types/market";

type DividendCalendarWidgetProps = {
  initialEvents?: DividendItem[];
};

export function DividendCalendarWidget({ initialEvents = [] }: DividendCalendarWidgetProps) {
  const [filterType, setFilterType] = useState<"all" | "cash" | "stock">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEvents = useMemo(() => {
    return initialEvents.filter((event) => {
      // Type filter
      if (filterType === "cash" && event.type !== "cash") return false;
      if (filterType === "stock" && event.type !== "stock" && event.type !== "bonus") return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toUpperCase();
        return event.symbol.toUpperCase().includes(query) || event.title.toUpperCase().includes(query);
      }

      return true;
    });
  }, [initialEvents, filterType, searchQuery]);

  return (
    <section className="dividend-calendar-section w-full py-6 text-slate-100" aria-labelledby="dividend-calendar-title">
      <div className="beginner-heading flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">
            DỮ LIỆU SẮP DIỄN RA (TƯƠNG LAI)
          </p>
          <h2 id="dividend-calendar-title" className="text-xl sm:text-2xl font-extrabold text-white tracking-tight my-1">
            Lịch chia cổ tức sắp diễn ra
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed m-0">
            Theo dõi ngày chốt quyền GDKHQ và chi trả cổ tức trong thời gian tới của các doanh nghiệp niêm yết (Dữ liệu trực tiếp).
          </p>
        </div>
        <div className="dividend-filter-toolbar flex flex-wrap items-center gap-3">
          <div className="dividend-type-pills flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl shadow-inner" role="radiogroup" aria-label="Lọc theo loại cổ tức">
            <button
              type="button"
              className={`dividend-pill-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filterType === "all" ? "active bg-sky-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setFilterType("all")}
            >
              Tất cả ({initialEvents.length})
            </button>
            <button
              type="button"
              className={`dividend-pill-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filterType === "cash" ? "active bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setFilterType("cash")}
            >
              💵 Cổ tức tiền
            </button>
            <button
              type="button"
              className={`dividend-pill-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filterType === "stock" ? "active bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setFilterType("stock")}
            >
              📜 Cổ tức cổ phiếu
            </button>
          </div>
          <div className="dividend-search-box">
            <input
              type="text"
              placeholder="Lọc theo mã (HPG, FPT...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Tìm kiếm mã cổ phiếu chia cổ tức"
              className="dividend-search-input bg-slate-900/90 border border-slate-800 text-slate-200 text-xs rounded-xl px-3.5 py-2 w-48 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-500"
            />
          </div>
        </div>
      </div>

      {filteredEvents.length > 0 ? (
        <div className="dividend-cards-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event) => {
            const isCash = event.type === "cash";
            const dateStr = event.ex_date || event.event_date;
            let displayDay = "--";
            let displayMonth = "--/----";
            let daysLeft = 0;
            if (dateStr) {
              const [y, m, d] = dateStr.split("-");
              if (y && m && d) {
                displayDay = d;
                displayMonth = `${m}/${y}`;
                const eventTime = new Date(`${dateStr}T00:00:00`).getTime();
                const nowTime = new Date().setHours(0, 0, 0, 0);
                daysLeft = Math.max(1, Math.round((eventTime - nowTime) / (1000 * 3600 * 24)));
              }
            }

            return (
              <article key={event.id} className="dividend-event-card bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition flex flex-row group">
                <div className="dividend-card-date bg-slate-950/80 border-r border-slate-800/80 w-[78px] flex flex-col items-center justify-center p-3 text-center shrink-0">
                  <span className="dividend-date-day text-2xl font-black text-white leading-none tracking-tight">{displayDay}</span>
                  <span className="dividend-date-month text-[11px] font-semibold text-slate-400 mt-1">{displayMonth}</span>
                  <small className="dividend-date-tag text-[9px] font-extrabold text-sky-400 uppercase tracking-widest mt-1 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-800/50">GDKHQ</small>
                </div>
                <div className="dividend-card-content flex-1 p-3.5 flex flex-col justify-between gap-2.5 min-w-0">
                  <div className="dividend-card-header flex items-center justify-between flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link
                        href={`/market/stocks/${encodeURIComponent(event.symbol)}?tab=dividend`}
                        className="dividend-symbol-badge bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-2 py-0.5 rounded transition"
                      >
                        {event.symbol}
                      </Link>
                      <span className={`dividend-type-badge text-[11px] font-bold px-2 py-0.5 rounded ${
                        isCash ? "badge-cash bg-emerald-950 text-emerald-400 border border-emerald-800/60" : "badge-stock bg-purple-950 text-purple-400 border border-purple-800/60"
                      }`}>
                        {isCash ? "Tiền mặt" : event.type === "bonus" ? "Thưởng cp" : "Cổ phiếu"}
                      </span>
                      {daysLeft > 0 && (
                        <span className="dividend-countdown-badge text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800/60 text-amber-300">
                          ⏳ Còn {daysLeft} ngày
                        </span>
                      )}
                    </div>
                    {event.ratio && (
                      <span className="dividend-ratio-badge text-[11px] text-slate-400 font-medium">
                        Tỷ lệ: <strong className="text-slate-200 font-bold">{event.ratio}</strong>
                      </span>
                    )}
                  </div>
                  <h3 className="dividend-card-title text-xs sm:text-sm font-semibold text-slate-100 line-clamp-2 m-0 group-hover:text-sky-300 transition leading-snug">
                    {event.title}
                  </h3>
                  <div className="dividend-card-footer flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[11px]">
                    {event.cash_value ? (
                      <span className="dividend-cash-highlight text-emerald-400 font-bold">
                        Thực nhận: <strong>{new Intl.NumberFormat("vi-VN").format(event.cash_value)} đ/cp</strong>
                      </span>
                    ) : (
                      <span className="dividend-source-text text-slate-400 truncate">Nguồn: {event.source}</span>
                    )}
                    <Link
                      href={`/market/stocks/${encodeURIComponent(event.symbol)}?tab=dividend`}
                      className="dividend-detail-link text-sky-400 hover:text-sky-300 font-semibold shrink-0 transition"
                    >
                      Lịch sử {event.symbol} →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="market-empty compact bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
          <h3 className="text-base font-bold text-slate-300 mb-1">Không có sự kiện chi trả cổ tức nào phù hợp</h3>
          <p className="text-xs m-0">Thử thay đổi bộ lọc phân loại hoặc tìm kiếm với từ khóa khác.</p>
        </div>
      )}
    </section>
  );
}
