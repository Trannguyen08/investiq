import Link from "next/link";
import { getAdminTheses } from "@/lib/server/admin-ops-api";
import { ThesesTable } from "@/components/admin/theses-table";
import { IconSearch, IconReset } from "@/components/admin/admin-icons";

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
  const hasFilters = Boolean(q || symbol || status || stance);

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

      {/* COMPACT & USEFUL FILTER BAR */}
      <form
        className="admin-filter-bar-compact"
        action="/admin/theses"
        method="get"
      >
        <input
          type="search"
          name="q"
          placeholder="Tìm kiếm mã CP, tiêu đề hoặc tác giả..."
          maxLength={120}
          defaultValue={q || symbol}
        />
        <select name="stance" defaultValue={stance} aria-label="Lọc theo vị thế">
          <option value="">Tất cả vị thế</option>
          <option value="bullish">Tăng (Bullish)</option>
          <option value="bearish">Giảm (Bearish)</option>
          <option value="neutral">Trung lập (Neutral)</option>
        </select>
        <select name="status" defaultValue={status} aria-label="Lọc theo trạng thái">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang theo dõi</option>
          <option value="hit_target">Chạm mục tiêu</option>
          <option value="stopped_out">Cắt lỗ</option>
          <option value="expired">Hết hạn</option>
        </select>
        <button type="submit" title="Tìm kiếm">
          <IconSearch width={14} height={14} />
          <span>Tìm</span>
        </button>
        {hasFilters && (
          <Link href="/admin/theses" className="admin-reset-link" title="Xóa bộ lọc">
            <IconReset width={14} height={14} style={{ marginRight: "0.3rem" }} />
            <span>Đặt lại</span>
          </Link>
        )}
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
  if (params.q) query.set("q", params.q);
  if (params.symbol) query.set("symbol", params.symbol);
  if (params.status) query.set("status", params.status);
  if (params.stance) query.set("stance", params.stance);
  query.set("page", String(targetPage));
  return `/admin/theses?${query.toString()}`;
}
