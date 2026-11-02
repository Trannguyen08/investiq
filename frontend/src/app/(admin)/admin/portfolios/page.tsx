import Link from "next/link";
import { getAdminPortfolios, getAdminPortfolioDetail } from "@/lib/server/admin-ops-api";
import { PortfoliosTable } from "@/components/admin/portfolios-table";
import { IconSearch, IconReset } from "@/components/admin/admin-icons";

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
        : "Không thể tải danh sách tài khoản Paper Trading.";
  }

  if (errorMsg || !result) {
    return (
      <div>
        <div className="admin-view-header">
          <div>
            <h1>Paper Trading & Sổ lệnh</h1>
            <p>Giám sát danh mục đầu tư mô phỏng, số dư vốn và lịch sử khớp lệnh của người dùng.</p>
          </div>
        </div>
        <p className="admin-alert error" role="alert">
          {errorMsg ?? "Không thể tải danh sách tài khoản."}
        </p>
      </div>
    );
  }

  const prevPageUrl = pageQueryUrl(params, Math.max(1, page - 1));
  const nextPageUrl = pageQueryUrl(params, Math.min(result.total_pages, page + 1));
  const hasFilters = Boolean(q);

  async function loadDetailAction(id: string) {
    "use server";
    return getAdminPortfolioDetail(id);
  }

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

      {/* COMPACT FILTER BAR */}
      <form
        className="admin-filter-bar-compact"
        action="/admin/portfolios"
        method="get"
      >
        <input
          type="search"
          name="q"
          placeholder="Tìm theo email, tên hiển thị hoặc biệt danh..."
          maxLength={120}
          defaultValue={q}
        />
        <button type="submit" title="Tìm kiếm">
          <IconSearch width={14} height={14} />
          <span>Tìm</span>
        </button>
        {hasFilters && (
          <Link href="/admin/portfolios" className="admin-reset-link" title="Xóa bộ lọc">
            <IconReset width={14} height={14} style={{ marginRight: "0.3rem" }} />
            <span>Đặt lại</span>
          </Link>
        )}
      </form>

      <PortfoliosTable
        portfolios={result.items}
        loadDetail={loadDetailAction}
      />

      {/* PAGINATION BAR */}
      <nav
        className="admin-pagination-bar"
        aria-label="Phân trang danh mục"
        style={{ borderRadius: "0.5rem" }}
      >
        <span>
          Đang xem trang <strong>{result.page}</strong> / {result.total_pages} (Tổng {result.total} danh mục)
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
