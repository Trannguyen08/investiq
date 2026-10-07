"use client";

import { useId } from "react";

import type { MarketCandle } from "@/types/market";

export function InfoTip({ term, children }: { term: string; children: string }) {
  return (
    <details className="market-info-tip">
      <summary aria-label={`Giải thích ${term}`}>?</summary>
      <p><strong>{term}:</strong> {children}</p>
    </details>
  );
}

export function MarketColorLegend() {
  return (
    <div className="market-color-legend" aria-label="Chú giải màu bảng giá Việt Nam">
      <strong>Cách đọc màu:</strong>
      <span><i className="legend-up" /> Xanh lá: tăng</span>
      <span><i className="legend-down" /> Đỏ: giảm</span>
      <span><i className="legend-reference" /> Vàng: tham chiếu</span>
      <span><i className="legend-ceiling" /> Tím: giá trần</span>
      <span><i className="legend-floor" /> Xanh dương: giá sàn</span>
    </div>
  );
}

export function MarketLineChart({ candles, label }: { candles: MarketCandle[]; label: string }) {
  const gradientId = useId().replaceAll(":", "");
  const values = candles.map((item) => Number(item.close)).filter(Number.isFinite);
  if (values.length < 2) return <div className="beginner-line-empty">Chưa đủ dữ liệu để vẽ đường giá.</div>;
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
    <figure className={`beginner-line-chart ${rising ? "rising" : "falling"}`} aria-label={label}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" preserveAspectRatio="none">
        <title>{label}</title>
        <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.28" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
        <path className="line-area" style={{ fill: `url(#${gradientId})` }} d={`M ${pathPoints} L ${width - padding},${height} L ${padding},${height} Z`} />
        <polyline points={points} />
      </svg>
      <figcaption><span>Thấp {minimum.toLocaleString("vi-VN")}</span><span>Cao {maximum.toLocaleString("vi-VN")}</span></figcaption>
    </figure>
  );
}

export function SentimentGauge({ score }: { score: number }) {
  const normalized = Math.max(0, Math.min(100, score));
  const label = normalized < 40 ? "Thận trọng" : normalized > 60 ? "Tích cực" : "Trung tính";
  return (
    <div className="sentiment-gauge" aria-label={`Tâm lý phiên ước tính: ${label}, ${Math.round(normalized)} trên 100`}>
      <div className="gauge-track"><span style={{ left: `${normalized}%` }} /></div>
      <div className="gauge-labels"><span>Sợ hãi</span><strong>{label}</strong><span>Tham lam</span></div>
      <small>Ước tính từ độ rộng và biến động phiên, không phải chỉ số Fear &amp; Greed chính thức.</small>
    </div>
  );
}
