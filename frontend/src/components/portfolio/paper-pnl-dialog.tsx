"use client";

import { useEffect, useRef, useState } from "react";
import type { PaperDashboard } from "@/types/portfolio";
import {
  BIGINT_ZERO,
  percentOf,
  projectedHolding,
  realizedTrade,
  roundVnd,
} from "@/lib/portfolio-math";

const moneyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

function money(value: string | number | bigint) {
  if (typeof value === "bigint") return moneyFormat.format(value);
  if (typeof value === "string") return moneyFormat.format(roundVnd(value));
  return moneyFormat.format(value);
}

function moneyOrUnavailable(value: string | null) {
  return value === null ? "Chưa đủ giá" : money(value);
}

function tone(value: string | number) {
  const numeric = Number(value);
  return numeric > 0 ? "positive" : numeric < 0 ? "negative" : "neutral";
}

export function ProfitLossDialog({
  kind,
  dashboard,
  currentPrices,
  onClose,
}: {
  kind: "unrealized" | "realized";
  dashboard: PaperDashboard;
  currentPrices: ReadonlyMap<string, string | null>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [viewMode, setViewMode] = useState<"scenario" | "daily_timeline">("scenario");
  const [selectedHoldingSymbol, setSelectedHoldingSymbol] = useState<string>(
    () => dashboard.holdings[0]?.symbol ?? ""
  );

  const projections = dashboard.holdings.map((holding) => ({
    holding,
    quantity: holding.available_quantity,
    result: projectedHolding(
      holding,
      holding.available_quantity,
      dashboard.assumptions.broker_fee_rate,
      dashboard.assumptions.sell_tax_rate
    ),
  }));

  const projectedBasis = projections.reduce(
    (total, item) => total + (item.result?.basis ?? BIGINT_ZERO),
    BIGINT_ZERO
  );
  const projectedPnl = projections.reduce(
    (total, item) => total + (item.result?.pnl ?? BIGINT_ZERO),
    BIGINT_ZERO
  );

  const sellTrades = dashboard.trades.filter(
    (trade) => trade.side === "sell" && trade.realized_pnl !== null
  );
  const realizedRows = sellTrades.map((trade) => ({
    trade,
    result: realizedTrade(trade),
  }));

  const visibleGains = realizedRows.reduce(
    (total, item) => total + (item.result.pnl > BIGINT_ZERO ? item.result.pnl : BIGINT_ZERO),
    BIGINT_ZERO
  );
  const visibleLosses = realizedRows.reduce(
    (total, item) => total + (item.result.pnl < BIGINT_ZERO ? item.result.pnl : BIGINT_ZERO),
    BIGINT_ZERO
  );

  const titleId = `paper-${kind}-pnl-title`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    const returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled])")
      );
    focusables()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusables();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      returnFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="paper-order-modal" role="presentation">
      <button
        className="paper-order-backdrop"
        type="button"
        aria-label="Đóng chi tiết lãi lỗ"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        className="paper-pnl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header>
          <div>
            <p className="eyebrow">
              {kind === "unrealized" ? "KỊCH BẢN CHỈ ĐỂ XEM" : "KẾT QUẢ ĐÃ GHI NHẬN"}
            </p>
            <h2 id={titleId}>
              {kind === "unrealized" ? "Lãi/lỗ dự kiến nếu bán" : "Lãi/lỗ thực tế đã chốt"}
            </h2>
            <span>
              {kind === "unrealized"
                ? "Điều chỉnh khối lượng để xem kết quả; popup này không thể đặt lệnh."
                : "Tách rõ từng giao dịch bán tạo ra lãi hoặc lỗ."}
            </span>
          </div>
          <button type="button" aria-label="Đóng chi tiết lãi lỗ" onClick={onClose}>
            ×
          </button>
        </header>

        {kind === "unrealized" ? (
          <div className="paper-pnl-content">
            <div className="paper-pnl-summary" aria-label="Tổng hợp lãi lỗ dự kiến">
              <article>
                <span>Chưa chốt hiện tại</span>
                <strong className={tone(dashboard.account.unrealized_pnl ?? 0)}>
                  {moneyOrUnavailable(dashboard.account.unrealized_pnl)}
                </strong>
                <small>Chưa trừ chi phí bán giả định</small>
              </article>
              <article>
                <span>Nếu bán khối lượng đã chọn</span>
                <strong className={tone(projectedPnl.toString())}>
                  {money(projectedPnl)}
                </strong>
                <small>{percentOf(projectedPnl, projectedBasis)} trên giá vốn được chọn</small>
              </article>
              <article>
                <span>Phí + thuế bán giả định</span>
                <strong>
                  {money(
                    projections.reduce(
                      (total, item) =>
                        total +
                        (item.result?.fee ?? BIGINT_ZERO) +
                        (item.result?.tax ?? BIGINT_ZERO),
                      BIGINT_ZERO
                    )
                  )}
                </strong>
                <small>Theo giả định của tài khoản</small>
              </article>
            </div>

            {/* Chuyển đổi giữa 2 chế độ: Kịch bản bán giả định & Biến động theo ngày */}
            <div className="paper-pnl-tabs flex gap-2 border-b border-slate-800 pb-2.5">
              <button
                type="button"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === "scenario"
                    ? "bg-emerald-500 text-slate-950 font-extrabold shadow-sm"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
                onClick={() => setViewMode("scenario")}
              >
                Kịch bản bán giả định
              </button>
              <button
                type="button"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === "daily_timeline"
                    ? "bg-emerald-500 text-slate-950 font-extrabold shadow-sm"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
                onClick={() => setViewMode("daily_timeline")}
              >
                Biến động theo ngày (Từ ngày mua)
              </button>
            </div>

            {viewMode === "scenario" ? (
              <>
                {dashboard.holdings.length ? (
                  <div className="paper-pnl-table-wrap">
                    <table aria-label="Chi tiết lãi lỗ dự kiến theo cổ phiếu">
                      <thead>
                        <tr>
                          <th className="text-left">Nguồn lãi/lỗ</th>
                          <th className="text-center">Giá mua bình quân</th>
                          <th className="text-center">Giá hiện tại</th>
                          <th className="text-center">Giá bán giả định</th>
                          <th className="text-center">Khối lượng bán</th>
                          <th className="text-center">Phí + thuế</th>
                          <th className="text-center">Lãi/lỗ dự kiến</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projections.map(({ holding, quantity, result }) => (
                          <tr key={holding.symbol}>
                            <td className="text-left">
                              <strong>{holding.symbol}</strong>
                              <span>{holding.name}</span>
                              <small className={result ? tone(result.pnl.toString()) : "neutral"}>
                                {result
                                  ? result.pnl > BIGINT_ZERO
                                    ? "Lãi từ chênh lệch giá"
                                    : result.pnl < BIGINT_ZERO
                                    ? "Lỗ từ chênh lệch giá và chi phí"
                                    : "Hòa vốn sau chi phí"
                                  : "Chưa đủ dữ liệu giá"}
                              </small>
                            </td>
                            <td className="text-center">
                              {money(holding.average_cost)}
                              <small>Đã gồm phí mua</small>
                            </td>
                            <td className="text-center">
                              {holding.current_price ? money(holding.current_price) : "Chưa có"}
                            </td>
                            <td className="text-center">
                              {holding.current_price ? money(holding.current_price) : "Chưa có"}
                              <small>Giá quan sát, không cam kết khớp</small>
                            </td>
                            <td className="text-center font-medium">
                              <strong className="text-white text-base font-extrabold block">
                                {numberFormat.format(holding.available_quantity)} CP
                              </strong>
                              <small className="text-slate-400 text-xs">
                                Toàn bộ {numberFormat.format(holding.available_quantity)} CP khả dụng
                              </small>
                            </td>
                            <td className="text-center">{result ? money(result.fee + result.tax) : "—"}</td>
                            <td className={`text-center ${result ? tone(result.pnl.toString()) : "neutral"}`}>
                              <strong>{result ? money(result.pnl) : "—"}</strong>
                              <small>{result?.percent ?? "—"}</small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="paper-empty compact">
                    <p>Chưa có cổ phiếu để lập kịch bản bán.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                {/* Stock Selector Dropdown */}
                <div className="paper-stock-select-bar flex flex-wrap items-center gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                  <label htmlFor="timeline-stock-select" className="text-sm font-bold text-slate-200 shrink-0">
                    Chọn cổ phiếu theo dõi:
                  </label>
                  <select
                    id="timeline-stock-select"
                    aria-label="Chọn cổ phiếu theo dõi"
                    value={selectedHoldingSymbol || dashboard.holdings[0]?.symbol || ""}
                    onChange={(e) => setSelectedHoldingSymbol(e.target.value)}
                    className="bg-slate-950 border border-slate-700 hover:border-sky-500 focus:border-sky-400 text-white text-sm font-semibold rounded-lg px-3 py-2 outline-none cursor-pointer min-w-[260px] transition shadow-inner"
                  >
                    {dashboard.holdings.map((h) => (
                      <option key={h.symbol} value={h.symbol}>
                        {h.symbol} - {h.name} ({numberFormat.format(h.quantity)} CP)
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const activeHolding = dashboard.holdings.find(
                    (h) => h.symbol === (selectedHoldingSymbol || dashboard.holdings[0]?.symbol)
                  ) ?? dashboard.holdings[0];
                  if (!activeHolding) {
                    return (
                      <div className="paper-empty compact">
                        <p>Chưa có dữ liệu cổ phiếu nắm giữ.</p>
                      </div>
                    );
                  }

                  const buyTrades = dashboard.trades.filter(
                    (t) => t.symbol === activeHolding.symbol && t.side === "buy"
                  );
                  const firstBuyTrade = buyTrades.slice().sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  )[0];

                  const purchaseTime = firstBuyTrade ? new Date(firstBuyTrade.created_at).getTime() : 0;
                  const history = activeHolding.price_history || [];
                  const candles = purchaseTime > 0
                    ? history.filter((c) => new Date(c.timestamp).getTime() >= purchaseTime - 86400000)
                    : history;
                  const displayCandles = candles.length > 0 ? candles : history;

                  const avgCost = Number(activeHolding.average_cost);
                  const qty = activeHolding.quantity;
                  const costBasis = avgCost * qty;

                  return (
                    <div className="space-y-3.5">
                      {/* Summary Card for the Stock */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 text-xs">
                        <div>
                          <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Mã &amp; Khối lượng</span>
                          <strong className="text-white text-base font-extrabold">{activeHolding.symbol}</strong>
                          <small className="text-slate-400 block text-xs mt-0.5">{numberFormat.format(qty)} CP · {activeHolding.name}</small>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Giá vốn bình quân</span>
                          <strong className="text-sky-300 text-base font-extrabold">{money(avgCost)}</strong>
                          <small className="text-slate-400 block text-xs mt-0.5">
                            {firstBuyTrade ? `Mua lúc: ${timeFormat.format(new Date(firstBuyTrade.created_at))}` : "Snapshot ban đầu"}
                          </small>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Giá thị trường</span>
                          <strong className="text-white text-base font-extrabold">{activeHolding.current_price ? money(activeHolding.current_price) : "Chưa có"}</strong>
                          <small className="text-slate-400 block text-xs mt-0.5">Phiên gần nhất</small>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Lãi/lỗ tạm tính</span>
                          <strong className={`text-base font-extrabold ${tone(activeHolding.unrealized_pnl ?? 0)}`}>
                            {moneyOrUnavailable(activeHolding.unrealized_pnl)}
                          </strong>
                          <small className={`block text-xs font-bold mt-0.5 ${tone(activeHolding.unrealized_pnl ?? 0)}`}>
                            {activeHolding.unrealized_pnl_percent ? `${Number(activeHolding.unrealized_pnl_percent) >= 0 ? "+" : ""}${activeHolding.unrealized_pnl_percent}%` : "—"}
                          </small>
                        </div>
                      </div>

                      {/* Daily Timeline Table */}
                      <div className="paper-pnl-table-wrap">
                        <table aria-label={`Lịch sử biến động theo ngày của ${activeHolding.symbol}`}>
                          <thead>
                            <tr>
                              <th className="text-left">Ngày</th>
                              <th className="text-center">Giá đóng cửa</th>
                              <th className="text-center">Biến động phiên</th>
                              <th className="text-center">Giá trị danh mục</th>
                              <th className="text-center">Lãi/lỗ so với giá vốn</th>
                              <th className="text-center">% Sinh lời</th>
                              <th className="text-center">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayCandles.map((candle, idx) => {
                              const close = Number(candle.close);
                              const prevClose = idx > 0 ? Number(displayCandles[idx - 1].close) : close;
                              const dayChange = close - prevClose;
                              const dayChangePct = prevClose > 0 ? ((dayChange / prevClose) * 100).toFixed(2) : "0.00";
                              const dayValue = Math.round(close * qty);
                              const dayPnl = dayValue - costBasis;
                              const dayPnlPct = costBasis > 0 ? ((dayPnl / costBasis) * 100).toFixed(2) : "0.00";

                              const dateStr = new Intl.DateTimeFormat("vi-VN", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                timeZone: "Asia/Ho_Chi_Minh",
                              }).format(new Date(candle.timestamp));

                              const isFirstDay = idx === 0 && purchaseTime > 0;

                              return (
                                <tr key={candle.timestamp}>
                                  <td className="text-left">
                                    <strong className="text-white text-sm">{dateStr}</strong>
                                    {isFirstDay && <small className="text-sky-400 font-bold block text-xs">Phiên mua vào</small>}
                                  </td>
                                  <td className="text-center font-bold text-slate-100 text-sm">{money(close)}</td>
                                  <td className={`text-center font-semibold text-sm ${tone(dayChange)}`}>
                                    {idx === 0 ? "—" : `${dayChange >= 0 ? "+" : ""}${money(dayChange)} (${dayChange >= 0 ? "+" : ""}${dayChangePct}%)`}
                                  </td>
                                  <td className="text-center font-bold text-white text-sm">{money(dayValue)}</td>
                                  <td className={`text-center font-bold text-sm ${tone(dayPnl)}`}>
                                    {dayPnl >= 0 ? "+" : ""}{money(dayPnl)}
                                  </td>
                                  <td className={`text-center font-extrabold text-sm ${tone(dayPnl)}`}>
                                    {dayPnl >= 0 ? "+" : ""}{dayPnlPct}%
                                  </td>
                                  <td className="text-center">
                                    <span
                                      className={`paper-status-badge ${
                                        dayPnl > 0 ? "profit" : dayPnl < 0 ? "loss" : "even"
                                      }`}
                                    >
                                      <span className="paper-status-dot" />
                                      <span>{dayPnl > 0 ? "Đang có lãi" : dayPnl < 0 ? "Tạm ghi nhận lỗ" : "Hòa vốn"}</span>
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <p className="paper-pnl-note">
              <strong>Chỉ đọc, không bán:</strong> toàn bộ dữ liệu đều khóa.
              Kết quả dùng giá quan sát hiện tại, phí {dashboard.assumptions.broker_fee_rate} và
              thuế bán {dashboard.assumptions.sell_tax_rate}; giá thật có thể khác.
            </p>
          </div>
        ) : (
          <div className="paper-pnl-content">
            <div className="paper-pnl-summary" aria-label="Tổng hợp lãi lỗ thực tế">
              <article>
                <span>Đã chốt toàn tài khoản</span>
                <strong className={tone(dashboard.account.realized_pnl)}>
                  {money(dashboard.account.realized_pnl)}
                </strong>
                <small>Sau phí và thuế mô phỏng</small>
              </article>
              <article>
                <span>Các khoản lãi đang hiển thị</span>
                <strong className="positive">{money(visibleGains)}</strong>
                <small>
                  {realizedRows.filter((item) => item.result.pnl > BIGINT_ZERO).length} giao
                  dịch bán có lãi
                </small>
              </article>
              <article>
                <span>Các khoản lỗ đang hiển thị</span>
                <strong className="negative">{money(visibleLosses)}</strong>
                <small>
                  {realizedRows.filter((item) => item.result.pnl < BIGINT_ZERO).length} giao
                  dịch bán bị lỗ
                </small>
              </article>
            </div>

            {realizedRows.length ? (
              <div className="paper-pnl-table-wrap">
                <table aria-label="Chi tiết lãi lỗ thực tế theo giao dịch bán">
                  <thead>
                    <tr>
                      <th>Nguồn lãi/lỗ</th>
                      <th>Khối lượng</th>
                      <th>Giá mua phân bổ</th>
                      <th>Giá bán</th>
                      <th>Giá hiện tại</th>
                      <th>Phí + thuế</th>
                      <th>Lãi/lỗ đã chốt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {realizedRows.map(({ trade, result }) => (
                      <tr key={trade.id}>
                        <td>
                          <strong>{trade.symbol}</strong>
                          <span>{trade.name}</span>
                          <small>
                            {timeFormat.format(new Date(trade.created_at))} ·{" "}
                            {result.pnl > BIGINT_ZERO
                              ? "Lãi từ giao dịch bán"
                              : result.pnl < BIGINT_ZERO
                              ? "Lỗ từ giao dịch bán"
                              : "Giao dịch hòa vốn"}
                          </small>
                        </td>
                        <td>{numberFormat.format(trade.quantity)} CP</td>
                        <td>
                          {money(result.averageCost)}
                          <small>Giá vốn bình quân đã gồm phí mua</small>
                        </td>
                        <td>
                          {money(trade.execution_price)}
                          <small>Giá khớp mô phỏng</small>
                        </td>
                        <td>
                          {currentPrices.get(trade.symbol)
                            ? money(currentPrices.get(trade.symbol) as string)
                            : "Chưa có"}
                          <small>Chỉ để đối chiếu hiện tại</small>
                        </td>
                        <td>
                          {money(roundVnd(trade.fee_amount) + roundVnd(trade.tax_amount))}
                        </td>
                        <td className={tone(result.pnl.toString())}>
                          <strong>{money(result.pnl)}</strong>
                          <small>{result.percent}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="paper-empty compact">
                <strong>Chưa có lãi/lỗ đã chốt</strong>
                <p>Chi tiết sẽ xuất hiện sau giao dịch bán mô phỏng đầu tiên.</p>
              </div>
            )}

            <p className="paper-pnl-note">
              Giá mua phân bổ được suy ra từ giá vốn bình quân đã ghi nhận tại lúc bán. Danh
              sách chi tiết giới hạn trong lịch sử giao dịch gần nhất; tổng toàn tài khoản vẫn
              lấy từ sổ cái danh mục.
            </p>
          </div>
        )}

        <footer>
          <button type="button" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </section>
    </div>
  );
}
