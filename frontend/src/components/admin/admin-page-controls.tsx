import Link from "next/link";

/**
 * Hiển thị thông báo trạng thái hoặc lỗi cho trang Admin.
 */
export function AdminAlertMessages({
  notice,
  error,
}: {
  notice?: string;
  error?: string;
}) {
  return (
    <>
      {notice && (
        <p className="admin-alert success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="admin-alert error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * Tạo URL phân trang kèm query params cho trang Admin.
 */
export function buildAdminPageUrl(
  basePath: string,
  params: Record<string, string | undefined>,
  targetPage: number
): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") {
      q.set(key, value);
    }
  }
  q.set("page", String(targetPage));
  return `${basePath}?${q.toString()}`;
}

/**
 * Kiểm tra xem lỗi có phải là Next.js Redirect không để rethrow an toàn.
 */
export function isNextRedirect(err: unknown): boolean {
  return Boolean(
    err instanceof Error &&
      (err.message === "NEXT_REDIRECT" ||
        ("digest" in err &&
          String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))
  );
}

/**
 * Thanh điều hướng phân trang dùng chung cho các màn hình Admin.
 */
export function AdminPaginationBar({
  page,
  totalPages,
  totalItems,
  itemLabel = "mục",
  basePath,
  params,
  ariaLabel = "Phân trang dữ liệu",
  variant = "links",
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  itemLabel?: string;
  basePath: string;
  params: Record<string, string | undefined>;
  ariaLabel?: string;
  variant?: "links" | "buttons";
}) {
  const prevPageUrl = buildAdminPageUrl(basePath, params, Math.max(1, page - 1));
  const nextPageUrl = buildAdminPageUrl(basePath, params, Math.min(totalPages, page + 1));

  if (variant === "buttons") {
    return (
      <nav
        className="admin-pagination-bar"
        aria-label={ariaLabel}
        style={{ borderRadius: "0.5rem" }}
      >
        <span>
          Đang xem trang <strong>{page}</strong> / {totalPages} (Tổng {totalItems} {itemLabel})
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
          {page < totalPages ? (
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
    );
  }

  return (
    <nav
      className="admin-pagination-bar"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "1.25rem",
      }}
    >
      <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
        Hiển thị trang <strong>{page}</strong> / <strong>{totalPages}</strong> (Tổng cộng {totalItems} {itemLabel})
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {page > 1 ? (
          <Link className="admin-page-link" href={prevPageUrl}>
            ← Trang trước
          </Link>
        ) : (
          <span className="admin-page-link disabled">← Trang trước</span>
        )}

        {page < totalPages ? (
          <Link className="admin-page-link" href={nextPageUrl}>
            Trang sau →
          </Link>
        ) : (
          <span className="admin-page-link disabled">Trang sau →</span>
        )}
      </div>
    </nav>
  );
}
