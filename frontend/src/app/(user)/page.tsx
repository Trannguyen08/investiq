import Link from "next/link";

import { HomeMarketDashboard } from "@/components/market/home-market-dashboard";
import {
  getMarketDividendCalendar,
  getMarketInstruments,
  getMarketOverview,
  getMarketSectors,
  getNews,
} from "@/lib/api-client";
import type { NewsSummary } from "@/lib/api-client";
import type { DividendItem, MarketInstrument, MarketSector } from "@/types/market";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const newsQuery = new URLSearchParams({ limit: "6", window_days: "1" });
  const pulseQuery = new URLSearchParams({ limit: "100", sort: "matched_value", direction: "desc" });
  const gainersQuery = new URLSearchParams({ limit: "20", sort: "change_percent", direction: "desc" });
  const declinersQuery = new URLSearchParams({ limit: "20", sort: "change_percent", direction: "asc" });

  const [
    overviewResult,
    sectorResult,
    newsResult,
    dividendResult,
    pulseResult,
    gainersResult,
    declinersResult,
  ] = await Promise.allSettled([
    getMarketOverview(15000),
    getMarketSectors(15000),
    getNews(newsQuery, 15000),
    getMarketDividendCalendar(30),
    getMarketInstruments(pulseQuery, 15000),
    getMarketInstruments(gainersQuery, 15000),
    getMarketInstruments(declinersQuery, 15000),
  ]);
  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
  const sectors: MarketSector[] = sectorResult.status === "fulfilled" ? sectorResult.value.data : [];
  const news: NewsSummary[] = newsResult.status === "fulfilled" ? newsResult.value.data : [];
  const dividendEvents: DividendItem[] =
    dividendResult.status === "fulfilled" ? dividendResult.value.data.events : [];

  // Gộp danh sách cổ phiếu toàn thị trường từ top thanh khoản, top tăng và top giảm
  const marketMap = new Map<string, MarketInstrument>();
  if (pulseResult.status === "fulfilled") {
    for (const item of pulseResult.value.data) marketMap.set(item.symbol, item);
  }
  if (gainersResult.status === "fulfilled") {
    for (const item of gainersResult.value.data) marketMap.set(item.symbol, item);
  }
  if (declinersResult.status === "fulfilled") {
    for (const item of declinersResult.value.data) marketMap.set(item.symbol, item);
  }
  if (overview?.data?.trending) {
    for (const item of overview.data.trending) {
      if (!marketMap.has(item.symbol)) marketMap.set(item.symbol, item);
    }
  }
  const allMarketInstruments: MarketInstrument[] = Array.from(marketMap.values());

  if (!overview) {
    return (
      <main id="main-content" className="market-unavailable">
        <p className="eyebrow">TRUNG TÂM THỊ TRƯỜNG</p>
        <h1>Dữ liệu thị trường chưa được bật</h1>
        <p>Hãy cấu hình một nhà cung cấp được cấp quyền hoặc bật fixture trong môi trường phát triển.</p>
        <Link className="market-primary-link" href="/news">
          Xem tin tức thị trường
        </Link>
      </main>
    );
  }
  return (
    <HomeMarketDashboard
      overview={overview}
      sectors={sectors}
      news={news}
      dividendEvents={dividendEvents}
      allMarketInstruments={allMarketInstruments}
    />
  );
}
