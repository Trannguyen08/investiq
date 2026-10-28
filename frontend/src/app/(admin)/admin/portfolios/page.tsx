import Link from "next/link";
import { getAdminPortfolioDetail, getAdminPortfolios } from "@/lib/server/admin-ops-api";
import { PortfoliosTable } from "@/components/admin/portfolios-table";

type SearchParams = Promise<{
  q?: string;
  page?: string;
  notice?: string;
  error?: string;
}>;

export default async function AdminPortfoliosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const q = params.q ?? "";

  let result = null;
  let errorMsg = null;
  try {
    result = await getAdminPortfolios({
      q: q || undefined,
      limit: 20,
      page,
    });
  } catch (err) {
    errorMsg =
      err instanceof Error
        ? err.message
        : "Không thể tải danh sách tài khoản Paper Trading.";
  }

  if (errorMsg || !result) {
    return (
      <div>
        <div className="admin-view-header">
          <div>
            <h1>Paper Trading & Lệnh</h1>
            <p>Giám sát danh mục đầu tư mô phỏng, số dư vốn và lịch sử khớp lệnh của người dùng.</p>
          </div>
        </div>
        <p className="admin-alert error" role="alert">
          {errorMsg ?? "Không thể tải danh sách tài khoản Paper Trading."}
        </p>
      </div>
    );
  }

  async function loadDetailAction(id: string) {
    "use server";
    return getAdminPortfolioDetail(id).catch(() => null);
  }

  const prevPageUrl = pageQueryUrl(params, Math.max(1, page - 1));
  const nextPageUrl = pageQueryUrl(params, Math.min(result.total_pages, page + 1));

  return (
    <div>
      <div className="admin-view-header">
        <div>
          <h1>Paper Trading & Sổ lệnh</h1>
          <p>
            Giám sát danh mục đầu tư mô phỏng, số dư vốn và lịch sử khớp lệnh của người dùng.
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <span className="admin-badge admin" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
            Tổng: {result.total} danh mục
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

      {/* FILTER BAR */}
      <form
        className="admin-filter-bar"
        action="/admin/portfolios"
        method="get"
        style={{ borderRadius: "0.5rem", marginBottom: "1rem" }}
      >
        <input
          type="search"
          name="q"
          placeholder="Tìm theo email, tên hoặc nickname..."
          maxLength={120}
          defaultValue={q}
          className="admin-filter-input"
          style={{ minWidth: "260px", flex: 1 }}
        />
        <button type="submit" className="admin-btn-primary">
          Lọc danh mục
        </button>
      </form>

      <PortfoliosTable
        portfolios={result.items}
        loadDetail={loadDetailAction}
      />

      {/* PAGINATION BAR */}
      <nav
        className="admin-pagination-bar"
        aria-label="Phân trang Paper Trading"
        style={{ borderRadius: "0.5rem" }}
      >
        <span>
          Đang xem trang <strong>{result.page}</strong> / {result.total_pages} (Tổng {result.total} tài khoản)
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
  if (params.q) query.set("q", params.q);
  query.set("page", String(targetPage));
  return `/admin/portfolios?${query.toString()}`;
}

