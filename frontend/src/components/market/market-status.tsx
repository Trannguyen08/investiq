"use client";

import { formatMarketTime } from "@/components/market/formatters";
import { useMarketStreamState } from "@/hooks/use-realtime-price";
import type { MarketMeta } from "@/types/market";

function sessionContext(value: string) {
  if (value === "open") return { label: "Đang trong giờ giao dịch", detail: "Giá và khối lượng có thể tiếp tục thay đổi." };
  if (value === "closed") return { label: "Ngoài giờ giao dịch", detail: "Đang hiển thị snapshot gần nhất của nguồn." };
  return { label: "Trạng thái phiên chưa xác định", detail: "Hãy dựa vào thời điểm dữ liệu được ghi bên cạnh." };
}

export function MarketStatus({
  meta,
  className = "",
}: {
  meta: MarketMeta;
  className?: string;
}) {
  const stream = useMarketStreamState();
  const latestDataTime = stream.lastUpdate ?? meta.market_time;
  const isConnected = stream.state === "connected";
  const session = sessionContext(meta.session);

  return (
    <div
      className={`market-timestamp-badge inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 shrink-0 shadow-sm backdrop-blur-sm ${className}`}
      role="status"
    >
      <span
        className={`w-2 h-2 rounded-full inline-block shrink-0 ${
          isConnected ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-amber-400"
        }`}
        aria-hidden="true"
      />
      <span className="flex items-center gap-1.5">
        <small className="text-slate-400 text-xs">Dữ liệu cập nhật gần nhất</small>
        <time className="text-slate-100 font-semibold font-mono" dateTime={latestDataTime}>
          {formatMarketTime(latestDataTime)}
        </time>
      </span>
      <span className="sr-only">
        <span>{session.label}</span>. <span>{session.detail}</span>
      </span>
    </div>
  );
}
