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

function sessionContext(value: string) {
  if (value === "open") return { label: "Đang trong giờ giao dịch", detail: "Giá và khối lượng có thể tiếp tục thay đổi." };
  if (value === "closed") return { label: "Ngoài giờ giao dịch", detail: "Đang hiển thị snapshot gần nhất của nguồn." };
  return { label: "Trạng thái phiên chưa xác định", detail: "Hãy dựa vào thời điểm dữ liệu được ghi bên cạnh." };
}

export function MarketStatus({ meta }: { meta: MarketMeta }) {
  const stream = useMarketStreamState();
  const latestDataTime = stream.lastUpdate ?? meta.market_time;
  const fixture = meta.freshness === "fixture";
  const stale = meta.freshness === "stale";
  const session = sessionContext(meta.session);
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
      <span className="data-update-stamp"><small>Dữ liệu cập nhật gần nhất</small><time dateTime={latestDataTime}>{formatMarketTime(latestDataTime)}</time></span>
      <span className="market-session-context"><small>Trạng thái phiên</small><b>{session.label}</b><em>{session.detail}</em></span>
      <span>Nguồn: {meta.provider_name}</span>
      {meta.partial && <span>Phạm vi: một phần</span>}
      <span>Luồng: {stream.state === "connected" ? "đã kết nối" : stream.state === "connecting" ? "đang kết nối" : "tạm gián đoạn"}</span>
    </div>
  );
}
