"use client";

import { useState } from "react";
import type { AdminMarketInstrumentItem } from "@/lib/server/admin-ops-api";
import { AdminDetailModal } from "@/components/admin/admin-detail-modal";
import { IconView, IconLock, IconUnlock } from "@/components/admin/admin-icons";
import { changeInstrumentStatusAction } from "@/app/(admin)/admin/actions";

const vndFormat = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

export function MarketInstrumentsTable({
  instruments,
}: {
  instruments: AdminMarketInstrumentItem[];
}) {
  const [selectedItem, setSelectedItem] = useState<AdminMarketInstrumentItem | null>(null);

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div>
          <h2 className="admin-card-title">Vũ trụ Cổ phiếu Niêm yết</h2>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Biên độ giá phiên, chỉ số định giá P/E, P/B và điều phối quyền giao dịch Paper Trading
          </span>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table-unified">
          <thead>
            <tr>
              <th>Mã CP</th>
              <th>Doanh nghiệp</th>
              <th>Sàn</th>
              <th>Ngành</th>
              <th style={{ textAlign: "right" }}>Thị giá</th>
              <th style={{ textAlign: "right" }}>Tham chiếu</th>
              <th style={{ textAlign: "right" }}>Trần / Sàn</th>
              <th style={{ textAlign: "right" }}>Vốn hóa</th>
              <th style={{ textAlign: "right" }}>Khối lượng</th>
              <th style={{ textAlign: "center" }}>Trạng thái</th>
              <th style={{ textAlign: "center" }}>Paper Trading</th>
              <th style={{ textAlign: "right", width: "100px" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {instruments.length ? (
              instruments.map((item) => {
                const change = item.price - item.reference_price;
                const changePct =
                  item.reference_price > 0
                    ? ((change / item.reference_price) * 100).toFixed(2)
                    : "0.00";
                const isUp = change > 0;
                const isDown = change < 0;

                const statusBadge =
                  item.trading_status === "normal" ? (
                    <span className="admin-badge active">Bình thường</span>
                  ) : item.trading_status === "warning" ? (
                    <span className="admin-badge pending">Cảnh báo</span>
                  ) : (
                    <span className="admin-badge disabled">Tạm ngừng</span>
                  );

                return (
                  <tr key={item.symbol}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <strong style={{ color: "#1e40af", fontSize: "0.95rem" }}>
                          {item.symbol}
                        </strong>
                        {item.is_vn30 && (
                          <span
                            style={{
                              fontSize: "0.68rem",
                              padding: "0.1rem 0.35rem",
                              borderRadius: "4px",
                              backgroundColor: "#eff6ff",
                              color: "#2563eb",
                              fontWeight: 700,
                              border: "1px solid #bfdbfe",
                            }}
                          >
                            VN30
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ maxWidth: "220px" }}>
                        <span
                          style={{
                            fontSize: "0.84rem",
                            color: "#334155",
                            display: "block",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={item.name}
                        >
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="admin-badge" style={{ backgroundColor: "#f1f5f9" }}>
                        {item.exchange}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                        {item.sector ?? "—"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <strong
                        style={{
                          color: isUp ? "#16a34a" : isDown ? "#dc2626" : "#d97706",
                        }}
                      >
                        {vndFormat.format(item.price)} ₫
                      </strong>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: isUp ? "#16a34a" : isDown ? "#dc2626" : "#64748b",
                        }}
                      >
                        {isUp ? "+" : ""}
                        {changePct}%
                      </div>
                    </td>
                    <td style={{ textAlign: "right", color: "#64748b", fontSize: "0.85rem" }}>
                      {vndFormat.format(item.reference_price)} ₫
                    </td>
                    <td style={{ textAlign: "right", fontSize: "0.78rem" }}>
                      <div style={{ color: "#9333ea" }}>{vndFormat.format(item.ceiling_price)}</div>
                      <div style={{ color: "#0284c7" }}>{vndFormat.format(item.floor_price)}</div>
                    </td>
                    <td style={{ textAlign: "right", fontSize: "0.82rem", color: "#475569" }}>
                      {item.market_cap
                        ? `${(item.market_cap / 1_000_000_000_000).toFixed(1)} Tỷ`
                        : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontSize: "0.82rem", color: "#475569" }}>
                      {vndFormat.format(item.volume)}
                    </td>
                    <td style={{ textAlign: "center" }}>{statusBadge}</td>
                    <td style={{ textAlign: "center" }}>
                      {item.paper_trading_enabled ? (
                        <span className="admin-badge active" style={{ fontSize: "0.74rem" }}>
                          Cho phép
                        </span>
                      ) : (
                        <span className="admin-badge disabled" style={{ fontSize: "0.74rem" }}>
                          Đã khóa
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          justifyContent: "flex-end",
                        }}
                      >
                        {/* VIEW DETAIL */}
                        <button
                          type="button"
                          className="admin-icon-btn view"
                          title="Xem chi tiết cổ phiếu"
                          aria-label={`Xem chi tiết ${item.symbol}`}
                          onClick={() => setSelectedItem(item)}
                        >
                          <IconView width={15} height={15} />
                        </button>

                        {/* TOGGLE PAPER TRADING */}
                        <form action={changeInstrumentStatusAction} style={{ display: "inline" }}>
                          <input type="hidden" name="symbol" value={item.symbol} />
                          <input
                            type="hidden"
                            name="paper_trading_enabled"
                            value={item.paper_trading_enabled ? "false" : "true"}
                          />
                          <button
                            type="submit"
                            className={`admin-icon-btn ${item.paper_trading_enabled ? "lock" : "unlock"}`}
                            title={
                              item.paper_trading_enabled
                                ? "Khóa giao dịch trong Paper Trading"
                                : "Mở khóa giao dịch trong Paper Trading"
                            }
                            aria-label={
                              item.paper_trading_enabled
                                ? `Khóa ${item.symbol}`
                                : `Mở khóa ${item.symbol}`
                            }
                          >
                            {item.paper_trading_enabled ? (
                              <IconLock width={14} height={14} />
                            ) : (
                              <IconUnlock width={14} height={14} />
                            )}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={12} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#94a3b8" }}>
                  Không tìm thấy mã cổ phiếu nào phù hợp với điều kiện lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DETAIL MODAL */}
      {selectedItem && (
        <AdminDetailModal
          title={`Hồ sơ Cổ phiếu: ${selectedItem.symbol} — ${selectedItem.name}`}
          isOpen={true}
          onClose={() => setSelectedItem(null)}
        >
          <div className="admin-detail-grid">
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mã chứng khoán</span>
              <span className="admin-detail-val">
                <strong style={{ color: "#2563eb" }}>{selectedItem.symbol}</strong>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Tên doanh nghiệp</span>
              <span className="admin-detail-val">{selectedItem.name}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Sàn giao dịch</span>
              <span className="admin-detail-val">{selectedItem.exchange}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Nhóm ngành</span>
              <span className="admin-detail-val">{selectedItem.sector ?? "Chưa phân loại"}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Thuộc rổ VN30</span>
              <span className="admin-detail-val">{selectedItem.is_vn30 ? "Có (VN30)" : "Không"}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Thị giá hiện tại</span>
              <span className="admin-detail-val">
                <strong>{vndFormat.format(selectedItem.price)} ₫</strong>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Giá tham chiếu</span>
              <span className="admin-detail-val">{vndFormat.format(selectedItem.reference_price)} ₫</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Biên độ phiên (Trần / Sàn)</span>
              <span className="admin-detail-val">
                {vndFormat.format(selectedItem.ceiling_price)} ₫ / {vndFormat.format(selectedItem.floor_price)} ₫
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Khối lượng giao dịch</span>
              <span className="admin-detail-val">{vndFormat.format(selectedItem.volume)} CP</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Giá trị khớp lệnh</span>
              <span className="admin-detail-val">{vndFormat.format(selectedItem.matched_value)} ₫</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Định giá P/E</span>
              <span className="admin-detail-val">{selectedItem.pe !== null ? `${selectedItem.pe.toFixed(2)}x` : "—"}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Định giá P/B</span>
              <span className="admin-detail-val">{selectedItem.pb !== null ? `${selectedItem.pb.toFixed(2)}x` : "—"}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Vốn hóa thị trường</span>
              <span className="admin-detail-val">
                {selectedItem.market_cap ? `${vndFormat.format(selectedItem.market_cap)} ₫` : "—"}
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Trạng thái thị trường</span>
              <span className="admin-detail-val">
                {selectedItem.trading_status === "normal"
                  ? "Giao dịch bình thường"
                  : selectedItem.trading_status === "warning"
                  ? "Cảnh báo / Kiểm soát"
                  : "Tạm ngừng giao dịch"}
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Paper Trading</span>
              <span className="admin-detail-val">
                {selectedItem.paper_trading_enabled ? "Đang cho phép đặt lệnh" : "Bị tạm dừng"}
              </span>
            </div>
          </div>
        </AdminDetailModal>
      )}
    </div>
  );
}
