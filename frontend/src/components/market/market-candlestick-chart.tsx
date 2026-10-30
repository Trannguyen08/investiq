"use client";

import { useEffect, useId, useRef, useState } from "react";

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

type TrendlinePoint = {
  absoluteIndex: number;
  price: number;
};

type Trendline = {
  id: string;
  p1: TrendlinePoint;
  p2: TrendlinePoint;
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
    return Object.values(values).slice(1).every((value) => Number.isFinite(value)) &&
      values.open > 0 &&
      values.high > 0 &&
      values.low > 0 &&
      values.close > 0
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

function calculateEMA(values: NumericCandle[], period: number): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null);
  if (values.length < period) return result;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i].close;
  let ema = sum / period;
  result[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i].close * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

function calculateRSI(values: NumericCandle[], period = 14): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null);
  if (values.length <= period) return result;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i].close - values[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i].close - values[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - 100 / (1 + rs);
    }
  }
  return result;
}

function calculateBollingerBands(
  values: NumericCandle[],
  period = 20,
  multiplier = 2,
): { upper: Array<number | null>; middle: Array<number | null>; lower: Array<number | null> } {
  const upper: Array<number | null> = [];
  const middle: Array<number | null> = [];
  const lower: Array<number | null> = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
      continue;
    }
    const window = values.slice(i - period + 1, i + 1);
    const mean = window.reduce((sum, item) => sum + item.close, 0) / period;
    const variance = window.reduce((sum, item) => sum + Math.pow(item.close - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    middle.push(mean);
    upper.push(mean + multiplier * stdDev);
    lower.push(mean - multiplier * stdDev);
  }
  return { upper, middle, lower };
}

function calculateMACD(
  values: NumericCandle[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): { macd: Array<number | null>; signal: Array<number | null>; histogram: Array<number | null> } {
  const fastEMA = calculateEMA(values, fast);
  const slowEMA = calculateEMA(values, slow);
  const macd: Array<number | null> = values.map((_, i) => {
    if (fastEMA[i] === null || slowEMA[i] === null) return null;
    return (fastEMA[i] as number) - (slowEMA[i] as number);
  });

  const signal: Array<number | null> = new Array(values.length).fill(null);
  const k = 2 / (signalPeriod + 1);
  let firstValid = -1;
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] !== null) {
      firstValid = i;
      break;
    }
  }

  if (firstValid >= 0 && macd.length - firstValid >= signalPeriod) {
    let sum = 0;
    for (let i = firstValid; i < firstValid + signalPeriod; i++) {
      sum += macd[i] as number;
    }
    let sig = sum / signalPeriod;
    signal[firstValid + signalPeriod - 1] = sig;

    for (let i = firstValid + signalPeriod; i < macd.length; i++) {
      sig = (macd[i] as number) * k + sig * (1 - k);
      signal[i] = sig;
    }
  }

  const histogram: Array<number | null> = values.map((_, i) => {
    if (macd[i] === null || signal[i] === null) return null;
    return (macd[i] as number) - (signal[i] as number);
  });

  return { macd, signal, histogram };
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

