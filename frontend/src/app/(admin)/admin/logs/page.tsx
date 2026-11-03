import Link from "next/link";
import { getAdminAuditLogs } from "@/lib/server/admin-ops-api";
import { AuditLogsTable } from "@/components/admin/audit-logs-table";
import { IconSearch, IconReset, IconArrowUpRight } from "@/components/admin/admin-icons";
import { AdminAlertMessages, AdminPaginationBar, isNextRedirect } from "@/components/admin/admin-page-controls";

type SearchParams = Promise<{
  category?: string;
  outcome?: string;
  page?: string;
  notice?: string;
  error?: string;
}>;

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const category = params.category ?? "";
  const outcome = params.outcome ?? "";

  let result = null;
  let errorMsg = null;
  try {
    result = await getAdminAuditLogs({
      category: category || undefined,
      outcome: outcome || undefined,
      limit: 25,
      page,
    });
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    errorMsg = err instanceof Error ? err.message : "Không thể tải nhật ký kiểm toán hệ thống.";
  }

  if (errorMsg || !result) {
    return (
      <div>
        <div className="admin-view-header">
          <div>
            <h1>Nhật ký & Giám sát hệ thống</h1>
            <p>Kiểm toán an ninh, lưu vết truy cập và liên kết trực tiếp tới Runtime Container Logs.</p>
          </div>
        </div>
        <p className="admin-alert error" role="alert">
          {errorMsg ?? "Không thể tải nhật ký kiểm toán."}
        </p>
      </div>
    );
  }

  const hasFilters = Boolean(category || outcome);

  return (
    <div>
      <div className="admin-view-header">
        <div>
          <h1>Nhật ký & Giám sát hệ thống</h1>
          <p>
            Kiểm toán an ninh, lưu vết truy cập và liên kết trực tiếp tới Runtime Container Logs.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <a
            href="https://dashboard.render.com"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn-detail"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "#0284c7",
              color: "#fff",
              border: "none",
              padding: "0.45rem 0.85rem",
              borderRadius: "0.4rem",
              fontSize: "0.82rem",
              fontWeight: 600,
            }}
          >
            <span>Live Container Logs</span>
            <IconArrowUpRight width={13} height={13} />
          </a>
        </div>
      </div>

      <AdminAlertMessages notice={params.notice} error={params.error} />

      {/* COMPACT FILTER BAR */}
      <form
        className="admin-filter-bar-compact"
        action="/admin/logs"
        method="get"
      >
        <select name="category" defaultValue={category}>
          <option value="">Tất cả danh mục</option>
          <option value="auth">Xác thực (Auth)</option>
          <option value="data_pipeline">Thu thập dữ liệu</option>
          <option value="user_management">Quản trị người dùng</option>
          <option value="system_admin">Hệ thống</option>
          <option value="security">An ninh</option>
        </select>
        <select name="outcome" defaultValue={outcome}>
          <option value="">Tất cả kết quả</option>
          <option value="success">Thành công</option>
          <option value="failed">Thất bại</option>
        </select>
        <button type="submit" title="Tìm kiếm">
          <IconSearch width={14} height={14} />
          <span>Tìm</span>
        </button>
        {hasFilters && (
          <Link href="/admin/logs" className="admin-reset-link" title="Xóa bộ lọc">
            <IconReset width={14} height={14} style={{ marginRight: "0.3rem" }} />
            <span>Đặt lại</span>
          </Link>
        )}
      </form>

      <AuditLogsTable logs={result.items} />

      <AdminPaginationBar
        page={result.page}
        totalPages={result.total_pages}
        totalItems={result.total}
        itemLabel="sự kiện"
        basePath="/admin/logs"
        params={{ category, outcome }}
        ariaLabel="Phân trang kiểm toán"
        variant="buttons"
      />
    </div>
  );
}
