"use client";

import type { ForensicWarningWidgetData } from "@/types/ai-chat";

export function ForensicWarningWidget({ data }: { data: ForensicWarningWidgetData }) {
  const { symbol, altman_z_score, zone, flags } = data;

  const zoneLabel =
    zone === "safe"
      ? "Vùng An toàn (Rủi ro phá sản thấp)"
      : zone === "grey"
        ? "Vùng Xám / Thận trọng (Cần theo dõi thêm)"
        : "Vùng Báo động (Áp lực tài chính cao)";

  const zoneColor =
    zone === "safe"
      ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
      : zone === "grey"
        ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
        : "text-rose-400 border-rose-500/40 bg-rose-500/10";

  // Score slider position (range 0 to 4.5)
  const percent = Math.min(100, Math.max(0, (altman_z_score / 4.5) * 100));

  return (
    <div className="w-full max-w-xl bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl my-3 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🩺</span>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-white m-0">
              Giám định sức khỏe tài chính &amp; BCTC: {symbol}
            </h4>
            <span className="text-[11px] text-slate-400">Mô hình Altman Z-Score &amp; Kiểm toán Forensics</span>
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-bold border ${zoneColor}`}>
          Z-Score: {altman_z_score.toFixed(2)}
        </div>
      </div>

      {/* Visual Altman Z-Score bar */}
      <div className="mb-4 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
        <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
          <span className="text-slate-400">Phân loại sức khỏe:</span>
          <span className="font-bold text-white">{zoneLabel}</span>
        </div>
        <div className="relative h-2.5 rounded-full overflow-hidden bg-slate-800 flex">
          <div className="w-[40%] bg-rose-600/80" title="Báo động (<1.8)" />
          <div className="w-[25%] bg-amber-500/80" title="Thận trọng (1.8 - 2.9)" />
          <div className="w-[35%] bg-emerald-500/80" title="An toàn (>2.9)" />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
          <span>0 (Nguy hiểm)</span>
          <span>1.81</span>
          <span>2.99</span>
          <span>4.5+ (Rất tốt)</span>
        </div>
      </div>

      {/* Red Flags List */}
      <div>
        <h5 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
          <span>🚩</span>
          <span>Chi tiết cờ đỏ kế toán cần lưu ý:</span>
        </h5>
        <div className="space-y-2">
          {flags.map((f, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                f.level === "danger"
                  ? "bg-rose-950/40 border-rose-900/60 text-rose-200"
                  : f.level === "warning"
                    ? "bg-amber-950/40 border-amber-900/60 text-amber-200"
                    : "bg-slate-950/60 border-slate-800 text-slate-300"
              }`}
            >
              <span className="text-sm mt-0.5 shrink-0">
                {f.level === "danger" ? "🚨" : f.level === "warning" ? "⚠️" : "ℹ️"}
              </span>
              <div>
                <strong className="font-bold block text-slate-100">{f.title}</strong>
                <p className="text-[11px] text-slate-400 m-0 mt-0.5 leading-relaxed">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