function areaPath(
  upper: Array<number | null>,
  lower: Array<number | null>,
  x: (index: number) => number,
  y: (value: number) => number,
): string {
  let upperPart = "";
  let lowerPart = "";
  let hasValid = false;

  upper.forEach((val, index) => {
    const lowVal = lower[index];
    if (val === null || lowVal === null) return;
    const px = x(index).toFixed(2);
    const pyUpper = y(val).toFixed(2);
    const pyLower = y(lowVal).toFixed(2);

    if (!hasValid) {
      upperPart = `M ${px} ${pyUpper}`;
      lowerPart = `L ${px} ${pyLower}`;
      hasValid = true;
    } else {
      upperPart += ` L ${px} ${pyUpper}`;
      lowerPart = ` L ${px} ${pyLower}` + lowerPart;
    }
  });

  return hasValid ? `${upperPart} ${lowerPart} Z` : "";
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

function axisLabel(timestamp: string, range: ChartRange | undefined, first: boolean, intraday: boolean) {
  const dt = marketDateTime(timestamp);
  const dayStr = String(dt.day).padStart(2, "0");
  const monthStr = String(dt.month).padStart(2, "0");
  const hourStr = String(dt.hour).padStart(2, "0");
  const minuteStr = String(dt.minute).padStart(2, "0");

  if (range === "day") {
    return `${dayStr}/${monthStr} ${hourStr}:${minuteStr}`;
  }
  if (range === "week" || range === "month") {
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
      if (!seen.has(key)) {
        seen.add(key);
        result.push(index);
      }
    });
    if (result.length >= 3 && result.length <= 7) {
      return result;
    }
  }
  const divisions = range === "month" ? 5 : 4;
  return [
    ...new Set(
      Array.from({ length: divisions + 1 }, (_, index) => Math.round(((values.length - 1) * index) / divisions)),
    ),
  ];
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
  const chartId = useId();
  const allValues = numericCandles(candles);
  const defaultStart = allValues.length >= 2 ? initialWindowStart(allValues, range) : 0;
  const rangeVisibleCount = Math.max(0, allValues.length - defaultStart);
  const maximumZoomCount = Math.min(
    allValues.length,
    Math.max(2, Math.floor(maximumCandles ?? allValues.length)),
  );
  const requestedMinimum =
    minimumCandles ?? Math.min(defaultMinimumVisibleCandles, rangeVisibleCount);
  const minimumZoomCount = Math.min(
    Math.max(2, Math.floor(requestedMinimum)),
    maximumZoomCount,
  );
  const initialVisibleCount = Math.max(
    minimumZoomCount,
    Math.min(rangeVisibleCount, maximumZoomCount),
  );
  const initialStart = Math.max(0, allValues.length - initialVisibleCount);

  // Viewport / Zoom State
  const [requestedStart, setRequestedStart] = useState(initialStart);
  const [requestedCount, setRequestedCount] = useState(initialVisibleCount);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Technical Indicators Toggles
  const [showBB, setShowBB] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);

  // Trendline Drawing Tool State
  const [isDrawingTrendline, setIsDrawingTrendline] = useState(false);
  const [drawingStart, setDrawingStart] = useState<TrendlinePoint | null>(null);
  const [drawingHover, setDrawingHover] = useState<TrendlinePoint | null>(null);
  const [trendlines, setTrendlines] = useState<Trendline[]>([]);

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
      const nextCount =
        changedCount === visibleCount
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

  // Layout Heights and Offsets
  const width = 1080;
  const mainPriceHeight = 330;
  const priceTop = 35;
  const priceBottom = priceTop + mainPriceHeight;
  const volumeTop = priceBottom + 25;
  const volumeBottom = volumeTop + 75;

  const rsiHeight = showRSI ? 85 : 0;
  const rsiTop = volumeBottom + 30;
  const rsiBottom = rsiTop + (showRSI ? 65 : 0);

  const macdHeight = showMACD ? 90 : 0;
  const macdTop = (showRSI ? rsiBottom + 30 : volumeBottom + 30);
  const macdBottom = macdTop + (showMACD ? 70 : 0);

  const axisY = (showMACD ? macdBottom : showRSI ? rsiBottom : volumeBottom) + 26;
  const totalSvgHeight = axisY + 20;

  const left = 18;
  const right = 94;
  const plotWidth = width - left - right;
  const slot = plotWidth / values.length;
  const bodyWidth = Math.max(1.8, Math.min(11, slot * 0.72));

  // Price calculations
  const rawLow = Math.min(...values.map((item) => item.low));
  const rawHigh = Math.max(...values.map((item) => item.high));
  const pricePadding = Math.max((rawHigh - rawLow) * 0.08, rawHigh * 0.002, 1);
  const minimum = rawLow - pricePadding;
  const maximum = rawHigh + pricePadding;
  const priceRange = maximum - minimum;
  const maxVolume = Math.max(...values.map((item) => item.volume), 1);

  const x = (index: number) => left + slot * index + slot / 2;
  const priceY = (value: number) => priceTop + ((maximum - value) / priceRange) * (priceBottom - priceTop);
  const volumeY = (value: number) => volumeBottom - (value / maxVolume) * (volumeBottom - volumeTop);

  // Technical Indicators
  const ma5 = movingAverage(values, 5);
  const ma20 = movingAverage(values, 20);
  const bb = calculateBollingerBands(values, 20, 2);
  const rsiValues = calculateRSI(values, 14);
  const macdData = calculateMACD(values, 12, 26, 9);

  // RSI scale
  const rsiY = (val: number) => rsiBottom - (val / 100) * (rsiBottom - rsiTop);

  // MACD scale
  const macdValidValues = [
    ...macdData.macd.filter((v): v is number => v !== null),
    ...macdData.signal.filter((v): v is number => v !== null),
    ...macdData.histogram.filter((v): v is number => v !== null),
  ];
  const maxMacdAbs = Math.max(...macdValidValues.map((v) => Math.abs(v)), 0.1) * 1.15;
  const macdZeroY = (macdTop + macdBottom) / 2;
  const macdY = (val: number) => macdZeroY - (val / maxMacdAbs) * ((macdBottom - macdTop) / 2);

  const latest = values.at(-1)!;
  const selected = selectedIndex === null ? null : values[selectedIndex];
  const displayed = selected ?? latest;
  const gridPrices = Array.from({ length: 5 }, (_, index) => maximum - (priceRange * index) / 4);
  const labelIndexes = axisIndexes(values, range);
  const intraday =
    range === "day" ||
    range === "week" ||
    (!range &&
      values.some(
        (item, index) =>
          index > 0 &&
          Math.abs(
            new Date(item.source.timestamp).getTime() -
              new Date(values[index - 1].source.timestamp).getTime(),
          ) < 20 * 60 * 60 * 1000,
      ));

  const changePercent = ((displayed.close - displayed.open) / displayed.open) * 100;
  const tooltipSide =
    selectedIndex !== null && selectedIndex > values.length * 0.66
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
  const zoomRangeLabel =
    range === "day"
      ? "ngày"
      : range === "week"
        ? "tuần"
        : range === "month"
          ? "tháng"
          : range === "year"
            ? "năm"
            : "snapshot";

  // Trendline Pointer Handlers
  const handleStageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingTrendline) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Convert click coordinates to candle index and price
    const svgX = (clickX / rect.width) * width;
    const svgY = (clickY / rect.height) * totalSvgHeight;

    const visibleIdx = Math.max(0, Math.min(values.length - 1, Math.floor((svgX - left) / slot)));
    const absIdx = windowStart + visibleIdx;
    const priceRatio = Math.max(0, Math.min(1, (svgY - priceTop) / (priceBottom - priceTop)));
    const priceVal = maximum - priceRatio * priceRange;

    if (!drawingStart) {
      setDrawingStart({ absoluteIndex: absIdx, price: priceVal });
    } else {
      setTrendlines((prev) => [
        ...prev,
        {
          id: `trendline-${Date.now()}`,
          p1: drawingStart,
          p2: { absoluteIndex: absIdx, price: priceVal },
        },
      ]);
      setDrawingStart(null);
      setDrawingHover(null);
      setIsDrawingTrendline(false);
    }
  };

  const handleStagePointerMoveForDrawing = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawingTrendline || !drawingStart) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const svgX = (mouseX / rect.width) * width;
    const svgY = (mouseY / rect.height) * totalSvgHeight;

    const visibleIdx = Math.max(0, Math.min(values.length - 1, Math.floor((svgX - left) / slot)));
    const absIdx = windowStart + visibleIdx;
    const priceRatio = Math.max(0, Math.min(1, (svgY - priceTop) / (priceBottom - priceTop)));
    const priceVal = maximum - priceRatio * priceRange;

    setDrawingHover({ absoluteIndex: absIdx, price: priceVal });
  };

  return (
    <div className="financial-candlestick-chart">
      {/* Top Technical Analysis Controls Toolbar */}
      <div className="technical-indicators-toolbar">
        <div className="indicator-group" role="group" aria-label="Chỉ báo phân tích kỹ thuật">
          <span className="toolbar-label">Chỉ báo:</span>
          <button
            type="button"
            className={`indicator-btn ${showBB ? "active" : ""}`}
            onClick={() => setShowBB(!showBB)}
          >
            <span className="indicator-color-dot dot-bb" />
            Bollinger Bands (20, 2)
          </button>
          <button
            type="button"
            className={`indicator-btn ${showRSI ? "active" : ""}`}
            onClick={() => setShowRSI(!showRSI)}
          >
            <span className="indicator-color-dot dot-rsi" />
            RSI (14)
          </button>
          <button
            type="button"
            className={`indicator-btn ${showMACD ? "active" : ""}`}
            onClick={() => setShowMACD(!showMACD)}
          >
            <span className="indicator-color-dot dot-macd" />
            MACD (12, 26, 9)
          </button>
        </div>

        <div className="trendline-group" role="group" aria-label="Công cụ vẽ biểu đồ">
          <button
            type="button"
            className={`trendline-btn ${isDrawingTrendline ? "active-drawing" : ""}`}
            onClick={() => {
              setIsDrawingTrendline(!isDrawingTrendline);
              setDrawingStart(null);
              setDrawingHover(null);
            }}
          >
            ✏️ {isDrawingTrendline ? (drawingStart ? "Bấm điểm kết thúc" : "Bấm điểm bắt đầu...") : "Vẽ Trendline"}
          </button>
          {trendlines.length > 0 && (
            <button
              type="button"
              className="trendline-clear-btn"
              onClick={() => {
                setTrendlines([]);
                setDrawingStart(null);
                setDrawingHover(null);
              }}
              title="Xóa tất cả các đường trendline đã vẽ"
            >
              🗑️ Xóa đường vẽ ({trendlines.length})
            </button>
          )}
        </div>
      </div>

      {/* Quote Bar */}
      <div className="financial-chart-quote" aria-live="polite">
        <span>
          {selected
            ? candleTime(selected.source.timestamp, intraday)
            : atPresent
              ? "Nến mới nhất"
              : "Nến cuối khung xem"}
        </span>
        <span>O <strong>{formatDecimal(displayed.source.open)}</strong></span>
        <span>H <strong>{formatDecimal(displayed.source.high)}</strong></span>
        <span>L <strong>{formatDecimal(displayed.source.low)}</strong></span>
        <span>C <strong>{formatDecimal(displayed.source.close)}</strong></span>
        <span>Vol <strong>{formatCompact(displayed.source.volume)}</strong></span>

        {showRSI && rsiValues.at(-1) !== null && (
          <span className="quote-indicator-pill rsi-pill">
            RSI(14): <strong>{rsiValues.at(-1)?.toFixed(1)}</strong>
          </span>
        )}
        {showMACD && macdData.macd.at(-1) !== null && (
          <span className="quote-indicator-pill macd-pill">
            MACD: <strong>{macdData.macd.at(-1)?.toFixed(2)}</strong> · Sig:{" "}
            <strong>{macdData.signal.at(-1)?.toFixed(2)}</strong>
          </span>
        )}
      </div>

      {/* Chart SVG Stage */}
      <div
        ref={stageRef}
        className={`financial-chart-stage${isDragging ? " dragging" : ""}${isDrawingTrendline ? " drawing-mode" : ""}`}
        onClick={handleStageClick}
        onPointerMove={handleStagePointerMoveForDrawing}
        onPointerDown={(event) => {
          if (isDrawingTrendline) return;
          if (event.button !== 0) return;
          suppressClick.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragState.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            windowStart,
            moved: false,
          };
          setIsDragging(true);
        }}
        onPointerMoveCapture={(event) => {
          if (isDrawingTrendline) return;
          const drag = dragState.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const delta = event.clientX - drag.startX;
          if (Math.abs(delta) > 4) drag.moved = true;
          const pixelsPerCandle = Math.max(
            event.currentTarget.getBoundingClientRect().width / visibleCount,
            4,
          );
          panTo(drag.windowStart - Math.round(delta / pixelsPerCandle));
        }}
        onPointerUp={(event) => {
          if (isDrawingTrendline) return;
          suppressClick.current = dragState.current?.moved ?? false;
          dragState.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          setIsDragging(false);
        }}
        onPointerCancel={() => {
          dragState.current = null;
          setIsDragging(false);
        }}
        onLostPointerCapture={() => {
          dragState.current = null;
          setIsDragging(false);
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${totalSvgHeight}`}
          role="img"
          aria-label={`${label}, ${values.length} nến giá`}
        >
          <defs>
            <linearGradient id={`bb-grad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Grid Lines */}
          <g className="financial-chart-grid">
            {gridPrices.map((price) => (
              <g key={price}>
                <line x1={left} x2={width - right} y1={priceY(price)} y2={priceY(price)} />
                <text x={width - right + 10} y={priceY(price) + 4}>
                  {formatDecimal(String(price))}
                </text>
              </g>
            ))}
            <line x1={left} x2={width - right} y1={volumeBottom} y2={volumeBottom} />
          </g>

          {/* Bollinger Bands Fill & Lines */}
          {showBB && (
            <g className="financial-chart-bb">
              <path
                className="bb-band-fill"
                d={areaPath(bb.upper, bb.lower, x, priceY)}
                fill={`url(#bb-grad-${chartId})`}
              />
              <path
                className="bb-band-line bb-upper"
                d={linePath(bb.upper, x, priceY)}
                stroke="#38bdf8"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <path
                className="bb-band-line bb-middle"
                d={linePath(bb.middle, x, priceY)}
                stroke="#f59e0b"
                strokeWidth="1.2"
              />
              <path
                className="bb-band-line bb-lower"
                d={linePath(bb.lower, x, priceY)}
                stroke="#38bdf8"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
            </g>
          )}

          {/* Volume Bars */}
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

          {/* Candlesticks */}
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

          {/* Moving Averages */}
          <path className="financial-chart-ma ma-short" d={linePath(ma5, x, priceY)} />
          <path className="financial-chart-ma ma-long" d={linePath(ma20, x, priceY)} />

          {/* Drawn Trendlines */}
          <g className="financial-chart-trendlines">
            {trendlines.map((tl) => {
              const x1 = x(tl.p1.absoluteIndex - windowStart);
              const y1 = priceY(tl.p1.price);
              const x2 = x(tl.p2.absoluteIndex - windowStart);
              const y2 = priceY(tl.p2.price);
              return (
                <g key={tl.id}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#38bdf8"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx={x1} cy={y1} r="3.5" fill="#0284c7" stroke="#ffffff" strokeWidth="1" />
                  <circle cx={x2} cy={y2} r="3.5" fill="#0284c7" stroke="#ffffff" strokeWidth="1" />
                </g>
              );
            })}

            {/* Active Drawing Trendline Preview */}
            {isDrawingTrendline && drawingStart && drawingHover && (
              <g className="trendline-preview">
                <line
                  x1={x(drawingStart.absoluteIndex - windowStart)}
                  y1={priceY(drawingStart.price)}
                  x2={x(drawingHover.absoluteIndex - windowStart)}
                  y2={priceY(drawingHover.price)}
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
                <circle
                  cx={x(drawingStart.absoluteIndex - windowStart)}
                  cy={priceY(drawingStart.price)}
                  r="4"
                  fill="#f59e0b"
                />
                <circle
                  cx={x(drawingHover.absoluteIndex - windowStart)}
                  cy={priceY(drawingHover.price)}
                  r="4"
                  fill="#f59e0b"
                />
              </g>
            )}
          </g>

          {/* Current Price Line & Tag */}
          <line
            className="financial-chart-current"
            x1={left}
            x2={width - right}
            y1={priceY(latest.close)}
            y2={priceY(latest.close)}
          />
          <g className={latest.close >= latest.open ? "financial-price-tag up" : "financial-price-tag down"}>
            <rect x={width - right + 4} y={priceY(latest.close) - 12} width={88} height={24} rx="4" />
            <text x={width - right + 48} y={priceY(latest.close) + 4}>
              {formatDecimal(latest.source.close)}
            </text>
          </g>

          {/* Crosshair */}
          {selectedIndex !== null && (
            <line
              className="financial-chart-crosshair"
              x1={x(selectedIndex)}
              x2={x(selectedIndex)}
              y1={priceTop}
              y2={showMACD ? macdBottom : showRSI ? rsiBottom : volumeBottom}
            />
          )}

          {/* RSI Sub-Chart */}
          {showRSI && (
            <g className="financial-chart-rsi-subchart">
              {/* RSI background zone 30 - 70 */}
              <rect
                x={left}
                y={rsiY(70)}
                width={plotWidth}
                height={rsiY(30) - rsiY(70)}
                fill="rgba(168, 85, 247, 0.08)"
              />
              <line x1={left} x2={width - right} y1={rsiY(70)} y2={rsiY(70)} stroke="#a855f7" strokeDasharray="3 3" strokeOpacity="0.5" />
              <line x1={left} x2={width - right} y1={rsiY(30)} y2={rsiY(30)} stroke="#a855f7" strokeDasharray="3 3" strokeOpacity="0.5" />
              <line x1={left} x2={width - right} y1={rsiBottom} y2={rsiBottom} stroke="#334155" />

              <text x={width - right + 8} y={rsiY(70) + 4} fill="#a855f7" fontSize="10">70 (Quá mua)</text>
              <text x={width - right + 8} y={rsiY(30) + 4} fill="#a855f7" fontSize="10">30 (Quá bán)</text>
              <text x={left + 6} y={rsiTop + 14} fill="#a855f7" fontSize="11" fontWeight="bold">RSI (14)</text>

              <path
                d={linePath(rsiValues, x, rsiY)}
                stroke="#c084fc"
                strokeWidth="1.8"
                fill="none"
              />
            </g>
          )}

          {/* MACD Sub-Chart */}
          {showMACD && (
            <g className="financial-chart-macd-subchart">
              <line x1={left} x2={width - right} y1={macdZeroY} y2={macdZeroY} stroke="#64748b" strokeDasharray="2 2" />
              <line x1={left} x2={width - right} y1={macdBottom} y2={macdBottom} stroke="#334155" />

              <text x={left + 6} y={macdTop + 14} fill="#38bdf8" fontSize="11" fontWeight="bold">MACD (12, 26, 9)</text>
              <text x={width - right + 8} y={macdZeroY + 4} fill="#94a3b8" fontSize="10">0.00</text>

              {/* Histogram bars */}
              {macdData.histogram.map((val, idx) => {
                if (val === null) return null;
                const isPos = val >= 0;
                const barTop = isPos ? macdY(val) : macdZeroY;
                const barHeight = Math.max(1, Math.abs(macdY(val) - macdZeroY));
                return (
                  <rect
                    key={`hist-${idx}`}
                    x={x(idx) - bodyWidth / 2}
                    y={barTop}
                    width={bodyWidth}
                    height={barHeight}
                    fill={isPos ? "#22c55e" : "#ef4444"}
                    opacity="0.85"
                  />
                );
              })}

              {/* MACD & Signal Lines */}
              <path d={linePath(macdData.macd, x, macdY)} stroke="#06b6d4" strokeWidth="1.8" fill="none" />
              <path d={linePath(macdData.signal, x, macdY)} stroke="#f97316" strokeWidth="1.5" fill="none" />
            </g>
          )}

          {/* Axis Labels */}
          <g className="financial-chart-axis">
            {labelIndexes.map((index, tickIndex) => (
              <text key={index} x={x(index)} y={axisY} textAnchor="middle">
                {axisLabel(values[index].source.timestamp, range, tickIndex === 0, intraday)}
              </text>
            ))}
          </g>
        </svg>

        {/* Hit Layer for hover & keyboard selection */}
        <div className="financial-chart-hit-layer">
          {values.map((item, index) => (
            <button
              type="button"
              className="financial-chart-hit-target"
              aria-label={`Xem nến ${candleLabel(item, intraday)}`}
              key={item.source.timestamp}
              style={{
                left: `${((left + slot * index) / width) * 100}%`,
                top: `${(priceTop / totalSvgHeight) * 100}%`,
                width: `${(slot / width) * 100}%`,
                height: `${((volumeBottom - priceTop) / totalSvgHeight) * 100}%`,
              }}
              onMouseEnter={() => !isDrawingTrendline && setSelectedIndex(index)}
              onMouseLeave={() => !isDrawingTrendline && setSelectedIndex(null)}
              onFocus={() => setSelectedIndex(index)}
              onBlur={() => setSelectedIndex(null)}
              onClick={() => {
                if (isDrawingTrendline) return;
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                setSelectedIndex((current) => (current === index ? null : index));
              }}
            />
          ))}
        </div>

        {/* Tooltip */}
        {selected && selectedIndex !== null && !isDrawingTrendline && (
          <aside
            className={`financial-chart-tooltip ${tooltipSide}`}
            style={{ left: `${(x(selectedIndex) / width) * 100}%` }}
            aria-label="Thông tin cây nến đang chọn"
          >
            <strong>{candleTime(selected.source.timestamp, intraday)}</strong>
            <dl>
              <div><dt>Mở</dt><dd>{formatDecimal(selected.source.open)}</dd></div>
              <div><dt>Cao</dt><dd>{formatDecimal(selected.source.high)}</dd></div>
              <div><dt>Thấp</dt><dd>{formatDecimal(selected.source.low)}</dd></div>
              <div><dt>Đóng</dt><dd>{formatDecimal(selected.source.close)}</dd></div>
              <div><dt>Khối lượng</dt><dd>{formatCompact(selected.source.volume)}</dd></div>
              <div>
                <dt>Trong nến</dt>
                <dd className={changePercent >= 0 ? "positive" : "negative"}>
                  {changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%
                </dd>
              </div>
              {showRSI && rsiValues[selectedIndex] !== null && (
                <div><dt>RSI(14)</dt><dd>{rsiValues[selectedIndex]?.toFixed(1)}</dd></div>
              )}
              {showMACD && macdData.macd[selectedIndex] !== null && (
                <div><dt>MACD</dt><dd>{macdData.macd[selectedIndex]?.toFixed(2)}</dd></div>
              )}
            </dl>
          </aside>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="financial-chart-navigation" aria-label="Điều hướng lịch sử biểu đồ">
        <button
          type="button"
          disabled={windowStart === 0}
          onClick={() => panTo(windowStart - panStep)}
        >
          ← Dữ liệu cũ hơn
        </button>
        <div className="financial-chart-navigation-help">
          <span>Kéo sang phải để xem quá khứ, kéo sang trái để trở về hiện tại.</span>
          {zoomEnabled && (
            <div className="financial-chart-zoom" role="group" aria-label={`Thu phóng biểu đồ ${zoomRangeLabel}`}>
              <button
                type="button"
                aria-label={`Phóng to biểu đồ ${zoomRangeLabel}`}
                disabled={visibleCount <= minimumZoomCount}
                onClick={() => zoomTo(Math.round(visibleCount * 0.82))}
              >
                ＋
              </button>
              <span>{visibleCount} nến</span>
              <button
                type="button"
                aria-label={`Thu nhỏ biểu đồ ${zoomRangeLabel}`}
                disabled={visibleCount >= maximumZoomCount}
                onClick={() => zoomTo(Math.round(visibleCount * 1.22))}
              >
                −
              </button>
              <small>Lăn con chuột trên biểu đồ để phóng to/thu nhỏ.</small>
            </div>
          )}
        </div>
        <button type="button" disabled={atPresent} onClick={() => panTo(maximumStart)}>
          Về hiện tại →
        </button>
      </div>

      {/* Legend */}
      <div className="financial-chart-legend">
        <span className="ma-short">MA5 {ma5.at(-1) === null ? "—" : formatDecimal(String(ma5.at(-1)))}</span>
        <span className="ma-long">MA20 {ma20.at(-1) === null ? "—" : formatDecimal(String(ma20.at(-1)))}</span>
        {showBB && (
          <span className="bb-legend" style={{ color: "#38bdf8" }}>
            BB(20, 2): {bb.upper.at(-1)?.toFixed(1)} / {bb.lower.at(-1)?.toFixed(1)}
          </span>
        )}
        {showRSI && (
          <span className="rsi-legend" style={{ color: "#c084fc" }}>
            RSI(14): {rsiValues.at(-1)?.toFixed(1)}
          </span>
        )}
        {showMACD && (
          <span className="macd-legend" style={{ color: "#06b6d4" }}>
            MACD: {macdData.macd.at(-1)?.toFixed(2)}
          </span>
        )}
        <span>{values.length} nến · Asia/Ho_Chi_Minh</span>
      </div>

      {explain && (
        <section className="financial-chart-guide" aria-label="Giải thích biểu đồ">
          <p><i className="candle" aria-hidden="true" /><span><strong>Nến xanh / đỏ:</strong> thân nến nối giá mở và đóng; râu nến cho biết giá cao nhất và thấp nhất trong khoảng thời gian.</span></p>
          <p><i className="ma-short" aria-hidden="true" /><span><strong>MA5 màu vàng:</strong> giá đóng cửa trung bình của 5 nến gần nhất, phản ứng nhanh với xu hướng ngắn hạn.</span></p>
          <p><i className="ma-long" aria-hidden="true" /><span><strong>MA20 màu xanh:</strong> giá đóng cửa trung bình của 20 nến gần nhất, mượt hơn để quan sát xu hướng dài hơn.</span></p>
          <p><i className="current" aria-hidden="true" /><span><strong>Đường ngang nét đứt:</strong> mức giá đóng cửa của nến cuối khung đang xem; các cột phía dưới là khối lượng giao dịch.</span></p>
        </section>
      )}

      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead><tr><th>Thời gian</th><th>Mở</th><th>Cao</th><th>Thấp</th><th>Đóng</th><th>Khối lượng</th></tr></thead>
          <tbody>
            {values.map((item) => (
              <tr key={item.source.timestamp}>
                <td>{item.source.timestamp}</td>
                <td>{item.source.open}</td>
                <td>{item.source.high}</td>
                <td>{item.source.low}</td>
                <td>{item.source.close}</td>
                <td>{item.source.volume}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
