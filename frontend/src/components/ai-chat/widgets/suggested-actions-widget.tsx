"use client";

import { useRouter } from "next/navigation";
import type { SuggestedAction } from "@/types/ai-chat";

export function SuggestedActionsWidget({
  actions,
  onSendPrompt,
  onActionTriggered,
}: {
  actions: SuggestedAction[];
  onSendPrompt?: (prompt: string) => void;
  onActionTriggered?: () => void;
}) {
  const router = useRouter();

  if (!actions || actions.length === 0) return null;

  const handleNavigate = (url: string) => {
    onActionTriggered?.();
    if (typeof window !== "undefined") {
      router.push(url);
    }
  };

  const handleOpenTrade = (sym: string, qty: number, side: "buy" | "sell" = "buy") => {
    onActionTriggered?.();
    if (typeof window !== "undefined") {
      if (window.location.pathname.startsWith("/portfolio")) {
        window.dispatchEvent(
          new CustomEvent("open-stock-trade", {
            detail: { symbol: sym, side, quantity: qty },
          })
        );
      } else if (window.location.pathname.startsWith(`/market/stocks/${sym}`)) {
        const url = new URL(window.location.href);
        url.searchParams.set("trade", side);
        url.searchParams.set("qty", String(qty));
        window.history.pushState({}, "", url.toString());
        window.dispatchEvent(
          new CustomEvent("open-stock-trade", {
            detail: { symbol: sym, side, quantity: qty },
          })
        );
      } else {
        router.push(`/portfolio?action=trade&symbol=${sym}&side=${side}&qty=${qty}`);
      }
    }
  };

  const handlePostCommunityThesis = (act: SuggestedAction) => {
    onActionTriggered?.();
    const sym = act.symbol || "MBB";
    const payload = act.payload || {
      symbol: sym,
      title: act.title || `Luận điểm đầu tư ${sym}`,
      stance: act.stance || "bullish",
      targetPrice: act.target_price,
      stopLossPrice: act.stop_loss_price,
      horizon: act.horizon || 3,
      body: act.content || "",
      catalysts: act.catalysts || "",
    };
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("investiq_pending_thesis", JSON.stringify(payload));
      } catch {}
      router.push(act.url || `/community?action=new-thesis&symbol=${sym}`);
    }
  };

  const handleOpenModal = (sym: string, modalType: string) => {
    onActionTriggered?.();
    const normalizedModal = (modalType || "comparator").toLowerCase();
    const targetUrl = `/market/stocks/${sym}?modal=${normalizedModal}`;
    if (typeof window !== "undefined") {
      if (window.location.pathname.startsWith(`/market/stocks/${sym}`)) {
        const url = new URL(window.location.href);
        url.searchParams.set("modal", normalizedModal);
        window.history.pushState({}, "", url.toString());
        window.dispatchEvent(new CustomEvent("open-dca-comparator-modal"));
      } else {
        router.push(targetUrl);
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3 pt-2">
      <span className="text-[11px] font-semibold text-slate-400 block w-full mb-1">
        Gợi ý tiếp theo:
      </span>
      {actions.map((act, idx) => {
        if (act.action_type === "NAVIGATE" && act.url) {
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleNavigate(act.url!)}
              className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-sky-500 hover:bg-slate-800 text-xs font-semibold text-sky-300 hover:text-white transition shadow-sm active:scale-95 cursor-pointer"
            >
              <span>{act.label}</span>
            </button>
          );
        }

        if (act.action_type === "SEND_PROMPT" && act.prompt) {
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSendPrompt?.(act.prompt!)}
              className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-900 border border-teal-800/80 hover:border-teal-400 hover:bg-teal-950/40 text-xs font-semibold text-teal-300 hover:text-white transition shadow-sm active:scale-95 cursor-pointer"
            >
              <span>{act.label}</span>
            </button>
          );
        }

        if (act.action_type === "TRADE_ORDER") {
          const sym = act.symbol || "MBB";
          const qty = act.quantity || 100;
          const side = act.side === "sell" ? "sell" : "buy";
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleOpenTrade(sym, qty, side)}
              className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm active:scale-95 cursor-pointer ${
                side === "sell"
                  ? "bg-rose-950/60 border border-rose-700/80 hover:border-rose-400 hover:bg-rose-900/60 text-rose-300 hover:text-white"
                  : "bg-emerald-950/60 border border-emerald-700/80 hover:border-emerald-400 hover:bg-emerald-900/60 text-emerald-300 hover:text-white"
              }`}
            >
              <span>{act.label}</span>
            </button>
          );
        }

        if (act.action_type === "POST_COMMUNITY_THESIS") {
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handlePostCommunityThesis(act)}
              className="inline-flex items-center px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-700/80 hover:border-purple-400 hover:bg-purple-900/60 text-xs font-semibold text-purple-300 hover:text-white transition shadow-sm active:scale-95 cursor-pointer"
            >
              <span>{act.label}</span>
            </button>
          );
        }

        if (act.action_type === "OPEN_MODAL") {
          const sym = act.symbol || "HPG";
          const modalType = act.modal_type || "comparator";
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleOpenModal(sym, modalType)}
              className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-800/80 hover:border-amber-400 hover:bg-amber-950/40 text-xs font-semibold text-amber-300 hover:text-white transition shadow-sm active:scale-95 cursor-pointer"
            >
              <span>{act.label}</span>
            </button>
          );
        }

        return null;
      })}
    </div>
  );
}
