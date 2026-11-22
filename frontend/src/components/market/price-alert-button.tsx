"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bell, BellRing, Trash2, X } from "lucide-react";

import {
  addPriceAlert,
  isAlertTriggered,
  loadPriceAlerts,
  removePriceAlert,
  type PriceAlert,
  type PriceAlertDirection,
} from "@/lib/price-alerts";

const vndFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

function roundToTick(price: number): number {
  if (price <= 0) return 0;
  if (price < 10_000) return Math.round(price / 10) * 10;
  if (price < 50_000) return Math.round(price / 50) * 50;
  return Math.round(price / 100) * 100;
}

export function PriceAlertButton({
  symbol,
  name,
  currentPrice,
}: {
  symbol: string;
  name: string;
  currentPrice: string | null;
}) {
  const normalizedSymbol = symbol.toUpperCase();
  const numericPrice = Number(currentPrice || 0);
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [direction, setDirection] = useState<PriceAlertDirection>("below");
  const [targetInput, setTargetInput] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const sync = () => {
      setAlerts(loadPriceAlerts().filter((item) => item.symbol === normalizedSymbol));
    };
    sync();
    window.addEventListener("investiq:price-alerts-updated", sync);
    return () => window.removeEventListener("investiq:price-alerts-updated", sync);
  }, [normalizedSymbol]);

  const triggeredCount = alerts.filter((item) =>
    isAlertTriggered(item, numericPrice > 0 ? numericPrice : null),
  ).length;

  function applyPreset(percentDelta: number) {
    if (numericPrice <= 0) return;
    const computed = roundToTick(numericPrice * (1 + percentDelta / 100));
    setDirection(percentDelta < 0 ? "below" : "above");
    setTargetInput(String(computed));
    setError("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleaned = Number(targetInput.replace(/[^\d]/g, ""));
    if (!Number.isFinite(cleaned) || cleaned <= 0) {
      setError("Vui lòng nhập mức giá mục tiêu hợp lệ (VND).");
      return;
    }
    const updated = addPriceAlert({
      symbol: normalizedSymbol,
      name,
      direction,
      targetPrice: cleaned,
      note,
    });
    setAlerts(updated.filter((item) => item.symbol === normalizedSymbol));
    setTargetInput("");
    setNote("");
    setError("");
  }

  function handleDelete(id: string) {
    const updated = removePriceAlert(id);
    setAlerts(updated.filter((item) => item.symbol === normalizedSymbol));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition ${
          triggeredCount > 0
            ? "bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/30"
            : "bg-slate-800/80 border-slate-700 text-slate-200 hover:border-sky-400/50 hover:text-white"
        }`}
      >
        {triggeredCount > 0 ? (
          <BellRing className="w-4 h-4 text-amber-300" />
        ) : (
          <Bell className="w-4 h-4 text-sky-400" />
        )}
        <span>
          {triggeredCount > 0
            ? `Chạm cảnh báo (${triggeredCount})`
            : alerts.length > 0
              ? `Cảnh báo giá (${alerts.length})`
              : "Đặt cảnh báo giá"}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="price-alert-modal-title"
            className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 p-5 shadow-2xl space-y-4 text-slate-100"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400 m-0">
                  CẢNH BÁO GIÁ · {normalizedSymbol}
                </p>
                <h2 id="price-alert-modal-title" className="text-lg font-extrabold text-white m-0 mt-0.5">
                  Theo dõi mốc giá mục tiêu
                </h2>
                {numericPrice > 0 && (
                  <p className="text-xs text-slate-400 m-0 mt-1">
                    Giá hiện tại: <strong className="text-slate-100">{vndFormatter.format(numericPrice)} ₫</strong>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng cảnh báo giá"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("below")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    direction === "below"
                      ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-200"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Giảm xuống ≤ (Canh mua)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("above")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    direction === "above"
                      ? "bg-amber-500/20 border-amber-400/60 text-amber-200"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Tăng lên ≥ (Chốt lời)
                </button>
              </div>

              {numericPrice > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[-5, -3, 5, 10].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyPreset(pct)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    >
                      {pct > 0 ? `+${pct}%` : `${pct}%`}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label htmlFor="price-alert-target" className="block text-xs font-semibold text-slate-300 mb-1">
                  Mức giá mục tiêu (VND)
                </label>
                <input
                  id="price-alert-target"
                  type="text"
                  inputMode="numeric"
                  placeholder={numericPrice > 0 ? `VD: ${vndFormatter.format(roundToTick(numericPrice * 0.95))}` : "VD: 44000"}
                  value={targetInput}
                  onChange={(e) => {
                    setTargetInput(e.target.value.replace(/[^\d.,]/g, ""));
                    setError("");
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="price-alert-note" className="block text-xs font-semibold text-slate-300 mb-1">
                  Ghi chú nhắc bản thân (tùy chọn)
                </label>
                <input
                  id="price-alert-note"
                  type="text"
                  maxLength={120}
                  placeholder="VD: Vùng hỗ trợ mạnh, giải ngân 30% vốn"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
                />
              </div>

              {error && (
                <p className="text-xs text-rose-400 m-0" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-sm transition"
              >
                Lưu cảnh báo giá
              </button>
            </form>

            <div className="border-t border-slate-800 pt-3 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">
                Cảnh báo đang bật cho {normalizedSymbol} ({alerts.length})
              </p>
              {alerts.length === 0 ? (
                <p className="text-xs text-slate-500 m-0">
                  Chưa có cảnh báo nào cho mã này. Khi giá chạm ngưỡng, hệ thống sẽ báo nổi bật trên trang chủ và trang chi tiết.
                </p>
              ) : (
                <ul className="space-y-2 m-0 p-0 list-none max-h-44 overflow-y-auto">
                  {alerts.map((alert) => {
                    const hit = isAlertTriggered(alert, numericPrice > 0 ? numericPrice : null);
                    return (
                      <li
                        key={alert.id}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                          hit
                            ? "border-amber-400/50 bg-amber-500/15"
                            : "border-slate-800 bg-slate-950/70"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className={alert.direction === "below" ? "text-emerald-300" : "text-amber-300"}>
                              {alert.direction === "below" ? "≤" : "≥"} {vndFormatter.format(alert.targetPrice)} ₫
                            </span>
                            {hit && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                                Đã chạm!
                              </span>
                            )}
                          </div>
                          {alert.note && (
                            <p className="text-slate-400 m-0 mt-0.5 truncate">{alert.note}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(alert.id)}
                          aria-label={`Xóa cảnh báo ${alert.symbol}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
