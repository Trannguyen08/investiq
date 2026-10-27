import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommunityClientHub } from "@/components/community/community-client-hub";
import { SocialPaperTrading } from "@/components/community/social-paper-trading";
import { ThesisArena } from "@/components/community/thesis-arena";
import type { AnalystReputationItem, InvestmentThesisItem, SocialLeaderboardItem } from "@/types/thesis";

afterEach(() => {
  cleanup();
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "user-123", name: "Nguyen Van A", email: "test@investiq.vn" },
  }),
}));

const mockTheses: InvestmentThesisItem[] = [
  {
    id: "thesis-1",
    user_id: "user-1",
    author_name: "Nguyen Van A",
    symbol: "HPG",
    stance: "bullish",
    entry_price: "28000.00",
    target_price: "35000.00",
    stop_loss_price: "25000.00",
    current_price: "29500.00",
    progress_percent: "21.4",
    horizon_months: 3,
    title: "HPG - Dung Quất 2 bùng nổ công suất",
    thesis_body: "Định giá P/E dự phóng chỉ 9.5x, biên lợi nhuận cải thiện mạnh mẽ.",
    catalysts: ["Lò cao số 2", "Biên gộp phục hồi"],
    status: "active",
    outcome_roi: null,
    closed_at: null,
    closed_price: null,
    upvotes: 12,
    created_at: "2026-10-27T10:00:00Z",
    updated_at: "2026-10-27T10:00:00Z",
  },
];

const mockAnalysts: AnalystReputationItem[] = [
  {
    user_id: "user-1",
    author_name: "Nguyen Van A",
    total_theses: 10,
    active_theses: 2,
    successful_theses: 8,
    stopped_theses: 0,
    win_rate_percent: "80.0",
    avg_roi_percent: "18.5",
    rank_tier: "🏆 Grandmaster Analyst",
  },
];

const mockLeaderboard: SocialLeaderboardItem[] = [
  {
    portfolio_id: "port-1",
    nickname: "Dragon Investor",
    starting_cash: "1000000000.00",
    cash_balance: "450000000.00",
    realized_pnl: "125000000.00",
    roi_percent: "12.5",
    roi_number: 12.5,
    holding_count: 3,
    total_trades: 8,
    win_trades: 6,
  },
];

describe("Community & Proof-of-Thesis Components", () => {
  it("renders CommunityClientHub and switches tabs between Thesis Arena and Social Paper Trading", () => {
    render(
      <CommunityClientHub
        initialTheses={mockTheses}
        initialAnalystLeaderboard={mockAnalysts}
        initialSocialLeaderboard={mockLeaderboard}
      />,
    );

    expect(screen.getByText("Cộng đồng & Đấu trường Luận điểm InvestIQ")).toBeInTheDocument();
    expect(screen.getByText("HPG - Dung Quất 2 bùng nổ công suất")).toBeInTheDocument();

    const socialTab = screen.getByRole("button", {
      name: /Bảng xếp hạng Mô phỏng/i,
    });
    fireEvent.click(socialTab);

    expect(screen.getByText("Dragon Investor")).toBeInTheDocument();
    expect(screen.getByText("🥇 #1")).toBeInTheDocument();
  });

  it("renders ThesisArena with analyst reputation and thesis card details", () => {
    render(
      <ThesisArena
        initialTheses={mockTheses}
        initialLeaderboard={mockAnalysts}
      />,
    );

    expect(screen.getByText("🏆 BẢNG VINH DANH CHUYÊN GIA (TOP ANALYSTS)")).toBeInTheDocument();
    expect(screen.getByText("🏆 Grandmaster Analyst")).toBeInTheDocument();
    expect(screen.getByText("HPG")).toBeInTheDocument();
    expect(screen.getByText("📈 Bullish")).toBeInTheDocument();
    expect(screen.getByText("Kỳ hạn 3T")).toBeInTheDocument();
    expect(screen.getByText("⚡ Lò cao số 2")).toBeInTheDocument();
    expect(screen.getByText(/Hữu ích \(12\)/)).toBeInTheDocument();
  });

  it("renders SocialPaperTrading leaderboard and rank medals", () => {
    render(<SocialPaperTrading initialLeaderboard={mockLeaderboard} />);

    expect(screen.getByText("Dragon Investor")).toBeInTheDocument();
    expect(screen.getByText("🥇 #1")).toBeInTheDocument();
    expect(screen.getByText("+12.5%")).toBeInTheDocument();
    expect(screen.getByText("3 mã")).toBeInTheDocument();
  });
});
