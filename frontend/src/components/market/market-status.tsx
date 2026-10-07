"use client";

import { formatMarketTime } from "@/components/market/formatters";
import { useMarketStreamState } from "@/hooks/use-realtime-price";
import type { MarketMeta } from "@/types/market";

function delayLabel(value: string) {
  const labels: Record<string, string> = {
    realtime: "Dữ liệu thời gian thực",
    delayed: "Dữ liệu có độ trễ",
    source_delayed: "Độ trễ theo nguồn",
    end_of_day: "Dữ liệu cuối ngày",
  };
  return labels[value] ?? value;
}

export function MarketStatus({ meta }: { meta: MarketMeta }) {
  const stream = useMarketStreamState();
  const fixture = meta.freshness === "fixture";
  const stale = meta.freshness === "stale";
  const statusLabel = fixture
    ? "Dữ liệu minh họa"
    : stale
      ? "Dữ liệu cũ"
      : meta.session === "closed"
        ? `Cuối phiên · ${delayLabel(meta.delay_class)}`
        : delayLabel(meta.delay_class);
  return (
    <div className={`market-status ${fixture ? "fixture" : ""} ${stale ? "stale" : ""}`} role="status">
      <span className="market-status-dot" aria-hidden="true" />
      <strong>{statusLabel}</strong>
      <span>Thị trường: {formatMarketTime(meta.market_time)}</span>
      <span>Nguồn: {meta.provider_name}</span>
      {meta.partial && <span>Phạm vi: một phần</span>}
      <span>Luồng: {stream.state === "connected" ? "đã kết nối" : stream.state === "connecting" ? "đang kết nối" : "tạm gián đoạn"}</span>
      {stream.lastUpdate && <span className="sr-only">Cập nhật luồng {formatMarketTime(stream.lastUpdate)}</span>}
    </div>
  );
}
