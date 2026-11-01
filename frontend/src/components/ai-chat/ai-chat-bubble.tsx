"use client";

import type { AiMessage } from "@/types/ai-chat";
import { StockScoreCardWidget } from "./widgets/stock-score-card-widget";
import { StockComparisonWidget } from "./widgets/stock-comparison-widget";
import { ForensicWarningWidget } from "./widgets/forensic-warning-widget";
import { MarketPulseWidget } from "./widgets/market-pulse-widget";
import { SuggestedActionsWidget } from "./widgets/suggested-actions-widget";

export function AiChatBubble({
  message,
  onSendPrompt,
}: {
  message: AiMessage;
  onSendPrompt?: (prompt: string) => void;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] sm:max-w-[70%] bg-sky-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-md text-sm leading-relaxed">
          <p className="m-0 whitespace-pre-wrap">{message.content}</p>
          <span className="text-[10px] text-sky-200 block text-right mt-1 opacity-80">
            {new Date(message.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    );
  }

  // Assistant bubble
  return (
    <div className="flex items-start gap-3 mb-6">
      {/* Bot Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center text-white text-sm font-black shadow-md shrink-0 mt-1">
        🤖
      </div>

      <div className="flex-1 max-w-[92%] sm:max-w-[85%]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-sky-400">InvestIQ Assistant</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800/60 font-semibold">
            AI Cố Vấn
          </span>
        </div>

        {/* Text Body */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl rounded-tl-sm p-4 text-slate-200 text-sm leading-relaxed shadow-lg">
          <div className="space-y-2 whitespace-pre-wrap">
            {message.content.split("\n\n").map((para, i) => {
              if (para.startsWith("### ")) {
                return (
                  <h4 key={i} className="text-base font-extrabold text-white mt-2 mb-1">
                    {para.replace("### ", "")}
                  </h4>
                );
              }
              return (
                <p key={i} className="m-0 leading-relaxed">
                  {para}
                </p>
              );
            })}
          </div>

          {/* Render Rich Widgets if any */}
          {message.widgets && message.widgets.length > 0 && (
            <div className="mt-3 space-y-3">
              {message.widgets.map((widget, idx) => {
                if (widget.type === "stock_score_card") {
                  return <StockScoreCardWidget key={idx} data={widget.data} />;
                }
                if (widget.type === "stock_comparison") {
                  return <StockComparisonWidget key={idx} data={widget.data} />;
                }
                if (widget.type === "forensic_warning") {
                  return <ForensicWarningWidget key={idx} data={widget.data} />;
                }
                if (widget.type === "market_pulse") {
                  return <MarketPulseWidget key={idx} data={widget.data} />;
                }
                return null;
              })}
            </div>
          )}

          {/* Render Suggested Actions */}
          {message.suggested_actions && message.suggested_actions.length > 0 && (
            <SuggestedActionsWidget
              actions={message.suggested_actions}
              onSendPrompt={onSendPrompt}
            />
          )}

          <span className="text-[10px] text-slate-500 block text-right mt-2">
            {new Date(message.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}
