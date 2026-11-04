"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { changeTone, formatMoney, formatPercent } from "@/components/market/formatters";
import type { MarketInstrument, MarketSector } from "@/types/market";

type SizeMetric = "market_cap" | "matched_value";
type HeatmapTimeframe = "1D" | "7D" | "30D" | "1Y";

type TreemapRect<T> = {
  item: T;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Squarified Treemap layout algorithm (Bruls, Huizing, van Wijk)
function computeSquarifiedTreemap<T>(
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

  function layoutRow(
    row: Array<{ data: T; area: number }>,
    w: number,
    h: number,
    x: number,
    y: number,
    isHoriz: boolean
  ) {
    const rowArea = row.reduce((sum, item) => sum + item.area, 0);
    const side = isHoriz ? h : w;
    const rowLength = rowArea / side;
    let offset = 0;

    for (const item of row) {
      const itemLen = item.area / rowLength;
      if (isHoriz) {
        rects.push({
          item: item.data,
          x: (x + offset) / width * 100,
          y: y / height * 100,
          width: itemLen / width * 100,
          height: rowLength / height * 100,
        });
        offset += itemLen;
      } else {
        rects.push({
          item: item.data,
          x: x / width * 100,
          y: (y + offset) / height * 100,
          width: rowLength / width * 100,
          height: itemLen / height * 100,
        });
        offset += itemLen;
      }
    }
    return rowLength;
  }

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
        x: x / width * 100,
        y: y / height * 100,
        width: w / width * 100,
        height: h / height * 100,
      });
      return;
    }

    const isHoriz = w < h;
    const side = Math.min(w, h);
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

    const rowThickness = layoutRow(row, w, h, x, y, isHoriz);
    const nextRemaining = remaining.slice(i);

    if (isHoriz) {
      recurse(nextRemaining, x, y + rowThickness, w, h - rowThickness);
    } else {
      recurse(nextRemaining, x + rowThickness, y, w - rowThickness, h);
    }
  }

  recurse(normalized, 0, 0, width, height);
  return rects;
}

export function StockTreemapHeatmap({
  instruments,
  sectors,
  headingId = "stock-treemap-title",
}: {
  instruments: MarketInstrument[];
  sectors: MarketSector[];
  headingId?: string;
}) {
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>("market_cap");
  const [timeframe, setTimeframe] = useState<HeatmapTimeframe>("1D");
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  // Group and select representative stocks
  const filteredInstruments = useMemo(() => {
    if (selectedSector === "ALL") {
      // Return top 28 representative stocks sorted by matched value / market cap
      return [...instruments]
        .sort((a, b) => {
          const valA = Number(a.market_cap) || Number(a.matched_value) || 0;
          const valB = Number(b.market_cap) || Number(b.matched_value) || 0;
          return valB - valA;
        })
        .slice(0, 30);
    }
    return instruments.filter(
      (inst) => inst.sector && inst.sector.toLocaleLowerCase("vi-VN") === selectedSector.toLocaleLowerCase("vi-VN")
    );
  }, [instruments, selectedSector]);

  // Compute layout rectangles using Squarified Treemap
  const treemapRects = useMemo(() => {
    const rawItems = filteredInstruments.map((item) => {
      let weight = Number(item[sizeMetric]);
      if (!weight || weight <= 0) {
        weight = sizeMetric === "market_cap" ? 10_000_000_000_000 : 10_000_000_000;
      }
      return { item, value: weight };
    });
    return computeSquarifiedTreemap(rawItems, 1000, 560);
  }, [filteredInstruments, sizeMetric]);

  const hoveredItem = hoveredSymbol ? instruments.find((i) => i.symbol === hoveredSymbol) : null;

  return (
    <div className="stock-treemap-heatmap flex flex-col gap-3">
      {/* Controls Bar */}
      <div className="treemap-controls flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="treemap-sector-select" className="text-slate-400 font-semibold shrink-0">
            Ngành:
          </label>
          <select
            id="treemap-sector-select"
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="bg-slate-900 text-slate-100 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 focus:border-sky-500 focus:outline-none transition cursor-pointer max-w-[200px] truncate"
          >
            <option value="ALL">Toàn bộ thị trường (Tiêu biểu)</option>
            {sectors.map((sec) => (
              <option key={sec.name} value={sec.name}>
                {sec.name} ({sec.member_count} mã)
              </option>
            ))}
          </select>

          <span className="text-slate-600 hidden sm:inline">|</span>

          {/* Size Metric */}
          <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => setSizeMetric("market_cap")}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                sizeMetric === "matched_value"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              GTGD
            </button>
          </div>
        </div>

        {/* Timeframe Buttons */}
        <div className="flex items-center gap-1">
          {(["1D", "7D", "30D", "1Y"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 rounded-md font-bold transition cursor-pointer ${
                timeframe === tf
                  ? "bg-slate-800 text-sky-400 border border-sky-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Treemap Visual Container */}
      {treemapRects.length > 0 ? (
        <div
          className="treemap-canvas relative w-full h-[360px] sm:h-[420px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner select-none"
          role="region"
          aria-labelledby={headingId}
        >
          {treemapRects.map(({ item, x, y, width, height }) => {
            const changeNum = Number(item.change_percent);
            const isPos = changeNum > 0;
            const isNeg = changeNum < 0;

            // Rich vibrant colors matching Vietnamese market standards
            const bgClass = isPos
              ? "bg-[#047857] hover:bg-[#059669] text-emerald-50 border-[#064e3b]"
              : isNeg
              ? "bg-[#991b1b] hover:bg-[#b91c1c] text-rose-50 border-[#450a0a]"
              : "bg-[#b45309] hover:bg-[#d97706] text-amber-50 border-[#78350f]";

            const isBig = width > 12 && height > 14;
            const isSmall = width < 6 || height < 7;

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
                className={`absolute border flex flex-col items-center justify-center p-1 transition-all duration-150 overflow-hidden cursor-pointer shadow-sm ${bgClass}`}
                title={`${item.symbol} - ${item.name} | Giá: ${Number(item.price).toLocaleString("vi-VN")} đ | Biến động: ${formatPercent(item.change_percent)} | GTGD: ${formatMoney(item.matched_value)}`}
              >
                <strong
                  className={`font-black tracking-tight leading-none drop-shadow-sm ${
                    isSmall ? "text-[10px]" : isBig ? "text-sm sm:text-base" : "text-xs sm:text-sm"
                  }`}
                >
                  {item.symbol}
                </strong>
                {!isSmall && (
                  <span
                    className={`font-bold tracking-tight mt-0.5 drop-shadow-sm ${
                      isBig ? "text-xs sm:text-sm" : "text-[10px] sm:text-xs"
                    }`}
                  >
                    {formatPercent(item.change_percent)}
                  </span>
                )}
                {isBig && (
                  <span className="text-[10px] opacity-80 mt-0.5 hidden sm:inline drop-shadow-sm">
                    {Number(item.price).toLocaleString("vi-VN")} đ
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800/80">
          <p className="text-xs sm:text-sm">Chưa có mã cổ phiếu tiêu biểu nào phù hợp với ngành đã chọn.</p>
        </div>
      )}

      {/* Floating or Footer Tooltip Details */}
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
