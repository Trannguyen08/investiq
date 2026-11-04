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

  it("renders assistant news report heading, strips duplicate inline source block, and deduplicates source pills", () => {
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
        "- [Hệ thống InvestIQ] Tin tổng hợp (/news)\n" +
        "- [Nguồn ngoài] Nguồn công bố: CafeF Data (https://s.cafef.vn/lich-su-kien/MBB/sub.chn)",
      sources: [
        {
          kind: "internal",
          title: "Tin tổng hợp",
          url: "/news",
        },
        {
          kind: "external",
          title: "Nguồn công bố: CafeF Data",
          url: "https://s.cafef.vn/lich-su-kien/MBB/sub.chn",
        },
        {
          kind: "external",
          title: "Nguồn công bố: CafeF Data",
          url: "https://s.cafef.vn/lich-su-kien/MBB/sub.chn",
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

    // Structured source pills rendered and deduplicated (CafeF Data only once)
    expect(screen.getByText("Tin tổng hợp")).toBeDefined();
    expect(screen.getAllByText("Nguồn công bố: CafeF Data")).toHaveLength(1);

    // Inline duplicate "Nguồn tham khảo:" bullet block stripped when structured sources exist
    expect(screen.queryByText("Nguồn tham khảo:")).toBeNull();
    expect(screen.getByText("Nguồn tham khảo đã kiểm chuẩn:")).toBeDefined();

    // Ensure no empty dash rows exist
    const paragraphs = container.querySelectorAll("p");
    paragraphs.forEach((p) => {
      const text = p.textContent?.trim();
      expect(text).not.toBe("-");
      expect(text).not.toBe("•");
      expect(text).not.toBe("- -");
    });
  });

  it("synchronizes highlight badges across percentage ratios (10%) and colon ratios (10:1, 100:15, 100:3)", () => {
    const dividendMsg: AiMessage = {
      id: "msg-div-1",
      role: "assistant",
      content:
        "Lịch chia cổ tức: MBB - Ngân hàng TMCP Quân đội\n\n" +
        ".\n" +
        "- •\n" +
        "- Ngày GDKHQ: 2026-08-11 | Hình thức: Quyền mua | Tỷ lệ: 10:1 (Nguồn: CafeF Data)\n" +
        "- Ngày GDKHQ: 2026-08-11 | Hình thức: Cổ phiếu | Tỷ lệ: 100:15 (Nguồn: CafeF Data)\n" +
        "- Ngày GDKHQ: 2026-07-09 | Hình thức: Tiền mặt | Tỷ lệ: 10% (1,000 đ/cp) (Nguồn: CafeF Data)\n" +
        "- Ngày GDKHQ: 2025-08-13 | Hình thức: Tiền mặt | Tỷ lệ: Cổ tức bằng Tiền, tỷ lệ 100:3 (Nguồn: CafeF Data)\n" +
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

    // Verify all ratios (10:1, 100:15, 10%, 100:3) get highlighted with emerald badge styling
    for (const ratioText of ["10:1", "100:15", "10%", "100:3"]) {
      const badge = screen.getByText(ratioText);
      expect(badge.className).toContain("text-emerald-300");
      expect(badge.className).toContain("bg-emerald-950/60");
    }

    // Verify currency 1,000 đ/cp gets highlighted with sky badge styling
    const currencyBadge = screen.getByText("1,000 đ/cp");
    expect(currencyBadge.className).toContain("text-sky-300");

    // Verify redundant "Cổ tức bằng Tiền, tỷ lệ" phrase was normalized away
    const textNodes = container.textContent || "";
    expect(textNodes).not.toContain("Cổ tức bằng Tiền");
    expect(textNodes).not.toContain("• -");
  });

  it("renders StockScoreCardWidget in compact drawer layout without overlapping metrics", () => {
    const stockMsg: AiMessage = {
      id: "msg-stock-1",
      role: "assistant",
      content: "Báo cáo phân tích chuyên sâu: MBB - Ngân hàng TMCP Quân đội",
      widgets: [
        {
          type: "stock_score_card",
          data: {
            symbol: "MBB",
            name: "Ngân hàng TMCP Quân đội",
            current_price: 19250,
            change_percent: 1.85,
            pe: 10.0,
            pb: 2.3,
            roe_percent: 22.6,
            scores: {
              valuation: 80,
              financial_health: 85,
              growth: 79,
              technical: 75,
              cashflow: 80,
            },
            verdict: "TÍCH CỰC",
            key_support: 18600,
            key_resistance: 20200,
            analysis_points: [
              "Định giá P/E 10.0x tương đối hợp lý so với trung bình lịch sử.",
            ],
          },
        },
      ],
      created_at: "2026-11-04T13:40:02Z",
    };

    render(<AiChatBubble message={stockMsg} />);

    expect(screen.getByText("TÍCH CỰC")).toBeDefined();
    expect(screen.getByText("10.0x")).toBeDefined();
    expect(screen.getByText("2.3x")).toBeDefined();
    expect(screen.getByText("22.6%")).toBeDefined();
    expect(screen.getByText("Hỗ trợ quan trọng")).toBeDefined();
    expect(screen.getByText("Kháng cự gần")).toBeDefined();
  });
});
