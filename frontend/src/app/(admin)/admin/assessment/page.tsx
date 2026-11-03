import {
  getAdminAssessmentQuestions,
  getAdminAssessmentStats,
  getAdminAssessmentSubmissions,
  getAdminPersonas,
} from "@/lib/server/admin-ops-api";
import { AssessmentManagementTable } from "@/components/admin/assessment-management-table";

interface PageProps {
  searchParams: Promise<{
    notice?: string;
    error?: string;
    page?: string;
    limit?: string;
    persona_code?: string;
    readiness_level?: string;
  }>;
}

export default async function AdminAssessmentPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = parseInt(sp.page || "1", 10);
  const limit = parseInt(sp.limit || "20", 10);

  const [stats, questions, personas, submissionsPage] = await Promise.all([
    getAdminAssessmentStats().catch(() => ({
      total_assessments: 0,
      average_readiness_score: 0,
      ready_percentage: 0,
      top_persona_code: "dca_accumulator",
      top_persona_title: "Nhà đầu tư Tích sản Dài hạn (DCA)",
      persona_distribution: {},
    })),
    getAdminAssessmentQuestions().catch(() => []),
    getAdminPersonas().catch(() => []),
    getAdminAssessmentSubmissions({
      page,
      limit,
      personaCode: sp.persona_code,
      readinessLevel: sp.readiness_level,
    }).catch(() => ({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      pages: 1,
    })),
  ]);

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>
          Đánh giá Khảo sát &amp; Định hướng Nhà đầu tư
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>
          Quản lý ngân hàng câu hỏi trắc nghiệm tâm lý rủi ro, hồ sơ Persona và theo dõi mức độ sẵn sàng của người dùng.
        </p>

        {sp.notice && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1rem",
              background: "#dcfce7",
              border: "1px solid #86efac",
              color: "#166534",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            {sp.notice}
          </div>
        )}

        {sp.error && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1rem",
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              color: "#991b1b",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            {sp.error}
          </div>
        )}
      </div>

      <AssessmentManagementTable
        stats={stats}
        questions={questions}
        personas={personas}
        submissionsPage={submissionsPage}
      />
    </div>
  );
}
