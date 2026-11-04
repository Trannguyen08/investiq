"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AiMessage } from "@/types/ai-chat";
import { ForensicWarningWidget } from "./widgets/forensic-warning-widget";
import { MarketPulseWidget } from "./widgets/market-pulse-widget";
import { StockComparisonWidget } from "./widgets/stock-comparison-widget";
import { StockScoreCardWidget } from "./widgets/stock-score-card-widget";
import { SuggestedActionsWidget } from "./widgets/suggested-actions-widget";

/** Clean all leading decorative emojis, normalize redundant dividend phrases, and strip raw '**' markdown asterisks */
function sanitizeText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/^[\s]*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}🤖🏮💬💡⚡🔗🔍📊⚖️🌐✅⚠️📌🗑️]+\s*/gu, "")
    .replace(/([\n\r]+)[\s]*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}🤖🏮💬💡⚡🔗🔍📊⚖️🌐✅⚠️📌🗑️]+\s*/gu, "$1")
    .replace(/Tỷ lệ:\s*Cổ tức bằng [^,]+,\s*tỷ lệ\s*/gi, "Tỷ lệ: ")
    .replace(/\*\*/g, "");
}

/** Client-safe timestamp renderer to eliminate SSR hydration mismatches */
function MessageTime({
  timestamp,
  isUser = false,
}: {
  timestamp: string;
  isUser?: boolean;
}) {
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
    <span
      className={`text-[10px] font-mono select-none ${
        isUser
          ? "text-sky-100 font-semibold shrink-0 align-bottom inline-block leading-none tracking-tight ml-2"
          : "text-slate-500 block text-right mt-2"
      }`}
      suppressHydrationWarning
    >
      {formatted}
    </span>
  );
}

