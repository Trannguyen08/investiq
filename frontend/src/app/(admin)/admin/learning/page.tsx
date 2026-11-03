import { getAdminLearningTopics } from "@/lib/server/admin-ops-api";
import { LearningManagementTable } from "@/components/admin/learning-management-table";
import { AdminAlertMessages, AdminPaginationBar, isNextRedirect } from "@/components/admin/admin-page-controls";

type SearchParams = Promise<{
  level?: string;
  status?: string;
  q?: string;
  page?: string;
  notice?: string;
  error?: string;
}>;

export default async function AdminLearningPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const level = params.level ?? "";
  const status = params.status ?? "";
  const q = params.q ?? "";

  let result = null;
  let errorMsg = null;
  try {
    result = await getAdminLearningTopics({
      level: level || undefined,
      status: status || undefined,
      q: q || undefined,
      limit: 25,
      page,
    });
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    errorMsg = err instanceof Error ? err.message : "Không thể tải danh sách bài học.";
  }

  if (errorMsg || !result) {
    return (
      <div>
        <div className="admin-view-header">
          <div>
            <h1>Khóa học & Lộ trình Chứng khoán</h1>
            <p>Quản lý giáo trình đào tạo, lý thuyết, ví dụ thực tế và bài kiểm tra trắc nghiệm.</p>
          </div>
        </div>
        <p className="admin-alert error" role="alert">
          {errorMsg ?? "Không thể tải danh sách bài học."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-view-header">
        <div>
          <h1>Khóa học & Lộ trình Chứng khoán</h1>
          <p>
            Quản lý giáo trình đào tạo theo cấp độ từ Dễ tới Khó, bài tập thực tế và bộ câu hỏi trắc nghiệm.
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <span className="admin-badge admin" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
            Tổng: {result.total} bài học
          </span>
        </div>
      </div>

      <AdminAlertMessages notice={params.notice} error={params.error} />

      <LearningManagementTable
        topics={result.items}
        initialSearch={q}
        initialLevel={level}
      />

      <AdminPaginationBar
        page={result.page}
        totalPages={result.total_pages}
        totalItems={result.total}
        itemLabel="bài học"
        basePath="/admin/learning"
        params={{ q, level, status }}
        ariaLabel="Phân trang Khóa học"
        variant="buttons"
      />
    </div>
  );
}
