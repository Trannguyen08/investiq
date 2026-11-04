"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { changeTone, formatMoney, formatPercent } from "@/components/market/formatters";
import { balanceDynamicWeights, computeSquarifiedTreemap } from "@/components/market/stock-treemap-heatmap";
import type { MarketSector } from "@/types/market";

type SectorSizeMetric = "market_cap" | "matched_value";

export function SectorTreemapHeatmap({
  sectors,
  headingId = "sector-treemap-title",
  onSelectSector,
}: {
  sectors: MarketSector[];
  headingId?: string;
  onSelectSector?: (sectorName: string) => void;
}) {
  const [sizeMetric, setSizeMetric] = useState<SectorSizeMetric>("market_cap");
  const [hoveredSectorName, setHoveredSectorName] = useState<string | null>(null);

  // Compute treemap rectangles for all sectors with balanced dynamic weights
  const treemapRects = useMemo(() => {
    if (!sectors.length) return [];

    const rawWeights = sectors.map((sector) => {
      let weight = Number(sector[sizeMetric]);
      if (!weight || weight <= 0) {
        weight = sizeMetric === "market_cap" ? 10_000_000_000_000 : 100_000_000_000;
      }
      return weight;
    });

    const balancedWeights = balanceDynamicWeights(rawWeights, 20, 2.5);

    const rawItems = sectors.map((sector, idx) => ({
      item: sector,
      value: balancedWeights[idx],
    }));

    return computeSquarifiedTreemap(rawItems, 1000, 560);
  }, [sectors, sizeMetric]);

  const hoveredSector = hoveredSectorName
    ? sectors.find((s) => s.name === hoveredSectorName) ?? null
    : null;

  return (
    <div className="sector-treemap-heatmap flex flex-col gap-3">
      {/* Controls Bar: Metric Toggle & Market Overview */}
      <div className="treemap-controls flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-slate-300 font-bold shrink-0">
            Biến động các ngành ({sectors.length} ngành)
          </span>

          <span className="text-slate-600 hidden sm:inline">|</span>

          {/* Size Metric Toggle: Vốn hóa vs GTGD */}
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

        {/* Daily Change Notice */}
        <span className="text-[11px] text-slate-400 italic">
          Biến động trong ngày (%) · Bấm vào ngành để lọc
        </span>
      </div>

      {/* Sector Treemap Canvas */}
      <div
        className="treemap-canvas relative w-full h-[380px] sm:h-[440px] md:h-[480px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner select-none"
        role="region"
        aria-labelledby={headingId}
      >
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

            const isBig = width > 13 && height > 14;
            const isTiny = width < 5 || height < 5.5;
            const isSmall = !isBig && (width < 8 || height < 8);

            const handleClick = () => {
              if (onSelectSector) {
                onSelectSector(item.name);
              }
            };

            return (
              <button
                type="button"
                key={item.name}
                onClick={handleClick}
                onMouseEnter={() => setHoveredSectorName(item.name)}
                onMouseLeave={() => setHoveredSectorName(null)}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                }}
                className={`absolute border box-border flex flex-col items-center justify-center p-1.5 transition-all duration-150 overflow-hidden cursor-pointer shadow-xs text-center ${bgClass}`}
                title={`${item.name} | Biến động: ${formatPercent(item.change_percent)} | ${item.member_count} mã (${item.advances} tăng, ${item.declines} giảm) | GTGD: ${formatMoney(item.matched_value)} | Vốn hóa: ${formatMoney(item.market_cap)}`}
              >
                <strong
                  className={`font-black tracking-tight leading-tight drop-shadow-sm max-w-full ${
                    isTiny
                      ? "text-[9px] truncate"
                      : isSmall
                      ? "text-[11px] line-clamp-2"
                      : isBig
                      ? "text-sm sm:text-base line-clamp-2"
                      : "text-xs line-clamp-2"
                  }`}
                >
                  {item.name}
                </strong>

                {!isTiny && (
                  <span
                    className={`font-extrabold tracking-tight mt-1 drop-shadow-sm truncate max-w-full ${
                      isBig ? "text-sm sm:text-base" : isSmall ? "text-[11px]" : "text-xs"
                    }`}
                  >
                    {formatPercent(item.change_percent)}
                  </span>
                )}

                {isBig && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] opacity-90 drop-shadow-sm">
                    <span className="font-semibold">{item.member_count} mã</span>
                    <span>·</span>
                    <span>GTGD {formatMoney(item.matched_value)}</span>
                  </div>
                )}

                {!isBig && !isSmall && !isTiny && (
                  <span className="text-[10px] opacity-80 mt-0.5 drop-shadow-sm">
                    {item.member_count} mã
                  </span>
                )}
              </button>
            );
          })
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs sm:text-sm">
            Chưa có dữ liệu biến động các ngành.
          </div>
        )}
      </div>

      {/* Bottom Detail Bar on Hover */}
      {hoveredSector && (
        <div className="treemap-hover-bar flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white text-sm">{hoveredSector.name}</span>
            <span className="text-slate-400 font-semibold">({hoveredSector.member_count} mã)</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`font-bold ${changeTone(hoveredSector.change_percent)}`}>
              Biến động: {formatPercent(hoveredSector.change_percent)}
            </span>
            <span className="text-slate-300">
              <span className="text-emerald-400 font-semibold">{hoveredSector.advances} tăng</span>
              {" · "}
              <span className="text-amber-400 font-semibold">{hoveredSector.unchanged} đứng</span>
              {" · "}
              <span className="text-rose-400 font-semibold">{hoveredSector.declines} giảm</span>
            </span>
            <span className="text-slate-400 hidden sm:inline">
              GTGD: <strong className="text-slate-200">{formatMoney(hoveredSector.matched_value)}</strong>
            </span>
            <span className="text-slate-400 hidden md:inline">
              Vốn hóa: <strong className="text-slate-200">{formatMoney(hoveredSector.market_cap)}</strong>
            </span>
            <Link
              href={`/market/stocks?sector=${encodeURIComponent(hoveredSector.name)}#stock-table`}
              prefetch={false}
              className="text-sky-400 hover:text-sky-300 font-semibold ml-1 inline-flex items-center gap-0.5 underline transition"
            >
              Mở bảng giá →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
