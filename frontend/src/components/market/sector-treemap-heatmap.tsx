"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { changeTone, formatMoney, formatPercent } from "@/components/market/formatters";
import { computePercentMovementWeights, computeSquarifiedTreemap } from "@/components/market/stock-treemap-heatmap";
import type { MarketSector, MarketSubsector } from "@/types/market";

export function SectorTreemapHeatmap({
  sectors,
  subsectors = [],
  headingId = "sector-treemap-title",
  onSelectSector,
}: {
  sectors: MarketSector[];
  subsectors?: MarketSubsector[];
  headingId?: string;
  onSelectSector?: (sectorName: string) => void;
}) {
  const [hoveredSectorName, setHoveredSectorName] = useState<string | null>(null);
  const [activeSectorName, setActiveSectorName] = useState<string | null>(null);
  const [drilldownSector, setDrilldownSector] = useState<string | null>(null);
  const visibleSectors = drilldownSector
    ? subsectors.filter((sector) => sector.parent_sector === drilldownSector)
    : sectors;

  // Compute treemap rectangles for all sectors with weights based on absolute percentage movement
  const treemapRects = useMemo(() => {
    if (!visibleSectors.length) return [];

    const rawChanges = visibleSectors.map((sector) => Number(sector.change_percent) || 0);
    const balancedWeights = computePercentMovementWeights(rawChanges);

    const rawItems = visibleSectors.map((sector, idx) => ({
      item: sector,
      value: balancedWeights[idx],
    }));

    return computeSquarifiedTreemap(rawItems, 1000, 560);
  }, [visibleSectors]);

  const displaySector = (hoveredSectorName ? visibleSectors.find((s) => s.name === hoveredSectorName) : null)
    ?? (activeSectorName ? visibleSectors.find((s) => s.name === activeSectorName) : null);

  return (
    <div className="sector-treemap-heatmap flex flex-col gap-3">
      {/* Controls Bar: Metric Toggle & Market Overview */}
      <div className="treemap-controls flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-slate-300 font-bold shrink-0">
            {drilldownSector ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDrilldownSector(null);
                    setHoveredSectorName(null);
                    setActiveSectorName(null);
                  }}
                  className="rounded border border-slate-700 px-2 py-1 text-sky-300 hover:text-white"
                >
                  ← Tất cả ngành
                </button>
                <span>{drilldownSector} · {visibleSectors.length} nhóm con</span>
              </>
            ) : (
              <span>Biến động các ngành ({visibleSectors.length} ngành)</span>
            )}
          </span>
        </div>

        {/* Daily Change Notice */}
        <span className="text-[11px] text-slate-400 italic">
          Độ to khối theo |% biến động| · Bấm vào ngành để lọc
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

            const hasChildren = !drilldownSector
              && subsectors.some((subsector) => subsector.parent_sector === item.name);
            const handleClick = () => {
              if (hasChildren) {
                setDrilldownSector(item.name);
                setHoveredSectorName(null);
                setActiveSectorName(null);
              } else {
                onSelectSector?.(item.name);
              }
            };

            return (
              <button
                type="button"
                key={item.name}
                onClick={handleClick}
                onMouseEnter={() => {
                  setHoveredSectorName(item.name);
                  setActiveSectorName(item.name);
                }}
                onMouseLeave={() => setHoveredSectorName(null)}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                }}
                className={`absolute border box-border flex flex-col items-center justify-center p-1.5 transition-all duration-150 overflow-hidden cursor-pointer shadow-xs text-center ${bgClass}`}
                title={`${item.name}${"parent_sector" in item ? ` · ${item.parent_sector}` : ""} | Biến động: ${formatPercent(item.change_percent)} | ${item.member_count} mã (${item.advances} tăng, ${item.declines} giảm) | GTGD: ${formatMoney(item.matched_value)} | Vốn hóa: ${formatMoney(item.market_cap)}${hasChildren ? " | Bấm để xem nhóm con" : ""}`}
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
              </button>
            );
          })
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs sm:text-sm">
            Chưa có dữ liệu biến động các ngành.
          </div>
        )}
      </div>

      {/* Bottom Detail Bar on Hover / Active */}
      {displaySector && (
        <div
          onMouseEnter={() => setActiveSectorName(displaySector.name)}
          className="treemap-hover-bar flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white text-sm">{displaySector.name}</span>
            <span className="text-slate-400 font-semibold">({displaySector.member_count} mã)</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`font-bold ${changeTone(displaySector.change_percent)}`}>
              Biến động: {formatPercent(displaySector.change_percent)}
            </span>
            <span className="text-slate-300">
              <span className="text-emerald-400 font-semibold">{displaySector.advances} tăng</span>
              {" · "}
              <span className="text-amber-400 font-semibold">{displaySector.unchanged} đứng</span>
              {" · "}
              <span className="text-rose-400 font-semibold">{displaySector.declines} giảm</span>
            </span>
            <span className="text-slate-400 hidden sm:inline">
              GTGD: <strong className="text-slate-200">{formatMoney(displaySector.matched_value)}</strong>
            </span>
            <span className="text-slate-400 hidden md:inline">
              Vốn hóa: <strong className="text-slate-200">{formatMoney(displaySector.market_cap)}</strong>
            </span>
            <Link
              href={`/market/stocks?sector=${encodeURIComponent(displaySector.name)}#stock-table`}
              prefetch={false}
              className="text-sky-400 hover:text-sky-200 hover:bg-sky-900/80 font-bold ml-1 inline-flex items-center gap-1 transition px-2.5 py-1 rounded-md bg-sky-950/70 border border-sky-700/80 shadow-xs"
            >
              Mở bảng giá →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
