import Link from "next/link";
import { getAdminAuditLogs } from "@/lib/server/admin-ops-api";
import { AuditLogsTable } from "@/components/admin/audit-logs-table";
import { IconSearch, IconReset, IconArrowUpRight } from "@/components/admin/admin-icons";

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
    if (
      err instanceof Error &&
      (err.message === "NEXT_REDIRECT" ||
        ("digest" in err && String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))
    ) {
      throw err;
    }
    errorMsg =
      err instanceof Error
        ? err.message
        : "Không thể tải nhật ký kiểm toán hệ thống.";
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

  const prevPageUrl = pageQueryUrl(params, Math.max(1, page - 1));
  const nextPageUrl = pageQueryUrl(params, Math.min(result.total_pages, page + 1));
  const logViewerUrl = process.env.ADMIN_LOG_VIEWER_URL || "http://localhost:8888";
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
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <a
            className="admin-btn-primary"
            href={logViewerUrl}
            target="_blank"
            rel="noreferrer"
            title="Mở trình xem log runtime Dozzle chạy trên localhost"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
          >
            <span>Dozzle Runtime Log Viewer</span>
            <IconArrowUpRight width={14} height={14} />
          </a>
        </div>
      </div>

      {params.notice && (
        <p className="admin-alert success" role="status">
          {params.notice}
        </p>
      )}
      {params.error && (
        <p className="admin-alert error" role="alert">
          {params.error}
        </p>
      )}

      {/* COMPACT FILTER BAR */}
      <form
        className="admin-filter-bar-compact"
        action="/admin/logs"
        method="get"
      >
        <input
          type="search"
          name="category"
          placeholder="Lọc loại sự kiện (auth, admin, thesis, status...)..."
          maxLength={60}
          defaultValue={category}
        />
        <select name="outcome" defaultValue={outcome} aria-label="Lọc theo kết quả">
          <option value="">Tất cả kết quả</option>
          <option value="succeeded">Thành công</option>
          <option value="denied">Bị từ chối</option>
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

      {/* PAGINATION BAR */}
      <nav
        className="admin-pagination-bar"
        aria-label="Phân trang kiểm toán"
        style={{ borderRadius: "0.5rem" }}
      >
        <span>
          Đang xem trang <strong>{result.page}</strong> / {result.total_pages} (Tổng {result.total} sự kiện)
        </span>
        <div className="admin-pagination-controls">
          {page > 1 ? (
            <Link className="admin-btn-detail" href={prevPageUrl}>
              Trang trước
            </Link>
          ) : (
            <button
              type="button"
              className="admin-btn-detail"
              disabled
              style={{ opacity: 0.5, cursor: "not-allowed" }}
            >
              Trang trước
            </button>
          )}
          {page < result.total_pages ? (
            <Link className="admin-btn-detail" href={nextPageUrl}>
              Trang sau
            </Link>
          ) : (
            <button
              type="button"
              className="admin-btn-detail"
              disabled
              style={{ opacity: 0.5, cursor: "not-allowed" }}
            >
              Trang sau
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}

function pageQueryUrl(params: Awaited<SearchParams>, targetPage: number) {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.outcome) query.set("outcome", params.outcome);
  query.set("page", String(targetPage));
  return `/admin/logs?${query.toString()}`;
}
