"use client";

import type { StockComparisonWidgetData } from "@/types/ai-chat";

export function StockComparisonWidget({ data }: { data: StockComparisonWidgetData }) {
  const { title, items, summary_verdict } = data;

  return (
    <div className="w-full max-w-xl bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl my-3 text-slate-200">
      <div className="border-b border-slate-800 pb-3 mb-4">
        <h4 className="text-sm sm:text-base font-bold text-white m-0">{title}</h4>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 mb-3">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-2.5 px-3">Mã / Chỉ tiêu</th>
              {items.map((it) => (
                <th key={it.symbol} className="py-2.5 px-3 font-extrabold text-white text-center text-xs">
                  {it.symbol}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            <tr className="hover:bg-slate-800/30 transition">
              <td className="py-2 px-3 text-slate-400">Thị giá hiện tại</td>
              {items.map((it) => (
                <td key={it.symbol} className="py-2 px-3 text-center font-bold text-white whitespace-nowrap">
                  {typeof it.price === "number" ? `${it.price.toLocaleString("vi-VN")} đ` : it.price}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-800/30 transition">
              <td className="py-2 px-3 text-slate-400">Biến động gần nhất</td>
              {items.map((it) => (
                <td
                  key={it.symbol}
                  className={`py-2 px-3 text-center font-bold whitespace-nowrap ${
                    it.change_percent.startsWith("+")
                      ? "text-emerald-400"
                      : it.change_percent.startsWith("-")
                        ? "text-rose-400"
                        : "text-amber-300"
                  }`}
                >
                  {it.change_percent}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-800/30 transition">
              <td className="py-2 px-3 text-slate-400">Định giá P/E</td>
              {items.map((it) => (
                <td key={it.symbol} className="py-2 px-3 text-center font-semibold text-slate-200">
                  {it.pe || "--"}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-800/30 transition">
              <td className="py-2 px-3 text-slate-400">Định giá P/B</td>
              {items.map((it) => (
                <td key={it.symbol} className="py-2 px-3 text-center font-semibold text-slate-200">
                  {it.pb || "--"}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-800/30 transition">
              <td className="py-2 px-3 text-slate-400">Hiệu quả ROE</td>
              {items.map((it) => (
                <td key={it.symbol} className="py-2 px-3 text-center font-bold text-emerald-400">
                  {it.roe || "--"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pros & Cons Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {items.map((it) => (
          <div key={it.symbol} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs">
            <div className="font-bold text-sky-400 mb-1.5 flex items-center justify-between">
              <span>{it.symbol} ({it.name})</span>
            </div>
            {it.pros.length > 0 && (
              <div className="space-y-1 mb-2">
                {it.pros.map((p, idx) => (
                  <div key={idx} className="flex items-start gap-1 text-[11px] text-emerald-300">
                    <span>✓</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}
            {it.cons.length > 0 && (
              <div className="space-y-1">
                {it.cons.map((c, idx) => (
                  <div key={idx} className="flex items-start gap-1 text-[11px] text-slate-400">
                    <span className="text-amber-400">•</span>
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {summary_verdict && (
        <div className="p-3 bg-sky-950/30 border border-sky-800/40 rounded-xl text-xs text-sky-200">
          <span className="font-bold text-sky-400 block mb-0.5">Nhận định định lượng:</span>
          {summary_verdict}
        </div>
      )}
    </div>
  );
}
