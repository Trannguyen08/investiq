"use client";

import { useEffect, useRef, useState } from "react";
import type { AiConversation, AiMessage } from "@/types/ai-chat";
import {
  deleteUserConversation,
  fetchConversationHistory,
  fetchUserConversations,
  sendChatMessage,
} from "@/lib/ai-chat-api";
import { AiChatBubble } from "./ai-chat-bubble";

const STORAGE_KEY = "investiq_ai_session";

const DEFAULT_WELCOME: AiMessage = {
  id: "workspace-welcome",
  role: "assistant",
  content:
    "Chào mừng bạn đến với InvestIQ Financial Assistant — Trợ lý phân tích tài chính toàn diện.\n\n" +
    "Tôi được trang bị hệ thống phân tích định lượng kết nối trực tiếp với 1.396 mã chứng khoán, dữ liệu BCTC và biểu đồ kỹ thuật. " +
    "Bạn có thể bắt đầu bằng một câu hỏi cụ thể hoặc chọn một gợi ý bên dưới:",
  suggested_actions: [
    { label: "Phân tích toàn diện HPG", action_type: "SEND_PROMPT", prompt: "Phân tích HPG" },
    { label: "So sánh VCB và MBB", action_type: "SEND_PROMPT", prompt: "So sánh VCB và MBB" },
    { label: "Kiểm tra rủi ro BCTC NVL", action_type: "SEND_PROMPT", prompt: "Kiểm tra rủi ro BCTC NVL" },
    { label: "Nhịp đập VN-Index hôm nay", action_type: "SEND_PROMPT", prompt: "Thị trường hôm nay thế nào?" },
  ],
  created_at: new Date().toISOString(),
};

export function AiAssistantWorkspace() {
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([DEFAULT_WELCOME]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Restore messages from sessionStorage or query param on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.messages && parsed.messages.length > 0) {
          setMessages(parsed.messages);
        }
        if (parsed.conversationId) {
          setActiveConvId(parsed.conversationId);
        }
      }
    } catch {
      // Ignore storage errors
    }

    // Load server conversations list if authenticated
    fetchUserConversations().then((data) => {
      setConversations(data);
    });
  }, []);

  // Save to sessionStorage when messages change
  useEffect(() => {
    if (messages.length > 1) {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ conversationId: activeConvId, messages })
        );
      } catch {
        // Ignore storage errors
      }
    }
  }, [messages, activeConvId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSelectConversation = async (convId: string) => {
    if (convId === activeConvId) return;
    setActiveConvId(convId);
    setIsLoadingHistory(true);
    try {
      const data = await fetchConversationHistory(convId);
      if (data && data.messages.length > 0) {
        setMessages(data.messages);
      } else {
        setMessages([DEFAULT_WELCOME]);
      }
    } catch {
      setMessages([DEFAULT_WELCOME]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([DEFAULT_WELCOME]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!confirm("Bạn có chắc muốn xóa cuộc trò chuyện này?")) return;
    const ok = await deleteUserConversation(convId);
    if (ok) {
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        handleNewChat();
      }
    }
  };

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
      const res = await sendChatMessage(text, activeConvId);
      if (res.conversation_id && res.conversation_id !== activeConvId) {
        setActiveConvId(res.conversation_id);
        fetchUserConversations().then(setConversations);
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

  return (
    <div className="w-full h-[calc(100vh-4rem)] flex overflow-hidden bg-[#06111f] text-slate-100">
      {/* Sidebar: Chat History */}
      <aside
        className={`${
          sidebarOpen ? "w-64 sm:w-72" : "w-0 -translate-x-full"
        } transition-all duration-300 bg-slate-900/95 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
            Lịch sử hội thoại
          </span>
          <button
            type="button"
            onClick={handleNewChat}
            className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 font-bold text-xs transition shadow-sm"
          >
            Tạo mới
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              Chưa có phiên lưu trữ. Các phiên hỏi đáp sẽ tự động được lưu khi bạn đăng nhập.
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition ${
                    isActive
                      ? "bg-sky-950/70 text-white border border-sky-800/80 font-bold shadow-sm"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <div className="flex-1 truncate mr-2">
                    <p className="m-0 truncate font-semibold text-slate-200">{conv.title}</p>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {new Date(conv.updated_at).toLocaleDateString("vi-VN")} · {conv.message_count} tin
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                    title="Xóa cuộc trò chuyện này"
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 px-1.5 py-0.5 rounded transition text-xs font-semibold"
                  >
                    Xóa
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer info */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/50 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>AI Trực tuyến</span>
          </span>
          <span className="text-slate-500">InvestIQ Quantitative</span>
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#06111f] relative">
        {/* Workspace Top Bar */}
        <div className="px-4 sm:px-6 py-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-sm font-semibold"
              title="Đóng / mở sidebar lịch sử"
            >
              ☰
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center text-slate-950 text-xs font-black shadow-md">
                AI
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-white m-0">
                    InvestIQ Financial Assistant
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    Trực tuyến
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 m-0 hidden sm:block">
                  Cố vấn tài chính định lượng hỗ trợ phân tích cổ phiếu, BCTC, chỉ báo nến và so sánh tài sản.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Message Stream Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoadingHistory ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              <span>Đang tải lịch sử hội thoại...</span>
            </div>
          ) : (
            messages.map((msg) => (
              <AiChatBubble key={msg.id} message={msg} onSendPrompt={(p) => handleSend(p)} />
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-2.5 text-xs text-sky-400 bg-slate-900/90 p-3 rounded-2xl border border-slate-800 w-fit shadow-lg">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping inline-block" />
              <span>AI đang tra cứu dữ liệu thị trường và phân tích...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-slate-900/90 border-t border-slate-800 shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-2 sm:gap-3 bg-slate-950 border border-slate-800 focus-within:border-sky-500 rounded-2xl p-2.5 sm:p-3 transition shadow-xl">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập mã CP hoặc câu hỏi (VD: 'Đánh giá HPG', 'So sánh VCB và MBB', 'Khám BCTC NVL')..."
                rows={1}
                className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-32 py-1 leading-relaxed"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 disabled:opacity-40 disabled:hover:from-sky-500 disabled:hover:to-teal-500 text-white font-extrabold text-xs transition shrink-0 shadow-lg"
              >
                Gửi
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-2 font-medium">
              <span>Nhấn Enter để gửi · Shift+Enter để xuống dòng</span>
              <span>Dữ liệu thời gian thực InvestIQ</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
