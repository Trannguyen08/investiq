import Link from "next/link";
import { getAdminAlerts } from "@/lib/server/admin-ops-api";
import { AlertsTable } from "@/components/admin/alerts-table";
import { IconSearch, IconReset } from "@/components/admin/admin-icons";

type SearchParams = Promise<{
  severity?: string;
  status?: string;
  category?: string;
  page?: string;
  notice?: string;
  error?: string;
}>;

function pageQueryUrl(
  params: { severity?: string; status?: string; category?: string },
  targetPage: number
) {
  const q = new URLSearchParams();
  if (params.severity) q.set("severity", params.severity);
  if (params.status) q.set("status", params.status);
  if (params.category) q.set("category", params.category);
  q.set("page", String(targetPage));
  return `/admin/alerts?${q.toString()}`;
}

export default async function AdminAlertsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const severity = params.severity ?? "";
  const status = params.status ?? "";

  let result = null;
  let errorMsg = null;
  try {
    result = await getAdminAlerts({
      severity: severity || undefined,
      status: status || undefined,
      limit: 20,
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
        : "Không thể tải danh sách cảnh báo rủi ro.";
  }

  if (errorMsg || !result) {
    return (
      <div>
        <div className="admin-view-header">
          <div>
            <h1>Cảnh báo & Quản trị rủi ro</h1>
            <p>
              Giám sát giao dịch bất thường (Whale volume), sự cố thu thập dữ liệu và các hành vi an ninh hệ thống.
            </p>
          </div>
        </div>
        <p className="admin-alert error" role="alert">
          {errorMsg ?? "Không thể tải danh sách cảnh báo."}
        </p>
      </div>
    );
  }

  const prevPageUrl = pageQueryUrl(params, Math.max(1, page - 1));
  const nextPageUrl = pageQueryUrl(params, Math.min(result.total_pages, page + 1));
  const hasFilters = Boolean(severity || status);

  return (
    <div>
      <div className="admin-view-header">
        <div>
          <h1>Cảnh báo & Quản trị rủi ro</h1>
          <p>
            Giám sát giao dịch bất thường (Whale volume), sự cố thu thập dữ liệu và các hành vi an ninh hệ thống.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <span
            className="admin-badge disabled"
            style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem", backgroundColor: "#fee2e2", color: "#b91c1c" }}
          >
            Nghiêm trọng: {result.high_count}
          </span>
          <span
            className="admin-badge pending"
            style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem", backgroundColor: "#fef3c7", color: "#b45309" }}
          >
            Trung bình: {result.medium_count}
          </span>
          <span
            className="admin-badge active"
            style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}
          >
            Đang mở: {result.active_count}
          </span>
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
        action="/admin/alerts"
        method="get"
      >
        <select name="severity" defaultValue={severity}>
          <option value="">Tất cả mức độ</option>
          <option value="high">Nghiêm trọng (High)</option>
          <option value="medium">Trung bình (Medium)</option>
          <option value="low">Thấp (Low)</option>
        </select>

        <select name="status" defaultValue={status}>
          <option value="">Tất cả trạng thái</option>
          <option value="active">Chờ xử lý (Active)</option>
          <option value="resolved">Đã giải quyết (Resolved)</option>
          <option value="dismissed">Đã bỏ qua (Dismissed)</option>
        </select>

        <button type="submit" title="Lọc cảnh báo">
          <IconSearch width={14} height={14} />
          <span>Lọc</span>
        </button>

        {hasFilters && (
          <Link href="/admin/alerts" className="admin-reset-link" title="Xóa bộ lọc">
            <IconReset width={14} height={14} style={{ marginRight: "0.3rem" }} />
            <span>Đặt lại</span>
          </Link>
        )}
      </form>

      <AlertsTable alerts={result.items} />

      {/* PAGINATION BAR */}
      <nav
        className="admin-pagination-bar"
        aria-label="Phân trang cảnh báo"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "1.25rem",
        }}
      >
        <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
          Hiển thị trang <strong>{result.page}</strong> / <strong>{result.total_pages}</strong> (Tổng cộng {result.total} cảnh báo)
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {page > 1 ? (
            <Link className="admin-page-link" href={prevPageUrl}>
              ← Trang trước
            </Link>
          ) : (
            <span className="admin-page-link disabled">← Trang trước</span>
          )}

          {page < result.total_pages ? (
            <Link className="admin-page-link" href={nextPageUrl}>
              Trang sau →
            </Link>
          ) : (
            <span className="admin-page-link disabled">Trang sau →</span>
          )}
        </div>
      </nav>
    </div>
  );
}

