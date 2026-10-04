"use client";

import { useMarketStream } from "@/hooks/use-realtime-price";
import { formatMarketTime } from "@/components/market/formatters";
import type { MarketMeta } from "@/types/market";

export function MarketStatus({ meta, symbols }: { meta: MarketMeta; symbols: string[] }) {
  const stream = useMarketStream(symbols);
  const fixture = meta.freshness === "fixture";
  return (
    <div className={`market-status ${fixture ? "fixture" : ""}`} role="status">
      <span className="market-status-dot" aria-hidden="true" />
      <strong>{fixture ? "Dữ liệu minh họa" : meta.delay_class}</strong>
      <span>Thị trường: {formatMarketTime(meta.market_time)}</span>
      <span>Nguồn: {meta.provider_name}</span>
      <span>Luồng: {stream.state === "connected" ? "đã kết nối" : stream.state === "connecting" ? "đang kết nối" : "tạm gián đoạn"}</span>
      {stream.lastUpdate && <span className="sr-only">Cập nhật luồng {formatMarketTime(stream.lastUpdate)}</span>}
    </div>
  );
}

