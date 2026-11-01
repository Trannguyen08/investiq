import type { AiChatResponse, AiConversation, AiMessage } from "@/types/ai-chat";

export async function sendChatMessage(message: string, conversationId?: string | null): Promise<AiChatResponse> {
  const res = await fetch("/ai-api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: conversationId || undefined }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error?.message || "Không thể kết nối đến Trợ lý AI.");
  }
  return res.json();
}

export async function fetchUserConversations(): Promise<AiConversation[]> {
  const res = await fetch("/ai-api/conversations", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchConversationHistory(
  conversationId: string,
): Promise<{ conversation: AiConversation; messages: AiMessage[] } | null> {
  const res = await fetch(`/ai-api/conversations/${conversationId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteUserConversation(conversationId: string): Promise<boolean> {
  const res = await fetch(`/ai-api/conversations/${conversationId}`, {
    method: "DELETE",
  });
  return res.ok;
}

