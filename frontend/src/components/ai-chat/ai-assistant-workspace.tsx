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

const DEFAULT_WELCOME: AiMessage = {
  id: "workspace-welcome",
  role: "assistant",
  content:
    "Chào mừng bạn đến với **InvestIQ Financial Assistant** — Trợ lý phân tích tài chính toàn diện.\n\n" +
    "Tôi được trang bị hệ thống phân tích định lượng kết nối trực tiếp với 1.396 mã chứng khoán, dữ liệu BCTC và biểu đồ kỹ thuật. " +
    "Bạn có thể bắt đầu bằng một câu hỏi cụ thể hoặc chọn một gợi ý bên dưới:",
  suggested_actions: [
    { label: "Phân tích toàn diện HPG", action_type: "SEND_PROMPT", prompt: "Phân tích toàn diện HPG" },
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

  // Load conversations list on mount
  useEffect(() => {
    fetchUserConversations().then((data) => {
      setConversations(data);
    });
  }, []);

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
        // Refresh conversations list
        fetchUserConversations().then(setConversations);
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

  return (
    <div className="w-full h-[calc(100vh-5rem)] max-w-7xl mx-auto flex overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/90 shadow-2xl text-slate-100 my-4">
      {/* Sidebar: Chat History */}
      <aside
        className={`${
          sidebarOpen ? "w-72 sm:w-80" : "w-0 -translate-x-full"
        } transition-all duration-300 bg-slate-900/95 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <span className="font-extrabold text-sm text-white">Lịch sử hội thoại</span>
          </div>
          <button
            type="button"
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 font-bold text-xs transition shadow-sm"
          >
            <span>+</span>
            <span>Mới</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              Chưa có phiên lưu trữ. Các phiên hỏi đáp sẽ tự động được lưu tại đây khi bạn đăng nhập!
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer text-xs transition ${
                    isActive
                      ? "bg-sky-950/60 text-white border border-sky-800/80 font-bold shadow-sm"
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
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 rounded transition"
                  >
                    🗑️
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
            <span>AI Connected</span>
          </span>
          <span className="text-slate-500">InvestIQ v2.0</span>
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 relative">
        {/* Workspace Top Bar */}
        <div className="px-5 py-3.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-sm"
              title="Đóng / mở sidebar lịch sử"
            >
              ☰
            </button>
            <div>
              <h2 className="text-base font-extrabold text-white m-0 flex items-center gap-2">
                <span>🤖 InvestIQ AI Financial Assistant</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                  Trực tuyến
                </span>
              </h2>
              <p className="text-xs text-slate-400 m-0 mt-0.5">
                Cố vấn tài chính chuyên sâu hỗ trợ phân tích cổ phiếu, BCTC, chỉ báo nến và so sánh tài sản.
              </p>
            </div>
          </div>
        </div>

        {/* Message Stream Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoadingHistory ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm animate-pulse">
              <span>Đang tải lịch sử hội thoại...</span>
            </div>
          ) : (
            messages.map((msg) => (
              <AiChatBubble key={msg.id} message={msg} onSendPrompt={(p) => handleSend(p)} />
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-3 text-xs text-sky-400 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 w-fit animate-pulse shadow-lg">
              <span className="animate-spin text-base">⚙️</span>
              <span>AI đang tra cứu dữ liệu thị trường và phân tích...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3 bg-slate-950 border border-slate-800 focus-within:border-sky-500 rounded-2xl p-3 transition shadow-xl">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập câu hỏi tài chính (VD: 'Đánh giá HPG', 'So sánh VCB và MBB', 'Khám BCTC NVL')..."
                rows={2}
                className="flex-1 bg-transparent border-0 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-32 py-1 leading-relaxed"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 disabled:opacity-40 disabled:hover:from-sky-500 disabled:hover:to-teal-500 text-white font-extrabold text-xs transition shrink-0 shadow-lg"
              >
                Gửi ➔
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-2 font-medium">
              <span>💡 Nhấn Enter để gửi · Shift+Enter để xuống dòng</span>
              <span>Dữ liệu thời gian thực được bảo chứng bởi InvestIQ Data Engine</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
