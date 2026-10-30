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
  const stale = meta.freshness === "stale" && meta.session !== "closed";
  const session = sessionContext(meta.session);
  const statusLabel = fixture
    ? "Dữ liệu minh họa"
    : stale
      ? "Dữ liệu cũ"
      : meta.session === "closed"
        ? `Chốt phiên · ${delayLabel(meta.delay_class)}`
        : delayLabel(meta.delay_class);

  return (
    <div
      className={`market-status flex flex-wrap items-center gap-2.5 sm:gap-4 px-4 py-2.5 rounded-xl border text-xs transition-colors my-2.5 shadow-sm ${
        fixture
          ? "bg-slate-900/95 border-amber-500/30 text-slate-300"
          : stale
            ? "bg-slate-900/95 border-rose-500/30 text-slate-300"
            : "bg-slate-900/90 border-slate-800 text-slate-300"
      } ${fixture ? "fixture" : ""} ${stale ? "stale" : ""}`}
      role="status"
    >
      <span
        className={`market-status-dot w-2.5 h-2.5 rounded-full inline-block shrink-0 ${
          fixture
            ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
            : stale
              ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
              : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
        }`}
        aria-hidden="true"
      />
      <strong
        className={`px-2 py-0.5 rounded text-xs font-bold ${
          fixture
            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
            : stale
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
        }`}
      >
        {statusLabel}
      </strong>
      <span className="data-update-stamp flex items-center gap-1.5 border-l border-slate-800 pl-3">
        <small className="text-slate-400 text-[11px]">Dữ liệu cập nhật gần nhất</small>
        <time className="font-semibold text-slate-100" dateTime={latestDataTime}>
          {formatMarketTime(latestDataTime)}
        </time>
      </span>
      <span className="market-session-context flex items-center gap-1.5 border-l border-slate-800 pl-3">
        <small className="text-slate-400 text-[11px]">Trạng thái phiên</small>
        <b className="font-semibold text-slate-100">{session.label}</b>
        <em className="not-italic text-slate-400 text-[11px]">{session.detail}</em>
      </span>
      <span className="border-l border-slate-800 pl-3 text-slate-400">
        Nguồn: <span className="font-medium text-slate-200">{meta.provider_name}</span>
      </span>
      {meta.partial && <span className="text-amber-400 border-l border-slate-800 pl-3 font-medium">Phạm vi: một phần</span>}
      <span className="border-l border-slate-800 pl-3 flex items-center gap-1.5 text-slate-400">
        Luồng:
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${
            stream.state === "connected"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
              : stream.state === "connecting"
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                : "bg-rose-500/15 text-rose-400 border border-rose-500/25"
          }`}
        >
          {stream.state === "connected" ? "đã kết nối" : stream.state === "connecting" ? "đang kết nối" : "tạm gián đoạn"}
        </span>
      </span>
    </div>
  );
}
