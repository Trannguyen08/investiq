import { afterEach, describe, expect, it, vi } from "vitest";

import { aiChatRequest } from "@/lib/server/ai-chat-server-api";
import { POST } from "@/app/ai-api/[[...path]]/route";

vi.mock("@/lib/server/ai-chat-server-api", () => ({
  aiChatRequest: vi.fn(),
}));

describe("AI Chat BFF route proxy", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("proxies POST /ai-api/chat to backend and returns assistant response with dividend content", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        conversation_id: "conv-123",
        message: {
          id: "msg-1",
          role: "assistant",
          content:
            "Lịch chia cổ tức: MBB - Ngân hàng TMCP Quân đội\n\n" +
            "- Ngày GDKHQ: 2026-12-10 | Hình thức: Tiền mặt | Tỷ lệ: 5% (500 đ/cp) (Nguồn: Nghị quyết HĐQT MBB)",
          widgets: [],
          suggested_actions: [
            {
              label: "Xem bảng giá MBB",
              action_type: "NAVIGATE",
              url: "/market/stocks/MBB",
            },
          ],
          sources: [
            {
              kind: "internal",
              title: "Lịch chia cổ tức MBB (InvestIQ)",
              url: "/market/stocks/MBB#dividends",
            },
          ],
          evaluation: { score: 1.0 },
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
    vi.mocked(aiChatRequest).mockResolvedValue(mockResponse);

    const request = new Request("http://localhost:3000/ai-api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "cho tao lịch chia cổ tức của mbb" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["chat"] }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.conversation_id).toBe("conv-123");
    expect(json.message.content).toContain("Lịch chia cổ tức: MBB");
    expect(json.message.sources[0].url).toBe("/market/stocks/MBB#dividends");
  });

  it("handles request exceeding maximum size payload with 413", async () => {
    const hugeMessage = "a".repeat(40_000);
    const request = new Request("http://localhost:3000/ai-api/chat", {
      method: "POST",
      body: JSON.stringify({ message: hugeMessage }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["chat"] }),
    });

    expect(response.status).toBe(413);
    const json = await response.json();
    expect(json.error.code).toBe("REQUEST_TOO_LARGE");
  });
});
