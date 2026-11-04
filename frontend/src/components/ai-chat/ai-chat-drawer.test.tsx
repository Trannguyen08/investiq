import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiChatDrawer } from "@/components/ai-chat/ai-chat-drawer";
import * as aiChatApi from "@/lib/ai-chat-api";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

describe("AiChatDrawer Component E2E Flow", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens chat drawer, allows user to send prompt, and renders dividend response with sources", async () => {
    const sendChatMessageSpy = vi.spyOn(aiChatApi, "sendChatMessage").mockResolvedValue({
      conversation_id: "conv-mock-1",
      message: {
        id: "msg-assistant-1",
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
        evaluation: { score: 1.0, checks: { accuracy: true } },
        created_at: "2026-11-04T12:00:00Z",
      },
    });

    render(<AiChatDrawer />);

    // Trigger button should be visible
    const triggerBtn = screen.getByRole("button", { name: /Trợ lý AI/i });
    expect(triggerBtn).toBeDefined();

    // Click to open drawer
    fireEvent.click(triggerBtn);

    // Initial welcome message should be present
    expect(screen.getAllByText(/InvestIQ Assistant/i).length).toBeGreaterThan(0);

    // Find input field and submit prompt
    const inputEl = screen.getByPlaceholderText(/Nhập mã CP/i);
    fireEvent.change(inputEl, { target: { value: "cho tao lịch chia cổ tức của mbb" } });

    const sendBtn = screen.getByRole("button", { name: "Gửi tin nhắn" });
    fireEvent.click(sendBtn);

    // Verify spy was called
    expect(sendChatMessageSpy).toHaveBeenCalledWith("cho tao lịch chia cổ tức của mbb", null);

    // Verify user message appears in list
    expect(screen.getByText("cho tao lịch chia cổ tức của mbb")).toBeDefined();

    // Wait for assistant response to render
    await waitFor(() => {
      expect(screen.getByText(/Lịch chia cổ tức: MBB/i)).toBeDefined();
    });

    // Check specific dividend details and source link
    expect(screen.getByText(/2026-12-10/)).toBeDefined();
    expect(screen.getByText("Lịch chia cổ tức MBB (InvestIQ)")).toBeDefined();
  });

  it("handles news prompt with concatenated words and renders news report", async () => {
    vi.spyOn(aiChatApi, "sendChatMessage").mockResolvedValue({
      conversation_id: "conv-mock-2",
      message: {
        id: "msg-assistant-2",
        role: "assistant",
        content:
          "Điểm tin thị trường hôm nay:\n\n" +
          "- **Thị trường bứt phá**: VN-Index tăng điểm tích cực.\n" +
          "- **Khối ngoại**: Tiếp tục mua ròng nhóm tài chính.",
        widgets: [],
        suggested_actions: [],
        sources: [
          {
            kind: "internal",
            title: "Tin tức thị trường",
            url: "/news",
          },
        ],
        evaluation: { score: 1.0, checks: { accuracy: true } },
        created_at: "2026-11-04T12:00:00Z",
      },
    });

    render(<AiChatDrawer />);

    // Open drawer
    const triggerBtn = screen.getByRole("button", { name: /Trợ lý AI/i });
    fireEvent.click(triggerBtn);

    // Input news prompt with concatenated word
    const inputEl = screen.getByPlaceholderText(/Nhập mã CP/i);
    fireEvent.change(inputEl, { target: { value: "cho tao tin tức chứng khoánhôm nay" } });

    const sendBtn = screen.getByRole("button", { name: "Gửi tin nhắn" });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText("Điểm tin thị trường hôm nay:")).toBeDefined();
    });
    expect(screen.getByText(/Thị trường bứt phá/)).toBeDefined();
  });
});
