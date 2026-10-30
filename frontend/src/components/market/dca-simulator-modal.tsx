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
    <div
      className="dca-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invest-title"
    >
      <div className="dca-modal-backdrop absolute inset-0 cursor-pointer" onClick={onClose} />
      <div
        className="dca-modal-content relative z-10 w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl text-slate-100 flex flex-col gap-4"
      >
        <header className="dca-modal-header flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="dca-badge inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              CÔNG CỤ HOẠCH ĐỊNH TÀI CHÍNH
            </span>
            <h2 id="invest-title" className="dca-heading text-lg sm:text-xl font-bold text-slate-100 mt-2">
              So Sánh Đầu Tư: Cổ Phiếu {symbol} vs Vàng Miếng SJC vs Ngân Hàng
            </h2>
            <p className="dca-subheading text-xs sm:text-sm text-slate-400 mt-1">
              Chọn năm bắt đầu giải ngân và theo dõi diễn biến thực tế giá trị dòng tiền lũy kế qua các năm tiếp theo tới nay.
            </p>
          </div>
          <button
            type="button"
            className="dca-close-btn w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition text-lg shrink-0 cursor-pointer"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
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
        className="dca-trigger-button inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold text-slate-200 bg-slate-900/90 border border-slate-700/80 hover:border-sky-500 hover:text-white hover:bg-slate-800 transition shadow-sm cursor-pointer"
        onClick={() => setIsOpen(true)}
        title="So sánh hiệu suất đầu tư Cổ phiếu vs Vàng vs Ngân hàng"
      >
        <span aria-hidden="true" className="text-amber-400">⚖️</span>
        <span>So sánh Cổ phiếu vs Vàng &amp; Tiết kiệm</span>
      </button>

      <DCASimulatorModal
        initialSymbol={symbol}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
