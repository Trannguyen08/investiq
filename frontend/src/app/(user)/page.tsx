import Link from "next/link";

import { HomeMarketDashboard } from "@/components/market/home-market-dashboard";
import { getMarketOverview } from "@/lib/api-client";

export default async function OverviewPage() {
  let overview = null;
  try {
    overview = await getMarketOverview();
  } catch {
    overview = null;
  }
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
  return <HomeMarketDashboard overview={overview} />;
}
