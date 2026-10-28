import Link from "next/link";
import { getAdminMarketInstruments } from "@/lib/server/admin-ops-api";
import { MarketInstrumentsTable } from "@/components/admin/market-instruments-table";
import { IconSearch, IconReset } from "@/components/admin/admin-icons";

type SearchParams = Promise<{
  symbol?: string;
  exchange?: string;
  sector?: string;
  status?: string;
  page?: string;
  notice?: string;
  error?: string;
}>;

function pageQueryUrl(
  params: { symbol?: string; exchange?: string; status?: string; sector?: string },
  targetPage: number
) {
  const q = new URLSearchParams();
  if (params.symbol) q.set("symbol", params.symbol);
  if (params.exchange) q.set("exchange", params.exchange);
  if (params.sector) q.set("sector", params.sector);
  if (params.status) q.set("status", params.status);
  q.set("page", String(targetPage));
  return `/admin/market?${q.toString()}`;
}

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
    errorMsg =
      err instanceof Error
        ? err.message
        : "Không thể tải danh sách mã cổ phiếu thị trường.";
  }

  if (errorMsg || !result) {
    return (
      <div>
        <div className="admin-view-header">
          <div>
            <h1>Mã cổ phiếu & Thị trường</h1>
            <p>
              Quản trị danh mục cổ phiếu niêm yết, theo dõi biên độ giá và điều phối quyền giao dịch Paper Trading.
            </p>
          </div>
        </div>
        <p className="admin-alert error" role="alert">
          {errorMsg ?? "Không thể tải danh sách mã cổ phiếu."}
        </p>
      </div>
    );
  }

  const prevPageUrl = pageQueryUrl(params, Math.max(1, page - 1));
  const nextPageUrl = pageQueryUrl(params, Math.min(result.total_pages, page + 1));
  const hasFilters = Boolean(symbol || exchange || status);

  return (
    <div>
      <div className="admin-view-header">
        <div>
          <h1>Mã cổ phiếu & Thị trường</h1>
          <p>
            Quản trị danh mục cổ phiếu niêm yết, theo dõi biên độ giá và điều phối quyền giao dịch Paper Trading.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <span className="admin-badge admin" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
            Tổng: {result.total} mã cổ phiếu
          </span>
          <span className="admin-badge active" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
            Khớp: {(result.total_matched_value_vnd / 1_000_000_000).toFixed(1)} Tỷ VND
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

      {/* PAGINATION BAR */}
      <nav
        className="admin-pagination-bar"
        aria-label="Phân trang danh mục cổ phiếu"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "1.25rem",
        }}
      >
        <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
          Hiển thị trang <strong>{result.page}</strong> / <strong>{result.total_pages}</strong> (Tổng cộng {result.total} mã)
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
