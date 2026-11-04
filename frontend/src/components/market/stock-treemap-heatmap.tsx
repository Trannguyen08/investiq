"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { changeTone, formatMoney, formatPercent } from "@/components/market/formatters";
import type { MarketInstrument, MarketSector } from "@/types/market";

type SizeMetric = "market_cap" | "matched_value";

type TreemapRect<T> = {
  item: T;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Squarified Treemap layout algorithm (Bruls, Huizing, van Wijk)
export function computeSquarifiedTreemap<T>(
  rawItems: Array<{ item: T; value: number }>,
  width = 1000,
  height = 600
): Array<TreemapRect<T>> {
  const items = rawItems
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = items.reduce((sum, i) => sum + i.value, 0);
  if (total <= 0 || items.length === 0) return [];

  const normalized = items.map((i) => ({
    data: i.item,
    area: (i.value / total) * width * height,
  }));

  const rects: Array<TreemapRect<T>> = [];

  function worst(row: Array<{ data: T; area: number }>, side: number) {
    const s2 = side * side;
    const rArea = row.reduce((sum, item) => sum + item.area, 0);
    const r2 = rArea * rArea;
    let maxAspect = 0;
    for (const item of row) {
      const aspect = Math.max((s2 * item.area) / r2, r2 / (s2 * item.area));
      if (aspect > maxAspect) maxAspect = aspect;
    }
    return maxAspect;
  }

  function recurse(
    remaining: Array<{ data: T; area: number }>,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    if (remaining.length === 0) return;
    if (w <= 0 || h <= 0) return;

    if (remaining.length === 1) {
      rects.push({
        item: remaining[0].data,
        x: (x / width) * 100,
        y: (y / height) * 100,
        width: (w / width) * 100,
        height: (h / height) * 100,
      });
      return;
    }

    // Shorter side determines row placement direction
    const alongWidth = w < h;
    const side = alongWidth ? w : h;

    let row = [remaining[0]];
    let i = 1;

    while (i < remaining.length) {
      const nextRow = [...row, remaining[i]];
      if (worst(nextRow, side) <= worst(row, side)) {
        row = nextRow;
        i++;
      } else {
        break;
      }
    }

    const rowArea = row.reduce((sum, item) => sum + item.area, 0);
    const thickness = rowArea / side;
    let offset = 0;

    for (const item of row) {
      const itemLen = item.area / thickness;
      if (alongWidth) {
        rects.push({
          item: item.data,
          x: ((x + offset) / width) * 100,
          y: (y / height) * 100,
          width: (itemLen / width) * 100,
          height: (thickness / height) * 100,
        });
        offset += itemLen;
      } else {
        rects.push({
          item: item.data,
          x: (x / width) * 100,
          y: ((y + offset) / height) * 100,
          width: (thickness / width) * 100,
          height: (itemLen / height) * 100,
        });
        offset += itemLen;
      }
    }

    const nextRemaining = remaining.slice(i);
    if (alongWidth) {
      recurse(nextRemaining, x, y + thickness, w, h - thickness);
    } else {
      recurse(nextRemaining, x + thickness, y, w - thickness, h);
    }
  }

  recurse(normalized, 0, 0, width, height);
  return rects;
}

// Damp dynamic range between mega-caps and small-caps so all stocks remain legible
export function balanceDynamicWeights(
  rawValues: number[],
  maxPct = 24,
  minPct = 2.5
): number[] {
  if (rawValues.length === 0) return [];
  if (rawValues.length === 1) return [100];

  const compressed = rawValues.map((v) => Math.pow(Math.max(v, 1), 0.35));
  const sumCompressed = compressed.reduce((a, b) => a + b, 0);
  if (sumCompressed <= 0) return rawValues.map(() => 100 / rawValues.length);

  let pcts = compressed.map((c) => (c / sumCompressed) * 100);
  const n = rawValues.length;
  const effectiveMax = Math.max(maxPct, 100 / n);
  const effectiveMin = Math.min(minPct, 80 / n);

  // Iteratively redistribute surplus to maintain exact bounds [effectiveMin, effectiveMax]
  for (let iter = 0; iter < 4; iter++) {
    const clamped = pcts.map((p) => Math.max(Math.min(p, effectiveMax), effectiveMin));
    const sumClamped = clamped.reduce((a, b) => a + b, 0);
    pcts = clamped.map((c) => (c / sumClamped) * 100);
  }

  return pcts;
}

export function StockTreemapHeatmap({
  instruments,
  sectors,
  headingId = "stock-treemap-title",
  selectedSector: propSector,
  onSectorChange,
}: {
  instruments: MarketInstrument[];
  sectors: MarketSector[];
  headingId?: string;
  selectedSector?: string;
  onSectorChange?: (sector: string) => void;
}) {
  const [internalSector, setInternalSector] = useState<string>("ALL");
  const selectedSector = propSector !== undefined ? propSector : internalSector;
  const setSelectedSector = (sec: string) => {
    setInternalSector(sec);
    onSectorChange?.(sec);
  };

  const [sizeMetric, setSizeMetric] = useState<SizeMetric>("market_cap");
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  // Cache sector instruments loaded from API
  const [sectorCache, setSectorCache] = useState<Record<string, MarketInstrument[]>>({});
  const [loadingSector, setLoadingSector] = useState<boolean>(false);

  // Fetch full representative stocks for the chosen sector if not yet cached
  useEffect(() => {
    if (selectedSector === "ALL") return;
    if (sectorCache[selectedSector]) return;

    setLoadingSector(true);
    let cancelled = false;

    fetch(`/market-api/instruments?sector=${encodeURIComponent(selectedSector)}&limit=20&sort=matched_value&direction=desc`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { data?: MarketInstrument[] } | null) => {
        if (cancelled) return;
        if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
          setSectorCache((prev) => ({ ...prev, [selectedSector]: data.data! }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingSector(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSector, sectorCache]);

  // Determine items to display (max 20 notable stocks per view)
  const activeStockList = useMemo(() => {
    if (selectedSector === "ALL") {
      // Top 20 representative stocks across whole market
      return [...instruments]
        .sort((a, b) => {
          const valA = Number(a.market_cap) || Number(a.matched_value) || 0;
          const valB = Number(b.market_cap) || Number(b.matched_value) || 0;
          return valB - valA;
        })
        .slice(0, 20);
    }

    // Use cached sector data if available (max 20 notable stocks)
    const cached = sectorCache[selectedSector];
    if (cached && cached.length > 0) {
      return cached.slice(0, 20);
    }

    // Fallback to filtering from snapshot instruments
    const fromSnapshot = instruments
      .filter(
        (inst) => inst.sector && inst.sector.toLocaleLowerCase("vi-VN") === selectedSector.toLocaleLowerCase("vi-VN")
      )
      .slice(0, 20);
    return fromSnapshot;
  }, [instruments, selectedSector, sectorCache]);

  // Compute treemap rectangles with balanced dynamic weights
  const treemapRects = useMemo(() => {
    if (!activeStockList.length) return [];

    const rawWeights = activeStockList.map((item) => {
      let weight = Number(item[sizeMetric]);
      if (!weight || weight <= 0) {
        weight = sizeMetric === "market_cap" ? 5_000_000_000_000 : 5_000_000_000;
      }
      return weight;
    });

    const balancedWeights = balanceDynamicWeights(rawWeights, 24, 2.5);

    const rawItems = activeStockList.map((item, idx) => ({
      item,
      value: balancedWeights[idx],
    }));

    return computeSquarifiedTreemap(rawItems, 1000, 560);
  }, [activeStockList, sizeMetric]);

  const hoveredItem = hoveredSymbol
    ? activeStockList.find((i) => i.symbol === hoveredSymbol) ?? instruments.find((i) => i.symbol === hoveredSymbol)
    : null;

  return (
    <div className="stock-treemap-heatmap flex flex-col gap-3">
      {/* Controls Bar: Selector & Size Metric */}
      <div className="treemap-controls flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="treemap-sector-select" className="text-slate-400 font-semibold shrink-0">
            Ngành:
          </label>
          <select
            id="treemap-sector-select"
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="bg-slate-900 text-slate-100 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 focus:border-sky-500 focus:outline-none transition cursor-pointer max-w-[220px] truncate"
          >
            <option value="ALL">Toàn bộ thị trường (Tiêu biểu)</option>
            {sectors.map((sec) => (
              <option key={sec.name} value={sec.name}>
                {sec.name} ({sec.member_count} mã)
              </option>
            ))}
          </select>

          <span className="text-slate-600 hidden sm:inline">|</span>

          {/* Size Metric: Vốn hóa vs GTGD */}
          <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => setSizeMetric("market_cap")}
              className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                sizeMetric === "market_cap"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Vốn hóa
            </button>
            <button
              type="button"
              onClick={() => setSizeMetric("matched_value")}
              className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                sizeMetric === "matched_value"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              GTGD
            </button>
          </div>
        </div>

        {/* Indicator that data is daily change */}
        <span className="text-[11px] text-slate-400 italic">
          Biến động trong ngày (%) · Tối đa 20 mã tiêu biểu
        </span>
      </div>

      {/* Treemap Canvas Container */}
      <div
        className="treemap-canvas relative w-full h-[380px] sm:h-[440px] md:h-[480px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner select-none"
        role="region"
        aria-labelledby={headingId}
      >
        {loadingSector && (
          <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center text-xs text-sky-400">
            <div className="inline-block w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mr-2" />
            Đang tải dữ liệu ngành...
          </div>
        )}

        {treemapRects.length > 0 ? (
          treemapRects.map(({ item, x, y, width, height }) => {
            const changeNum = Number(item.change_percent);
            const isPos = changeNum > 0;
            const isNeg = changeNum < 0;

            const bgClass = isPos
              ? "bg-[#047857] hover:bg-[#059669] text-emerald-50 border-slate-950"
              : isNeg
              ? "bg-[#991b1b] hover:bg-[#b91c1c] text-rose-50 border-slate-950"
              : "bg-[#b45309] hover:bg-[#d97706] text-amber-50 border-slate-950";

            const isBig = width > 13 && height > 16;
            const isSmall = width < 8.5 || height < 9.5;

            return (
              <Link
                key={item.symbol}
                href={`/market/stocks/${item.symbol}`}
                prefetch={false}
                onMouseEnter={() => setHoveredSymbol(item.symbol)}
                onMouseLeave={() => setHoveredSymbol(null)}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                }}
                className={`absolute border box-border flex flex-col items-center justify-center p-1.5 transition-all duration-150 overflow-hidden cursor-pointer shadow-xs text-center ${bgClass}`}
                title={`${item.symbol} - ${item.name} | Giá: ${Number(item.price).toLocaleString("vi-VN")} đ | Biến động: ${formatPercent(item.change_percent)} | GTGD: ${formatMoney(item.matched_value)}`}
              >
                <strong
                  className={`font-black tracking-tight leading-none drop-shadow-sm truncate max-w-full ${
                    isBig ? "text-sm sm:text-base" : isSmall ? "text-xs" : "text-xs sm:text-sm"
                  }`}
                >
                  {item.symbol}
                </strong>
                <span
                  className={`font-extrabold tracking-tight mt-1 drop-shadow-sm truncate max-w-full ${
                    isBig ? "text-xs sm:text-sm" : isSmall ? "text-[10px] sm:text-[11px]" : "text-xs"
                  }`}
                >
                  {formatPercent(item.change_percent)}
                </span>
                {!isSmall && (
                  <span className="text-[10px] opacity-85 mt-0.5 hidden sm:inline drop-shadow-sm truncate max-w-full">
                    {Number(item.price).toLocaleString("vi-VN")} đ
                  </span>
                )}
              </Link>
            );
          })
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs sm:text-sm">
            Chưa có mã cổ phiếu tiêu biểu nào phù hợp với ngành đã chọn.
          </div>
        )}
      </div>

      {/* Bottom Detail Bar on Hover */}
      {hoveredItem && (
        <div className="treemap-hover-bar flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white text-sm">{hoveredItem.symbol}</span>
            <span className="text-slate-300 font-medium truncate max-w-[200px] sm:max-w-xs">{hoveredItem.name}</span>
            <span className="text-slate-500">({hoveredItem.sector})</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              Giá: <strong className="text-white">{Number(hoveredItem.price).toLocaleString("vi-VN")} đ</strong>
            </span>
            <span className={`font-bold ${changeTone(hoveredItem.change_percent)}`}>
              {formatPercent(hoveredItem.change_percent)}
            </span>
            <span className="text-slate-400 hidden sm:inline">
              GTGD: <strong className="text-slate-200">{formatMoney(hoveredItem.matched_value)}</strong>
            </span>
            <span className="text-slate-400 hidden md:inline">
              Vốn hóa: <strong className="text-slate-200">{formatMoney(hoveredItem.market_cap)}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
