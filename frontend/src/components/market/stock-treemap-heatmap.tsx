"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { changeTone, formatMoney, formatPercent } from "@/components/market/formatters";
import type { MarketInstrument, MarketSector, MarketSubsector } from "@/types/market";

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

// Compute dynamic weights for percentage movement treemap
// Enhances visual disparity so stocks with large movements are noticeably larger
// than stocks with near-zero changes, while maintaining readability of ticker and %
export function computePercentMovementWeights(rawChangePercents: number[]): number[] {
  if (rawChangePercents.length === 0) return [];
  if (rawChangePercents.length === 1) return [100];

  const absValues = rawChangePercents.map((val) => Math.abs(Number(val) || 0));
  const maxVal = Math.max(...absValues);

  if (maxVal === 0) {
    const uniform = 100 / absValues.length;
    return absValues.map(() => uniform);
  }

  // Multiplier of 7.0 provides clear, dramatic contrast between large movers (e.g. 4-7%)
  // and stationary stocks (0-0.5%), giving the largest movers ~7-8x the visual area of 0% stocks.
  const minFloor = 1.0;
  const multiplier = 7.0;

  const weights = absValues.map((v) => minFloor + (v / maxVal) * multiplier);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (totalWeight <= 0) {
    const uniform = 100 / absValues.length;
    return absValues.map(() => uniform);
  }

  return weights.map((w) => (w / totalWeight) * 100);
}

