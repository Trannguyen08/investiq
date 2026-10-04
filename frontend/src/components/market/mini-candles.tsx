import type { MarketCandle } from "@/types/market";

export function MiniCandles({ candles, label }: { candles: MarketCandle[]; label: string }) {
  const values = candles.slice(-24);
  if (!values.length) return <div className="mini-chart-empty">Chưa có dữ liệu nến</div>;
  const lows = values.map((item) => Number(item.low));
  const highs = values.map((item) => Number(item.high));
  const minimum = Math.min(...lows);
  const maximum = Math.max(...highs);
  const range = maximum - minimum || 1;
  const width = 240;
  const height = 72;
  const slot = width / values.length;
  const y = (value: number) => 4 + ((maximum - value) / range) * (height - 8);

  return (
    <svg className="mini-candles" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {values.map((item, index) => {
        const opened = Number(item.open);
        const closed = Number(item.close);
        const x = index * slot + slot / 2;
        const top = y(Math.max(opened, closed));
        const bottom = y(Math.min(opened, closed));
        const tone = closed >= opened ? "up" : "down";
        return (
          <g className={tone} key={item.timestamp}>
            <line x1={x} x2={x} y1={y(Number(item.high))} y2={y(Number(item.low))} />
            <rect x={x - Math.max(1.8, slot * 0.23)} y={top} width={Math.max(3.6, slot * 0.46)} height={Math.max(1.5, bottom - top)} rx="0.5" />
          </g>
        );
      })}
    </svg>
  );
}

