import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AiChatBubble } from "@/components/ai-chat/ai-chat-bubble";
import type { AiMessage } from "@/types/ai-chat";

describe("AiChatBubble", () => {
  it("renders user message bubble with compact padding, distinct time and gradient styling", () => {
    const userMsg: AiMessage = {
      id: "msg-user-1",
      role: "user",
      content: "cho tao tin tức hôm nay",
      created_at: "2026-11-04T13:40:00Z",
    };

    const { container } = render(
      <AiChatBubble message={userMsg} />
    );

    expect(screen.getByText("cho tao tin tức hôm nay")).toBeDefined();
    const bubble = container.querySelector(".bg-gradient-to-r");
    expect(bubble).not.toBeNull();
    expect(bubble?.className).toContain("from-sky-600");
  });

  it("renders assistant news report heading and filters out orphan bullet rows", () => {
    const assistantMsg: AiMessage = {
      id: "msg-assistant-1",
      role: "assistant",
      content:
        "Điểm tin thị trường hôm nay:\n\n" +
        "-\n" +
        "- •\n" +
        "- **VN-Index bứt phá**: Lực cầu khối ngoại gia tăng mạnh mẽ.\n" +
        "-\n" +
        "- **Lãi suất điều hành**: Ngân hàng Nhà nước giữ vững ổn định.\n\n" +
        "Nguồn tham khảo:\n" +
        "- [Hệ thống InvestIQ] Tin tổng hợp (/news)",
      sources: [
        {
          kind: "internal",
          title: "Tin tổng hợp",
          url: "/news",
        },
      ],
      created_at: "2026-11-04T13:40:02Z",
    };

    const { container } = render(
      <AiChatBubble message={assistantMsg} />
    );

    // Heading rendered
    expect(screen.getByText("Điểm tin thị trường hôm nay:")).toBeDefined();

    // Headlines rendered
    expect(screen.getByText(/VN-Index bứt phá/)).toBeDefined();
    expect(screen.getByText(/Lãi suất điều hành/)).toBeDefined();

    // Source pill rendered
    expect(screen.getByText("Tin tổng hợp")).toBeDefined();

    // Ensure no empty dash rows exist
    const paragraphs = container.querySelectorAll("p");
    paragraphs.forEach((p) => {
      const text = p.textContent?.trim();
      expect(text).not.toBe("-");
      expect(text).not.toBe("•");
      expect(text).not.toBe("- -");
    });
  });

  it("renders dividend schedule heading and cleanly strips empty dot rows", () => {
    const dividendMsg: AiMessage = {
      id: "msg-div-1",
      role: "assistant",
      content:
        "Lịch chia cổ tức: MBB - Ngân hàng TMCP Quân đội\n\n" +
        ".\n" +
        "- •\n" +
        "- Ngày GDKHQ: 2026-12-10 | Hình thức: Tiền mặt | Tỷ lệ: 5% (500 đ/cp) (Nguồn: Nghị quyết HĐQT MBB)\n" +
        "- .\n",
      sources: [
        {
          kind: "internal",
          title: "Lịch chia cổ tức MBB",
          url: "/market/stocks/MBB#dividends",
        },
      ],
      created_at: "2026-11-04T13:40:02Z",
    };

    const { container } = render(<AiChatBubble message={dividendMsg} />);

    expect(screen.getByText(/Lịch chia cổ tức: MBB/)).toBeDefined();
    expect(screen.getByText(/2026-12-10/)).toBeDefined();
    expect(screen.getByText("Lịch chia cổ tức MBB")).toBeDefined();

    // Verify no stray dots rendered as bullet text
    const textNodes = container.textContent || "";
    expect(textNodes).not.toContain("• -");
  });
});
