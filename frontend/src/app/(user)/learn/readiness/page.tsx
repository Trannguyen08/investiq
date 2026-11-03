import { Metadata } from "next";
import Link from "next/link";
import { getAssessmentQuestions, getLatestAssessment } from "@/lib/api-client";
import { InvestorAssessmentWizard } from "@/components/learn/investor-assessment-wizard";

export const metadata: Metadata = {
  title: "Đánh giá Mức độ Sẵn sàng Đầu tư | InvestIQ",
  description:
    "Trắc nghiệm định hướng tính cách, khẩu vị rủi ro và đánh giá mức độ sẵn sàng tham gia thị trường chứng khoán cho người mới.",
};

export default async function ReadinessAssessmentPage() {
  const [questions, initialEvaluation] = await Promise.all([
    getAssessmentQuestions().catch(() => []),
    getLatestAssessment().catch(() => null),
  ]);

  return (
    <main id="main-content" className="learn-page readiness-page">
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Breadcrumb & Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#94a3b8" }}>
          <Link href="/learn" style={{ color: "#38bdf8", textDecoration: "none" }}>
            Chứng khoán căn bản
          </Link>
          <span>/</span>
          <span style={{ color: "#ffffff", fontWeight: 600 }}>Đánh giá mức độ sẵn sàng</span>
        </div>

        {/* Intro Header */}
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 900, color: "#ffffff", lineHeight: 1.3 }}>
            Khảo sát Định hướng &amp; Mức độ Sẵn sàng Đầu tư
          </h1>
          <p style={{ fontSize: "0.95rem", color: "#94a3b8", marginTop: "0.5rem", lineHeight: 1.6 }}>
            Bạn có tố chất, tâm lý và kỷ luật phù hợp để theo đuổi chứng khoán hay không? Hoàn thành 10 câu hỏi tình huống thực tế để nhận bản báo cáo chẩn đoán khách quan, xác định phong cách đầu tư chuẩn mực và biết mình đã sẵn sàng nạp tiền thật hay chưa.
          </p>
        </div>

        {/* Interactive Wizard or Result Card */}
        <InvestorAssessmentWizard
          questions={questions}
          initialEvaluation={initialEvaluation}
        />
      </div>
    </main>
  );
}
