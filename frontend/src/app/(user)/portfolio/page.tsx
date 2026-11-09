import { PaperTradingDashboard } from "@/components/portfolio/paper-trading-dashboard";
import { getMarketInstruments } from "@/lib/api-client";
import { paperTradingRequest } from "@/lib/server/paper-trading-api";
import type { PaperDashboard } from "@/types/portfolio";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const marketQuery = new URLSearchParams({ sort: "matched_value", direction: "desc", limit: "30" });
  const dashboardWithTimeout = Promise.race([
    paperTradingRequest("").then(async (res) => (res.ok ? ((await res.json()) as PaperDashboard) : null)),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
  ]).catch(() => null);

  const [marketResult, dashboardResult] = await Promise.allSettled([
    getMarketInstruments(marketQuery, 30),
    dashboardWithTimeout,
  ]);

  const marketInstruments = marketResult.status === "fulfilled" ? marketResult.value.data : [];
  const initialDashboard = dashboardResult.status === "fulfilled" ? dashboardResult.value : null;

  return (
    <PaperTradingDashboard
      positiveNews={[]}
      marketInstruments={marketInstruments}
      marketLoadError={marketResult.status === "rejected"}
      initialDashboard={initialDashboard}
    />
  );
}
