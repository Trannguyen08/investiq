import type { Metadata } from "next";

import { LearningJourney } from "@/components/learn/learning-journey";
import { stockBasicsLessons } from "@/content/stock-basics";
import { getMarketIndices } from "@/lib/api-client";
import type { LearningMarketExample } from "@/types/learning";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chứng khoán căn bản | InvestIQ",
  description: "Lộ trình ngắn giúp người mới hiểu rủi ro, đọc dữ liệu và thực hành đầu tư mô phỏng.",
};

async function getLearningMarketExample(): Promise<LearningMarketExample | null> {
  try {
    const collection = await getMarketIndices(15000);
    const index = collection.data.find((item) => item.symbol === "VNINDEX") ?? collection.data[0];
    const candle = index?.candles.at(-1);
    if (!index || !candle) return null;
    return {
      symbol: index.symbol,
      name: index.name,
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      providerName: collection.meta.provider_name,
      marketTime: collection.meta.market_time,
      timezone: collection.meta.market_timezone,
      freshness: collection.meta.freshness,
      delayClass: collection.meta.delay_class,
    };
  } catch {
    return null;
  }
}

export default async function LearnPage() {
  const marketExample = await getLearningMarketExample();
  return (
    <main id="main-content" className="learn-page">
      <LearningJourney lessons={stockBasicsLessons} marketExample={marketExample} />
    </main>
  );
}
