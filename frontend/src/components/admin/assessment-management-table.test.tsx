import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AssessmentManagementTable } from "./assessment-management-table";
import type {
  AdminAssessmentPage,
  AdminAssessmentStats,
  AssessmentQuestion,
  InvestorPersona,
} from "@/types/assessment";

vi.mock("@/app/(admin)/admin/actions", () => ({
  createAssessmentQuestionAction: vi.fn(),
  updateAssessmentQuestionAction: vi.fn(),
  deleteAssessmentQuestionAction: vi.fn(),
  toggleAssessmentQuestionStatusAction: vi.fn(),
  updatePersonaAction: vi.fn(),
}));

const mockStats: AdminAssessmentStats = {
  total_assessments: 128,
  average_readiness_score: 68.5,
  ready_percentage: 62.5,
  top_persona_code: "dca_accumulator",
  top_persona_title: "Nhà đầu tư Tích sản Dài hạn (DCA)",
  persona_distribution: {
    dca_accumulator: 60,
    value_growth: 40,
    active_swing: 20,
    conservative_fund: 8,
  },
};

const mockQuestions: AssessmentQuestion[] = [
  {
    id: "q-1",
    sort_order: 1,
    category: "risk_tolerance",
    prompt: "Khi tài khoản giảm điểm mạnh, phản ứng của bạn là gì?",
    subtext: "Khẩu vị rủi ro",
    options: [
      { id: "o1", label: "Mua thêm", risk_weight: 50, persona_weights: { dca_accumulator: 5 } },
      { id: "o2", label: "Cắt lỗ", risk_weight: 80, persona_weights: { active_swing: 5 } },
    ],
    status: "published",
  },
];

const mockPersonas: InvestorPersona[] = [
  {
    code: "dca_accumulator",
    title: "Nhà đầu tư Tích sản Dài hạn (DCA)",
    tagline: "Tích lũy tài sản bền vững",
    description: "Ưu tiên an toàn và dài hạn.",
    strengths: ["Kiên nhẫn"],
    weaknesses: ["Chậm"],
    recommended_strategy: "Chiến lược DCA hàng tháng.",
    asset_allocation: { stocks: 50, gold: 25, savings: 25 },
    ideal_time_hours_per_week: 2,
    suitable_instruments: ["VN30"],
  },
];

const mockSubmissionsPage: AdminAssessmentPage = {
  items: [
    {
      id: "sub-1",
      persona_code: "dca_accumulator",
      persona_title: "Nhà đầu tư Tích sản Dài hạn (DCA)",
      risk_score: 55,
      knowledge_score: 75,
      discipline_score: 80,
      readiness_score: 70,
      readiness_level: "ready_starter",
      readiness_label: "Sẵn sàng Khởi đầu có Kiểm soát",
      can_trade_real_money: true,
      created_at: new Date().toISOString(),
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
  pages: 1,
};

describe("AssessmentManagementTable", () => {
  it("renders 4 KPI cards and tab switches", () => {
    render(
      <AssessmentManagementTable
        stats={mockStats}
        questions={mockQuestions}
        personas={mockPersonas}
        submissionsPage={mockSubmissionsPage}
      />
    );

    // KPI cards
    expect(screen.getByText("TỔNG LƯỢT KHẢO SÁT")).toBeDefined();
    expect(screen.getByText("128")).toBeDefined();
    expect(screen.getByText("68.5 / 100")).toBeDefined();
    expect(screen.getByText("62.5%")).toBeDefined();

    // Default tab: questions
    expect(screen.getByText("Khi tài khoản giảm điểm mạnh, phản ứng của bạn là gì?")).toBeDefined();

    // Switch to Personas tab
    const personaTabBtn = screen.getByText(/Hồ sơ Nhóm Persona/);
    fireEvent.click(personaTabBtn);
    expect(screen.getByText("Tích lũy tài sản bền vững")).toBeDefined();
    expect(screen.getByText(/Phân bổ tài sản khuyến nghị/)).toBeDefined();

    // Switch to Submissions tab
    const subsTabBtn = screen.getByText(/Lịch sử khảo sát người dùng/);
    fireEvent.click(subsTabBtn);
    expect(screen.getByText("70 / 100")).toBeDefined();
    expect(screen.getByText("Được phép")).toBeDefined();
  });
});
