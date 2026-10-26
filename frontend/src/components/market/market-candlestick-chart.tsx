"use client";

import { useEffect, useRef, useState } from "react";

import { formatCompact, formatDecimal } from "@/components/market/formatters";
import type { MarketCandle } from "@/types/market";

type ChartRange = "day" | "week" | "month" | "year";

type NumericCandle = {
  source: MarketCandle;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  windowStart: number;
  moved: boolean;
};

type ZoomWindow = {
  count: number;
  start: number;
};

const defaultMinimumVisibleCandles = 10;

export const MARKET_OVERVIEW_INDEX_CHART_LIMITS = {
  minimum: 50,
  maximum: 120,
} as const;

export const INDEX_DETAIL_CHART_LIMITS = {
  minimum: 70,
  maximum: 170,
} as const;

const marketDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function numericCandles(candles: MarketCandle[]): NumericCandle[] {
  return candles.flatMap((source) => {
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

function marketDate(timestamp: string) {
  const parts = Object.fromEntries(
    marketDateFormatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function marketDateSerial(timestamp: string) {
  const value = marketDate(timestamp);
  return Date.UTC(value.year, value.month - 1, value.day);
}

function initialWindowStart(values: NumericCandle[], range?: ChartRange) {
  if (!range) return Math.max(0, values.length - 80);
  const latest = marketDate(values.at(-1)!.source.timestamp);
  const latestSerial = Date.UTC(latest.year, latest.month - 1, latest.day);
  let cutoff = latestSerial;
  if (range === "week") cutoff = latestSerial - 7 * 24 * 60 * 60 * 1000;
  if (range === "month") cutoff = Date.UTC(latest.year, latest.month - 2, 1);
  if (range === "year") cutoff = Date.UTC(latest.year - 1, latest.month - 1, 1);
  const found = values.findIndex((item) => marketDateSerial(item.source.timestamp) >= cutoff);
  return Math.min(found < 0 ? Math.max(0, values.length - 2) : found, Math.max(0, values.length - 2));
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

function nextZoomWindow({
  nextCount,
  anchorRatio,
  minimumCount,
  maximumCount,
  visibleCount,
  windowStart,
  totalCount,
}: {
  nextCount: number;
  anchorRatio: number;
  minimumCount: number;
  maximumCount: number;
  visibleCount: number;
  windowStart: number;
  totalCount: number;
}): ZoomWindow | null {
  const count = Math.max(minimumCount, Math.min(nextCount, maximumCount));
  if (count === visibleCount) return null;
  const ratio = Math.max(0, Math.min(anchorRatio, 1));
  const anchorIndex = windowStart + (visibleCount - 1) * ratio;
  const maximumStart = Math.max(0, totalCount - count);
  const start = Math.round(anchorIndex - (count - 1) * ratio);
  return { count, start: Math.max(0, Math.min(start, maximumStart)) };
}

function marketDateTime(timestamp: string) {
  const date = new Date(timestamp);
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const vn = new Date(utc + 7 * 3600000);
  return {
    year: vn.getFullYear(),
    month: vn.getMonth() + 1,
    day: vn.getDate(),
    hour: vn.getHours(),
    minute: vn.getMinutes(),
  };
}

function shortDate(timestamp: string) {
  const dt = marketDateTime(timestamp);
  return `${String(dt.day).padStart(2, "0")}/${String(dt.month).padStart(2, "0")}`;
}

function axisLabel(timestamp: string, range: ChartRange | undefined, first: boolean, intraday: boolean) {
  const dt = marketDateTime(timestamp);
  const dayStr = String(dt.day).padStart(2, "0");
  const monthStr = String(dt.month).padStart(2, "0");
  const hourStr = String(dt.hour).padStart(2, "0");
  const minuteStr = String(dt.minute).padStart(2, "0");

  if (range === "day") {
    return `${dayStr}/${monthStr} ${hourStr}:${minuteStr}`;
  }
  if (range === "week") {
    return `${dayStr}/${monthStr}`;
  }
  if (range === "month") {
    return `${dayStr}/${monthStr}`;
  }
  if (range === "year") {
    if (dt.month === 1) return String(dt.year);
    return first ? `T${dt.month}/${dt.year}` : `T${dt.month}`;
  }
  if (intraday) {
    return `${dayStr}/${monthStr} ${hourStr}:${minuteStr}`;
  }
  return `${dayStr}/${monthStr}`;
}

function axisIndexes(values: NumericCandle[], range?: ChartRange) {
  if (range === "year") {
    const seen = new Set<string>();
    const result: number[] = [];
    values.forEach((item, index) => {
      const date = marketDate(item.source.timestamp);
      const key = `${date.year}-${date.month}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (index === 0 || date.month % 2 === 1) result.push(index);
    });
    const last = values.length - 1;
    if (!result.includes(last)) result.push(last);
    return result;
  }
  if (range === "week") {
    const seenDays = new Set<string>();
    const result: number[] = [];
    values.forEach((item, index) => {
      const dt = marketDateTime(item.source.timestamp);
      const key = `${dt.year}-${dt.month}-${dt.day}`;
      if (!seenDays.has(key)) {
        seenDays.add(key);
        result.push(index);
      }
    });
    if (result.length >= 3 && result.length <= 7) {
      return result;
    }
  }
  const divisions = range === "month" ? 5 : 4;
  return [...new Set(Array.from(
    { length: divisions + 1 },
    (_, index) => Math.round((values.length - 1) * index / divisions),
  ))];
}

function candleTime(timestamp: string, intraday: boolean) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "medium",
    ...(intraday ? { timeStyle: "short" as const } : {}),
  }).format(new Date(timestamp));
}

function candleLabel(item: NumericCandle, intraday: boolean) {
  const direction = item.close >= item.open ? "tăng" : "giảm";
  return `${candleTime(item.source.timestamp, intraday)}: mở ${formatDecimal(item.source.open)}, cao ${formatDecimal(item.source.high)}, thấp ${formatDecimal(item.source.low)}, đóng ${formatDecimal(item.source.close)}, khối lượng ${formatCompact(item.source.volume)}, nến ${direction}`;
}

export function MarketCandlestickChart({
  candles,
  label,
  explain = false,
  maximumCandles,
  minimumCandles,
  range,
}: {
  candles: MarketCandle[];
  label: string;
  explain?: boolean;
  maximumCandles?: number;
  minimumCandles?: number;
  range?: ChartRange;
}) {
  const allValues = numericCandles(candles);
  const defaultStart = allValues.length >= 2 ? initialWindowStart(allValues, range) : 0;
  const rangeVisibleCount = Math.max(0, allValues.length - defaultStart);
  const maximumZoomCount = Math.min(
    allValues.length,
    Math.max(2, Math.floor(maximumCandles ?? allValues.length)),
  );
  const requestedMinimum = minimumCandles
    ?? Math.min(defaultMinimumVisibleCandles, rangeVisibleCount);
  const minimumZoomCount = Math.min(
    Math.max(2, Math.floor(requestedMinimum)),
    maximumZoomCount,
  );
  const initialVisibleCount = Math.max(
    minimumZoomCount,
    Math.min(rangeVisibleCount, maximumZoomCount),
  );
  const initialStart = Math.max(0, allValues.length - initialVisibleCount);
  const [requestedStart, setRequestedStart] = useState(initialStart);
  const [requestedCount, setRequestedCount] = useState(initialVisibleCount);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const zoomEnabled = maximumZoomCount > minimumZoomCount;
  const visibleCount = zoomEnabled
    ? Math.max(minimumZoomCount, Math.min(requestedCount, maximumZoomCount))
    : maximumZoomCount;
  const maximumStart = Math.max(0, allValues.length - visibleCount);
  const windowStart = Math.max(0, Math.min(requestedStart, maximumStart));
  const values = allValues.slice(windowStart, windowStart + visibleCount);

  const zoomTo = (nextCount: number, anchorRatio = 0.5) => {
    if (!zoomEnabled) return;
    const next = nextZoomWindow({
      nextCount,
      anchorRatio,
      minimumCount: minimumZoomCount,
      maximumCount: maximumZoomCount,
      visibleCount,
      windowStart,
      totalCount: allValues.length,
    });
    if (!next) return;
    setRequestedCount(next.count);
    setRequestedStart(next.start);
    setSelectedIndex(null);
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !zoomEnabled) return;
    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      event.stopPropagation();
      const bounds = stage.getBoundingClientRect();
      const anchor = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0.5;
      const factor = event.deltaY < 0 ? 0.82 : 1.22;
      const changedCount = Math.round(visibleCount * factor);
      const nextCount = changedCount === visibleCount
        ? visibleCount + (event.deltaY < 0 ? -1 : 1)
        : changedCount;
      const next = nextZoomWindow({
        nextCount,
        anchorRatio: anchor,
        minimumCount: minimumZoomCount,
        maximumCount: maximumZoomCount,
        visibleCount,
        windowStart,
        totalCount: allValues.length,
      });
      if (!next) return;
      setRequestedCount(next.count);
      setRequestedStart(next.start);
      setSelectedIndex(null);
    };
    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [allValues.length, maximumZoomCount, minimumZoomCount, visibleCount, windowStart, zoomEnabled]);

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
  const bodyWidth = Math.max(1.8, Math.min(11, slot * 0.72));
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
  const selected = selectedIndex === null ? null : values[selectedIndex];
  const displayed = selected ?? latest;
  const gridPrices = Array.from({ length: 5 }, (_, index) => maximum - priceRange * index / 4);
  const labelIndexes = axisIndexes(values, range);
  const intraday = range === "day" || range === "week" || (!range && values.some((item, index) => index > 0
    && Math.abs(new Date(item.source.timestamp).getTime() - new Date(values[index - 1].source.timestamp).getTime()) < 20 * 60 * 60 * 1000));
  const changePercent = (displayed.close - displayed.open) / displayed.open * 100;
  const tooltipSide = selectedIndex !== null && selectedIndex > values.length * 0.66
    ? "right"
    : selectedIndex !== null && selectedIndex < values.length * 0.33
      ? "left"
      : "center";
  const atPresent = windowStart === maximumStart;

  const panTo = (next: number) => {
    setRequestedStart(Math.max(0, Math.min(next, maximumStart)));
    setSelectedIndex(null);
  };
  const panStep = Math.max(1, Math.round(visibleCount * 0.2));
  const zoomRangeLabel = range === "day"
    ? "ngày"
    : range === "week"
      ? "tuần"
      : range === "month"
        ? "tháng"
        : range === "year"
          ? "năm"
          : "snapshot";

  return (
    <div className="financial-candlestick-chart">
      <div className="financial-chart-quote" aria-live="polite">
        <span>{selected ? candleTime(selected.source.timestamp, intraday) : atPresent ? "Nến mới nhất" : "Nến cuối khung xem"}</span>
        <span>O <strong>{formatDecimal(displayed.source.open)}</strong></span>
        <span>H <strong>{formatDecimal(displayed.source.high)}</strong></span>
        <span>L <strong>{formatDecimal(displayed.source.low)}</strong></span>
        <span>C <strong>{formatDecimal(displayed.source.close)}</strong></span>
        <span>Vol <strong>{formatCompact(displayed.source.volume)}</strong></span>
      </div>
      <div
        ref={stageRef}
        className={`financial-chart-stage${isDragging ? " dragging" : ""}`}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          suppressClick.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragState.current = { pointerId: event.pointerId, startX: event.clientX, windowStart, moved: false };
          setIsDragging(true);
        }}
        onPointerMove={(event) => {
          const drag = dragState.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const delta = event.clientX - drag.startX;
          if (Math.abs(delta) > 4) drag.moved = true;
          const pixelsPerCandle = Math.max(event.currentTarget.getBoundingClientRect().width / visibleCount, 4);
          panTo(drag.windowStart - Math.round(delta / pixelsPerCandle));
        }}
        onPointerUp={(event) => {
          suppressClick.current = dragState.current?.moved ?? false;
          dragState.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          setIsDragging(false);
        }}
        onPointerCancel={() => {
          suppressClick.current = dragState.current?.moved ?? false;
          dragState.current = null;
          setIsDragging(false);
        }}
        onLostPointerCapture={() => {
          dragState.current = null;
          setIsDragging(false);
        }}
      >
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}, ${values.length} nến giá xanh đỏ`}>
          <g className="financial-chart-grid">
            {gridPrices.map((price) => <g key={price}>
              <line x1={left} x2={width - right} y1={priceY(price)} y2={priceY(price)} />
              <text x={width - right + 10} y={priceY(price) + 4}>{formatDecimal(String(price))}</text>
            </g>)}
            <line x1={left} x2={width - right} y1={volumeBottom} y2={volumeBottom} />
          </g>
          <g className="financial-chart-volume">{values.map((item, index) => <rect
            className={item.close >= item.open ? "up" : "down"}
            key={`volume-${item.source.timestamp}`}
            x={x(index) - bodyWidth / 2}
            y={volumeY(item.volume)}
            width={bodyWidth}
            height={Math.max(1, volumeBottom - volumeY(item.volume))}
          />)}</g>
          <g className="financial-chart-candles">{values.map((item, index) => {
            const rising = item.close >= item.open;
            const top = priceY(Math.max(item.open, item.close));
            const bottom = priceY(Math.min(item.open, item.close));
            return <g className={rising ? "up" : "down"} key={item.source.timestamp}>
              <line x1={x(index)} x2={x(index)} y1={priceY(item.high)} y2={priceY(item.low)} />
              <rect x={x(index) - bodyWidth / 2} y={top} width={bodyWidth} height={Math.max(1.5, bottom - top)} rx="0.7" />
            </g>;
          })}</g>
          <path className="financial-chart-ma ma-short" d={linePath(ma5, x, priceY)} />
          <path className="financial-chart-ma ma-long" d={linePath(ma20, x, priceY)} />
          <line className="financial-chart-current" x1={left} x2={width - right} y1={priceY(latest.close)} y2={priceY(latest.close)} />
          <g className={latest.close >= latest.open ? "financial-price-tag up" : "financial-price-tag down"}>
            <rect x={width - right + 4} y={priceY(latest.close) - 12} width={88} height={24} rx="4" />
            <text x={width - right + 48} y={priceY(latest.close) + 4}>{formatDecimal(latest.source.close)}</text>
          </g>
          {selectedIndex !== null && <line className="financial-chart-crosshair" x1={x(selectedIndex)} x2={x(selectedIndex)} y1={priceTop} y2={volumeBottom} />}
          <g className="financial-chart-axis">{labelIndexes.map((index, tickIndex) => <text key={index} x={x(index)} y={510} textAnchor="middle">
            {axisLabel(values[index].source.timestamp, range, tickIndex === 0, intraday)}
          </text>)}</g>
        </svg>
        <div className="financial-chart-hit-layer">{values.map((item, index) => <button
          type="button"
          className="financial-chart-hit-target"
          aria-label={`Xem nến ${candleLabel(item, intraday)}`}
          key={item.source.timestamp}
          style={{
            left: `${(left + slot * index) / width * 100}%`,
            top: `${priceTop / height * 100}%`,
            width: `${slot / width * 100}%`,
            height: `${(volumeBottom - priceTop) / height * 100}%`,
          }}
          onMouseEnter={() => setSelectedIndex(index)}
          onMouseLeave={() => setSelectedIndex(null)}
          onFocus={() => setSelectedIndex(index)}
          onBlur={() => setSelectedIndex(null)}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            setSelectedIndex((current) => current === index ? null : index);
          }}
        />)}</div>
        {selected && selectedIndex !== null && <aside
          className={`financial-chart-tooltip ${tooltipSide}`}
          style={{ left: `${x(selectedIndex) / width * 100}%` }}
          aria-label="Thông tin cây nến đang chọn"
        >
          <strong>{candleTime(selected.source.timestamp, intraday)}</strong>
          <dl>
            <div><dt>Mở</dt><dd>{formatDecimal(selected.source.open)}</dd></div>
            <div><dt>Cao</dt><dd>{formatDecimal(selected.source.high)}</dd></div>
            <div><dt>Thấp</dt><dd>{formatDecimal(selected.source.low)}</dd></div>
            <div><dt>Đóng</dt><dd>{formatDecimal(selected.source.close)}</dd></div>
            <div><dt>Khối lượng</dt><dd>{formatCompact(selected.source.volume)}</dd></div>
            <div><dt>Trong nến</dt><dd className={changePercent >= 0 ? "positive" : "negative"}>{changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%</dd></div>
          </dl>
        </aside>}
      </div>
      <div className="financial-chart-navigation" aria-label="Điều hướng lịch sử biểu đồ">
        <button type="button" disabled={windowStart === 0} onClick={() => panTo(windowStart - panStep)}>← Dữ liệu cũ hơn</button>
        <div className="financial-chart-navigation-help">
          <span>Kéo sang phải để xem quá khứ, kéo sang trái để trở về hiện tại.</span>
          {zoomEnabled && <div className="financial-chart-zoom" role="group" aria-label={`Thu phóng biểu đồ ${zoomRangeLabel}`}>
            <button type="button" aria-label={`Phóng to biểu đồ ${zoomRangeLabel}`} disabled={visibleCount <= minimumZoomCount} onClick={() => zoomTo(Math.round(visibleCount * 0.82))}>＋</button>
            <span>{visibleCount} nến</span>
            <button type="button" aria-label={`Thu nhỏ biểu đồ ${zoomRangeLabel}`} disabled={visibleCount >= maximumZoomCount} onClick={() => zoomTo(Math.round(visibleCount * 1.22))}>−</button>
            <small>Lăn con chuột trên biểu đồ để phóng to/thu nhỏ.</small>
          </div>}
        </div>
        <button type="button" disabled={atPresent} onClick={() => panTo(maximumStart)}>Về hiện tại →</button>
      </div>
      <div className="financial-chart-legend">
        <span className="ma-short">MA5 {ma5.at(-1) === null ? "—" : formatDecimal(String(ma5.at(-1)))}</span>
        <span className="ma-long">MA20 {ma20.at(-1) === null ? "—" : formatDecimal(String(ma20.at(-1)))}</span>
        <span>{values.length} nến · Asia/Ho_Chi_Minh</span>
      </div>
      {explain && <section className="financial-chart-guide" aria-label="Giải thích biểu đồ">
        <p><i className="candle" aria-hidden="true" /><span><strong>Nến xanh / đỏ:</strong> thân nến nối giá mở và đóng; râu nến cho biết giá cao nhất và thấp nhất trong khoảng thời gian.</span></p>
        <p><i className="ma-short" aria-hidden="true" /><span><strong>MA5 màu vàng:</strong> giá đóng cửa trung bình của 5 nến gần nhất, phản ứng nhanh với xu hướng ngắn hạn.</span></p>
        <p><i className="ma-long" aria-hidden="true" /><span><strong>MA20 màu xanh:</strong> giá đóng cửa trung bình của 20 nến gần nhất, mượt hơn để quan sát xu hướng dài hơn.</span></p>
        <p><i className="current" aria-hidden="true" /><span><strong>Đường ngang nét đứt:</strong> mức giá đóng cửa của nến cuối khung đang xem; các cột phía dưới là khối lượng giao dịch của từng nến.</span></p>
      </section>}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead><tr><th>Thời gian</th><th>Mở</th><th>Cao</th><th>Thấp</th><th>Đóng</th><th>Khối lượng</th></tr></thead>
          <tbody>{values.map((item) => <tr key={item.source.timestamp}><td>{item.source.timestamp}</td><td>{item.source.open}</td><td>{item.source.high}</td><td>{item.source.low}</td><td>{item.source.close}</td><td>{item.source.volume}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
