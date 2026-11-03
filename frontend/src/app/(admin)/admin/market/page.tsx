import Link from "next/link";
import { getAdminMarketInstruments } from "@/lib/server/admin-ops-api";
import { MarketInstrumentsTable } from "@/components/admin/market-instruments-table";
import { IconSearch, IconReset } from "@/components/admin/admin-icons";
import { AdminAlertMessages, AdminPaginationBar, isNextRedirect } from "@/components/admin/admin-page-controls";

type SearchParams = Promise<{
  symbol?: string;
  exchange?: string;
  sector?: string;
  status?: string;
  page?: string;
  notice?: string;
  error?: string;
}>;

export default async function AdminMarketPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const symbol = params.symbol ?? "";
  const exchange = params.exchange ?? "";
  const status = params.status ?? "";

  let result = null;
  let errorMsg = null;
  try {
    result = await getAdminMarketInstruments({
      symbol: symbol || undefined,
      exchange: exchange || undefined,
      status: status || undefined,
      limit: 20,
      page,
    });
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    errorMsg = err instanceof Error ? err.message : "Không thể tải danh mục cổ phiếu.";
  }

  if (errorMsg || !result) {
    return (
      <div>
        <div className="admin-view-header">
          <div>
            <h1>Quản trị Cổ phiếu & Thị trường</h1>
            <p>
              Giám sát trạng thái niêm yết, sàn giao dịch và công cụ kiểm soát rủi ro thị trường.
            </p>
          </div>
        </div>
        <p className="admin-alert error" role="alert">
          {errorMsg ?? "Không thể tải danh sách cổ phiếu."}
        </p>
      </div>
    );
  }

  const hasFilters = Boolean(symbol || exchange || status);

  return (
    <div>
      <div className="admin-view-header">
        <div>
          <h1>Quản trị Cổ phiếu & Thị trường</h1>
          <p>
            Giám sát trạng thái niêm yết, sàn giao dịch và công cụ kiểm soát rủi ro thị trường.
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <span className="admin-badge admin" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
            Tổng: {result.total} mã cổ phiếu
          </span>
        </div>
      </div>

      <AdminAlertMessages notice={params.notice} error={params.error} />

      {/* COMPACT FILTER BAR */}
      <form
        className="admin-filter-bar-compact"
        action="/admin/market"
        method="get"
      >
        <input
          type="search"
          name="symbol"
          placeholder="Tìm theo mã CP (ví dụ: HPG, FPT, VHM)..."
          maxLength={20}
          defaultValue={symbol}
        />

        <select name="exchange" defaultValue={exchange}>
          <option value="">Tất cả sàn giao dịch</option>
          <option value="HOSE">Sàn HOSE</option>
          <option value="HNX">Sàn HNX</option>
          <option value="UPCOM">Sàn UPCoM</option>
        </select>

        <select name="status" defaultValue={status}>
          <option value="">Tất cả trạng thái</option>
          <option value="normal">Giao dịch bình thường</option>
          <option value="warning">Cảnh báo / Kiểm soát</option>
          <option value="halted">Tạm ngừng giao dịch</option>
        </select>

        <button type="submit" title="Tìm kiếm">
          <IconSearch width={14} height={14} />
          <span>Tìm</span>
        </button>

        {hasFilters && (
          <Link href="/admin/market" className="admin-reset-link" title="Xóa bộ lọc">
            <IconReset width={14} height={14} style={{ marginRight: "0.3rem" }} />
            <span>Đặt lại</span>
          </Link>
        )}
      </form>

      <MarketInstrumentsTable instruments={result.items} />

      <AdminPaginationBar
        page={result.page}
        totalPages={result.total_pages}
        totalItems={result.total}
        itemLabel="mã"
        basePath="/admin/market"
        params={{ symbol, exchange, status }}
        ariaLabel="Phân trang danh mục cổ phiếu"
      />
    </div>
  );
}
