"use client";

import Link from "next/link";
import type { SuggestedAction } from "@/types/ai-chat";

export function SuggestedActionsWidget({
  actions,
  onSendPrompt,
}: {
  actions: SuggestedAction[];
  onSendPrompt?: (prompt: string) => void;
}) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3 pt-2">
      <span className="text-[11px] font-semibold text-slate-400 block w-full mb-1">
        💡 Hành động &amp; gợi ý tiếp theo:
      </span>
      {actions.map((act, idx) => {
        if (act.action_type === "NAVIGATE" && act.url) {
          return (
            <Link
              key={idx}
              href={act.url}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-sky-500 hover:bg-slate-800 text-xs font-semibold text-sky-300 hover:text-white transition shadow-sm"
            >
              <span>🔗</span>
              <span>{act.label}</span>
            </Link>
          );
        }

        if (act.action_type === "SEND_PROMPT" && act.prompt) {
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSendPrompt?.(act.prompt!)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-teal-800/80 hover:border-teal-400 hover:bg-teal-950/40 text-xs font-semibold text-teal-300 hover:text-white transition shadow-sm"
            >
              <span>💬</span>
              <span>{act.label}</span>
            </button>
          );
        }

        if (act.action_type === "TRADE_ORDER") {
          return (
            <Link
              key={idx}
              href={`/market/stocks/${act.symbol || "HPG"}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-700/80 hover:border-emerald-400 hover:bg-emerald-900/60 text-xs font-semibold text-emerald-300 hover:text-white transition shadow-sm"
            >
              <span>⚡</span>
              <span>{act.label}</span>
            </Link>
          );
        }

        if (act.action_type === "OPEN_MODAL") {
          return (
            <Link
              key={idx}
              href={`/market/stocks/${act.symbol || "HPG"}?modal=${act.modal_type || "comparator"}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-800/80 hover:border-amber-400 hover:bg-amber-950/40 text-xs font-semibold text-amber-300 hover:text-white transition shadow-sm"
            >
              <span>⚖️</span>
              <span>{act.label}</span>
            </Link>
          );
        }

        return null;
      })}
    </div>
  );
}
