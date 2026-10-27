"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMarketDailyDigest } from "@/lib/api-client";
import type { DailyDigestData } from "@/types/market";

export function DailyDigestBanner() {
  const [digest, setDigest] = useState<DailyDigestData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMarketDailyDigest()
      .then((res) => {
        if (!cancelled && res.data) {
          setDigest(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !digest) return null;

  const isPos = digest.session_summary.is_positive;

  return (
    <>
      <section className="daily-digest-strip" aria-label="Bản tin đóng cửa thị trường 15h30">
        <div className="digest-strip-inner">
          <div className="digest-badge-col">
            <span className="digest-live-pill">BẢN TIN 15H30</span>
            <span className="digest-time-tag">{digest.date}</span>
          </div>

          <div className="digest-headline-col">
            <strong className="digest-title">{digest.headline}</strong>
            <div className="digest-quick-stats">
              <span className={`index-val-chip ${isPos ? "up" : "down"}`}>
                VN-Index: {digest.session_summary.vnindex_value} ({digest.session_summary.vnindex_change})
              </span>
              <span className="stat-chip">Thanh khoản: {digest.session_summary.liquidity}</span>
              <span className="stat-chip">
                {digest.session_summary.breadth.advances} tăng · {digest.session_summary.breadth.declines} giảm
              </span>
            </div>
          </div>

          <div className="digest-action-col">
            <button
              type="button"
              className="digest-open-btn"
              onClick={() => setIsOpen(true)}
            >
              Mở bản tin chi tiết →
            </button>
          </div>
        </div>
      </section>

      {/* Detail Modal */}
      {isOpen && (
        <div className="dca-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="digest-modal-title">
          <div className="dca-modal-backdrop" onClick={() => setIsOpen(false)} />
          <div className="dca-modal-content digest-modal-content">
            <header className="dca-modal-header">
              <div>
                <span className="dca-badge">ĐIỂM TIN SAU GIỜ GIAO DỊCH (15H30)</span>
                <h2 id="digest-modal-title" className="dca-heading">
                  Hôm nay thị trường có gì mới? ({digest.date})
                </h2>
                <p className="dca-subheading">{digest.headline}</p>
              </div>
              <button
                type="button"
                className="dca-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng bản tin"
              >
                ✕
              </button>
            </header>

            <div className="digest-modal-body">
              {/* Session Overview Stats */}
              <div className="digest-metrics-row">
                <div className="digest-metric-box">
                  <span className="box-label">Điểm số VN-Index</span>
                  <strong className={`box-value ${isPos ? "positive" : "negative"}`}>
                    {digest.session_summary.vnindex_value}
                  </strong>
                  <span className={`box-sub ${isPos ? "positive" : "negative"}`}>
                    {digest.session_summary.vnindex_change}
                  </span>
                </div>
                <div className="digest-metric-box">
                  <span className="box-label">Giá trị giao dịch</span>
                  <strong className="box-value">{digest.session_summary.liquidity}</strong>
                  <span className="box-sub text-muted">Toàn thị trường</span>
                </div>
                <div className="digest-metric-box">
                  <span className="box-label">Độ rộng phiên</span>
                  <strong className="box-value">
                    {digest.session_summary.breadth.advances} / {digest.session_summary.breadth.declines}
                  </strong>
                  <span className="box-sub text-muted">Mã tăng / Mã giảm</span>
                </div>
              </div>

              {/* Key Drivers */}
              <div className="digest-section-block">
                <h3 className="section-block-title">
                  <span aria-hidden="true">🎯</span> 3 Yếu tố dẫn dắt phiên hôm nay
                </h3>
                <ul className="drivers-list">
                  {digest.key_drivers.map((driver, idx) => (
                    <li key={idx} className="driver-item">
                      <span className="driver-num">0{idx + 1}</span>
                      <p>{driver}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Volume Breakouts & Gainers side by side */}
              <div className="digest-two-col">
                <div className="digest-col-box">
                  <h4 className="col-box-title">
                    <span aria-hidden="true">⚡</span> Bùng nổ khối lượng đột biến
                  </h4>
                  <div className="col-ticker-list">
                    {digest.volume_breakouts.map((item) => (
                      <Link
                        key={item.symbol}
                        href={`/market/stocks/${item.symbol}`}
                        className="digest-ticker-row"
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="ticker-badge-col">
                          <strong>{item.symbol}</strong>
                          <span className="volume-surge-tag">{item.surge_label}</span>
                        </div>
                        <div className="ticker-price-col">
                          <span>{item.price} đ</span>
                          <span className="positive">+{item.change_pct}%</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="digest-col-box">
                  <h4 className="col-box-title">
                    <span aria-hidden="true">🚀</span> Cổ phiếu tăng giá mạnh nhất
                  </h4>
                  <div className="col-ticker-list">
                    {digest.gainers.map((item) => (
                      <Link
                        key={item.symbol}
                        href={`/market/stocks/${item.symbol}`}
                        className="digest-ticker-row"
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="ticker-badge-col">
                          <strong>{item.symbol}</strong>
                          <span className="ticker-sector-tag">{item.sector}</span>
                        </div>
                        <div className="ticker-price-col">
                          <span>{item.price} đ</span>
                          <span className="positive">+{item.change_pct}%</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Upcoming Events / Catalysts */}
              {digest.upcoming_events.length > 0 && (
                <div className="digest-section-block">
                  <h3 className="section-block-title">
                    <span aria-hidden="true">📅</span> Lịch sự kiện doanh nghiệp đáng chú ý
                  </h3>
                  <div className="catalyst-events-grid">
                    {digest.upcoming_events.map((ev, idx) => (
                      <div key={idx} className="catalyst-card">
                        <div className="catalyst-top">
                          <span className="catalyst-symbol">{ev.symbol}</span>
                          <span className="catalyst-date">{ev.date}</span>
                        </div>
                        <p className="catalyst-title">{ev.title}</p>
                        <span className="catalyst-type">{ev.event_type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <footer className="digest-modal-footer">
              <span className="footer-source">
                Nguồn: InvestIQ Market Intelligence Engine · Tự động tổng hợp lúc 15:30 hàng ngày
              </span>
              <button
                type="button"
                className="footer-close-btn"
                onClick={() => setIsOpen(false)}
              >
                Đóng
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
