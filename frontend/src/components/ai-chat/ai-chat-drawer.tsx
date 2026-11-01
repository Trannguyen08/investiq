"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AiMessage } from "@/types/ai-chat";
import { sendChatMessage } from "@/lib/ai-chat-api";
import { AiChatBubble } from "./ai-chat-bubble";

const STORAGE_KEY = "investiq_ai_session";

const DEFAULT_WELCOME: AiMessage = {
  id: "welcome-msg",
  role: "assistant",
  content:
    "Xin chào, tôi là InvestIQ Assistant — Trợ lý phân tích tài chính và hỗ trợ đầu tư trực tiếp.\n\n" +
    "Bạn có thể hỏi tôi về bất kỳ mã cổ phiếu nào trên 3 sàn HOSE, HNX, UPCoM, yêu cầu so sánh đa tài sản hoặc rà soát cờ đỏ BCTC.",
  suggested_actions: [
    { label: "Phân tích cổ phiếu HPG", action_type: "SEND_PROMPT", prompt: "Phân tích HPG" },
    { label: "So sánh VCB và MBB", action_type: "SEND_PROMPT", prompt: "So sánh VCB và MBB" },
    { label: "Kiểm tra rủi ro BCTC NVL", action_type: "SEND_PROMPT", prompt: "Kiểm tra rủi ro BCTC NVL" },
    { label: "Nhịp đập thị trường hôm nay", action_type: "SEND_PROMPT", prompt: "Thị trường hôm nay thế nào?" },
  ],
  created_at: "2026-11-01T12:00:00.000Z",
};

export function AiChatDrawer() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AiMessage[]>([DEFAULT_WELCOME]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.messages && parsed.messages.length > 0) {
          setMessages(parsed.messages);
        }
        if (parsed.conversationId) {
          setConversationId(parsed.conversationId);
        }
      }
    } catch {
      // Ignore sessionStorage read errors
    }
  }, []);

  // Save session to sessionStorage whenever messages change
  useEffect(() => {
    if (messages.length > 1) {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ conversationId, messages })
        );
      } catch {
        // Ignore sessionStorage write errors
      }
    }
  }, [messages, conversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMaximized]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    setInput("");
    const userMsg: AiMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await sendChatMessage(text, conversationId);
      if (res.conversation_id) {
        setConversationId(res.conversation_id);
      }
      setMessages((prev) => [...prev, res.message]);
    } catch (err: unknown) {
      const errorMsg: AiMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: (err as Error)?.message || "Có lỗi xảy ra khi kết nối trợ lý AI. Vui lòng thử lại sau.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!mounted || pathname === "/ai-assistant") {
    return null;
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Mở Trợ lý AI InvestIQ"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 text-white font-bold rounded-full shadow-[0_0_20px_rgba(56,189,248,0.35)] hover:shadow-[0_0_30px_rgba(56,189,248,0.55)] transition-all transform hover:-translate-y-0.5 group"
      >
        <span className="w-6 h-6 rounded-lg bg-white/20 text-white flex items-center justify-center text-xs font-black tracking-tight">
          AI
        </span>
        <span className="text-xs sm:text-sm font-bold tracking-wide hidden sm:inline">
          {isOpen ? "Thu gọn" : "Trợ lý AI"}
        </span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] inline-block" />
      </button>

      {/* Chat Popover Window */}
      {isOpen && (
        <div
          className={`fixed z-50 bg-slate-950/95 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl transition-all duration-300 ${
            isMaximized
              ? "bottom-4 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[50vw] sm:min-w-[520px] sm:max-w-[760px] h-[86vh]"
              : "bottom-20 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[450px] h-[610px] max-h-[82vh]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center text-slate-950 text-xs font-black shadow-md">
                AI
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white m-0">InvestIQ Assistant</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                </div>
                <span className="text-[11px] text-slate-400 block">Cố vấn phân tích định lượng trực tiếp</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Full Page Link */}
              <Link
                href={`/ai-assistant${conversationId ? `?conv=${conversationId}` : ""}`}
                title="Mở toàn trang AI"
                className="px-2 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs font-semibold mr-0.5"
              >
                Trang AI
              </Link>

              {/* Maximize / Restore Icon Button */}
              <button
                type="button"
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? "Thu nhỏ (Nửa màn hình -> Thu nhỏ)" : "Phóng to nửa màn hình"}
                aria-label={isMaximized ? "Thu nhỏ" : "Phóng to nửa màn hình"}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition"
              >
                {isMaximized ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Đóng cửa sổ"
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <AiChatBubble
                key={msg.id}
                message={msg}
                onSendPrompt={(p) => handleSend(p)}
                onActionTriggered={() => setIsOpen(false)}
              />
            ))}

            {isLoading && (
              <div className="flex items-center gap-2.5 text-xs text-sky-400 bg-slate-900/80 p-3 rounded-2xl border border-slate-800 w-fit">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping inline-block" />
                <span>Đang truy xuất dữ liệu định lượng và phân tích...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 shrink-0">
            <div className="flex items-end gap-2 bg-slate-950 border border-slate-800 focus-within:border-sky-500 rounded-2xl px-3 py-2 transition shadow-inner">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập mã CP (HPG, VCB, MBB...), câu hỏi phân tích..."
                rows={1}
                className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-24 py-1"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                aria-label="Gửi tin nhắn"
                className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center transition shrink-0 shadow-md"
              >
                Gửi
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 px-1">
              <span>Enter để gửi · Shift+Enter để xuống dòng</span>
              <span>Dữ liệu thời gian thực InvestIQ</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
