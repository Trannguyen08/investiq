"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AiMessage } from "@/types/ai-chat";
import { sendChatMessage } from "@/lib/ai-chat-api";
import { AiChatBubble } from "./ai-chat-bubble";

const DEFAULT_WELCOME: AiMessage = {
  id: "welcome-msg",
  role: "assistant",
  content:
    "Xin chào! Tôi là **InvestIQ Assistant** — Trợ lý tài chính và cố vấn đầu tư thông minh được kết nối trực tiếp với dữ liệu thị trường Việt Nam.\n\nBạn có thể hỏi tôi về bất kỳ mã cổ phiếu nào, yêu cầu so sánh đa tài sản, hoặc rà soát cờ đỏ BCTC!",
  suggested_actions: [
    { label: "Phân tích cổ phiếu HPG", action_type: "SEND_PROMPT", prompt: "Phân tích nhanh HPG" },
    { label: "So sánh VCB và MBB", action_type: "SEND_PROMPT", prompt: "So sánh VCB và MBB" },
    { label: "Kiểm tra rủi ro BCTC NVL", action_type: "SEND_PROMPT", prompt: "Kiểm tra rủi ro BCTC NVL" },
    { label: "Nhịp đập thị trường hôm nay", action_type: "SEND_PROMPT", prompt: "Thị trường hôm nay thế nào?" },
  ],
  created_at: new Date().toISOString(),
};

export function AiChatDrawer() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AiMessage[]>([DEFAULT_WELCOME]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

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
        content: `⚠️ ${(err as Error)?.message || "Có lỗi xảy ra khi kết nối trợ lý AI. Vui lòng thử lại."}`,
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

  if (pathname === "/ai-assistant") {
    return null;
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Mở Trợ lý AI InvestIQ"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 text-white font-bold rounded-full shadow-[0_0_20px_rgba(56,189,248,0.4)] hover:shadow-[0_0_30px_rgba(56,189,248,0.6)] transition-all transform hover:-translate-y-1 group"
      >
        <span className="text-xl animate-pulse">🤖</span>
        <span className="text-xs sm:text-sm font-extrabold tracking-wide hidden sm:inline">
          {isOpen ? "Thu nhỏ AI" : "InvestIQ AI"}
        </span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] inline-block" />
      </button>

      {/* Chat Popover Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[460px] h-[600px] max-h-[82vh] bg-slate-950/95 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-slate-900/90 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center text-white text-base font-black shadow-md">
                🤖
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white m-0">InvestIQ AI Assistant</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                </div>
                <span className="text-[11px] text-slate-400 block">Cố vấn tài chính &amp; phân tích dữ liệu</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link
                href="/ai-assistant"
                title="Mở rộng toàn màn hình"
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition text-sm"
              >
                ⤢
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Đóng cửa sổ chat"
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition text-lg"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <AiChatBubble key={msg.id} message={msg} onSendPrompt={(p) => handleSend(p)} />
            ))}

            {isLoading && (
              <div className="flex items-center gap-2.5 text-xs text-sky-400 bg-slate-900/80 p-3 rounded-2xl border border-slate-800 w-fit animate-pulse">
                <span className="animate-spin text-sm">⚙️</span>
                <span>AI đang đối chiếu dữ liệu thị trường và phân tích...</span>
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
                placeholder="Hỏi về mã cổ phiếu, BCTC, nến, so sánh..."
                rows={1}
                className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-24 py-1"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                aria-label="Gửi tin nhắn"
                className="w-8 h-8 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-white flex items-center justify-center transition shrink-0 shadow-md"
              >
                ➔
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
