import Link from "next/link";
import { getAdminAuditLogs } from "@/lib/server/admin-ops-api";
import { AuditLogsTable } from "@/components/admin/audit-logs-table";

type SearchParams = Promise<{
  category?: string;
  outcome?: string;
  page?: string;
  notice?: string;
  error?: string;
}>;

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const category = params.category ?? "";
  const outcome = params.outcome ?? "";
  const logViewerUrl =
    process.env.NEXT_PUBLIC_LOG_VIEWER_URL ?? "http://localhost:9999";

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
            <p>Kiểm toán an ninh, nhật ký truy cập và runtime console logs.</p>
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
          >
            Mở Dozzle Runtime Log Viewer ↗
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

      {/* FILTER BAR */}
      <form
        className="admin-filter-bar"
        action="/admin/logs"
        method="get"
        style={{ borderRadius: "0.5rem", marginBottom: "1rem" }}
      >
        <input
          type="search"
          name="category"
          placeholder="Lọc loại sự kiện (auth, admin, thesis...)"
          maxLength={60}
          defaultValue={category}
          className="admin-filter-input"
          style={{ minWidth: "260px", flex: 1 }}
        />
        <select name="outcome" defaultValue={outcome} className="admin-filter-select">
          <option value="">Tất cả kết quả</option>
          <option value="succeeded">Thành công (Succeeded)</option>
          <option value="denied">Bị từ chối (Denied)</option>
          <option value="failed">Thất bại (Failed)</option>
        </select>
        <button type="submit" className="admin-btn-primary">
          Lọc sự kiện
        </button>
      </form>

      <AuditLogsTable logs={result.items} />

      {/* PAGINATION BAR */}
      <nav
        className="admin-pagination-bar"
        aria-label="Phân trang Audit Logs"
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
  for (const key of ["category", "outcome"] as const) {
    const val = params[key];
    if (val) query.set(key, val);
  }
  query.set("page", String(targetPage));
  return `/admin/logs?${query.toString()}`;
}
