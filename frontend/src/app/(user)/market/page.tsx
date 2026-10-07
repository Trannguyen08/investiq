import { redirect } from "next/navigation";

import { legacyMarketDestination, type MarketSearchParams } from "@/lib/market-routes";

export default async function LegacyMarketPage({
  searchParams,
}: {
  searchParams: Promise<MarketSearchParams>;
}) {
  redirect(legacyMarketDestination(await searchParams));
}
