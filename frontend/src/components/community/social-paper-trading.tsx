"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PublicPortfolioDetailData, SocialLeaderboardItem } from "@/types/thesis";

const moneyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function parsePriceNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let str = String(value).replace(/[+₫đVNDvnd\s]/gi, "").trim();
  if (str.includes(",")) {
    str = str.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
    str = str.replace(/\./g, "");
  }
  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatVnd(value: string | number | undefined | null): string {
  const num = parsePriceNumber(value);
  return moneyFormat.format(num);
}

type SocialPaperTradingProps = {
  initialLeaderboard?: SocialLeaderboardItem[];
};

export function SocialPaperTrading({ initialLeaderboard = [] }: SocialPaperTradingProps) {
  const [leaderboard, setLeaderboard] = useState<SocialLeaderboardItem[]>(initialLeaderboard);
  const [loading, setLoading] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<PublicPortfolioDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<"holdings" | "trades">("holdings");
  const isFirstMount = useRef(true);

  const loadLeaderboard = useCallback(async () => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (initialLeaderboard.length > 0) return;
    }
    setLoading(true);
    try {
      const res = await fetch("/portfolio-api/leaderboard", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { data: SocialLeaderboardItem[] };
        setLeaderboard(data.data || []);
      }
    } catch {
      // Keep initial
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  async function openPortfolioDetail(portfolioId: string) {
    setSelectedPortfolioId(portfolioId);
    setLoadingDetail(true);
    setDetailData(null);
    setDetailTab("holdings");
    try {
      const res = await fetch(`/portfolio-api/public/${portfolioId}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as PublicPortfolioDetailData;
        setDetailData(data);
      }
    } catch {
      // handle error
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className="social-trading-container">
      {/* Header Row */}
      <div className="social-trading-header-row">
        <div>
          <h2 className="social-trading-title">Bảng Xếp Hạng Nhà Đầu Tư</h2>
          <p className="social-trading-desc">
            Khám phá chiến lược, tỷ trọng tài sản và nhật ký vào/ra lệnh của những nhà đầu tư có hiệu suất sinh lời cao nhất. Minh bạch và cập nhật theo thời gian thực.
          </p>
        </div>
        <Link href="/portfolio" className="btn-primary">
          Quản lý & Công khai Danh mục
        </Link>
      </div>

      {/* Leaderboard Table */}
      {loading ? (
        <div className="thesis-loading-placeholder">Đang tải bảng xếp hạng nhà đầu tư...</div>
      ) : leaderboard.length === 0 ? (
        <div className="thesis-empty-box">
          <p className="empty-title">Chưa có nhà đầu tư nào công khai danh mục.</p>
          <p className="empty-sub">
            Vào trang <Link href="/portfolio" className="text-cyan underline">Danh mục mô phỏng</Link>, bật tùy chọn &quot;Công khai danh mục&quot; để trở thành người dẫn đầu bảng xếp hạng!
          </p>
        </div>
      ) : (
        <div className="social-table-wrapper">
          <table className="social-leaderboard-table">
            <thead>
              <tr>
                <th className="text-center">Hạng</th>
                <th>Nhà đầu tư</th>
                <th className="text-right">Vốn ban đầu</th>
                <th className="text-right">Lãi đã chốt</th>
                <th className="text-right">Hiệu suất sinh lời</th>
                <th className="text-center">Nắm giữ</th>
                <th className="text-center">Tỷ lệ thắng lệnh</th>
                <th className="text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((item, idx) => {
                const isPositive = parsePriceNumber(item.roi_number) >= 0;
                const winRate =
                  item.total_trades > 0
                    ? Math.round((item.win_trades / item.total_trades) * 100)
                    : 0;

                return (
                  <tr key={item.portfolio_id} className="social-table-row">
                    <td className="text-center">
                      <span className={`rank-badge ${idx === 0 ? "rank-1" : idx === 1 ? "rank-2" : idx === 2 ? "rank-3" : "rank-normal"}`}>
                        #{idx + 1}
                      </span>
                    </td>
                    <td>
                      <div className="investor-name-cell">
                        <span className="investor-avatar">
                          {item.nickname.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <div className="investor-nickname">{item.nickname}</div>
                          <div className="investor-sub">Đầu tư chủ động</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right font-mono text-neutral">
                      {formatVnd(item.starting_cash)}
                    </td>
                    <td className={`text-right font-mono ${parsePriceNumber(item.realized_pnl) >= 0 ? "text-emerald" : "text-rose"}`}>
                      {parsePriceNumber(item.realized_pnl) > 0 ? `+${formatVnd(item.realized_pnl)}` : formatVnd(item.realized_pnl)}
                    </td>
                    <td className="text-right">
                      <span className={`roi-pill ${isPositive ? "roi-positive" : "roi-negative"}`}>
                        {isPositive ? `+${item.roi_percent}%` : `${item.roi_percent}%`}
                      </span>
                    </td>
                    <td className="text-center font-mono">
                      {item.holding_count} mã
                    </td>
                    <td className="text-center">
                      <div className="winrate-cell">
                        <span className="text-emerald font-bold">{winRate}%</span>
                        <span className="text-sub">({item.win_trades}/{item.total_trades})</span>
                      </div>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => openPortfolioDetail(item.portfolio_id)}
                        className="btn-view-portfolio"
                      >
                        Xem danh mục
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal chi tiết danh mục công khai */}
      {selectedPortfolioId && (
        <div className="modal-backdrop">
          <div className="public-portfolio-modal">
            <div className="portfolio-modal-header">
              <div>
                <h3 className="modal-title">
                  Danh mục đầu tư của: <span className="text-cyan">{detailData?.nickname || "Nhà đầu tư"}</span>
                </h3>
                <p className="modal-sub">
                  Chi tiết phân bổ tài sản thực tế và toàn bộ lịch sử lệnh giao dịch khớp trên sàn
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPortfolioId(null)}
                className="modal-close-btn"
              >
                ✕
              </button>
            </div>

            {loadingDetail ? (
              <div className="thesis-loading-placeholder">Đang tải danh mục và nhật ký lệnh...</div>
            ) : detailData ? (
              <div>
                {/* Highlights Stats */}
                <div className="public-stats-grid">
                  <div className="public-stat-box">
                    <span className="lbl">Tổng giá trị tài sản:</span>
                    <strong className="val text-cyan">{formatVnd(detailData.total_assets)}</strong>
                  </div>
                  <div className="public-stat-box">
                    <span className="lbl">Số dư tiền mặt:</span>
                    <strong className="val text-neutral">{formatVnd(detailData.cash_balance)}</strong>
                  </div>
                  <div className="public-stat-box">
                    <span className="lbl">Lãi/Lỗ đã chốt:</span>
                    <strong className={`val ${parsePriceNumber(detailData.realized_pnl) >= 0 ? "text-emerald" : "text-rose"}`}>
                      {parsePriceNumber(detailData.realized_pnl) > 0 ? `+${formatVnd(detailData.realized_pnl)}` : formatVnd(detailData.realized_pnl)}
                    </strong>
                  </div>
                  <div className="public-stat-box">
                    <span className="lbl">Hiệu suất tổng thể:</span>
                    <strong className={`val ${parsePriceNumber(detailData.roi_percent) >= 0 ? "text-emerald" : "text-rose"}`}>
                      {parsePriceNumber(detailData.roi_percent) > 0 ? `+${detailData.roi_percent}%` : `${detailData.roi_percent}%`}
                    </strong>
                  </div>
                </div>

                {/* Sub Tab Switcher */}
                <div className="public-subtabs">
                  <button
                    type="button"
                    className={`subtab-btn ${detailTab === "holdings" ? "subtab-active" : ""}`}
                    onClick={() => setDetailTab("holdings")}
                  >
                    Cổ phiếu đang nắm giữ ({detailData.holdings.length})
                  </button>
                  <button
                    type="button"
                    className={`subtab-btn ${detailTab === "trades" ? "subtab-active" : ""}`}
                    onClick={() => setDetailTab("trades")}
                  >
                    Nhật ký vào/ra lệnh ({detailData.trades.length})
                  </button>
                </div>

                {/* Tab 1: Holdings */}
                {detailTab === "holdings" && (
                  <div className="public-table-wrap">
                    {detailData.holdings.length === 0 ? (
                      <div className="text-center py-6 text-neutral">Tài khoản hiện đang giữ 100% tiền mặt, chưa mở vị thế cổ phiếu.</div>
                    ) : (
                      <table className="public-detail-table">
                        <thead>
                          <tr>
                            <th>Mã CK</th>
                            <th className="text-right">Khối lượng</th>
                            <th className="text-right">Giá vốn</th>
                            <th className="text-right">Giá thị trường</th>
                            <th className="text-right">Giá trị thị trường</th>
                            <th className="text-right">Lãi/Lỗ tạm tính</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailData.holdings.map((h) => {
                            const isPos = parsePriceNumber(h.roi_percent) >= 0;
                            return (
                              <tr key={h.symbol}>
                                <td>
                                  <Link href={`/market/stocks/${h.symbol}`} className="font-bold text-cyan">
                                    {h.symbol}
                                  </Link>
                                  <span className="text-sub block text-xs">{h.name}</span>
                                </td>
                                <td className="text-right font-mono">{h.quantity.toLocaleString("vi-VN")}</td>
                                <td className="text-right font-mono">{formatVnd(h.cost_basis)}</td>
                                <td className="text-right font-mono">{formatVnd(h.current_price)}</td>
                                <td className="text-right font-mono font-bold">{formatVnd(h.market_value)}</td>
                                <td className={`text-right font-mono font-bold ${isPos ? "text-emerald" : "text-rose"}`}>
                                  {isPos ? `+${h.roi_percent}%` : `${h.roi_percent}%`}
                                  <span className="text-sub block text-xs">({isPos ? `+${formatVnd(h.unrealized_pnl)}` : formatVnd(h.unrealized_pnl)})</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Tab 2: Trades */}
                {detailTab === "trades" && (
                  <div className="public-table-wrap">
                    {detailData.trades.length === 0 ? (
                      <div className="text-center py-6 text-neutral">Chưa có lịch sử khớp lệnh nào.</div>
                    ) : (
                      <table className="public-detail-table">
                        <thead>
                          <tr>
                            <th>Thời gian</th>
                            <th>Lệnh</th>
                            <th>Mã CK</th>
                            <th className="text-right">Khối lượng</th>
                            <th className="text-right">Giá khớp</th>
                            <th className="text-right">Giá trị lệnh</th>
                            <th className="text-right">Lãi chốt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailData.trades.map((t) => {
                            const isBuy = t.side.toLowerCase() === "buy";
                            const pnlNum = t.realized_pnl ? parsePriceNumber(t.realized_pnl) : null;

                            return (
                              <tr key={t.id}>
                                <td className="text-xs text-neutral">
                                  {new Date(t.created_at).toLocaleString("vi-VN", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </td>
                                <td>
                                  <span className={`trade-badge ${isBuy ? "trade-buy" : "trade-sell"}`}>
                                    {isBuy ? "MUA" : "BÁN"}
                                  </span>
                                </td>
                                <td className="font-bold text-cyan">{t.symbol}</td>
                                <td className="text-right font-mono">{t.quantity.toLocaleString("vi-VN")}</td>
                                <td className="text-right font-mono">{formatVnd(t.execution_price)}</td>
                                <td className="text-right font-mono">{formatVnd(t.gross_amount)}</td>
                                <td className="text-right font-mono">
                                  {pnlNum !== null ? (
                                    <span className={pnlNum >= 0 ? "text-emerald font-bold" : "text-rose font-bold"}>
                                      {pnlNum > 0 ? `+${formatVnd(t.realized_pnl!)}` : formatVnd(t.realized_pnl!)}
                                    </span>
                                  ) : (
                                    <span className="text-neutral">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="thesis-empty-box">Không thể tải thông tin danh mục này.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
