"use client";

import { useEffect, useState } from "react";
import { StockGoldBankComparator } from "@/components/market/stock-gold-bank-comparator";

type Props = {
  initialSymbol?: string;
  isOpen: boolean;
  onClose: () => void;
};

export function DCASimulatorModal({ initialSymbol = "HPG", isOpen, onClose }: Props) {
  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());

  // Keep symbol in sync with endpoint's selected stock
  useEffect(() => {
    if (initialSymbol) {
      setSymbol(initialSymbol.toUpperCase());
    }
  }, [initialSymbol, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="dca-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="invest-title">
      <div className="dca-modal-backdrop" onClick={onClose} />
      <div className="dca-modal-content" style={{ maxWidth: "920px", width: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
        <header className="dca-modal-header" style={{ marginBottom: "1rem" }}>
          <div>
            <span className="dca-badge">CÔNG CỤ HOẠCH ĐỊNH TÀI CHÍNH</span>
            <h2 id="invest-title" className="dca-heading" style={{ fontSize: "1.35rem" }}>
              So Sánh Đầu Tư: Cổ Phiếu {symbol} vs Vàng Miếng SJC vs Ngân Hàng
            </h2>
            <p className="dca-subheading">
              Chọn năm bắt đầu giải ngân và theo dõi diễn biến thực tế giá trị dòng tiền lũy kế qua các năm tiếp theo tới nay.
            </p>
          </div>
          <button type="button" className="dca-close-btn" onClick={onClose} aria-label="Đóng cửa sổ">
            ✕
          </button>
        </header>

        <StockGoldBankComparator initialSymbol={symbol} />
      </div>
    </div>
  );
}

export function DCASimulatorButton({ symbol }: { symbol: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="dca-trigger-button"
        onClick={() => setIsOpen(true)}
        title="So sánh hiệu suất đầu tư Cổ phiếu vs Vàng vs Ngân hàng"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          background: "#f8fafc",
          border: "1px solid #cbd5e1",
          borderRadius: "6px",
          padding: "0.45rem 0.85rem",
          fontSize: "0.82rem",
          fontWeight: 600,
          color: "#1e293b",
          cursor: "pointer",
        }}
      >
        <span aria-hidden="true">⚖️</span>
        <span>So sánh Cổ phiếu vs Vàng & Tiết kiệm</span>
      </button>

      <DCASimulatorModal
        initialSymbol={symbol}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
