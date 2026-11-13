"use client";

import Link from "next/link";
import React, { useEffect } from "react";
import type { DividendItem } from "@/types/market";
import { STOCK_DIRECTORY } from "@/lib/ticker-matcher";
import { resolveDirectArticleUrl } from "@/lib/market-article-links";

export interface DividendDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: DividendItem | null;
  onOpenReminder?: (event: DividendItem) => void;
}

export function DividendDetailModal({
  isOpen,
  onClose,
  event,
  onOpenReminder,
}: DividendDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !event) return null;

  const stockInfo = STOCK_DIRECTORY.find((s) => s.symbol === event.symbol);
  const companyName = stockInfo?.name || `Công ty Cổ phần ${event.symbol}`;
  const exchange = stockInfo?.exchange || "HOSE";
  const sector = stockInfo?.sector || "Thị trường chứng khoán";

  const isCash = event.type === "cash";
  const isStock = event.type === "stock";
  const isBonus = event.type === "bonus";

  const dateStr = event.ex_date || event.event_date;
  let daysLeft = 0;
  if (dateStr) {
    const eventTime = new Date(`${dateStr}T00:00:00`).getTime();
    const nowTime = new Date().setHours(0, 0, 0, 0);
    daysLeft = Math.round((eventTime - nowTime) / (1000 * 3600 * 24));
  }

  const cafefSourceUrl = resolveDirectArticleUrl(event.symbol, event.source_url);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dividend-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-lg shadow-md shrink-0">
              {event.symbol}
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="dividend-modal-title" className="text-lg sm:text-xl font-extrabold text-white tracking-tight m-0">
                  {event.symbol} — {companyName}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <span className="font-semibold text-slate-300">Sàn {exchange}</span>
                <span>•</span>
                <span>{sector}</span>
                <span>•</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  isCash
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                    : "bg-purple-950 text-purple-400 border border-purple-800/60"
                }`}>
                  {isCash ? "Cổ tức tiền mặt" : isBonus ? "Thưởng cổ phiếu" : "Cổ tức cổ phiếu"}
                </span>
                {daysLeft > 0 ? (
                  <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60">
                    Còn {daysLeft} ngày
                  </span>
                ) : daysLeft === 0 ? (
                  <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-sky-950 text-sky-300 border border-sky-800/60">
                    Hôm nay
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-800 text-slate-400">
                    Đã qua
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ chi tiết"
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/80 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-sm">
          {/* Main Payout Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-inner">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Giá trị chi trả cổ tức
            </span>
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                  {isCash && event.cash_value
                    ? `${new Intl.NumberFormat("vi-VN").format(event.cash_value)} ₫ / CP`
                    : event.ratio || "Theo nghị quyết ĐHCĐ"}
                </span>
                {event.ratio && isCash && (
                  <span className="text-sm font-semibold text-slate-300">
                    (Tỷ lệ {event.ratio})
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400">
                {isCash ? "Chi trả trực tiếp vào tài khoản" : "Cổ phiếu phát hành thêm"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2.5 mb-0 leading-relaxed border-t border-slate-800/80 pt-2.5">
              {isCash && event.cash_value
                ? `Ví dụ: Cổ đông nắm giữ 1.000 cổ phiếu ${event.symbol} sẽ nhận được ${new Intl.NumberFormat("vi-VN").format(event.cash_value * 1000)} ₫ tiền mặt vào tài khoản chứng khoán.`
                : isStock && event.ratio
                ? `Ví dụ: Với tỷ lệ ${event.ratio}, cổ đông sở hữu 1.000 cổ phiếu cũ sẽ được nhận thêm số cổ phiếu tương ứng theo tỷ lệ chốt quyền.`
                : "Quyền lợi chi trả cổ tức theo nghị quyết ĐHCĐ / HĐQT đã được phê duyệt."}
            </p>
          </div>

          {/* Full Resolution Title & Note */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Nội dung thông báo & Nghị quyết chi trả
            </h4>
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-slate-200 text-xs sm:text-sm leading-relaxed">
              <p className="font-semibold text-white mb-2">{event.title}</p>
              <div className="text-xs text-slate-400 space-y-1">
                <p>• <strong>Điều kiện hưởng quyền</strong>: Nhà đầu tư phải sở hữu cổ phiếu <strong>trước ngày GDKHQ</strong> (chậm nhất vào phiên T-1). Mua vào đúng ngày GDKHQ hoặc sau đó sẽ không được hưởng quyền nhận cổ tức.</p>
                <p>• <strong>Hạch toán tự động</strong>: Trung tâm Lưu ký Chứng khoán Việt Nam (VSDC) và công ty chứng khoán sẽ tự động chuyển tiền/cổ phiếu vào tài khoản của bạn vào ngày thanh toán.</p>
              </div>
            </div>
          </div>

          {/* Key Milestone Dates Timeline */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Các mốc thời gian chốt quyền & thanh toán
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Milestone 1: GDKHQ */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-sky-800/40 relative overflow-hidden">
                <span className="text-[10px] font-black uppercase text-sky-400 tracking-wider block mb-1">
                  Mốc 1 • Ngày GDKHQ
                </span>
                <span className="text-lg font-black text-white block">
                  {event.ex_date || event.event_date || "Chưa công bố"}
                </span>
                <p className="text-[11px] text-slate-400 mt-1 mb-0 leading-tight">
                  Ngày giao dịch không hưởng quyền. Giá cổ phiếu điều chỉnh kỹ thuật tại phiên này.
                </p>
              </div>

              {/* Milestone 2: ĐKCC */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 relative overflow-hidden">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  Mốc 2 • Ngày ĐKCC
                </span>
                <span className="text-lg font-black text-white block">
                  {event.record_date || (event.ex_date ? "Sau GDKHQ 1 ngày" : "Chưa công bố")}
                </span>
                <p className="text-[11px] text-slate-400 mt-1 mb-0 leading-tight">
                  Ngày đăng ký cuối cùng. VSDC chốt danh sách cổ đông chính thức được hưởng quyền.
                </p>
              </div>

              {/* Milestone 3: Payout */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-800/40 relative overflow-hidden">
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block mb-1">
                  Mốc 3 • Ngày Thực hiện
                </span>
                <span className="text-lg font-black text-emerald-300 block">
                  {event.payout_date || "Theo thông báo HĐQT"}
                </span>
                <p className="text-[11px] text-slate-400 mt-1 mb-0 leading-tight">
                  {isCash ? "Tiền tự động cộng vào tài khoản" : "Cổ phiếu mới về tài khoản chứng khoán"}
                </p>
              </div>
            </div>
          </div>

          {/* Official Source & Corporate Resolutions Link */}
          <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block">
                Nguồn gốc thông tin & Văn bản pháp lý
              </span>
              <p className="text-xs text-slate-300 mt-0.5 mb-0">
                Nguồn: <strong className="text-white">{event.source || "Công bố thông tin chính thức"}</strong>. CafeF lưu trữ đầy đủ bảng sự kiện, thông báo và file PDF nghị quyết ĐHCĐ/HĐQT gốc của {event.symbol}.
              </p>
            </div>
            <a
              href={cafefSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shrink-0 transition shadow-md"
            >
              <span>Xem nghị quyết trên CafeF</span>
              <span>↗</span>
            </a>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onOpenReminder && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenReminder(event);
                }}
                className="px-4 py-2 rounded-xl bg-sky-950 border border-sky-700/80 hover:border-sky-500 hover:bg-sky-900/60 text-sky-300 hover:text-white font-semibold text-xs transition shadow-sm"
              >
                Đặt nhắc nhở Email
              </button>
            )}
            <Link
              href={`/market/stocks/${encodeURIComponent(event.symbol)}`}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-500 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-xs transition shadow-sm"
            >
              Phân tích {event.symbol}
            </Link>
            <Link
              href={`/portfolio?action=trade&symbol=${encodeURIComponent(event.symbol)}&side=buy&qty=100`}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-700/80 hover:border-emerald-500 hover:bg-emerald-900/60 text-emerald-300 hover:text-white font-semibold text-xs transition shadow-sm"
            >
              Giao dịch mô phỏng
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
