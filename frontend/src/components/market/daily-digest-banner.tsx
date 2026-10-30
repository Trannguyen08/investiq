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
      <section className="daily-digest-strip bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 my-4 shadow-sm" aria-label="Bản tin đóng cửa thị trường 15h30">
        <div className="digest-strip-inner flex flex-wrap items-center justify-between gap-4">
          <div className="digest-badge-col flex items-center gap-2">
            <span className="digest-live-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              BẢN TIN 15H30
            </span>
            <span className="digest-time-tag text-xs text-slate-400 font-medium">{digest.date}</span>
          </div>

          <div className="digest-headline-col flex-1 min-w-[260px] flex flex-col gap-1.5">
            <strong className="digest-title text-sm sm:text-base font-bold text-slate-100 hover:text-sky-300 transition line-clamp-1">{digest.headline}</strong>
            <div className="digest-quick-stats flex flex-wrap items-center gap-2 text-xs">
              <span className={`index-val-chip font-bold px-2 py-0.5 rounded ${isPos ? "up text-emerald-400 bg-emerald-950/60 border border-emerald-800/60" : "down text-rose-400 bg-rose-950/60 border border-rose-800/60"}`}>
                VN-Index: {digest.session_summary.vnindex_value} ({digest.session_summary.vnindex_change})
              </span>
              <span className="stat-chip text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-850">Thanh khoản: {digest.session_summary.liquidity}</span>
              <span className="stat-chip text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-850">
                {digest.session_summary.breadth.advances} tăng · {digest.session_summary.breadth.declines} giảm
              </span>
            </div>
          </div>

          <div className="digest-action-col shrink-0">
            <button
              type="button"
              className="digest-open-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white transition cursor-pointer shadow-sm"
              onClick={() => setIsOpen(true)}
            >
              Mở bản tin chi tiết →
            </button>
          </div>
        </div>
      </section>

      {/* Detail Modal */}
      {isOpen && (
        <div className="dca-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="digest-modal-title">
          <div className="dca-modal-backdrop absolute inset-0 cursor-pointer" onClick={() => setIsOpen(false)} />
          <div className="dca-modal-content digest-modal-content relative z-10 w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl text-slate-100 flex flex-col gap-5">
            <header className="dca-modal-header flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="dca-badge inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  ĐIỂM TIN SAU GIỜ GIAO DỊCH (15H30)
                </span>
                <h2 id="digest-modal-title" className="dca-heading text-lg sm:text-xl font-bold text-slate-100 mt-2 m-0">
                  Hôm nay thị trường có gì mới? ({digest.date})
                </h2>
                <p className="dca-subheading text-xs sm:text-sm text-slate-400 mt-1 m-0">{digest.headline}</p>
              </div>
              <button
                type="button"
                className="dca-close-btn w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition text-lg shrink-0 cursor-pointer"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng bản tin"
              >
                ✕
              </button>
            </header>

            <div className="digest-modal-body flex flex-col gap-5">
              {/* Session Overview Stats */}
              <div className="digest-metrics-row grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="digest-metric-box bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col">
                  <span className="box-label text-xs text-slate-400 mb-1">Điểm số VN-Index</span>
                  <strong className={`box-value text-xl font-bold ${isPos ? "positive text-emerald-400" : "negative text-rose-400"}`}>
                    {digest.session_summary.vnindex_value}
                  </strong>
                  <span className={`box-sub text-xs font-semibold mt-0.5 ${isPos ? "positive text-emerald-400" : "negative text-rose-400"}`}>
                    {digest.session_summary.vnindex_change}
                  </span>
                </div>
                <div className="digest-metric-box bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col">
                  <span className="box-label text-xs text-slate-400 mb-1">Giá trị giao dịch</span>
                  <strong className="box-value text-xl font-bold text-white">{digest.session_summary.liquidity}</strong>
                  <span className="box-sub text-muted text-xs text-slate-500 mt-0.5">Toàn thị trường</span>
                </div>
                <div className="digest-metric-box bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col">
                  <span className="box-label text-xs text-slate-400 mb-1">Độ rộng phiên</span>
                  <strong className="box-value text-xl font-bold text-white">
                    {digest.session_summary.breadth.advances} / {digest.session_summary.breadth.declines}
                  </strong>
                  <span className="box-sub text-muted text-xs text-slate-500 mt-0.5">Mã tăng / Mã giảm</span>
                </div>
              </div>

              {/* Key Drivers */}
              <div className="digest-section-block bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                <h3 className="section-block-title text-sm sm:text-base font-bold text-slate-200 mb-3 flex items-center gap-2 m-0">
                  <span aria-hidden="true">🎯</span> 3 Yếu tố dẫn dắt phiên hôm nay
                </h3>
                <ul className="drivers-list flex flex-col gap-2.5 m-0 pl-0 list-none">
                  {digest.key_drivers.map((driver, idx) => (
                    <li key={idx} className="driver-item flex items-start gap-3 text-xs sm:text-sm text-slate-300">
                      <span className="driver-num font-mono font-bold text-sky-400 bg-sky-950/80 border border-sky-800 px-2 py-0.5 rounded text-xs shrink-0">0{idx + 1}</span>
                      <p className="m-0 leading-relaxed">{driver}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Volume Breakouts & Gainers side by side */}
              <div className="digest-two-col grid md:grid-cols-2 gap-4">
                <div className="digest-col-box bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                  <h4 className="col-box-title text-xs sm:text-sm font-bold text-slate-200 mb-3 flex items-center gap-2 m-0 uppercase tracking-wider">
                    <span aria-hidden="true">⚡</span> Bùng nổ khối lượng đột biến
                  </h4>
                  <div className="col-ticker-list flex flex-col gap-2">
                    {digest.volume_breakouts.map((item) => (
                      <Link
                        key={item.symbol}
                        href={`/market/stocks/${item.symbol}`}
                        className="digest-ticker-row flex items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 transition no-underline text-xs"
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="ticker-badge-col flex items-center gap-2">
                          <strong className="text-white font-bold text-sm">{item.symbol}</strong>
                          <span className="volume-surge-tag text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">{item.surge_label}</span>
                        </div>
                        <div className="ticker-price-col text-right">
                          <span className="text-slate-300 block">{item.price} đ</span>
                          <span className="positive text-emerald-400 font-bold block">+{item.change_pct}%</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="digest-col-box bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                  <h4 className="col-box-title text-xs sm:text-sm font-bold text-slate-200 mb-3 flex items-center gap-2 m-0 uppercase tracking-wider">
                    <span aria-hidden="true">🚀</span> Cổ phiếu tăng giá mạnh nhất
                  </h4>
                  <div className="col-ticker-list flex flex-col gap-2">
                    {digest.gainers.map((item) => (
                      <Link
                        key={item.symbol}
                        href={`/market/stocks/${item.symbol}`}
                        className="digest-ticker-row flex items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 transition no-underline text-xs"
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="ticker-badge-col flex items-center gap-2">
                          <strong className="text-white font-bold text-sm">{item.symbol}</strong>
                          <span className="ticker-sector-tag text-[10px] text-slate-400 max-w-[100px] truncate">{item.sector}</span>
                        </div>
                        <div className="ticker-price-col text-right">
                          <span className="text-slate-300 block">{item.price} đ</span>
                          <span className="positive text-emerald-400 font-bold block">+{item.change_pct}%</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Upcoming Events / Catalysts */}
              {digest.upcoming_events.length > 0 && (
                <div className="digest-section-block bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                  <h3 className="section-block-title text-sm sm:text-base font-bold text-slate-200 mb-3 flex items-center gap-2 m-0">
                    <span aria-hidden="true">📅</span> Lịch sự kiện doanh nghiệp đáng chú ý
                  </h3>
                  <div className="catalyst-events-grid grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {digest.upcoming_events.map((ev, idx) => (
                      <div key={idx} className="catalyst-card bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5 text-xs">
                        <div className="catalyst-top flex items-center justify-between">
                          <span className="catalyst-symbol font-bold text-sky-400">{ev.symbol}</span>
                          <span className="catalyst-date text-slate-500 text-[11px]">{ev.date}</span>
                        </div>
                        <p className="catalyst-title text-slate-200 font-medium m-0 line-clamp-2 leading-tight">{ev.title}</p>
                        <span className="catalyst-type text-[10px] text-slate-400 mt-auto">{ev.event_type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <footer className="digest-modal-footer flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3 text-xs text-slate-500">
              <span className="footer-source">
                Nguồn: InvestIQ Market Intelligence Engine · Tự động tổng hợp lúc 15:30 hàng ngày
              </span>
              <button
                type="button"
                className="footer-close-btn px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition cursor-pointer"
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
