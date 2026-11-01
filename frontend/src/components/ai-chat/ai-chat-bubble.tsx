"use client";

import { useEffect, useState } from "react";
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
    .replace(/^[\s]*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}🤖🏮💬💡⚡🔗🔍📊⚖️🌐✅⚠️📌🗑️]+\s*/gu, "")
    .replace(/([\n\r]+)[\s]*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}🤖🏮💬💡⚡🔗🔍📊⚖️🌐✅⚠️📌🗑️]+\s*/gu, "$1")
    .replace(/\*\*/g, "");
}

/** Client-safe timestamp renderer to eliminate SSR hydration mismatches */
function MessageTime({ timestamp }: { timestamp: string }) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    try {
      const d = new Date(timestamp);
      if (!isNaN(d.getTime())) {
        setFormatted(
          d.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      }
    } catch {
      // Ignore
    }
  }, [timestamp]);

  if (!formatted) return null;

  return (
    <span className="text-[10px] text-slate-500 block text-right mt-2 font-mono" suppressHydrationWarning>
      {formatted}
    </span>
  );
}

/** Highlight numbers, percentages, currency, and financial ratios */
function HighlightedText({ text }: { text: string }) {
  // Regex to match percentages (-0.94%, +1.2%), prices (21,000 đ, 21.000 đ), multiples (6.5x), indicators (RSI (14), MA20)
  const regex = /([+-]?\d+(?:[.,]\d+)?%|\d{1,3}(?:[.,]\d{3})*\s*đ|\b\d+(?:\.\d+)?x\b|RSI\s*\(\d+\)|MA\d+)/g;
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        // Percentage with sign
        if (/^[+-]\d+(?:[.,]\d+)?%$/.test(part)) {
          const isNegative = part.startsWith("-");
          return (
            <span
              key={i}
              className={`font-bold px-1.5 py-0.5 rounded text-xs font-mono inline-block mx-0.5 ${
                isNegative
                  ? "bg-rose-950/80 text-rose-300 border border-rose-800/60"
                  : "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
              }`}
            >
              {part}
            </span>
          );
        }

        // Percentage neutral / ROE
        if (/^\d+(?:[.,]\d+)?%$/.test(part)) {
          return (
            <span
              key={i}
              className="font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50 font-mono text-xs inline-block mx-0.5"
            >
              {part}
            </span>
          );
        }

        // Price in VND
        if (/\d{1,3}(?:[.,]\d{3})*\s*đ/.test(part)) {
          return (
            <span
              key={i}
              className="font-extrabold text-sky-300 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/50 font-mono text-xs inline-block mx-0.5"
            >
              {part}
            </span>
          );
        }

        // Multiple (6.5x, 1.2x)
        if (/^\d+(?:\.\d+)?x$/.test(part)) {
          return (
            <span
              key={i}
              className="font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50 font-mono text-xs inline-block mx-0.5"
            >
              {part}
            </span>
          );
        }

        // Indicator (RSI, MA)
        if (/^(RSI\s*\(\d+\)|MA\d+)$/.test(part)) {
          return (
            <span key={i} className="font-semibold text-teal-300 font-mono inline-block mx-0.5">
              {part}
            </span>
          );
        }

        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function FormattedContent({ text }: { text: string }) {
  const sanitized = sanitizeText(text);

  // If text contains continuous single-line financial reports, split into distinct lines
  let normalized = sanitized
    .replace(/(Định giá:)/g, "\n- $1")
    .replace(/(Tín hiệu kỹ thuật:|Kỹ thuật:)/g, "\n- $1")
    .replace(/(Vùng hỗ trợ|Vùng giá trọng yếu:)/g, "\n- $1");

  const rawBlocks = normalized.split(/\n\n+/);

  return (
    <div className="space-y-2.5 text-sm text-slate-200 leading-relaxed font-normal">
      {rawBlocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Heading
        if (trimmed.startsWith("### ") || trimmed.startsWith("Báo cáo phân tích chuyên sâu:") || trimmed.startsWith("Đối chiếu so sánh:")) {
          const title = trimmed.replace(/^###\s*/, "");
          return (
            <h4
              key={bIdx}
              className="text-sm sm:text-base font-extrabold text-sky-300 pt-1 border-b border-slate-800/80 pb-1.5 m-0 tracking-tight"
            >
              <HighlightedText text={title} />
            </h4>
          );
        }

        // Lines within block
        const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);

        return (
          <div key={bIdx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const isBullet = line.startsWith("- ") || line.startsWith("• ");
              const cleanLine = isBullet ? line.substring(2) : line;

              // Check if line starts with key dimension
              const hasColon = cleanLine.includes(":");
              const [firstPart, ...rest] = cleanLine.split(":");
              const label = hasColon ? firstPart.trim() : "";
              const value = hasColon ? rest.join(":").trim() : cleanLine;

              return (
                <div
                  key={lIdx}
                  className={`flex items-start gap-2 py-1 px-2.5 rounded-xl transition ${
                    isBullet || hasColon
                      ? "bg-slate-950/50 border border-slate-800/60"
                      : "bg-transparent"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-2 shrink-0 opacity-80" />
                  <div className="flex-1 leading-relaxed text-xs sm:text-sm text-slate-200">
                    {hasColon ? (
                      <>
                        <strong className="text-white font-bold mr-1.5">{label}:</strong>
                        <HighlightedText text={value} />
                      </>
                    ) : (
                      <HighlightedText text={cleanLine} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function AiChatBubble({
  message,
  onSendPrompt,
  onActionTriggered,
}: {
  message: AiMessage;
  onSendPrompt?: (prompt: string) => void;
  onActionTriggered?: () => void;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] sm:max-w-[70%] bg-sky-600/95 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-md text-sm leading-relaxed border border-sky-500/30">
          <p className="m-0 whitespace-pre-wrap">{sanitizeText(message.content)}</p>
          <MessageTime timestamp={message.created_at} />
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

      <div className="flex-1 max-w-[96%] sm:max-w-[90%]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-bold text-sky-400">InvestIQ Assistant</span>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-950/80 text-sky-300 border border-sky-800/60 font-semibold tracking-wide">
            Cố vấn
          </span>
        </div>

        {/* Text Body */}
        <div className="bg-slate-900/85 border border-slate-800/90 rounded-2xl rounded-tl-sm p-4 sm:p-5 text-slate-200 text-sm leading-relaxed shadow-xl backdrop-blur-sm">
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
              onActionTriggered={onActionTriggered}
            />
          )}

          <MessageTime timestamp={message.created_at} />
        </div>
      </div>
    </div>
  );
}
