import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LearningManagementTable } from "@/components/admin/learning-management-table";
import type { LearningTopicDetail } from "@/types/learning";

vi.mock("@/app/(admin)/admin/actions", () => ({
  createLearningTopicAction: vi.fn(),
  updateLearningTopicAction: vi.fn(),
  deleteLearningTopicAction: vi.fn(),
  toggleLearningTopicStatusAction: vi.fn(),
}));

const mockTopic: LearningTopicDetail = {
  id: "topic-12345678-abcd",
  slug: "stock-basics-saving-vs-investing",
  level: "beginner",
  stage: 1,
  sort_order: 1,
  title: "Bản chất Cổ phiếu & Phân biệt Tiết kiệm vs Đầu tư",
  eyebrow: "BÀI 1 · NỀN TẢNG",
  summary: "Hiểu rõ cổ phiếu là gì và phân biệt tiết kiệm ngân hàng với đầu tư chứng khoán.",
  estimated_minutes: 5,
  theory_content: "Lý thuyết cốt lõi về cổ phiếu và quyền lợi của cổ đông.",
  practical_example: {
    title: "Khoản tích lũy của anh Nam",
    ticker: "HPG",
    scenario: "Anh Nam có 100 triệu cần phân bổ.",
    analysis: "Phân tích không dùng tiền ngắn hạn lướt sóng.",
    key_takeaway: "Mục tiêu tài chính phải đi trước chọn mã.",
  },
  quizzes: [
    {
      id: "q1",
      prompt: "Tiền ngắn hạn 2 tháng nên để ở đâu?",
      options: [
        { id: "opt1", label: "Mua cổ phiếu", correct: false, feedback: "Sai" },
        { id: "opt2", label: "Tiết kiệm ngắn hạn", correct: true, feedback: "Đúng" },
      ],
    },
  ],
  glossary: [
    { term: "Cổ đông", definition: "Người sở hữu cổ phần." },
  ],
  practice_action: {
    href: "/portfolio",
    label: "Xem danh mục mô phỏng",
    description: "Thực hành ngay với tiền giả lập",
  },
  status: "published",
  created_at: "2026-11-03T00:00:00Z",
  updated_at: "2026-11-03T00:00:00Z",
};

describe("LearningManagementTable", () => {
  it("renders learning topic list with title, level, slug and stats", () => {
    render(<LearningManagementTable topics={[mockTopic]} />);

    expect(screen.getByRole("heading", { name: "Quản lý Khóa học & Lộ trình Chứng khoán" })).toBeInTheDocument();
    expect(screen.getByText("Bản chất Cổ phiếu & Phân biệt Tiết kiệm vs Đầu tư")).toBeInTheDocument();
    expect(screen.getAllByText("Cơ bản (Dễ)").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/slug: stock-basics-saving-vs-investing/)).toBeInTheDocument();
    expect(screen.getByText("5 phút")).toBeInTheDocument();
    expect(screen.getByText("1 câu")).toBeInTheDocument();
    expect(screen.getAllByText("Đã xuất bản").length).toBeGreaterThanOrEqual(1);
  });

  it("opens and closes topic detail modal upon clicking view button", () => {
    render(<LearningManagementTable topics={[mockTopic]} />);

    const viewBtn = screen.getByRole("button", { name: "Xem chi tiết nội dung" });
    fireEvent.click(viewBtn);

    expect(screen.getByRole("heading", { name: /Chi tiết bài học: Bản chất Cổ phiếu/i })).toBeInTheDocument();
    expect(screen.getByText(/Khoản tích lũy của anh Nam/)).toBeInTheDocument();
    expect(screen.getAllByText(/HPG/).length).toBeGreaterThanOrEqual(1);

    const closeBtn = screen.getByRole("button", { name: "Đóng hộp thoại" });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("heading", { name: /Chi tiết bài học: Bản chất Cổ phiếu/i })).not.toBeInTheDocument();
  });

  it("opens create modal when clicking add new lesson button", () => {
    render(<LearningManagementTable topics={[mockTopic]} />);

    const addBtn = screen.getByRole("button", { name: "+ Thêm bài học mới" });
    fireEvent.click(addBtn);

    expect(screen.getByRole("heading", { name: "Thêm bài học chứng khoán mới" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Tiêu đề bài học \*/)).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: "Hủy" });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole("heading", { name: "Thêm bài học chứng khoán mới" })).not.toBeInTheDocument();
  });

  it("shows empty state when no matching topics found", () => {
    render(<LearningManagementTable topics={[]} />);

    expect(screen.getByText("Không tìm thấy bài học nào phù hợp với bộ lọc.")).toBeInTheDocument();
  });
});
