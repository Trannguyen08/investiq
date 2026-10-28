import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThesesTable } from "@/components/admin/theses-table";
import type { AdminThesisItem } from "@/lib/server/admin-ops-api";

vi.mock("@/app/(admin)/admin/actions", () => ({
  changeThesisStatus: vi.fn(),
  removeThesisAction: vi.fn(),
}));

const mockThesis: AdminThesisItem = {
  id: "th-12345678-abcd",
  user_id: "user-1",
  author_name: "Nguyễn Văn A",
  author_email: "a@example.com",
  symbol: "FPT",
  title: "Đánh giá triển vọng tăng trưởng FPT 2026",
  stance: "bullish",
  entry_price: 135000,
  target_price: 160000,
  stop_loss_price: 125000,
  horizon_months: 6,
  thesis_body: "Luận điểm đầu tư FPT tăng trưởng tốt",
  catalysts: ["Chuyển đổi số", "AI"],
  status: "active",
  outcome_roi: null,
  closed_at: null,
  closed_price: null,
  upvotes: 12,
  created_at: "2026-10-15T08:00:00Z",
  updated_at: "2026-10-15T08:00:00Z",
};

describe("ThesesTable", () => {
  it("renders thesis list with symbol, author and stance", () => {
    render(<ThesesTable theses={[mockThesis]} />);

    expect(screen.getByRole("heading", { name: "Danh sách bài phân tích & khuyến nghị" })).toBeInTheDocument();
    expect(screen.getByText("FPT")).toBeInTheDocument();
    expect(screen.getByText(/Bởi Nguyễn Văn A/)).toBeInTheDocument();
    expect(screen.getByText("Tăng (Bullish)")).toBeInTheDocument();
    expect(screen.getByText("Đang theo dõi")).toBeInTheDocument();
  });

  it("opens and closes detail modal upon clicking action button", () => {
    render(<ThesesTable theses={[mockThesis]} />);

    const detailBtn = screen.getByRole("button", { name: "Xem chi tiết" });
    fireEvent.click(detailBtn);

    expect(screen.getByRole("heading", { name: /Chi tiết khuyến nghị: FPT/i })).toBeInTheDocument();
    expect(screen.getByText("th-12345678-abcd")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Đóng" });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("heading", { name: /Chi tiết khuyến nghị: FPT/i })).not.toBeInTheDocument();
  });

  it("shows empty state when no theses are found", () => {
    render(<ThesesTable theses={[]} />);

    expect(screen.getByText("Không tìm thấy bài phân tích nào phù hợp bộ lọc.")).toBeInTheDocument();
  });
});
