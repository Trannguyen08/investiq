import Link from "next/link";
import { getAdminPortfolios, getAdminPortfolioDetail } from "@/lib/server/admin-ops-api";
import { PortfoliosTable } from "@/components/admin/portfolios-table";
import { IconSearch, IconReset } from "@/components/admin/admin-icons";
import { AdminAlertMessages, AdminPaginationBar, isNextRedirect } from "@/components/admin/admin-page-controls";

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
    if (isNextRedirect(err)) throw err;
    errorMsg = err instanceof Error ? err.message : "Không thể tải danh sách tài khoản Paper Trading.";
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

      <AdminAlertMessages notice={params.notice} error={params.error} />

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

      <AdminPaginationBar
        page={result.page}
        totalPages={result.total_pages}
        totalItems={result.total}
        itemLabel="danh mục"
        basePath="/admin/portfolios"
        params={{ q }}
        ariaLabel="Phân trang danh mục"
        variant="buttons"
      />
    </div>
  );
}
