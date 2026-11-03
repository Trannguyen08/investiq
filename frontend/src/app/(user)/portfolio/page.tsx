import { PaperTradingDashboard } from "@/components/portfolio/paper-trading-dashboard";
import { getMarketInstruments } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const marketQuery = new URLSearchParams({ sort: "vn30", direction: "desc", limit: "100" });
  const marketResult = await getMarketInstruments(marketQuery).then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );
  return (
    <PaperTradingDashboard
      positiveNews={[]}
      marketInstruments={marketResult.ok ? marketResult.value.data : []}
      marketLoadError={!marketResult.ok}
    />
  );
}
