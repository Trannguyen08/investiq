import Link from "next/link";

import { HomeMarketDashboard } from "@/components/market/home-market-dashboard";
import { getMarketOverview, getMarketSectors, getNews } from "@/lib/api-client";
import type { NewsSummary } from "@/lib/api-client";
import type { MarketSector } from "@/types/market";

export default async function OverviewPage() {
  const newsQuery = new URLSearchParams({ limit: "4", window_days: "1" });
  const [overviewResult, sectorResult, newsResult] = await Promise.allSettled([
    getMarketOverview(),
    getMarketSectors(),
    getNews(newsQuery, 800),
  ]);
  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
  const sectors: MarketSector[] = sectorResult.status === "fulfilled" ? sectorResult.value.data : [];
  const news: NewsSummary[] = newsResult.status === "fulfilled" ? newsResult.value.data : [];
  if (!overview) {
    return (
      <main id="main-content" className="market-unavailable">
        <p className="eyebrow">TRUNG TÂM THỊ TRƯỜNG</p>
        <h1>Dữ liệu thị trường chưa được bật</h1>
        <p>Hãy cấu hình một nhà cung cấp được cấp quyền hoặc bật fixture trong môi trường phát triển.</p>
        <Link className="market-primary-link" href="/news">Xem tin tức thị trường</Link>
      </main>
    );
  }
  return <HomeMarketDashboard overview={overview} sectors={sectors} news={news} />;
}
