"use client";

import type { AiMessage } from "@/types/ai-chat";
import { StockScoreCardWidget } from "./widgets/stock-score-card-widget";
import { StockComparisonWidget } from "./widgets/stock-comparison-widget";
import { ForensicWarningWidget } from "./widgets/forensic-warning-widget";
import { MarketPulseWidget } from "./widgets/market-pulse-widget";
import { SuggestedActionsWidget } from "./widgets/suggested-actions-widget";

/** Clean all leading decorative emojis and strip any raw '**' markdown asterisks */
function sanitizeText(raw: string): string {
  if (!raw) return "";
  return raw
    // Remove leading emojis/symbols from beginning of text
    .replace(/^[\s]*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}🤖🏮💬💡⚡🔗🔍📊⚖️🌐✅⚠️📌🗑️]+\s*/gu, "")
    // Remove emojis following line breaks
    .replace(/([\n\r]+)[\s]*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}🤖🏮💬💡⚡🔗🔍📊⚖️🌐✅⚠️📌🗑️]+\s*/gu, "$1")
    // Remove all markdown asterisks **
    .replace(/\*\*/g, "");
}

function FormattedContent({ text }: { text: string }) {
  const sanitized = sanitizeText(text);
  const paragraphs = sanitized.split(/\n\n+/);

  return (
    <div className="space-y-3 text-sm text-slate-200 leading-relaxed font-normal">
      {paragraphs.map((para, idx) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // Heading (starts with ### or looks like title)
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="text-sm sm:text-base font-bold text-sky-300 pt-1 border-b border-slate-800/80 pb-1.5 m-0">
              {trimmed.replace(/^###\s*/, "")}
            </h4>
          );
        }

        // List items
        const lines = trimmed.split(/\n/);
        const hasBullets = lines.some((l) => l.trim().startsWith("- ") || l.trim().startsWith("• "));

        if (hasBullets) {
          return (
            <div key={idx} className="space-y-1.5 pl-1">
              {lines.map((line, lIdx) => {
                const cleanLine = line.trim();
                const isBullet = cleanLine.startsWith("- ") || cleanLine.startsWith("• ");
                const content = isBullet ? cleanLine.substring(2) : cleanLine;

                return (
                  <div key={lIdx} className="flex items-start gap-2.5">
                    {isBullet && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-2 shrink-0 opacity-80" />
                    )}
                    <p className="m-0 leading-relaxed text-slate-200">{content}</p>
                  </div>
                );
              })}
            </div>
          );
        }

        return (
          <p key={idx} className="m-0 leading-relaxed text-slate-200">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

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
        <div className="max-w-[85%] sm:max-w-[70%] bg-sky-600/90 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-md text-sm leading-relaxed border border-sky-500/30">
          <p className="m-0 whitespace-pre-wrap">{sanitizeText(message.content)}</p>
          <span className="text-[10px] text-sky-200 block text-right mt-1 opacity-75 font-mono">
            {new Date(message.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    );
  }

  // Assistant bubble
  return (
    <div className="flex items-start gap-3 mb-6">
      {/* Bot Avatar: Modern typography AI pill */}
      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center text-slate-950 text-[11px] font-black shadow-md shrink-0 mt-0.5 tracking-tight">
        AI
      </div>

      <div className="flex-1 max-w-[95%] sm:max-w-[88%]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-bold text-sky-400">InvestIQ Assistant</span>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-950/80 text-sky-300 border border-sky-800/60 font-semibold tracking-wide">
            Cố vấn
          </span>
        </div>

        {/* Text Body */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl rounded-tl-sm p-4 sm:p-5 text-slate-200 text-sm leading-relaxed shadow-xl backdrop-blur-sm">
          <FormattedContent text={message.content} />

          {/* Render Rich Widgets if any */}
          {message.widgets && message.widgets.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-slate-800/80 pt-3">
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

          <span className="text-[10px] text-slate-500 block text-right mt-2 font-mono">
            {new Date(message.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}
