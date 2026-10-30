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
    <section className="dividend-calendar-section" aria-labelledby="dividend-calendar-title">
      <div className="beginner-heading">
        <div>
          <p className="eyebrow">DỮ LIỆU THỰC TẾ THỊ TRƯỜNG</p>
          <h2 id="dividend-calendar-title">Lịch chia cổ tức doanh nghiệp</h2>
          <p>
            Theo dõi ngày chốt quyền và chi trả cổ tức tiền mặt &amp; cổ phiếu từ các doanh nghiệp niêm yết (Dữ liệu trực tiếp).
          </p>
        </div>
        <div className="dividend-filter-toolbar">
          <div className="dividend-type-pills" role="radiogroup" aria-label="Lọc theo loại cổ tức">
            <button
              type="button"
              className={`dividend-pill-btn ${filterType === "all" ? "active" : ""}`}
              onClick={() => setFilterType("all")}
            >
              Tất cả ({initialEvents.length})
            </button>
            <button
              type="button"
              className={`dividend-pill-btn ${filterType === "cash" ? "active" : ""}`}
              onClick={() => setFilterType("cash")}
            >
              💵 Cổ tức tiền
            </button>
            <button
              type="button"
              className={`dividend-pill-btn ${filterType === "stock" ? "active" : ""}`}
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
              className="dividend-search-input"
            />
          </div>
        </div>
      </div>

      {filteredEvents.length > 0 ? (
        <div className="dividend-cards-grid">
          {filteredEvents.map((event) => {
            const isCash = event.type === "cash";
            const dateStr = event.ex_date || event.event_date;
            let displayDay = "--";
            let displayMonth = "--/----";
            if (dateStr) {
              const [y, m, d] = dateStr.split("-");
              if (y && m && d) {
                displayDay = d;
                displayMonth = `${m}/${y}`;
              }
            }

            return (
              <article key={event.id} className="dividend-event-card">
                <div className="dividend-card-date">
                  <span className="dividend-date-day">{displayDay}</span>
                  <span className="dividend-date-month">{displayMonth}</span>
                  <small className="dividend-date-tag">GDKHQ</small>
                </div>
                <div className="dividend-card-content">
                  <div className="dividend-card-header">
                    <Link
                      href={`/market/stocks/${encodeURIComponent(event.symbol)}?tab=dividend`}
                      className="dividend-symbol-badge"
                    >
                      {event.symbol}
                    </Link>
                    <span className={`dividend-type-badge ${isCash ? "badge-cash" : "badge-stock"}`}>
                      {isCash ? "Tiền mặt" : event.type === "bonus" ? "Thưởng cp" : "Cổ phiếu"}
                    </span>
                    {event.ratio && (
                      <span className="dividend-ratio-badge">
                        Tỷ lệ: <strong>{event.ratio}</strong>
                      </span>
                    )}
                  </div>
                  <h3 className="dividend-card-title">{event.title}</h3>
                  <div className="dividend-card-footer">
                    {event.cash_value ? (
                      <span className="dividend-cash-highlight">
                        Thực nhận: <strong>{new Intl.NumberFormat("vi-VN").format(event.cash_value)} đ/cp</strong>
                      </span>
                    ) : (
                      <span className="dividend-source-text">Nguồn: {event.source}</span>
                    )}
                    <Link
                      href={`/market/stocks/${encodeURIComponent(event.symbol)}?tab=dividend`}
                      className="dividend-detail-link"
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
        <div className="market-empty compact">
          <h3>Không có sự kiện chi trả cổ tức nào phù hợp</h3>
          <p>
            {searchQuery
              ? `Không tìm thấy thông tin cổ tức cho mã "${searchQuery}". Thử tìm mã khác.`
              : "Hiện tại chưa có đợt chốt quyền cổ tức nào trong danh mục đã chọn."}
          </p>
        </div>
      )}
    </section>
  );
}
