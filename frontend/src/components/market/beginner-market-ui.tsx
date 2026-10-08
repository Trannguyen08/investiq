"use client";

import Link from "next/link";
import { useId } from "react";

import { changeTone, formatPercent } from "@/components/market/formatters";
import type { MarketCandle, MarketSector } from "@/types/market";

export function SectorHeatmap({ sectors: values, headingId }: { sectors: MarketSector[]; headingId: string }) {
  const sectors = values.slice(0, 16);
  const totalMove = sectors.reduce((sum, sector) => sum + Math.max(Math.abs(Number(sector.change_percent)), 0.05), 0) || 1;
  return (
    <section className="sector-heatmap" aria-labelledby={headingId}>
      <div className="beginner-card-title">
        <h2 id={headingId}>Ngành nào đang biến động mạnh?</h2>
        <InfoTip term="Bản đồ nhiệt">Diện tích ô tỷ lệ với độ lớn phần trăm tăng hoặc giảm bình quân có trọng số. Màu cho biết chiều biến động.</InfoTip>
      </div>
      <p>Chọn một ô để mở bảng cổ phiếu đã lọc theo ngành đó.</p>
      {sectors.length ? <div className="heatmap-grid">
        {sectors.map((sector) => {
          const change = Number(sector.change_percent);
          const magnitude = Math.max(Math.abs(change), 0.05);
          const relativeWidth = magnitude / totalMove * 100;
          return <Link
            aria-label={`${sector.name}: ${formatPercent(sector.change_percent)}, mở thị trường ngành`}
            className={changeTone(sector.change_percent)}
            href={`/market/stocks?sector=${encodeURIComponent(sector.name)}`}
            prefetch={false}
            style={{ flexGrow: magnitude, flexBasis: `${Math.max(12, relativeWidth)}%` }}
            key={sector.name}
          >
            <strong>{sector.name}</strong>
            <span>{formatPercent(sector.change_percent)}</span>
            <small>{sector.member_count} mã</small>
          </Link>;
        })}
      </div> : <div className="market-empty"><p>Chưa có phân loại ngành trong dữ liệu hiện tại.</p></div>}
    </section>
  );
}

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
