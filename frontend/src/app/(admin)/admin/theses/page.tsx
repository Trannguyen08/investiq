import Link from "next/link";
import { getAdminTheses } from "@/lib/server/admin-ops-api";
import { ThesesTable } from "@/components/admin/theses-table";
import { IconSearch, IconReset } from "@/components/admin/admin-icons";
import { AdminAlertMessages, AdminPaginationBar, isNextRedirect } from "@/components/admin/admin-page-controls";

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
    if (isNextRedirect(err)) throw err;
    errorMsg = err instanceof Error ? err.message : "Không thể tải danh sách khuyến nghị.";
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
          <span className="admin-badge admin" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
            Tổng: {result.total} khuyến nghị
          </span>
        </div>
      </div>

      <AdminAlertMessages notice={params.notice} error={params.error} />

      {/* COMPACT FILTER BAR */}
      <form
        className="admin-filter-bar-compact"
        action="/admin/theses"
        method="get"
      >
        <input
          type="search"
          name="q"
          placeholder="Tìm tiêu đề, tác giả..."
          maxLength={120}
          defaultValue={q}
        />
        <input
          type="text"
          name="symbol"
          placeholder="Mã CP (HPG, VNM...)"
          maxLength={10}
          defaultValue={symbol}
          style={{ width: "120px", textTransform: "uppercase" }}
        />
        <select name="stance" defaultValue={stance}>
          <option value="">Tất cả vị thế</option>
          <option value="bullish">Mua (Bullish)</option>
          <option value="bearish">Bán (Bearish)</option>
          <option value="neutral">Trung lập</option>
        </select>
        <select name="status" defaultValue={status}>
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

      <AdminPaginationBar
        page={result.page}
        totalPages={result.total_pages}
        totalItems={result.total}
        itemLabel="khuyến nghị"
        basePath="/admin/theses"
        params={{ q, symbol, status, stance }}
        ariaLabel="Phân trang Theses"
        variant="buttons"
      />
    </div>
  );
}
