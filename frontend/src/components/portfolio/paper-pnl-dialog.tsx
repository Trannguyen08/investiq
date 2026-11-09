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
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      dashboard.holdings.map((holding) => [holding.symbol, holding.available_quantity])
    )
  );

  const projections = dashboard.holdings.map((holding) => ({
    holding,
    quantity: quantities[holding.symbol] ?? 0,
    result: projectedHolding(
      holding,
      quantities[holding.symbol] ?? 0,
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
        dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])")
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

            {dashboard.holdings.length ? (
              <div className="paper-pnl-table-wrap">
                <table aria-label="Chi tiết lãi lỗ dự kiến theo cổ phiếu">
                  <thead>
                    <tr>
                      <th>Nguồn lãi/lỗ</th>
                      <th>Giá mua bình quân</th>
                      <th>Giá hiện tại</th>
                      <th>Giá bán giả định</th>
                      <th>Khối lượng bán</th>
                      <th>Phí + thuế</th>
                      <th>Lãi/lỗ dự kiến</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projections.map(({ holding, quantity, result }) => (
                      <tr key={holding.symbol}>
                        <td>
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
                        <td>
                          {money(holding.average_cost)}
                          <small>Đã gồm phí mua</small>
                        </td>
                        <td>
                          {holding.current_price ? money(holding.current_price) : "Chưa có"}
                        </td>
                        <td>
                          {holding.current_price ? money(holding.current_price) : "Chưa có"}
                          <small>Giá quan sát, không cam kết khớp</small>
                        </td>
                        <td>
                          <label className="paper-pnl-quantity">
                            <span className="sr-only">
                              Khối lượng bán giả định {holding.symbol}
                            </span>
                            <input
                              aria-label={`Khối lượng bán giả định ${holding.symbol}`}
                              type="number"
                              min="0"
                              max={holding.available_quantity}
                              step="1"
                              value={quantity}
                              onKeyDown={(event) => {
                                if (
                                  ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End", "Enter"].includes(event.key) ||
                                  event.ctrlKey ||
                                  event.metaKey
                                ) {
                                  return;
                                }
                                if (!/[\d]/.test(event.key)) {
                                  event.preventDefault();
                                }
                              }}
                              onChange={(event) => {
                                const clean = event.target.value.replace(/[^\d]/g, "");
                                const next = Number(clean);
                                setQuantities((current) => ({
                                  ...current,
                                  [holding.symbol]: Number.isInteger(next)
                                    ? Math.max(0, Math.min(holding.available_quantity, next))
                                    : 0,
                                }));
                              }}
                            />
                          </label>
                          <small>
                            Tối đa {numberFormat.format(holding.available_quantity)} CP khả dụng
                          </small>
                        </td>
                        <td>{result ? money(result.fee + result.tax) : "—"}</td>
                        <td className={result ? tone(result.pnl.toString()) : "neutral"}>
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

            <p className="paper-pnl-note">
              <strong>Chỉ đọc, không bán:</strong> ngoài ô khối lượng, mọi dữ liệu đều khóa.
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