/** Highlight numbers, percentages, colon ratios, currency, and financial ratios */
function HighlightedText({ text }: { text: string }) {
  // Regex to match percentages (-0.94%, +1.2%, 10%), colon ratios (10:1, 100:15, 100:32, 100:3),
  // prices (1,000 đ/cp, 21,000 đ, 125.4 tỷ đ), multiples (6.5x), indicators (RSI (14), MA20)
  const regex =
    /([+-]?\d+(?:[.,]\d+)?%|\b\d+\s*:\s*\d+(?:[.,]\d+)?\b|\d+(?:[.,]\d{3})*(?:[.,]\d+)?\s*(?:đ(?:\s*\/\s*cp)?|tỷ\s*đ|nghìn\s*tỷ\s*đồng|nghìn\s*tỷ)|\b\d+(?:\.\d+)?x\b|RSI\s*\(\d+\)|MA\d+)/g;
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        // Percentage with sign (+1.97%, -0.94%)
        if (/^[+-]\d+(?:[.,]\d+)?%$/.test(part)) {
          const isNegative = part.startsWith("-");
          return (
            <span
              key={i}
              className={`font-bold px-1.5 py-0.5 rounded text-xs font-mono inline-block mx-0.5 whitespace-nowrap ${
                isNegative
                  ? "bg-rose-950/80 text-rose-300 border border-rose-800/60"
                  : "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
              }`}
            >
              {part}
            </span>
          );
        }

        // Percentage neutral / ROE (10%, 22.6%) OR Colon dividend/right ratio (10:1, 100:15, 100:32, 100:3)
        if (/^\d+(?:[.,]\d+)?%$/.test(part) || /^\d+\s*:\s*\d+(?:[.,]\d+)?$/.test(part)) {
          return (
            <span
              key={i}
              className="font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50 font-mono text-xs inline-block mx-0.5 whitespace-nowrap"
            >
              {part}
            </span>
          );
        }

        // Price / Value in VND (1,000 đ/cp, 19,250 đ, 15.2 tỷ đ)
        if (/\d+(?:[.,]\d{3})*(?:[.,]\d+)?\s*(?:đ(?:\s*\/\s*cp)?|tỷ\s*đ|nghìn\s*tỷ\s*đồng|nghìn\s*tỷ)$/.test(part)) {
          return (
            <span
              key={i}
              className="font-extrabold text-sky-300 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/50 font-mono text-xs inline-block mx-0.5 whitespace-nowrap"
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
              className="font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50 font-mono text-xs inline-block mx-0.5 whitespace-nowrap"
            >
              {part}
            </span>
          );
        }

        // Indicator (RSI, MA)
        if (/^(RSI\s*\(\d+\)|MA\d+)$/.test(part)) {
          return (
            <span key={i} className="font-semibold text-teal-300 font-mono inline-block mx-0.5 whitespace-nowrap">
              {part}
            </span>
          );
        }

        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function FormattedContent({
  text,
  stripSourcesBlock = false,
}: {
  text: string;
  stripSourcesBlock?: boolean;
}) {
  let sanitized = sanitizeText(text);

  // Strip duplicate trailing "Nguồn tham khảo:" text block when structured interactive pills are rendered below
  if (stripSourcesBlock) {
    sanitized = sanitized.replace(
      /\n*Nguồn tham khảo:\s*(?:\n+-\s*\[(?:Hệ thống InvestIQ|Nguồn ngoài)\][^\n]*)+/gi,
      ""
    );
  }

  // If text contains continuous single-line financial reports, split cleanly on section boundaries
  const normalized = sanitized
    .replace(/(Báo cáo phân tích chuyên sâu:[^\n]+)/g, "$1\n\n")
    .replace(/(Đối chiếu so sánh:[^\n]+)/g, "$1\n\n")
    .replace(/(Lịch chia cổ tức:[^\n]+)/g, "$1\n\n")
    .replace(/(Lịch chia cổ tức các doanh nghiệp sắp tới:[^\n]+)/g, "$1\n\n")
    .replace(/(Điểm tin chứng khoán[^\n]+)/g, "$1\n\n")
    .replace(/(Điểm tin thị trường hôm nay:[^\n]+)/g, "$1\n\n")
    .replace(/(Top cổ phiếu[^\n]+:)/g, "$1\n\n")
    .replace(/(Thống kê giao dịch khối ngoại hôm nay:)/g, "$1\n\n")
    .replace(/(Diễn biến các nhóm ngành dẫn dắt hôm nay:)/g, "$1\n\n")
    .replace(/(Nhịp đập thị trường chứng khoán[^\n]*)/g, "$1\n\n");

  const rawBlocks = normalized.split(/\n\n+/);

  return (
    <div className="space-y-2.5 text-sm text-slate-200 leading-relaxed font-normal min-w-0 max-w-full">
      {rawBlocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (
          stripSourcesBlock &&
          (trimmed.startsWith("Nguồn tham khảo:") ||
            /^-\s*\[(?:Hệ thống InvestIQ|Nguồn ngoài)\]/.test(trimmed))
        ) {
          return null;
        }

        // Heading
        if (
          trimmed.startsWith("### ") ||
          trimmed.startsWith("Báo cáo phân tích chuyên sâu:") ||
          trimmed.startsWith("Đối chiếu so sánh:") ||
          trimmed.startsWith("Lịch chia cổ tức:") ||
          trimmed.startsWith("Lịch chia cổ tức các doanh nghiệp sắp tới:") ||
          trimmed.startsWith("Điểm tin thị trường hôm nay:") ||
          trimmed.startsWith("Điểm tin chứng khoán") ||
          trimmed.startsWith("Tin tức nổi bật hôm nay:") ||
          trimmed.startsWith("Top cổ phiếu") ||
          trimmed.startsWith("Thống kê giao dịch khối ngoại hôm nay:") ||
          trimmed.startsWith("Diễn biến các nhóm ngành dẫn dắt hôm nay:") ||
          trimmed.startsWith("Nhịp đập thị trường chứng khoán")
        ) {
          const title = trimmed.replace(/^###\s*/, "");
          return (
            <h4
              key={bIdx}
              className="text-sm sm:text-base font-extrabold text-sky-300 pt-1 border-b border-slate-800/80 pb-1.5 m-0 tracking-tight break-words"
            >
              <HighlightedText text={title} />
            </h4>
          );
        }

        // Lines within block
        const lines = trimmed
          .split(/\n+/)
          .map((l) => l.trim())
          .filter((l) => {
            if (!l) return false;
            if (
              stripSourcesBlock &&
              (l === "Nguồn tham khảo:" || /^-\s*\[(?:Hệ thống InvestIQ|Nguồn ngoài)\]/.test(l))
            ) {
              return false;
            }
            return true;
          });

        if (lines.length === 0) return null;

        return (
          <div key={bIdx} className="space-y-1.5 min-w-0">
            {lines.map((line, lIdx) => {
              const trimmedLine = line.trim();
              // Prevent rendering empty or orphan marker rows
              if (
                !trimmedLine ||
                trimmedLine === "-" ||
                trimmedLine === "•" ||
                trimmedLine === "*" ||
                trimmedLine === "- -" ||
                /^[\s.\-•*–—]+$/.test(trimmedLine)
              ) {
                return null;
              }

              const isBullet =
                trimmedLine.startsWith("- ") ||
                trimmedLine.startsWith("• ") ||
                trimmedLine.startsWith("* ");
              const cleanLine = (isBullet ? trimmedLine.substring(2) : trimmedLine).trim();
              if (!cleanLine || /^[\s.\-•*–—]+$/.test(cleanLine)) {
                return null;
              }

              // Check if line starts with key dimension
              const hasColon = cleanLine.includes(":");
              const [firstPart, ...rest] = cleanLine.split(":");
              const label = hasColon ? firstPart.trim() : "";
              const value = hasColon ? rest.join(":").trim() : cleanLine;

              return (
                <div
                  key={lIdx}
                  className={`flex items-start gap-2 py-1.5 px-2.5 rounded-xl transition min-w-0 max-w-full ${
                    isBullet || hasColon
                      ? "bg-slate-950/50 border border-slate-800/60"
                      : "bg-transparent"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-2 shrink-0 opacity-80" />
                  <div className="flex-1 min-w-0 break-words leading-relaxed text-xs sm:text-sm text-slate-200">
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
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] sm:max-w-[70%] bg-gradient-to-r from-sky-600 via-sky-600 to-cyan-600 text-white rounded-2xl rounded-tr-xs px-3.5 py-1.5 sm:py-2 shadow-md shadow-sky-950/30 border border-sky-400/30">
          <div className="flex flex-wrap items-end justify-between gap-x-2.5 gap-y-1">
            <p className="m-0 whitespace-pre-wrap leading-relaxed text-slate-50 break-words flex-1 min-w-0 text-sm font-normal">
              {sanitizeText(message.content)}
            </p>
            <MessageTime timestamp={message.created_at} isUser={true} />
          </div>
        </div>
      </div>
    );
  }

  // Deduplicate structured sources by URL so identical links never repeat
  const uniqueSources = (message.sources || []).filter(
    (s, idx, arr) => Boolean(s.url) && arr.findIndex((item) => item.url === s.url) === idx
  );

  // Assistant bubble
  return (
    <div className="flex items-start gap-2.5 sm:gap-3 mb-5 min-w-0 max-w-full">
      {/* Bot Avatar: Modern typography AI pill */}
      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center text-slate-950 text-[11px] font-black shadow-md shrink-0 mt-0.5 tracking-tight">
        AI
      </div>

      <div className="flex-1 min-w-0 max-w-full">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-xs font-bold text-sky-400">InvestIQ Assistant</span>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-950/80 text-sky-300 border border-sky-800/60 font-semibold tracking-wide">
            Cố vấn
          </span>
          {message.is_cached && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-medium">
              ⚡ Phản hồi từ cache
            </span>
          )}
          {message.evaluation && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 font-mono"
              title={Object.entries(message.evaluation.checks || {})
                .map(([k, v]) => `${k}: ${v ? "✓" : "✗"}`)
                .join("\n")}
            >
              Eval: {Math.round(message.evaluation.score * 100)}%
            </span>
          )}
        </div>

        {/* Text Body */}
        <div className="bg-slate-900/85 border border-slate-800/90 rounded-2xl rounded-tl-sm p-3.5 sm:p-4 text-slate-200 text-sm leading-relaxed shadow-xl backdrop-blur-sm min-w-0 max-w-full overflow-hidden break-words">
          <FormattedContent
            text={message.content}
            stripSourcesBlock={uniqueSources.length > 0}
          />

          {/* Render Rich Widgets if any */}
          {message.widgets && message.widgets.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-slate-800/80 pt-3 min-w-0 max-w-full">
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

          {/* Render Interactive Citation Links */}
          {uniqueSources.length > 0 && (
            <div className="mt-4 border-t border-slate-800/80 pt-3">
              <span className="text-[11px] font-bold text-slate-400 block mb-2 uppercase tracking-wider">
                Nguồn tham khảo đã kiểm chuẩn:
              </span>
              <div className="flex flex-wrap gap-2">
                {uniqueSources.map((s, idx) => {
                  const isInternal = s.kind === "internal" || s.url.startsWith("/");
                  if (isInternal) {
                    return (
                      <Link
                        key={idx}
                        href={s.url}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-800/60 text-xs transition max-w-full"
                      >
                        <span className="text-[9px] px-1 py-0.2 rounded bg-sky-800/60 text-sky-200 font-bold shrink-0">
                          InvestIQ
                        </span>
                        <span className="truncate max-w-[220px]">{s.title}</span>
                      </Link>
                    );
                  }
                  return (
                    <a
                      key={idx}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 hover:bg-slate-800/80 text-slate-300 border border-slate-700/60 text-xs transition max-w-full"
                    >
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-bold shrink-0">
                        Web
                      </span>
                      <span className="truncate max-w-[220px]">{s.title}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">↗</span>
                    </a>
                  );
                })}
              </div>
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
