"use client";

import Link from "next/link";
import { useId } from "react";

import { changeTone, formatPercent } from "@/components/market/formatters";
import type { MarketCandle, MarketSector } from "@/types/market";

export function SectorHeatmap({ sectors: values, headingId }: { sectors: MarketSector[]; headingId: string }) {
  const sectors = values.slice(0, 16);
  const rows = Array.from(
    { length: Math.ceil(sectors.length / 8) },
    (_, index) => sectors.slice(index * 8, index * 8 + 8),
  );
  return (
    <section className="sector-heatmap bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm" aria-labelledby={headingId}>
      <div className="beginner-card-title flex items-center justify-between mb-3">
        <h2 id={headingId} className="text-lg md:text-xl font-bold text-slate-100 m-0">Ngành nào đang biến động mạnh?</h2>
        <InfoTip term="Bản đồ nhiệt">Diện tích ô tỷ lệ với độ lớn phần trăm tăng hoặc giảm bình quân có trọng số. Màu cho biết chiều biến động.</InfoTip>
      </div>
      <p className="text-xs md:text-sm text-slate-400 mb-4">Chọn một ô để mở bảng cổ phiếu đã lọc theo ngành đó.</p>
      {sectors.length ? (
        <div className="heatmap-grid flex flex-col gap-2.5 min-h-[220px]">
          {rows.map((row, rowIndex) => (
            <div className="heatmap-row flex flex-nowrap gap-2.5 overflow-x-auto pb-1 scrollbar-none" key={rowIndex}>
              {row.map((sector) => {
                const change = Number(sector.change_percent);
                const magnitude = Math.max(Math.abs(change), 0.05);
                const isPositive = change > 0;
                const isNegative = change < 0;
                return (
                  <Link
                    aria-label={`${sector.name}: ${formatPercent(sector.change_percent)}, mở thị trường ngành`}
                    className={`heatmap-tile ${changeTone(sector.change_percent)} flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 min-h-[96px] min-w-[110px] md:min-w-[125px] text-center hover:scale-[1.02] shadow-sm ${
                      isPositive
                        ? "bg-emerald-950/70 border-emerald-500/40 hover:border-emerald-400 text-emerald-100"
                        : isNegative
                          ? "bg-rose-950/70 border-rose-500/40 hover:border-rose-400 text-rose-100"
                          : "bg-amber-950/60 border-amber-500/30 hover:border-amber-400 text-amber-100"
                    }`}
                    href={`/market/stocks?sector=${encodeURIComponent(sector.name)}#stock-table`}
                    prefetch={false}
                    style={{ flexGrow: magnitude }}
                    key={sector.name}
                  >
                    <strong className="text-xs md:text-sm font-bold text-white line-clamp-2 max-w-full leading-tight drop-shadow-sm">{sector.name}</strong>
                    <span className="text-sm md:text-base font-extrabold tracking-wide my-1 drop-shadow-sm">{formatPercent(sector.change_percent)}</span>
                    <small className="text-[11px] opacity-80 whitespace-nowrap text-slate-200">{sector.member_count} mã</small>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="market-empty py-8 text-center text-slate-500">
          <p>Chưa có phân loại ngành trong dữ liệu hiện tại.</p>
        </div>
      )}
    </section>
  );
}

export function InfoTip({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <details className="market-info-tip relative inline-block text-xs">
      <summary aria-label={`Giải thích ${term}`} className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center cursor-pointer transition text-[11px] font-bold border border-slate-700 select-none">?</summary>
      <div className="absolute right-0 top-7 z-30 w-72 p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs shadow-2xl leading-relaxed">
        <strong className="text-sky-400 block mb-1">{term}:</strong>
        <div className="m-0 text-slate-300">{children}</div>
      </div>
    </details>
  );
}

export function MarketColorLegend() {
  return (
    <div className="market-color-legend flex flex-wrap items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 text-xs w-fit shadow-sm" aria-label="Chú giải màu bảng giá Việt Nam">
      <strong className="text-slate-200 font-semibold mr-1">Cách đọc màu:</strong>
      <span className="inline-flex items-center gap-1.5"><i className="legend-up w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_rgba(52,211,153,0.5)]" /> Xanh lá: tăng</span>
      <span className="inline-flex items-center gap-1.5"><i className="legend-down w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-[0_0_8px_rgba(244,63,94,0.5)]" /> Đỏ: giảm</span>
      <span className="inline-flex items-center gap-1.5"><i className="legend-reference w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-[0_0_8px_rgba(251,191,36,0.5)]" /> Vàng: tham chiếu</span>
      <span className="inline-flex items-center gap-1.5"><i className="legend-ceiling w-2.5 h-2.5 rounded-full bg-purple-400 inline-block shadow-[0_0_8px_rgba(192,132,252,0.5)]" /> Tím: giá trần</span>
      <span className="inline-flex items-center gap-1.5"><i className="legend-floor w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-[0_0_8px_rgba(34,211,238,0.5)]" /> Xanh dương: giá sàn</span>
    </div>
  );
}

export function MarketLineChart({ candles, label }: { candles: MarketCandle[]; label: string }) {
  const gradientId = useId().replaceAll(":", "");
  const values = candles.map((item) => Number(item.close)).filter(Number.isFinite);
  if (values.length < 2) return <div className="beginner-line-empty py-8 text-center text-xs text-slate-500">Chưa đủ dữ liệu để vẽ đường giá.</div>;
  const width = 720;
  const height = 230;
  const padding = 12;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = maximum - minimum || 1;
  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = padding + ((maximum - value) / spread) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const rising = values.at(-1)! >= values[0];
  const pathPoints = points.replaceAll(" ", " L ");
  return (
    <figure className={`beginner-line-chart w-full ${rising ? "rising text-emerald-400" : "falling text-rose-500"}`} aria-label={label}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" preserveAspectRatio="none" className="w-full h-auto overflow-visible">
        <title>{label}</title>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="line-area" style={{ fill: `url(#${gradientId})` }} d={`M ${pathPoints} L ${width - padding},${height} L ${padding},${height} Z`} />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <figcaption className="flex items-center justify-between text-xs text-slate-400 mt-2 px-1">
        <span>Thấp {minimum.toLocaleString("vi-VN")}</span>
        <span>Cao {maximum.toLocaleString("vi-VN")}</span>
      </figcaption>
    </figure>
  );
}

export function SentimentGauge({ score }: { score: number }) {
  const normalized = Math.max(0, Math.min(100, score));
  const label = normalized < 40 ? "Thận trọng" : normalized > 60 ? "Tích cực" : "Trung tính";
  return (
    <div className="sentiment-gauge bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm" aria-label={`Tâm lý phiên ước tính: ${label}, ${Math.round(normalized)} trên 100`}>
      <div className="gauge-track relative h-2.5 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
        <span className="absolute top-0 bottom-0 w-3 -ml-1.5 bg-sky-400 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.8)] transition-all duration-300" style={{ left: `${normalized}%` }} />
      </div>
      <div className="gauge-labels flex items-center justify-between text-xs text-slate-400 mb-2">
        <span className="text-rose-400 font-medium">Sợ hãi</span>
        <strong className="text-sm font-bold text-white px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700">{label}</strong>
        <span className="text-emerald-400 font-medium">Tham lam</span>
      </div>
      <small className="block text-[11px] text-slate-500 leading-normal text-center">Ước tính từ độ rộng và biến động phiên, không phải chỉ số Fear &amp; Greed chính thức.</small>
    </div>
  );
}
