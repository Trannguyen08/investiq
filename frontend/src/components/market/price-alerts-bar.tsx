"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, Trash2 } from "lucide-react";

import {
  evaluatePriceAlerts,
  loadPriceAlerts,
  removePriceAlert,
  type PriceAlert,
} from "@/lib/price-alerts";
import type { MarketInstrument } from "@/types/market";

const vndFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

export function PriceAlertsBar({ instruments }: { instruments: MarketInstrument[] }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  useEffect(() => {
    const sync = () => setAlerts(loadPriceAlerts());
    sync();
    window.addEventListener("investiq:price-alerts-updated", sync);
    return () => window.removeEventListener("investiq:price-alerts-updated", sync);
  }, []);

  const evaluated = useMemo(() => {
    const priceMap: Record<string, number> = {};
    for (const item of instruments) {
      const n = Number(item.price || 0);
      if (Number.isFinite(n) && n > 0) {
        priceMap[item.symbol.toUpperCase()] = n;
      }
    }
    return evaluatePriceAlerts(alerts, priceMap);
  }, [alerts, instruments]);

  if (evaluated.length === 0) return null;

  const triggered = evaluated.filter((item) => item.triggered);

  return (
    <section
      aria-label="Cảnh báo giá cổ phiếu của bạn"
      className={`rounded-2xl border p-3.5 sm:p-4 space-y-2.5 ${
        triggered.length > 0
          ? "border-amber-400/40 bg-amber-950/20"
          : "border-slate-800 bg-slate-900/70"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          {triggered.length > 0 ? (
            <>
              <BellRing className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300">
                {triggered.length} cảnh báo giá đã chạm ngưỡng!
              </span>
            </>
          ) : (
            <>
              <Bell className="w-4 h-4 text-sky-400" />
              <span className="text-sky-300">
                Đang theo dõi {evaluated.length} cảnh báo giá
              </span>
            </>
          )}
        </div>
        <span className="text-[11px] text-slate-400">
          Tự động đối chiếu với giá thị trường mới nhất
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {evaluated.map((alert) => (
          <div
            key={alert.id}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs ${
              alert.triggered
                ? "border-amber-400/60 bg-amber-500/15 text-amber-100"
                : "border-slate-800 bg-slate-950/70 text-slate-200"
            }`}
          >
            <Link
              href={`/market/stocks/${alert.symbol}`}
              className="font-extrabold text-sky-300 hover:underline"
            >
              {alert.symbol}
            </Link>
            <span>
              {alert.direction === "below" ? "≤" : "≥"}{" "}
              <strong>{vndFormatter.format(alert.targetPrice)} ₫</strong>
            </span>
            {alert.currentPrice !== null && (
              <span className="text-slate-400">
                (Hiện tại: {vndFormatter.format(alert.currentPrice)} ₫)
              </span>
            )}
            {alert.triggered && (
              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                Đã chạm
              </span>
            )}
            <button
              type="button"
              onClick={() => setAlerts(removePriceAlert(alert.id))}
              aria-label={`Xóa cảnh báo ${alert.symbol}`}
              className="text-slate-400 hover:text-rose-400 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
