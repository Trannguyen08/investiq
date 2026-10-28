"use client";

import { useState } from "react";
import type {
  AdminPortfolioDetail,
  AdminPortfolioItem,
} from "@/lib/server/admin-ops-api";
import { AdminDetailModal } from "@/components/admin/admin-detail-modal";

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
        <h2 className="admin-card-title">Danh sách tài khoản Paper Trading</h2>
        <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
          Giám sát số dư, danh mục nắm giữ và lịch sử giao dịch mô phỏng
        </span>
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
              <th style={{ textAlign: "right" }}>Thao tác</th>
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
                        {item.holdings_count} cổ phiếu
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
                        className="admin-btn-detail"
                        disabled={loadingId === item.id}
                        onClick={() => handleViewDetail(item)}
                      >
                        {loadingId === item.id ? "Đang tải..." : "Xem chi tiết"}
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
              <span className="admin-detail-label">Người sở hữu</span>
              <span className="admin-detail-val">
                {selectedDetail.portfolio.user_name} ({selectedDetail.portfolio.user_email})
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Vốn khởi tạo</span>
              <span className="admin-detail-val">
                {selectedDetail.portfolio.starting_cash.toLocaleString("vi-VN")} ₫
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Tiền mặt khả dụng</span>
              <span className="admin-detail-val">
                <strong>{selectedDetail.portfolio.cash_balance.toLocaleString("vi-VN")} ₫</strong>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Lãi/Lỗ đã chốt</span>
              <span className="admin-detail-val">
                <strong
                  style={{
                    color:
                      selectedDetail.portfolio.realized_pnl >= 0 ? "#16a34a" : "#dc2626",
                  }}
                >
                  {selectedDetail.portfolio.realized_pnl > 0
                    ? `+${selectedDetail.portfolio.realized_pnl.toLocaleString("vi-VN")} ₫`
                    : `${selectedDetail.portfolio.realized_pnl.toLocaleString("vi-VN")} ₫`}
                </strong>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Trạng thái chia sẻ Leaderboard</span>
              <span className="admin-detail-val">
                <span className={`admin-badge ${selectedDetail.portfolio.is_public ? "active" : "neutral"}`}>
                  {selectedDetail.portfolio.is_public
                    ? `Công khai (Nickname: ${selectedDetail.portfolio.nickname ?? "Chưa đặt"})`
                    : "Chỉ riêng tư"}
                </span>
              </span>
            </div>
          </div>

          {/* HOLDINGS TABLE */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.5rem", color: "#0f172a" }}>
              Cổ phiếu đang nắm giữ ({selectedDetail.holdings.length})
            </h3>
            {selectedDetail.holdings.length ? (
              <div className="admin-table-container" style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}>
                <table className="admin-table-unified">
                  <thead>
                    <tr>
                      <th>Mã CP</th>
                      <th>Số lượng</th>
                      <th>Giá vốn TB</th>
                      <th>Tổng giá vốn</th>
                      <th>Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDetail.holdings.map((h) => (
                      <tr key={h.symbol}>
                        <td><strong style={{ color: "#2563eb" }}>{h.symbol}</strong></td>
                        <td>{h.quantity.toLocaleString("vi-VN")} CP</td>
                        <td>{Math.round(h.avg_price).toLocaleString("vi-VN")} ₫</td>
                        <td>{h.total_cost_basis.toLocaleString("vi-VN")} ₫</td>
                        <td>{new Date(h.updated_at).toLocaleDateString("vi-VN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.82rem", margin: 0 }}>
                Tài khoản hiện đang giữ 100% tiền mặt, chưa mua cổ phiếu nào.
              </p>
            )}
          </div>

          {/* RECENT TRADES */}
          <div>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.5rem", color: "#0f172a" }}>
              Lịch sử khớp lệnh gần đây ({selectedDetail.recent_trades.length})
            </h3>
            {selectedDetail.recent_trades.length ? (
              <div className="admin-table-container" style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}>
                <table className="admin-table-unified">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Mã CP</th>
                      <th>Chiều</th>
                      <th>Khối lượng</th>
                      <th>Giá khớp</th>
                      <th>Giá trị</th>
                      <th>Phí + Thuế</th>
                      <th>Lãi/Lỗ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDetail.recent_trades.map((t) => (
                      <tr key={t.id}>
                        <td>{new Date(t.created_at).toLocaleString("vi-VN")}</td>
                        <td><strong>{t.symbol}</strong></td>
                        <td>
                          <span className={`admin-badge ${t.side === "buy" ? "bullish" : "bearish"}`}>
                            {t.side === "buy" ? "MUA" : "BÁN"}
                          </span>
                        </td>
                        <td>{t.quantity.toLocaleString("vi-VN")}</td>
                        <td>{t.execution_price.toLocaleString("vi-VN")} ₫</td>
                        <td>{t.gross_amount.toLocaleString("vi-VN")} ₫</td>
                        <td>{(t.fee_amount + t.tax_amount).toLocaleString("vi-VN")} ₫</td>
                        <td>
                          {t.realized_pnl !== null ? (
                            <strong style={{ color: t.realized_pnl >= 0 ? "#16a34a" : "#dc2626" }}>
                              {t.realized_pnl > 0 ? `+${t.realized_pnl.toLocaleString("vi-VN")} ₫` : `${t.realized_pnl.toLocaleString("vi-VN")} ₫`}
                            </strong>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.82rem", margin: 0 }}>
                Chưa có lệnh giao dịch nào được thực hiện.
              </p>
            )}
          </div>
        </AdminDetailModal>
      )}
    </div>
  );
}

