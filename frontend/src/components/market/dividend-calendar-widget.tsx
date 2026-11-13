"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DividendItem } from "@/types/market";
import { Pagination } from "@/components/ui/pagination";
import { DividendDetailModal } from "./dividend-detail-modal";
import { EventReminderModal, type ReminderTargetEvent } from "./event-reminder-modal";
import { resolveDirectArticleUrl } from "@/lib/market-article-links";

const PAGE_SIZE = 6;

type DividendCalendarWidgetProps = {
  initialEvents?: DividendItem[];
};

export function DividendCalendarWidget({ initialEvents = [] }: DividendCalendarWidgetProps) {
  const [filterType, setFilterType] = useState<"all" | "cash" | "stock">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [reminderEvent, setReminderEvent] = useState<ReminderTargetEvent | null>(null);
  const [selectedDetailEvent, setSelectedDetailEvent] = useState<DividendItem | null>(null);

  // Reset to page 1 whenever filter or search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, searchQuery]);

  // 1. Filter events based on active type and search input
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

  // 2. Sort events closest to the present moment first:
  // - Upcoming events (diff >= 0) sorted ascending by distance from now (nearest future first)
  // - Past events (diff < 0) placed after upcoming ones, sorted descending (most recent past first)
  const sortedEvents = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const nowMs = now.getTime();

    return [...filteredEvents].sort((a, b) => {
      const rawDateA = a.ex_date || a.event_date;
      const rawDateB = b.ex_date || b.event_date;
      const timeA = rawDateA ? new Date(`${rawDateA}T00:00:00`).getTime() : 0;
      const timeB = rawDateB ? new Date(`${rawDateB}T00:00:00`).getTime() : 0;

      const diffA = timeA - nowMs;
      const diffB = timeB - nowMs;

      // Both in future or today: earliest first
      if (diffA >= 0 && diffB >= 0) {
        return diffA - diffB;
      }
      // Future always takes precedence over past
      if (diffA >= 0 && diffB < 0) {
        return -1;
      }
      if (diffA < 0 && diffB >= 0) {
        return 1;
      }
      // Both in past: most recent first
      return diffB - diffA;
    });
  }, [filteredEvents]);

  // 3. Client-side pagination calculations
  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedEvents = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return sortedEvents.slice(start, start + PAGE_SIZE);
  }, [sortedEvents, safeCurrentPage]);

  return (
    <section className="dividend-calendar-section w-full pb-6 text-slate-100" aria-labelledby="dividend-calendar-title">
      <div className="beginner-heading flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div className="dividend-heading-copy mb-3 sm:mb-4">
          <p className="eyebrow text-xs font-bold text-sky-400 uppercase tracking-widest mb-1.5">
            DỮ LIỆU SẮP DIỄN RA (TƯƠNG LAI)
          </p>
          <h2 id="dividend-calendar-title" className="text-xl sm:text-2xl font-extrabold text-white tracking-tight my-1.5">
            Lịch chia cổ tức sắp diễn ra
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed m-0 mt-1">
            Theo dõi ngày chốt quyền GDKHQ và chi trả cổ tức trong thời gian tới của các doanh nghiệp niêm yết (Dữ liệu trực tiếp).
          </p>
        </div>
        <div className="dividend-filter-toolbar flex flex-col items-end gap-2.5 ml-auto">
          <div className="dividend-type-pills flex items-center justify-end gap-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl shadow-inner" role="radiogroup" aria-label="Lọc theo loại cổ tức">
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
              Cổ tức tiền mặt
            </button>
            <button
              type="button"
              className={`dividend-pill-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filterType === "stock" ? "active bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setFilterType("stock")}
            >
              Cổ tức cổ phiếu
            </button>
          </div>
          <div className="dividend-search-box flex justify-end w-full sm:w-auto">
            <input
              type="text"
              placeholder="Lọc theo mã (HPG, FPT...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Tìm kiếm mã cổ phiếu chia cổ tức"
              className="dividend-search-input bg-slate-900/90 border border-slate-800 text-slate-200 text-xs rounded-xl px-3.5 py-2 w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-500 text-left"
            />
          </div>
        </div>
      </div>

      {sortedEvents.length > 0 ? (
        <>
          <div className="dividend-cards-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagedEvents.map((event) => {
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

              // Determine official source info link (direct article URL)
              const sourceUrl = resolveDirectArticleUrl(event.symbol, event.source_url);
              const isExternal = sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://");

              const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
                const target = e.target as HTMLElement;
                // Avoid interfering when user clicks an interactive element inside
                if (target.closest("a, button, input")) {
                  return;
                }
                setSelectedDetailEvent(event);
              };

              return (
                <article
                  key={event.id}
                  onClick={handleCardClick}
                  className="dividend-event-card bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition flex flex-row group cursor-pointer relative"
                  title="Bấm để xem chi tiết lịch chia cổ tức"
                >
                  <div className="dividend-card-date bg-slate-950/80 border-r border-slate-800/80 w-20 min-h-[82px] flex flex-col items-center justify-center p-2.5 text-center shrink-0">
                    <span className="dividend-date-day text-2xl font-black text-white leading-none tracking-tight">{displayDay}</span>
                    <span className="dividend-date-month text-[11px] font-semibold text-slate-400 mt-1">{displayMonth}</span>
                    <small className="dividend-date-tag text-[9px] font-black text-sky-400 uppercase tracking-wider mt-1 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-800/50 whitespace-nowrap">GDKHQ</small>
                  </div>
                  <div className="dividend-card-content flex-1 p-3.5 flex flex-col justify-between gap-2.5 min-w-0">
                    <div className="dividend-card-header flex items-center justify-between flex-wrap gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/market/stocks/${encodeURIComponent(event.symbol)}?tab=dividend`}
                          onClick={(e) => e.stopPropagation()}
                          className="dividend-symbol-badge bg-blue-600 hover:bg-blue-500 text-white font-black text-xs px-2.5 py-1 rounded transition shadow-sm"
                          title={`Xem chi tiết cổ tức mã ${event.symbol}`}
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
                            Còn {daysLeft} ngày
                          </span>
                        )}
                      </div>
                      {event.ratio && (
                        <span className="dividend-ratio-badge text-[11px] text-slate-400 font-medium">
                          Tỷ lệ: <strong className="text-slate-200 font-bold">{event.ratio}</strong>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDetailEvent(event);
                      }}
                      className="dividend-card-title text-left text-xs sm:text-sm font-semibold text-slate-100 line-clamp-2 m-0 group-hover:text-sky-300 hover:underline transition leading-snug cursor-pointer p-0 bg-transparent border-0"
                      title={`Xem chi tiết thông tin: ${event.title}`}
                    >
                      {event.title}
                    </button>

                    <div className="dividend-card-footer flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[11px]">
                      <div className="flex flex-col gap-0.5 min-w-0 pr-1">
                        {event.cash_value ? (
                          <span className="dividend-cash-highlight text-emerald-400 font-bold whitespace-nowrap text-xs">
                            Thực nhận: <strong>{new Intl.NumberFormat("vi-VN").format(event.cash_value)} đ/cp</strong>
                          </span>
                        ) : event.ratio ? (
                          <span className="dividend-cash-highlight text-purple-400 font-bold whitespace-nowrap text-xs">
                            {event.type === "bonus" ? "Thưởng CP" : "Cổ tức CP"}: <strong>{event.ratio}</strong>
                          </span>
                        ) : (
                          <span className="dividend-cash-highlight text-slate-400 font-medium whitespace-nowrap text-xs">
                            Theo nghị quyết ĐHCĐ
                          </span>
                        )}
                        <span
                          className="dividend-source-text text-[11px] text-slate-400 truncate block"
                          title={`Nguồn công bố: ${event.source}`}
                        >
                          Nguồn: {event.source}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDetailEvent(event);
                          }}
                          className="dividend-detail-btn w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition cursor-pointer shadow-sm"
                          title="Xem chi tiết các mốc ngày và quy định cổ tức"
                          aria-label="Chi tiết"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReminderEvent({
                              id: event.id,
                              symbol: event.symbol,
                              title: event.title,
                              date: event.ex_date || event.event_date || "",
                              type: "dividend",
                              extraInfo: {
                                cash_value: event.cash_value,
                                ratio: event.ratio,
                                record_date: event.record_date,
                                payout_date: event.payout_date,
                              },
                            });
                          }}
                          className="dividend-reminder-btn w-7 h-7 flex items-center justify-center rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-400 hover:text-sky-300 border border-sky-800/60 transition shadow-sm cursor-pointer"
                          title="Đặt nhắc nhở qua Email trước 1-2 ngày"
                          aria-label="Nhắc nhở"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </button>
                        <a
                          href={sourceUrl}
                          target={isExternal ? "_blank" : undefined}
                          rel={isExternal ? "noopener noreferrer" : undefined}
                          onClick={(e) => e.stopPropagation()}
                          className="dividend-detail-link w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-sky-300 border border-slate-700/80 transition shadow-sm"
                          title="Xem nguồn thông tin chi tiết trên CafeF"
                          aria-label="Nguồn tin ↗"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="dividend-pagination-wrapper pt-4">
            <Pagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={sortedEvents.length}
              pageSize={PAGE_SIZE}
              itemLabel="sự kiện cổ tức"
              onPageChange={(p) => setCurrentPage(p)}
              ariaLabel="Phân trang lịch chia cổ tức"
            />
          </div>
        </>
      ) : (
        <div className="market-empty compact bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
          <h3 className="text-base font-bold text-slate-300 mb-1">Không có sự kiện chi trả cổ tức nào phù hợp</h3>
          <p className="text-xs m-0">Thử thay đổi bộ lọc phân loại hoặc tìm kiếm với từ khóa khác.</p>
        </div>
      )}

      <DividendDetailModal
        isOpen={Boolean(selectedDetailEvent)}
        onClose={() => setSelectedDetailEvent(null)}
        event={selectedDetailEvent}
        onOpenReminder={(ev) => {
          setReminderEvent({
            id: ev.id,
            symbol: ev.symbol,
            title: ev.title,
            date: ev.ex_date || ev.event_date || "",
            type: "dividend",
            extraInfo: {
              cash_value: ev.cash_value,
              ratio: ev.ratio,
              record_date: ev.record_date,
              payout_date: ev.payout_date,
            },
          });
        }}
      />

      <EventReminderModal
        isOpen={Boolean(reminderEvent)}
        onClose={() => setReminderEvent(null)}
        event={reminderEvent}
      />
    </section>
  );
}
