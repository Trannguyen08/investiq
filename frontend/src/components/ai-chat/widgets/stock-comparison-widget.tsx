"use client";

import { useState } from "react";
import type { StockComparisonWidgetData } from "@/types/ai-chat";

export function StockComparisonWidget({ data }: { data: StockComparisonWidgetData }) {
  const { title, items: rawItems, summary_verdict, mode = "metrics" } = data;
  const items = (rawItems || []).slice(0, 2);
  const isBoth = mode === "both";
  const [activeTab, setActiveTab] = useState<"metrics" | "growth">(
    mode === "growth" ? "growth" : "metrics"
  );

  const displayTab = isBoth ? activeTab : mode === "growth" ? "growth" : "metrics";

  const badgeConfig = (status?: string | null) => {
    switch (status) {
      case "expanding":
        return { label: "Bứt phá", cls: "bg-emerald-950/80 text-emerald-300 border-emerald-800" };
      case "stable":
        return { label: "Ổn định", cls: "bg-sky-950/80 text-sky-300 border-sky-800" };
      case "accumulating":
        return { label: "Tích lũy", cls: "bg-amber-950/80 text-amber-300 border-amber-800" };
      case "cautious":
      default:
        return { label: "Thận trọng", cls: "bg-rose-950/80 text-rose-300 border-rose-800" };
    }
  };

  return (
    <div className="w-full max-w-2xl bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-2xl my-2.5 text-slate-200 overflow-hidden">
      <div className="border-b border-slate-800 pb-3 mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm sm:text-base font-bold text-white m-0">{title}</h4>
        {isBoth && (
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("metrics")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                displayTab === "metrics"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Thông số định giá
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("growth")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                displayTab === "growth"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Báo cáo tăng trưởng
            </button>
          </div>
        )}
      </div>

      {displayTab === "metrics" ? (
        <>
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

          {/* Pros & Cons Cards */}
          <div className={`grid grid-cols-1 ${items.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-2.5 mb-3`}>
            {items.map((it) => (
              <div key={it.symbol} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs">
                <div className="font-bold text-sky-400 mb-1.5 flex items-center justify-between">
                  <span>
                    {it.symbol} ({it.name})
                  </span>
                </div>
                {it.pros && it.pros.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {it.pros.map((p, idx) => (
                      <div key={idx} className="flex items-start gap-1 text-[11px] text-emerald-300">
                        <span>✓</span>
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                )}
                {it.cons && it.cons.length > 0 && (
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
        </>
      ) : (
        <>
          {/* Growth Report Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 mb-3">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Mã / Tiêu chí tăng trưởng</th>
                  {items.map((it) => (
                    <th key={it.symbol} className="py-2.5 px-3 font-extrabold text-white text-center text-xs">
                      {it.symbol}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2 px-3 text-slate-400">Sức khỏe tài chính</td>
                  {items.map((it) => {
                    const b = badgeConfig(it.health_status);
                    return (
                      <td key={it.symbol} className="py-2 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${b.cls}`}>
                          {b.label}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2 px-3 text-slate-400">Tăng trưởng vốn hóa 1T</td>
                  {items.map((it) => (
                    <td key={it.symbol} className="py-2 px-3 text-center font-semibold text-slate-200">
                      {it.market_cap_growth_1m || "--"}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2 px-3 text-slate-400">Tăng trưởng vốn hóa 3T</td>
                  {items.map((it) => (
                    <td key={it.symbol} className="py-2 px-3 text-center font-semibold text-slate-200">
                      {it.market_cap_growth_3m || "--"}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2 px-3 text-slate-400">Tăng trưởng vốn hóa 1N</td>
                  {items.map((it) => (
                    <td key={it.symbol} className="py-2 px-3 text-center font-semibold text-slate-200">
                      {it.market_cap_growth_1y || "--"}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2 px-3 text-slate-400">Doanh thu quý (YoY)</td>
                  {items.map((it) => (
                    <td key={it.symbol} className="py-2 px-3 text-center font-bold text-teal-400">
                      {it.revenue_growth_yoy || "--"}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2 px-3 text-slate-400">LNST quý (YoY)</td>
                  {items.map((it) => (
                    <td key={it.symbol} className="py-2 px-3 text-center font-bold text-emerald-400">
                      {it.profit_growth_yoy || "--"}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2 px-3 text-slate-400">Quy mô LNST TTM</td>
                  {items.map((it) => (
                    <td key={it.symbol} className="py-2 px-3 text-center font-semibold text-slate-200">
                      {it.profit_ttm || "--"}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2 px-3 text-slate-400">Khối lượng vs TB 20P</td>
                  {items.map((it) => (
                    <td key={it.symbol} className="py-2 px-3 text-center font-medium text-slate-300 text-[11px]">
                      {it.volume_growth_20d || "Ổn định"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Growth Insights Cards */}
          <div className={`grid grid-cols-1 ${items.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-2.5 mb-3`}>
            {items.map((it) => (
              <div key={it.symbol} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs">
                <div className="font-bold text-teal-400 mb-1 flex items-center justify-between">
                  <span>{it.symbol}</span>
                  <span className="text-[10px] text-slate-400">{it.health_title || "Ổn định"}</span>
                </div>
                {it.growth_insights && it.growth_insights.length > 0 ? (
                  <div className="space-y-1">
                    {it.growth_insights.map((ins, idx) => (
                      <p key={idx} className="text-[11px] text-slate-300 m-0 leading-relaxed">
                        • {ins}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 m-0 italic">
                    {it.health_summary || "Cơ cấu tài chính duy trì ổn định, an toàn."}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {summary_verdict && (
        <div className="p-3 bg-sky-950/30 border border-sky-800/40 rounded-xl text-xs text-sky-200">
          <span className="font-bold text-sky-400 block mb-0.5">Nhận định định lượng:</span>
          {summary_verdict}
        </div>
      )}
    </div>
  );
}
