"use client";

import type { MarketPulseWidgetData } from "@/types/ai-chat";

export function MarketPulseWidget({ data }: { data: MarketPulseWidgetData }) {
  const { vnindex, change_percent, advances, declines, liquidity_trillion } = data;
  const isPositive = change_percent >= 0;

  return (
    <div className="w-full max-w-xl bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl my-3 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div>
          <h4 className="text-sm sm:text-base font-bold text-white m-0">Nhịp đập thị trường toàn sàn</h4>
        </div>
        <div className="flex items-center gap-2">
          <strong className="text-sm sm:text-base font-extrabold text-white">
            {vnindex.toLocaleString("vi-VN", { minimumFractionDigits: 2 })}
          </strong>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded ${
              isPositive ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60" : "bg-rose-950 text-rose-400 border border-rose-800/60"
            }`}
          >
            {isPositive ? "+" : ""}
            {change_percent.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800">
        <div>
          <span className="text-slate-400 block text-[11px] mb-1">Độ rộng toàn sàn</span>
          <div className="flex items-center gap-3">
            <span className="font-bold text-emerald-400">{advances} tăng</span>
            <span className="text-slate-500">·</span>
            <span className="font-bold text-rose-400">{declines} giảm</span>
          </div>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px] mb-1">Thanh khoản khớp lệnh</span>
          <strong className="text-sm font-extrabold text-sky-400">
            ~{liquidity_trillion.toLocaleString("vi-VN")} nghìn tỷ
          </strong>
        </div>
      </div>
    </div>
  );
}
