"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEventDate, formatMarketTime } from "@/components/market/formatters";
import { EventReminderModal, type ReminderTargetEvent } from "@/components/market/event-reminder-modal";
import type { EventCollection } from "@/types/market";
import { Pagination } from "@/components/ui/pagination";

const labels: Record<string, string> = {
  shareholder_meeting: "Đại hội cổ đông",
  cash_dividend: "Cổ tức tiền",
  stock_dividend: "Cổ tức cổ phiếu",
  earnings: "Kết quả kinh doanh",
  additional_listing: "Niêm yết bổ sung",
  insider_trading: "Giao dịch nội bộ",
  share_issuance: "Phát hành cổ phiếu",
  corporate_action: "Sự kiện doanh nghiệp",
};

export function EventsView({
  collection,
  filters,
}: {
  collection: EventCollection;
  filters: { symbol: string; eventType: string };
}) {
  const [page, setPage] = useState(1);
  const [reminderTarget, setReminderTarget] = useState<ReminderTargetEvent | null>(null);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setPage(1);
  }, [filters.symbol, filters.eventType]);

  const totalEvents = collection.data.length;
  const totalPages = Math.ceil(totalEvents / PAGE_SIZE) || 1;
  const clampedPage = Math.min(Math.max(1, page), totalPages);

  const pagedEvents = useMemo(() => {
    const start = (clampedPage - 1) * PAGE_SIZE;
    return collection.data.slice(start, start + PAGE_SIZE);
  }, [collection.data, clampedPage]);

  const groups = new Map<string, typeof collection.data>();
  for (const event of pagedEvents) {
    const key = formatEventDate(event.event_at);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  const emptyTitle = collection.meta.partial
    ? "Nguồn hiện tại chưa cung cấp lịch sự kiện"
    : "Không có sự kiện phù hợp";
  const emptyCopy = collection.meta.partial
    ? `${collection.meta.provider_name} chưa trả sự kiện phù hợp trong cửa sổ này.`
    : "Thử bỏ mã hoặc chọn loại sự kiện khác.";

  return (
    <section className="market-tab-panel">
      <form className="event-filter" action="/market/events">
        <label>
          Mã chứng khoán
          <input
            name="symbol"
            defaultValue={filters.symbol}
            maxLength={24}
            placeholder="Ví dụ: FPT"
          />
        </label>
        <label>
          Loại sự kiện
          <select name="event_type" defaultValue={filters.eventType}>
            <option value="">Tất cả sự kiện</option>
            <option value="shareholder_meeting">Đại hội cổ đông</option>
            <option value="cash_dividend">Cổ tức tiền</option>
            <option value="stock_dividend">Cổ tức cổ phiếu</option>
            <option value="earnings">Kết quả kinh doanh</option>
            <option value="share_issuance">Phát hành cổ phiếu</option>
            <option value="additional_listing">Niêm yết bổ sung</option>
            <option value="insider_trading">Giao dịch nội bộ</option>
            <option value="corporate_action">Sự kiện khác</option>
          </select>
        </label>
        <button type="submit">Lọc sự kiện</button>
      </form>

      {groups.size ? (
        <>
          <div className="event-groups">
            {[...groups].map(([date, events]) => (
              <section key={date}>
                <h3>{date}</h3>
                <div>
                  {events.map((event) => {
                    const eventUrl =
                      event.source_url ||
                      (event.symbol
                        ? `https://s.cafef.vn/lich-su-kien.chn?symbol=${encodeURIComponent(event.symbol)}`
                        : "https://s.cafef.vn/lich-su-kien.chn");

                    return (
                      <a
                        key={event.id}
                        href={eventUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="event-card-link"
                        title={`Xem chi tiết sự kiện ${event.symbol} tại nguồn chính chủ (mở tab mới)`}
                      >
                        <article>
                          <time dateTime={event.event_at}>
                            {new Intl.DateTimeFormat("vi-VN", {
                              timeZone: "Asia/Ho_Chi_Minh",
                              day: "2-digit",
                              month: "2-digit",
                            }).format(new Date(event.event_at))}
                          </time>
                          <div className="event-symbol">
                            <strong>{event.symbol}</strong>
                            <span>{labels[event.event_type] ?? event.event_type}</span>
                          </div>
                          <div className="event-copy">
                            <h4>{event.title}</h4>
                            <p>{event.summary}</p>
                            <div className="event-source-line">
                              <small>
                                {event.source_name} · cập nhật {formatMarketTime(collection.meta.market_time)}
                              </small>
                              <span className="event-source-link-text">Nguồn chính chủ ↗</span>
                            </div>
                          </div>
                          <div className="event-status-wrap">
                            <span className={`event-status ${event.status}`}>
                              {event.status === "expected"
                                ? "Dự kiến"
                                : event.status === "official"
                                ? "Chính thức"
                                : "Đã hủy"}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setReminderTarget({
                                  id: event.id,
                                  symbol: event.symbol,
                                  title: event.title,
                                  date: event.event_at ? event.event_at.split("T")[0] : "",
                                  type: event.event_type,
                                  extraInfo: { summary: event.summary, source: event.source_name },
                                });
                              }}
                              className="event-reminder-action-btn"
                              title="Đặt nhắc nhở qua Email trước 1-2 ngày"
                            >
                              Nhắc nhở
                            </button>
                          </div>
                        </article>
                      </a>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {totalEvents > 0 && (
            <Pagination
              currentPage={clampedPage}
              totalPages={totalPages}
              totalItems={totalEvents}
              pageSize={PAGE_SIZE}
              itemLabel="sự kiện"
              onPageChange={(p) => {
                setPage(p);
                window.scrollTo({ top: 120, behavior: "smooth" });
              }}
              className="px-5 pb-5"
              ariaLabel="Phân trang sự kiện"
            />
          )}
        </>
      ) : (
        <div className="market-empty">
          <h3>{emptyTitle}</h3>
          <p>{emptyCopy}</p>
        </div>
      )}

      <EventReminderModal
        isOpen={Boolean(reminderTarget)}
        onClose={() => setReminderTarget(null)}
        event={reminderTarget}
      />
    </section>
  );
}
