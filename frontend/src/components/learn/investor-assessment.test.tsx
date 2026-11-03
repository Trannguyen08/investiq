import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InvestorAssessmentWizard } from "./investor-assessment-wizard";
import { ReadinessReportCard } from "./readiness-report-card";
import type { AssessmentQuestion, ReadinessEvaluation } from "@/types/assessment";

const mockQuestions: AssessmentQuestion[] = [
  {
    id: "q1",
    sort_order: 1,
    category: "financial_situation",
    prompt: "Mục tiêu tài chính của bạn là gì?",
    subtext: "Chọn 1 mục tiêu chính",
    options: [
      {
        id: "q1_opt1",
        label: "Tích sản dài hạn 5-10 năm",
        risk_weight: 40,
        persona_weights: { dca_accumulator: 8 },
      },
      {
        id: "q1_opt2",
        label: "Lướt sóng kiếm tiền nhanh",
        risk_weight: 85,
        persona_weights: { active_swing: 9 },
      },
    ],
    status: "published",
  },
  {
    id: "q2",
    sort_order: 2,
    category: "risk_tolerance",
    prompt: "Khi tài khoản lỗ -15%, bạn làm gì?",
    subtext: "Phản ứng tâm lý thực tế",
    options: [
      {
        id: "q2_opt1",
        label: "Bình tĩnh mua thêm",
        risk_weight: 50,
        persona_weights: { dca_accumulator: 8 },
      },
      {
        id: "q2_opt2",
        label: "Cắt lỗ ngay lập tức",
        risk_weight: 80,
        persona_weights: { active_swing: 8 },
      },
    ],
    status: "published",
  },
];

const mockEvaluation: ReadinessEvaluation = {
  id: "eval-1",
  persona: {
    code: "dca_accumulator",
    title: "Nhà đầu tư Tích sản Dài hạn (DCA)",
    tagline: "Tích lũy tài sản bền vững theo năm tháng",
    description: "Bạn ưu tiên sự an toàn và tăng trưởng ổn định.",
    strengths: ["Kiên nhẫn cao", "Tâm lý thoải mái"],
    weaknesses: ["Lợi nhuận ngắn hạn không bùng nổ"],
    recommended_strategy: "Chiến lược DCA hàng tháng vào VN30.",
    asset_allocation: { stocks: 50, gold: 25, savings: 25 },
    ideal_time_hours_per_week: 2,
    suitable_instruments: ["Cổ phiếu VN30", "Quỹ ETF"],
  },
  risk_score: 55.0,
  knowledge_score: 80.0,
  discipline_score: 75.0,
  overall_readiness_score: 71.0,
  readiness_level: "ready_starter",
  readiness_label: "Sẵn sàng Khởi đầu có Kiểm soát",
  verdict_summary: "Bạn có tố chất và nhận thức tốt, nên bắt đầu bằng chiến lược tích sản DCA.",
  can_trade_real_money: true,
  recommended_action: "Bắt đầu với 10-20% vốn nhàn rỗi.",
  created_at: new Date().toISOString(),
  answers: { q1: "q1_opt1", q2: "q2_opt1" },
};

describe("InvestorAssessmentWizard & ReadinessReportCard", () => {
  it("renders the wizard question and steps forward upon selection", () => {
    render(<InvestorAssessmentWizard questions={mockQuestions} />);

    expect(screen.getByText("Câu hỏi 1 / 2 (50%)")).toBeDefined();
    expect(screen.getByText("1. Mục tiêu tài chính của bạn là gì?")).toBeDefined();

    // Select option A
    const optA = screen.getByText(/Tích sản dài hạn 5-10 năm/);
    fireEvent.click(optA);

    // Click Next
    const nextBtn = screen.getByText("Tiếp tục");
    fireEvent.click(nextBtn);

    // Verify step 2
    expect(screen.getByText("Câu hỏi 2 / 2 (100%)")).toBeDefined();
    expect(screen.getByText("2. Khi tài khoản lỗ -15%, bạn làm gì?")).toBeDefined();
  });

  it("renders report card with persona, score breakdown, and asset allocation", () => {
    const onRetake = vi.fn();
    render(<ReadinessReportCard evaluation={mockEvaluation} onRetake={onRetake} />);

    expect(screen.getByText("Nhà đầu tư Tích sản Dài hạn (DCA)")).toBeDefined();
    expect(screen.getByText("Sẵn sàng Khởi đầu có Kiểm soát")).toBeDefined();
    expect(screen.getByText("71")).toBeDefined();
    expect(screen.getByText(/Bạn có tố chất và nhận thức tốt/)).toBeDefined();

    // Verify 3 pillars
    expect(screen.getByText("Kiến thức căn bản (35%)")).toBeDefined();
    expect(screen.getByText("Khẩu vị & Tâm lý rủi ro (30%)")).toBeDefined();
    expect(screen.getByText("Kỷ luật thực chiến (35%)")).toBeDefined();

    // Verify retake action
    const retakeBtn = screen.getByText("Làm lại bài khảo sát");
    fireEvent.click(retakeBtn);
    expect(onRetake).toHaveBeenCalledTimes(1);
  });
});
