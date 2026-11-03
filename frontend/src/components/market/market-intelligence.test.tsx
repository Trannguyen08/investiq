import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  getMarketEcosystems: vi.fn().mockResolvedValue({
    data: [
      {
        id: "vingroup",
        name: "Hệ sinh thái Vingroup",
        founder_id: "pham-nhat-vuong",
        founder_name: "Phạm Nhật Vượng",
        sector: "Bất động sản & Công nghiệp",
        overview: "Tập đoàn tư nhân lớn nhất Việt Nam.",
        total_market_cap: "450.000 tỷ",
        node_count: 5,
        link_count: 4,
        core_tickers: [{ symbol: "VIC", price: "45.000", change_percent: "+1.2", market_cap: "170.000 tỷ" }],
      },
    ],
  }),
  getMarketEcosystemDetail: vi.fn().mockResolvedValue({
    data: {
      id: "vingroup",
      name: "Hệ sinh thái Vingroup",
      founder_id: "pham-nhat-vuong",
      founder_name: "Phạm Nhật Vượng",
      sector: "Bất động sản & Công nghiệp",
      overview: "Tập đoàn tư nhân lớn nhất Việt Nam.",
      nodes: [
        {
          id: "vic",
          name: "Tập đoàn Vingroup",
          ticker: "VIC",
          node_type: "parent",
          role: "Công ty mẹ",
          ownership_percent: "100%",
          exchange: "HOSE",
          description: "Hạt nhân đầu mối",
        },
      ],
      links: [],
    },
  }),
}));

import { FinancialForensicsPanel } from "@/components/market/financial-forensics-panel";
import { EcosystemGraph } from "@/components/market/ecosystem-graph";
import type { FinancialForensicsData } from "@/types/market";

afterEach(() => {
  cleanup();
});

describe("FinancialForensicsPanel", () => {
  const mockForensics: FinancialForensicsData = {
    symbol: "HPG",
    z_score: "3.42",
    z_zone: "safe",
    z_label: "An toàn",
    health_score: 85,
    risk_summary: "Sức khỏe tài chính lành mạnh với biên an toàn cao.",
    recommendation: "Phù hợp tích sản dài hạn.",
    red_flags: [
      {
        flag_id: "cfo_divergence",
        name: "Dòng tiền kinh doanh vs Lợi nhuận ròng",
        severity: "clean",
        title: "Dòng tiền kinh doanh thặng dư vững chắc",
        description: "CFO dương và vượt lợi nhuận sau thuế.",
        indicator_value: "CFO/LNST: 1.25x",
        threshold: "Tối thiểu > 0.8x",
        implication: "Chất lượng lợi nhuận thực chất.",
      },
      {
        flag_id: "debt_leverage",
        name: "Áp lực nợ vay",
        severity: "clean",
        title: "Tỷ lệ nợ vay an toàn",
        description: "Nợ vay trong tầm kiểm soát.",
        indicator_value: "D/E: 0.62x",
        threshold: "Ngưỡng an toàn < 1.5x",
        implication: "Áp lực chi phí lãi vay thấp.",
      },
      {
        flag_id: "stretched_receivables",
        name: "Khoản phải thu",
        severity: "clean",
        title: "Phải thu ngắn hạn ở mức thấp",
        description: "Không có dấu hiệu chiếm dụng vốn.",
        indicator_value: "Phải thu/TTS: 12.4%",
        threshold: "Cảnh báo khi > 35%",
        implication: "Tiền bán hàng thu hồi nhanh.",
      },
      {
        flag_id: "valuation_stretch",
        name: "Định giá P/E",
        severity: "low",
        title: "P/E tiệm cận vùng hợp lý",
        description: "P/E ở mức hấp dẫn.",
        indicator_value: "P/E: 11.2x",
        threshold: "P/E < 18x",
        implication: "Biên an toàn định giá tốt.",
      },
    ],
  };

  it("renders Altman Z-Score and 4 forensic red flags", () => {
    render(<FinancialForensicsPanel data={mockForensics} symbol="HPG" />);

    expect(screen.getByText(/Tầm soát rủi ro BCTC & Mô hình Altman Z-Score: HPG/i)).toBeInTheDocument();
    expect(screen.getByText("3.42")).toBeInTheDocument();
    expect(screen.getAllByText("An toàn").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("Dòng tiền kinh doanh thặng dư vững chắc")).toBeInTheDocument();
    expect(screen.getByText("Tỷ lệ nợ vay an toàn")).toBeInTheDocument();
    expect(screen.getByText("Phải thu ngắn hạn ở mức thấp")).toBeInTheDocument();
    expect(screen.getByText("P/E tiệm cận vùng hợp lý")).toBeInTheDocument();
  });

  it("renders empty state when data is null", () => {
    render(<FinancialForensicsPanel data={null} symbol="ABC" />);
    expect(screen.getByText(/Đang cập nhật chỉ số rủi ro cho ABC/i)).toBeInTheDocument();
  });
});

describe("EcosystemGraph", () => {
  it("renders ecosystem selector and nodes", async () => {
    render(<EcosystemGraph />);
    const elements = await screen.findAllByText(/Hệ sinh thái Vingroup/i);
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });
});
