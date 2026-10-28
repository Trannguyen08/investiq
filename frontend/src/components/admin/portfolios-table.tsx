"use client";

import { useState } from "react";
import type {
  AdminPortfolioDetail,
  AdminPortfolioItem,
} from "@/lib/server/admin-ops-api";
import { AdminDetailModal } from "@/components/admin/admin-detail-modal";
import { IconView } from "@/components/admin/admin-icons";

export function PortfoliosTable({
  portfolios,
  loadDetail,
}: {
  portfolios: AdminPortfolioItem[];
  loadDetail: (id: string) => Promise<AdminPortfolioDetail | null>;
}) {
  const [selectedDetail, setSelectedDetail] = useState<AdminPortfolioDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleViewDetail(portfolio: AdminPortfolioItem) {
    setLoadingId(portfolio.id);
    try {
      const detail = await loadDetail(portfolio.id);
      if (detail) {
        setSelectedDetail(detail);
      }
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div>
          <h2 className="admin-card-title">Danh sách tài khoản Paper Trading</h2>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Giám sát số dư tiền mặt, danh mục nắm giữ và lịch sử giao dịch mô phỏng
          </span>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table-unified">
          <thead>
            <tr>
              <th>Người dùng</th>
              <th>Biệt danh</th>
              <th>Vốn ban đầu</th>
              <th>Số dư tiền mặt</th>
              <th>Lãi/Lỗ đã chốt</th>
              <th>Mã nắm giữ</th>
              <th>Tổng lệnh</th>
              <th>Chế độ</th>
              <th style={{ textAlign: "right", width: "80px" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {portfolios.length ? (
              portfolios.map((item) => {
                const pnlColor =
                  item.realized_pnl > 0
                    ? "#16a34a"
                    : item.realized_pnl < 0
                    ? "#dc2626"
                    : "#64748b";

                return (
                  <tr key={item.id}>
                    <td>
                      <div>
                        <strong style={{ color: "#0f172a" }}>{item.user_name}</strong>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {item.user_email}
                        </div>
                      </div>
                    </td>
                    <td>
                      {item.nickname ? (
                        <span style={{ fontWeight: 600, color: "#2563eb" }}>
                          {item.nickname}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    <td>{item.starting_cash.toLocaleString("vi-VN")} ₫</td>
                    <td>
                      <strong>{item.cash_balance.toLocaleString("vi-VN")} ₫</strong>
                    </td>
                    <td>
                      <span style={{ color: pnlColor, fontWeight: 700 }}>
                        {item.realized_pnl > 0
                          ? `+${item.realized_pnl.toLocaleString("vi-VN")} ₫`
                          : `${item.realized_pnl.toLocaleString("vi-VN")} ₫`}
                      </span>
                    </td>
                    <td>
                      <span className="admin-badge user">
                        {item.holdings_count} mã
                      </span>
                    </td>
                    <td>{item.trades_count} lệnh</td>
                    <td>
                      <span
                        className={`admin-badge ${
                          item.is_public ? "active" : "neutral"
                        }`}
                      >
                        {item.is_public ? "Công khai" : "Riêng tư"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="admin-icon-btn primary"
                        disabled={loadingId === item.id}
                        title="Xem danh mục & Lịch sử khớp lệnh"
                        aria-label="Xem chi tiết"
                        onClick={() => handleViewDetail(item)}
                      >
                        <IconView width={15} height={15} />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={9}
                  style={{ textAlign: "center", color: "#64748b", padding: "2.5rem" }}
                >
                  Không tìm thấy danh mục giao dịch ảo nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DETAIL MODAL */}
      {selectedDetail && (
        <AdminDetailModal
          isOpen={Boolean(selectedDetail)}
          onClose={() => setSelectedDetail(null)}
          title={`Chi tiết danh mục: ${selectedDetail.portfolio.user_name} (${selectedDetail.portfolio.user_email})`}
          isLarge
        >
          <div className="admin-detail-grid" style={{ marginBottom: "1.5rem" }}>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mã danh mục</span>
              <span className="admin-detail-val">
                <code>{selectedDetail.portfolio.id}</code>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Chủ tài khoản</span>
              <span className="admin-detail-val">
                {selectedDetail.portfolio.user_name} ({selectedDetail.portfolio.user_email})
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Vốn ban đầu</span>
              <span className="admin-detail-val">
                {selectedDetail.portfolio.starting_cash.toLocaleString("vi-VN")} ₫
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Số dư tiền mặt hiện tại</span>
              <span className="admin-detail-val">
                <strong>{selectedDetail.portfolio.cash_balance.toLocaleString("vi-VN")} ₫</strong>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Lãi / Lỗ đã hiện thực</span>
              <span className="admin-detail-val">
                <strong
                  style={{
                    color:
                      selectedDetail.portfolio.realized_pnl >= 0 ? "#16a34a" : "#dc2626",
                  }}
                >
                  {selectedDetail.portfolio.realized_pnl.toLocaleString("vi-VN")} ₫
                </strong>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Chế độ hiển thị</span>
              <span className="admin-detail-val">
                <span className={`admin-badge ${selectedDetail.portfolio.is_public ? "active" : "neutral"}`}>
                  {selectedDetail.portfolio.is_public ? "Công khai" : "Riêng tư"}
                </span>
              </span>
            </div>
          </div>

          {/* EMBEDDED HOLDINGS TABLE */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
              Cổ phiếu đang nắm giữ ({selectedDetail.holdings.length})
            </h4>
            <div className="admin-table-container">
              <table className="admin-table-unified">
                <thead>
                  <tr>
                    <th>Mã CP</th>
                    <th>Khối lượng</th>
                    <th>Giá vốn trung bình</th>
                    <th>Tổng giá trị vốn</th>
                    <th>Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDetail.holdings.length ? (
                    selectedDetail.holdings.map((h) => (
                      <tr key={h.symbol}>
                        <td>
                          <strong style={{ color: "#2563eb" }}>{h.symbol}</strong>
                        </td>
                        <td>{h.quantity.toLocaleString("vi-VN")}</td>
                        <td>{h.avg_price ? h.avg_price.toLocaleString("vi-VN") + " ₫" : "—"}</td>
                        <td>{h.total_cost_basis.toLocaleString("vi-VN")} ₫</td>
                        <td>{new Date(h.updated_at).toLocaleString("vi-VN")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "#64748b", padding: "1.5rem" }}>
                        Danh mục hiện đang giữ 100% tiền mặt.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* EMBEDDED RECENT TRADES TABLE */}
          <div>
            <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
              Lịch sử 20 lệnh gần nhất
            </h4>
            <div className="admin-table-container">
              <table className="admin-table-unified">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Mã CP</th>
                    <th>Chiều</th>
                    <th>Khối lượng</th>
                    <th>Giá khớp</th>
                    <th>Tổng tiền</th>
                    <th>Lãi/Lỗ</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDetail.recent_trades.length ? (
                    selectedDetail.recent_trades.map((t) => (
                      <tr key={t.id}>
                        <td>{new Date(t.created_at).toLocaleString("vi-VN")}</td>
                        <td>
                          <strong>{t.symbol}</strong>
                        </td>
                        <td>
                          <span className={`admin-badge ${t.side === "buy" ? "active" : "disabled"}`}>
                            {t.side === "buy" ? "MUA" : "BÁN"}
                          </span>
                        </td>
                        <td>{t.quantity.toLocaleString("vi-VN")}</td>
                        <td>{t.execution_price.toLocaleString("vi-VN")} ₫</td>
                        <td>{t.gross_amount.toLocaleString("vi-VN")} ₫</td>
                        <td>
                          {t.realized_pnl !== null ? (
                            <span
                              style={{
                                color: t.realized_pnl >= 0 ? "#16a34a" : "#dc2626",
                                fontWeight: 600,
                              }}
                            >
                              {t.realized_pnl.toLocaleString("vi-VN")} ₫
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "#64748b", padding: "1.5rem" }}>
                        Chưa có lệnh giao dịch nào được ghi nhận.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </AdminDetailModal>
      )}
    </div>
  );
}