export function StockTreemapHeatmap({
  instruments,
  sectors,
  subsectors = [],
  headingId = "stock-treemap-title",
  selectedSector: propSector,
  onSectorChange,
  standalone = false,
}: {
  instruments: MarketInstrument[];
  sectors: MarketSector[];
  subsectors?: MarketSubsector[];
  headingId?: string;
  selectedSector?: string;
  onSectorChange?: (sector: string) => void;
  standalone?: boolean;
}) {
  const [internalSector, setInternalSector] = useState<string>("ALL");
  const selectedSector = propSector !== undefined ? propSector : internalSector;
  const setSelectedSector = (sec: string) => {
    setInternalSector(sec);
    onSectorChange?.(sec);
  };

  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Cache sector instruments loaded from API
  const [sectorCache, setSectorCache] = useState<Record<string, MarketInstrument[]>>({});
  const [loadingSector, setLoadingSector] = useState<boolean>(false);

  // Fetch full representative stocks for the chosen sector if not yet cached
  useEffect(() => {
    if (selectedSector === "ALL") return;
    if (sectorCache[selectedSector]) return;

    setLoadingSector(true);
    let cancelled = false;

    async function loadSectorInstruments() {
      try {
        let allItems: MarketInstrument[] = [];
        let nextCursor: string | null = null;
        let pages = 0;
        const maxPages = 4; // up to 400 stocks per sector

        while (pages < maxPages && !cancelled) {
          const url: string = `/market-api/instruments?sector=${encodeURIComponent(selectedSector)}&limit=100&sort=matched_value&direction=desc${
            nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : ""
          }`;
          const res = await fetch(url);
          if (!res.ok) break;
          const json: { data?: MarketInstrument[]; meta?: { cursor?: string | null; has_next_page?: boolean } } =
            await res.json();
          if (!json?.data || !Array.isArray(json.data) || json.data.length === 0) break;
          allItems = [...allItems, ...json.data];
          if (!json.meta?.has_next_page || !json.meta?.cursor) break;
          nextCursor = json.meta.cursor;
          pages++;
        }

        if (!cancelled && allItems.length > 0) {
          setSectorCache((prev) => ({ ...prev, [selectedSector]: allItems }));
        }
      } catch {
        // Fall back to snapshot instruments
      } finally {
        if (!cancelled) setLoadingSector(false);
      }
    }

    loadSectorInstruments();

    return () => {
      cancelled = true;
    };
  }, [selectedSector, sectorCache]);

  // Find member count metadata from sectors/subsectors list
  const sectorMeta = useMemo(() => {
    if (!selectedSector || selectedSector === "ALL") return null;
    const target = selectedSector.toLocaleLowerCase("vi-VN");
    const directSector = (sectors || []).find(
      (s) => s?.name && s.name.toLocaleLowerCase("vi-VN") === target
    );
    if (directSector) return directSector;
    return (
      (subsectors || []).find(
        (s) => s?.name && s.name.toLocaleLowerCase("vi-VN") === target
      ) ?? null
    );
  }, [sectors, subsectors, selectedSector]);

  // Full pool of matching instruments for the chosen sector
  const sectorPool = useMemo(() => {
    if (selectedSector === "ALL") {
      return [...instruments].sort((a, b) => {
        const valA = Number(a.market_cap) || Number(a.matched_value) || 0;
        const valB = Number(b.market_cap) || Number(b.matched_value) || 0;
        return valB - valA;
      });
    }

    const cached = sectorCache[selectedSector];
    if (cached && cached.length > 0) {
      return cached;
    }

    return instruments.filter((inst) =>
      [inst.sector, inst.subsector].some(
        (name) => name?.toLocaleLowerCase("vi-VN") === selectedSector.toLocaleLowerCase("vi-VN")
      )
    );
  }, [instruments, selectedSector, sectorCache]);

  const totalMatched = sectorPool.length || sectorMeta?.member_count || 0;

  // Determine items to display based on standalone or search
  const activeStockList = useMemo(() => {
    if (!standalone) {
      return sectorPool.slice(0, 20);
    }
    if (!searchQuery.trim()) {
      return sectorPool;
    }
    const q = searchQuery.trim().toLowerCase();
    return sectorPool.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
    );
  }, [sectorPool, standalone, searchQuery]);

  // Compute treemap rectangles with weights based on absolute percentage movement
  const treemapRects = useMemo(() => {
    if (!activeStockList.length) return [];

    const rawChanges = activeStockList.map((item) => Number(item.change_percent) || 0);
    const balancedWeights = computePercentMovementWeights(rawChanges);

    const rawItems = activeStockList.map((item, idx) => ({
      item,
      value: balancedWeights[idx],
    }));

    const canvasH = standalone ? 700 : 560;
    return computeSquarifiedTreemap(rawItems, 1000, canvasH);
  }, [activeStockList, standalone]);

  const displayItem = (hoveredSymbol
    ? activeStockList.find((i) => i.symbol === hoveredSymbol) ?? instruments.find((i) => i.symbol === hoveredSymbol)
    : null)
    ?? (activeSymbol
      ? activeStockList.find((i) => i.symbol === activeSymbol) ?? instruments.find((i) => i.symbol === activeSymbol)
      : null);

  return (
    <div className="stock-treemap-heatmap flex flex-col gap-3">
      {/* Controls Bar: Selector & Notice */}
      <div className="treemap-controls flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="treemap-sector-select" className="text-slate-400 font-semibold shrink-0">
            {standalone ? "Lọc ngành:" : "Ngành:"}
          </label>
          <select
            id="treemap-sector-select"
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="bg-slate-900 text-slate-100 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 focus:border-sky-500 focus:outline-none transition cursor-pointer max-w-[220px] truncate"
          >
            <option value="ALL">Toàn bộ thị trường {standalone ? "(Tất cả mã)" : "(Tiêu biểu)"}</option>
            {sectors.map((sec) => (
              <option key={sec.name} value={sec.name}>
                {sec.name} ({sec.member_count} mã)
              </option>
            ))}
            {subsectors.length > 0 && (
              <optgroup label="Nhóm ngành con">
                {subsectors.map((subsector) => (
                  <option key={`${subsector.parent_sector}:${subsector.name}`} value={subsector.name}>
                    {subsector.parent_sector} · {subsector.name} ({subsector.member_count} mã)
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {standalone ? (
            <input
              type="text"
              placeholder="Tìm mã cổ phiếu (HPG, SSI, VCB...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 min-w-[200px]"
            />
          ) : (
            <Link
              href={`/market/heatmap?sector=${encodeURIComponent(selectedSector)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg font-semibold transition"
              title="Mở rộng biểu đồ nhiệt sang trang riêng biệt rộng rãi"
            >
              <span>Xem tất cả ({totalMatched} mã) trên trang riêng</span>
              <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>

        {/* Indicator that tile size is by |% change| */}
        {standalone ? (
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-md">
              Đang hiển thị {activeStockList.length} / {totalMatched} mã
            </span>
            <span className="text-[11px] text-slate-400 italic hidden sm:inline">
              Độ to khối biểu thị biên độ |% biến động|
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 italic">
            Độ to khối theo |% biến động| · Hiển thị 20 mã tiêu biểu
          </span>
        )}
      </div>

      {/* Treemap Canvas Container */}
      <div
        className={`treemap-canvas relative w-full ${
          standalone ? "h-[620px] sm:h-[680px] lg:h-[750px]" : "h-[380px] sm:h-[440px] md:h-[480px]"
        } rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner select-none`}
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
            const isTiny = width < 4.5 || height < 5.5;

            return (
              <Link
                key={item.symbol}
                href={`/market/stocks/${item.symbol}`}
                prefetch={false}
                onMouseEnter={() => {
                  setHoveredSymbol(item.symbol);
                  setActiveSymbol(item.symbol);
                }}
                onMouseLeave={() => setHoveredSymbol(null)}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                }}
                className={`absolute border box-border flex flex-col items-center justify-center p-1 transition-all duration-150 overflow-hidden cursor-pointer shadow-xs text-center ${bgClass}`}
                title={`${item.symbol} - ${item.name} | Giá: ${Number(item.price).toLocaleString("vi-VN")} đ | Biến động: ${formatPercent(item.change_percent)} | GTGD: ${formatMoney(item.matched_value)}`}
              >
                <strong
                  className={`font-black tracking-tight leading-none drop-shadow-sm truncate max-w-full ${
                    isBig ? "text-sm sm:text-base" : isTiny ? "text-[10px]" : isSmall ? "text-xs" : "text-xs sm:text-sm"
                  }`}
                >
                  {item.symbol}
                </strong>
                <span
                  className={`font-extrabold tracking-tight mt-0.5 drop-shadow-sm truncate max-w-full ${
                    isBig ? "text-xs sm:text-sm" : isTiny ? "text-[9px]" : isSmall ? "text-[10px] sm:text-[11px]" : "text-xs"
                  }`}
                >
                  {formatPercent(item.change_percent)}
                </span>
              </Link>
            );
          })
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs sm:text-sm">
            Chưa có mã cổ phiếu tiêu biểu nào phù hợp với ngành đã chọn.
          </div>
        )}
      </div>

      {/* Bottom Detail Bar on Hover / Active */}
      {displayItem && (
        <div
          onMouseEnter={() => setActiveSymbol(displayItem.symbol)}
          className="treemap-hover-bar flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white text-sm">{displayItem.symbol}</span>
            <span className="text-slate-300 font-medium truncate max-w-[200px] sm:max-w-xs">{displayItem.name}</span>
            <span className="text-slate-500">({displayItem.sector})</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              Giá: <strong className="text-white">{Number(displayItem.price).toLocaleString("vi-VN")} đ</strong>
            </span>
            <span className={`font-bold ${changeTone(displayItem.change_percent)}`}>
              {formatPercent(displayItem.change_percent)}
            </span>
            <span className="text-slate-400 hidden sm:inline">
              GTGD: <strong className="text-slate-200">{formatMoney(displayItem.matched_value)}</strong>
            </span>
            <span className="text-slate-400 hidden md:inline">
              Vốn hóa: <strong className="text-slate-200">{formatMoney(displayItem.market_cap)}</strong>
            </span>
            <Link
              href={`/market/stocks/${displayItem.symbol}`}
              prefetch={false}
              className="text-sky-400 hover:text-sky-200 hover:bg-sky-900/80 font-bold ml-1 inline-flex items-center gap-1 transition px-2.5 py-1 rounded-md bg-sky-950/70 border border-sky-700/80 shadow-xs"
            >
              Xem chi tiết →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
