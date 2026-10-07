import { formatCompact, formatDecimal } from "@/components/market/formatters";
import type { MarketCandle } from "@/types/market";

type NumericCandle = {
  source: MarketCandle;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function numericCandles(candles: MarketCandle[]): NumericCandle[] {
  return candles.slice(-80).flatMap((source) => {
    const values = {
      source,
      open: Number(source.open),
      high: Number(source.high),
      low: Number(source.low),
      close: Number(source.close),
      volume: Number(source.volume),
    };
    return Object.values(values).slice(1).every((value) => Number.isFinite(value))
      && values.open > 0
      && values.high > 0
      && values.low > 0
      && values.close > 0
      ? [values]
      : [];
  });
}

function movingAverage(values: NumericCandle[], period: number): Array<number | null> {
  return values.map((_, index) => {
    if (index < period - 1) return null;
    const window = values.slice(index - period + 1, index + 1);
    return window.reduce((sum, item) => sum + item.close, 0) / period;
  });
}

function linePath(
  values: Array<number | null>,
  x: (index: number) => number,
  y: (value: number) => number,
) {
  let path = "";
  let drawing = false;
  values.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    path += `${drawing ? " L" : "M"}${x(index).toFixed(2)} ${y(value).toFixed(2)}`;
    drawing = true;
  });
  return path;
}

function chartTime(timestamp: string, includeDate: boolean) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    ...(includeDate
      ? { day: "2-digit", month: "2-digit" }
      : { hour: "2-digit", minute: "2-digit" }),
  }).format(new Date(timestamp));
}

export function MarketCandlestickChart({
  candles,
  label,
}: {
  candles: MarketCandle[];
  label: string;
}) {
  const values = numericCandles(candles);
  if (values.length < 2) {
    return (
      <div className="financial-chart-empty">
        <strong>Chưa có đủ nến để vẽ biểu đồ</strong>
        <p>Biểu đồ sẽ xuất hiện khi nguồn dữ liệu trả ít nhất hai khoảng giá hợp lệ.</p>
      </div>
    );
  }

  const width = 1080;
  const height = 520;
  const left = 18;
  const right = 94;
  const priceTop = 35;
  const priceBottom = 356;
  const volumeTop = 386;
  const volumeBottom = 480;
  const plotWidth = width - left - right;
  const slot = plotWidth / values.length;
  const bodyWidth = Math.max(2.5, Math.min(11, slot * 0.58));
  const rawLow = Math.min(...values.map((item) => item.low));
  const rawHigh = Math.max(...values.map((item) => item.high));
  const pricePadding = Math.max((rawHigh - rawLow) * 0.08, rawHigh * 0.002, 1);
  const minimum = rawLow - pricePadding;
  const maximum = rawHigh + pricePadding;
  const priceRange = maximum - minimum;
  const maxVolume = Math.max(...values.map((item) => item.volume), 1);
  const x = (index: number) => left + slot * index + slot / 2;
  const priceY = (value: number) => priceTop + (maximum - value) / priceRange * (priceBottom - priceTop);
  const volumeY = (value: number) => volumeBottom - value / maxVolume * (volumeBottom - volumeTop);
  const ma5 = movingAverage(values, 5);
  const ma20 = movingAverage(values, 20);
  const latest = values.at(-1)!;
  const gridPrices = Array.from({ length: 5 }, (_, index) => maximum - priceRange * index / 4);
  const labelIndexes = [...new Set([0, Math.floor((values.length - 1) / 3), Math.floor((values.length - 1) * 2 / 3), values.length - 1])];
  const includeDate = values.some((item) => item.source.timestamp.slice(0, 10) !== values[0].source.timestamp.slice(0, 10));

  return (
    <div className="financial-candlestick-chart">
      <div className="financial-chart-quote" aria-hidden="true">
        <span>O <strong>{formatDecimal(latest.source.open)}</strong></span>
        <span>H <strong>{formatDecimal(latest.source.high)}</strong></span>
        <span>L <strong>{formatDecimal(latest.source.low)}</strong></span>
        <span>C <strong>{formatDecimal(latest.source.close)}</strong></span>
        <span>Vol <strong>{formatCompact(latest.source.volume)}</strong></span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}, ${values.length} nến giá xanh đỏ`}>
        <g className="financial-chart-grid">
          {gridPrices.map((price) => (
            <g key={price}>
              <line x1={left} x2={width - right} y1={priceY(price)} y2={priceY(price)} />
              <text x={width - right + 10} y={priceY(price) + 4}>{formatDecimal(String(price))}</text>
            </g>
          ))}
          <line x1={left} x2={width - right} y1={volumeBottom} y2={volumeBottom} />
        </g>
        <g className="financial-chart-volume">
          {values.map((item, index) => (
            <rect
              className={item.close >= item.open ? "up" : "down"}
              key={`volume-${item.source.timestamp}`}
              x={x(index) - bodyWidth / 2}
              y={volumeY(item.volume)}
              width={bodyWidth}
              height={Math.max(1, volumeBottom - volumeY(item.volume))}
            />
          ))}
        </g>
        <g className="financial-chart-candles">
          {values.map((item, index) => {
            const rising = item.close >= item.open;
            const top = priceY(Math.max(item.open, item.close));
            const bottom = priceY(Math.min(item.open, item.close));
            return (
              <g className={rising ? "up" : "down"} key={item.source.timestamp}>
                <line x1={x(index)} x2={x(index)} y1={priceY(item.high)} y2={priceY(item.low)} />
                <rect
                  x={x(index) - bodyWidth / 2}
                  y={top}
                  width={bodyWidth}
                  height={Math.max(1.5, bottom - top)}
                  rx="0.7"
                />
              </g>
            );
          })}
        </g>
        <path className="financial-chart-ma ma-short" d={linePath(ma5, x, priceY)} />
        <path className="financial-chart-ma ma-long" d={linePath(ma20, x, priceY)} />
        <line className="financial-chart-current" x1={left} x2={width - right} y1={priceY(latest.close)} y2={priceY(latest.close)} />
        <g className={latest.close >= latest.open ? "financial-price-tag up" : "financial-price-tag down"}>
          <rect x={width - right + 4} y={priceY(latest.close) - 12} width={88} height={24} rx="4" />
          <text x={width - right + 48} y={priceY(latest.close) + 4}>{formatDecimal(latest.source.close)}</text>
        </g>
        <g className="financial-chart-axis">
          {labelIndexes.map((index) => (
            <text key={index} x={x(index)} y={510} textAnchor="middle">
              {chartTime(values[index].source.timestamp, includeDate)}
            </text>
          ))}
        </g>
      </svg>
      <div className="financial-chart-legend">
        <span className="ma-short">MA5 {ma5.at(-1) === null ? "—" : formatDecimal(String(ma5.at(-1)))}</span>
        <span className="ma-long">MA20 {ma20.at(-1) === null ? "—" : formatDecimal(String(ma20.at(-1)))}</span>
        <span>Khối lượng · Asia/Ho_Chi_Minh</span>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th>Thời gian</th><th>Mở</th><th>Cao</th><th>Thấp</th><th>Đóng</th><th>Khối lượng</th></tr></thead>
        <tbody>{values.map((item) => <tr key={item.source.timestamp}><td>{item.source.timestamp}</td><td>{item.source.open}</td><td>{item.source.high}</td><td>{item.source.low}</td><td>{item.source.close}</td><td>{item.source.volume}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
