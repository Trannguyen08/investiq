import Link from "next/link";
import { StockTreemapHeatmap } from "@/components/market/stock-treemap-heatmap";
import { getMarketInstruments, getMarketSectors } from "@/lib/api-client";
import type { MarketInstrument, MarketSector, MarketSubsector } from "@/types/market";

export const dynamic = "force-dynamic";

const MARKET_UNIVERSE_PAGE_SIZE = 100;
const MARKET_UNIVERSE_PAGE_COUNT = 5;

async function getMarketUniverseSummary() {
  let firstPage: Awaited<ReturnType<typeof getMarketInstruments>> | null = null;
  let cursor: string | null = null;
  const data: Awaited<ReturnType<typeof getMarketInstruments>>["data"] = [];

  for (let page = 0; page < MARKET_UNIVERSE_PAGE_COUNT; page += 1) {
    const query = new URLSearchParams({
      sort: "matched_value",
      direction: "desc",
      limit: String(MARKET_UNIVERSE_PAGE_SIZE),
    });
    if (cursor) query.set("cursor", cursor);
    let result: Awaited<ReturnType<typeof getMarketInstruments>>;
    try {
      result = await getMarketInstruments(query, 30);
    } catch (error) {
      if (!firstPage) throw error;
      break;
    }
    firstPage ??= result;
    data.push(...result.data);
    cursor = result.pagination?.next_cursor ?? null;
    if (!cursor) break;
  }

  return firstPage ? { ...firstPage, data } : null;
}

export default async function MarketHeatmapDedicatedPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedSector = typeof query.sector === "string" ? query.sector : "ALL";

  const [universeResult, sectorsEnvelope] = await Promise.all([
    getMarketUniverseSummary().catch(() => null),
    getMarketSectors(30).catch(() => null),
  ]);

  const instruments: MarketInstrument[] = universeResult?.data ?? [];
  const sectors: MarketSector[] = sectorsEnvelope?.data ?? [];
  const subsectors: MarketSubsector[] = sectorsEnvelope?.subsectors ?? [];

  return (
    <main id="main-content" className="market-page market-heatmap-page w-full min-h-[calc(100vh-64px)] max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 text-slate-100 font-sans">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <Link
            href="/market/stocks#stock-table"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition mb-2"
          >
            ← Quay lại Bảng giá thị trường
          </Link>
          <div className="flex items-center gap-2">
            <span className="eyebrow text-xs font-bold text-sky-400 uppercase tracking-wider">
              GÓC NHÌN CHUYÊN SÂU
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">TOÀN BỘ CỔ PHIẾU THEO NGÀNH</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white m-0 tracking-tight mt-1">
            Biểu đồ nhiệt cổ phiếu toàn thị trường (Heatmap)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 m-0 mt-1 max-w-2xl">
            Không gian mở rộng quan sát toàn diện biên độ dao động giá và thanh khoản của tất cả cổ phiếu niêm yết trên HOSE, HNX và UPCoM.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/market/stocks"
            className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition"
          >
            Về trang Tổng quan
          </Link>
        </div>
      </div>

      {/* Standalone Full-Page Treemap Component */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl" aria-label="Bản đồ nhiệt thị trường">
        <StockTreemapHeatmap
          instruments={instruments}
          sectors={sectors}
          subsectors={subsectors}
          selectedSector={requestedSector}
          standalone={true}
        />
      </section>
    </main>
  );
}
