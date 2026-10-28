import Link from "next/link";
import { getAdminTheses } from "@/lib/server/admin-ops-api";
import { ThesesTable } from "@/components/admin/theses-table";

type SearchParams = Promise<{
  symbol?: string;
  status?: string;
  stance?: string;
  q?: string;
  page?: string;
  notice?: string;
  error?: string;
}>;

export default async function AdminThesesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const symbol = (params.symbol ?? "").toUpperCase().slice(0, 10);
  const status = params.status ?? "";
  const stance = params.stance ?? "";
  const q = params.q ?? "";

  let result = null;
  let errorMsg = null;
  try {
    result = await getAdminTheses({
      symbol: symbol || undefined,
      status: status || undefined,
      stance: stance || undefined,
      q: q || undefined,
      limit: 20,
      page,
    });
  } catch (err) {
    errorMsg =
      err instanceof Error
        ? err.message
        : "Không thể tải danh sách khuyến nghị.";
  }

  if (errorMsg || !result) {
    return (
      <div>
        <div className="admin-view-header">
          <div>
            <h1>Theses & Khuyến nghị đầu tư</h1>
            <p>Kiểm duyệt bài phân tích, theo dõi win rate và quản lý khuyến nghị cộng đồng.</p>
          </div>
        </div>
        <p className="admin-alert error" role="alert">
          {errorMsg ?? "Không thể tải danh sách khuyến nghị."}
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
          <h1>Theses & Khuyến nghị đầu tư</h1>
          <p>
            Kiểm duyệt bài phân tích, theo dõi win rate và quản lý khuyến nghị cộng đồng.
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <span className="admin-badge bullish" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
            Tổng: {result.total} bài phân tích
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
        action="/admin/theses"
        method="get"
        style={{ borderRadius: "0.5rem", marginBottom: "1rem" }}
      >
        <input
          type="search"
          name="q"
          placeholder="Tìm theo tiêu đề, tác giả..."
          maxLength={120}
          defaultValue={q}
          className="admin-filter-input"
          style={{ minWidth: "220px", flex: 1 }}
        />
        <input
          type="text"
          name="symbol"
          placeholder="Mã CP (VCB, HPG...)"
          maxLength={10}
          defaultValue={symbol}
          className="admin-filter-input"
          style={{ width: "160px" }}
        />
        <select name="stance" defaultValue={stance} className="admin-filter-select">
          <option value="">Tất cả vị thế</option>
          <option value="bullish">Tăng (Bullish)</option>
          <option value="bearish">Giảm (Bearish)</option>
          <option value="neutral">Trung lập (Neutral)</option>
        </select>
        <select name="status" defaultValue={status} className="admin-filter-select">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang theo dõi</option>
          <option value="hit_target">Chạm mục tiêu</option>
          <option value="stopped_out">Cắt lỗ</option>
          <option value="expired">Hết hạn</option>
        </select>
        <button type="submit" className="admin-btn-primary">
          Lọc dữ liệu
        </button>
      </form>

      <ThesesTable theses={result.items} />

      {/* PAGINATION BAR */}
      <nav
        className="admin-pagination-bar"
        aria-label="Phân trang Theses"
        style={{ borderRadius: "0.5rem" }}
      >
        <span>
          Đang xem trang <strong>{result.page}</strong> / {result.total_pages} (Tổng {result.total} khuyến nghị)
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
  for (const key of ["symbol", "status", "stance", "q"] as const) {
    const val = params[key];
    if (val) query.set(key, val);
  }
  query.set("page", String(targetPage));
  return `/admin/theses?${query.toString()}`;
}

