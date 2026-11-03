"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  changeTone,
  formatChange,
  formatCompact,
  formatMoney,
  formatPercent,
  formatRatioPair,
  priceTone,
} from "@/components/market/formatters";
import { PaperOrderDialog, requestPaperDashboard } from "@/components/portfolio/paper-order-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useVisibleFundamentals } from "@/hooks/use-visible-fundamentals";
import { roundVnd } from "@/lib/portfolio-math";
import type { MarketInstrument } from "@/types/market";
import type {
  PaperDashboard,
  PaperPricePoint,
  PositivePaperNews,
} from "@/types/portfolio";
import { ProfitLossDialog } from "./paper-pnl-dialog";
import { PaperDailyReportSection } from "./paper-daily-report-card";
import { PaperSocialVisibilitySection } from "./paper-social-card";
import { TradingDisciplineCard } from "./trading-discipline-card";

const moneyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });
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

function Sparkline({ points, label }: { points: PaperPricePoint[]; label: string }) {
  if (points.length < 2) return <span className="paper-no-chart">Chưa đủ lịch sử giá</span>;
  const values = points.map((item) => Number(item.close));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const line = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 120;
      const y = 38 - ((value - min) / range) * 32;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="paper-sparkline" viewBox="0 0 120 44" role="img" aria-label={label}>
      <polyline points={line} fill="none" />
    </svg>
  );
}

function EquityChart({ dashboard }: { dashboard: PaperDashboard }) {
  const points = dashboard.equity_curve;
  if (points.length < 2) {
    return (
      <div className="paper-chart-empty">
        <strong>Biểu đồ sẽ xuất hiện sau khi bạn mua cổ phiếu</strong>
        <span>Dữ liệu cần ít nhất hai phiên giá quan sát.</span>
      </div>
    );
  }
  const values = points.map((item) => Number(item.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const line = values
    .map((value, index) => {
      const x = 10 + (index / (values.length - 1)) * 580;
      const y = 170 - ((value - min) / range) * 140;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="paper-equity-chart">
      <svg viewBox="0 0 600 190" role="img" aria-label="Biểu đồ giá trị danh mục mô phỏng">
        <line x1="10" y1="170" x2="590" y2="170" />
        <line x1="10" y1="100" x2="590" y2="100" />
        <line x1="10" y1="30" x2="590" y2="30" />
        <polyline points={line} fill="none" />
      </svg>
      <div>
        <span>{money(min)}</span>
        <span>{money(max)}</span>
      </div>
      <p>
        Ước tính bằng cách phát lại danh mục hiện tại trên giá đóng cửa có sẵn; không phải NAV lịch sử đã kiểm toán.
      </p>
    </div>
  );
}

const MARKET_PAGE_SIZE = 15;

export function PaperTradingDashboard({
  positiveNews,
  marketInstruments,
  marketLoadError = false,
}: {
  positiveNews: PositivePaperNews[];
  marketInstruments: MarketInstrument[];
  marketLoadError?: boolean;
}) {
  const router = useRouter();
  const auth = useAuth();
  const [dashboard, setDashboard] = useState<PaperDashboard | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [selectedInstrument, setSelectedInstrument] = useState<{
    symbol: string;
    name: string;
    price: string | null;
  } | null>(null);
  const [marketQuery, setMarketQuery] = useState("");
  const [marketPage, setMarketPage] = useState(1);
  const [orderSide, setOrderSide] = useState("all");
  const [orderSymbol, setOrderSymbol] = useState("");
  const [pnlDialog, setPnlDialog] = useState<"unrealized" | "realized" | null>(null);

  const currentPrices = useMemo(
    () => new Map(marketInstruments.map((item) => [item.symbol, item.price])),
    [marketInstruments]
  );

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    requestPaperDashboard()
      .then((value) => {
        if (!cancelled) {
          setDashboard(value);
          setError("");
        }
      })
      .catch((value: unknown) => {
        if (!cancelled) setError(value instanceof Error ? value.message : "Không thể tải danh mục.");
      });
    return () => {
      cancelled = true;
    };
  }, [auth.status]);

  const holdingBySymbol = useMemo(
    () => new Map((dashboard?.holdings ?? []).map((holding) => [holding.symbol, holding])),
    [dashboard]
  );
  const normalizedMarketQuery = marketQuery.trim().toLocaleUpperCase("vi-VN");
  const filteredMarket = useMemo(
    () =>
      marketInstruments.filter(
        (item) =>
          !normalizedMarketQuery ||
          item.symbol.includes(normalizedMarketQuery) ||
          item.name.toLocaleUpperCase("vi-VN").includes(normalizedMarketQuery)
      ),
    [marketInstruments, normalizedMarketQuery]
  );
  const marketPageCount = Math.max(1, Math.ceil(filteredMarket.length / MARKET_PAGE_SIZE));
  const visibleMarket = useMemo(
    () =>
      filteredMarket.slice(
        (marketPage - 1) * MARKET_PAGE_SIZE,
        marketPage * MARKET_PAGE_SIZE
      ),
    [filteredMarket, marketPage]
  );
  const fundamentalsBySymbol = useVisibleFundamentals(
    visibleMarket
      .filter((item) => item.pe === null || item.pb === null)
      .map((item) => item.symbol)
  );

  const filteredOrders = useMemo(
    () =>
      (dashboard?.orders ?? []).filter(
        (order) =>
          (orderSide === "all" || order.side === orderSide) &&
          (!orderSymbol.trim() || order.symbol.includes(orderSymbol.trim().toUpperCase()))
      ),
    [dashboard, orderSide, orderSymbol]
  );

  const isUnauthenticated =
    auth.status === "anonymous" ||
    (auth.status !== "loading" && !auth.user) ||
    error.includes("chưa đăng nhập");

  if (auth.status === "loading" && !error) {
    return (
      <main id="main-content" className="paper-page">
        <div className="paper-state">Đang mở tài khoản mô phỏng…</div>
      </main>
    );
  }

  if (isUnauthenticated) {
    return (
      <main id="main-content" className="paper-page paper-unauth-page">
        <section className="paper-unauth-hero">
          <span className="paper-unauth-kicker">GIAO DỊCH MÔ PHỎNG THỰC TẾ</span>
          <h1 className="paper-unauth-title">Trải nghiệm Đầu tư Thực chiến với 1 Tỷ đồng Vốn Giả lập</h1>
          <p className="paper-unauth-subtitle">
            Hệ thống quản lý danh mục và khớp lệnh theo giá quan sát thời gian thực sàn HOSE & HNX. Rèn luyện tư duy kỷ luật, kiểm chứng chiến lược quản trị vốn và tích lũy kinh nghiệm mà không chịu bất kỳ rủi ro tài chính nào.
          </p>
          <div className="paper-unauth-actions">
            <Link href="/login" className="btn-unauth-primary">
              Đăng nhập để bắt đầu
            </Link>
            <Link href="/register" className="btn-unauth-secondary">
              Tạo tài khoản miễn phí
            </Link>
            <Link href="/community" className="link-unauth-community">
              Khám phá Bảng Xếp Hạng Cộng Đồng →
            </Link>
          </div>
        </section>

        <section className="paper-unauth-features" aria-label="Tính năng nổi bật của danh mục mô phỏng">
          <article className="unauth-feature-card">
            <div className="feature-card-header">
              <span className="feature-card-num">01</span>
              <h3>1.000.000.000 đ Vốn Sẵn Sàng</h3>
            </div>
            <p>Khởi đầu với 1 tỷ đồng tiền mặt mô phỏng. Trải nghiệm cảm giác phân bổ tài sản, giải ngân từng phần và quản lý rủi ro như một nhà đầu tư chuyên nghiệp.</p>
          </article>
          <article className="unauth-feature-card">
            <div className="feature-card-header">
              <span className="feature-card-num">02</span>
              <h3>Giá Thị Trường Sống Động</h3>
            </div>
            <p>Khớp lệnh mua/bán theo dữ liệu giá và bước giá thời gian thực từ sàn HOSE, HNX và UPCoM. Tính toán chính xác thuế, phí giao dịch giả lập.</p>
          </article>
          <article className="unauth-feature-card">
            <div className="feature-card-header">
              <span className="feature-card-num">03</span>
              <h3>Cộng Đồng & Bảng Xếp Hạng</h3>
            </div>
            <p>Tùy chọn công khai danh mục để so tài hiệu suất sinh lời cùng cộng đồng nhà đầu tư InvestIQ. Học hỏi chiến lược từ các danh mục dẫn đầu.</p>
          </article>
        </section>

        {marketInstruments.length > 0 && (
          <section className="paper-unauth-market-preview">
            <div className="preview-header">
              <div>
                <p className="eyebrow">DỮ LIỆU THỊ TRƯỜNG TRỰC TIẾP</p>
                <h2>Cổ phiếu sẵn sàng giao dịch</h2>
              </div>
              <span className="preview-badge">Sàn HOSE & HNX</span>
            </div>
            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Mã CP</th>
                    <th>Tên doanh nghiệp</th>
                    <th className="text-right">Giá quan sát</th>
                    <th className="text-right">Biến động</th>
                    <th className="text-right">P/E</th>
                    <th className="text-right">P/B</th>
                    <th className="text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {marketInstruments.slice(0, 8).map((inst) => {
                    const priceNum = Number(inst.price);
                    const changePct = Number(inst.change_percent);
                    const isUp = changePct > 0;
                    const isDown = changePct < 0;

                    return (
                      <tr key={inst.symbol}>
                        <td className="font-bold text-cyan">{inst.symbol}</td>
                        <td className="text-neutral">{inst.name}</td>
                        <td className="text-right font-mono font-bold">
                          {priceNum ? `${priceNum.toLocaleString("vi-VN")} đ` : "—"}
                        </td>
                        <td className={`text-right font-mono font-bold ${isUp ? "text-emerald" : isDown ? "text-rose" : "text-neutral"}`}>
                          {changePct ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"}
                        </td>
                        <td className="text-right font-mono text-neutral">{inst.pe ?? "—"}</td>
                        <td className="text-right font-mono text-neutral">{inst.pb ?? "—"}</td>
                        <td className="text-center">
                          <Link href="/login" className="btn-table-trade">
                            Đặt lệnh
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    );
  }

  if (!dashboard) {
    return (
      <main id="main-content" className="paper-page">
        <div className="paper-state" role={error ? "alert" : "status"}>
          {error || "Đang tải danh mục mô phỏng…"}
        </div>
      </main>
    );
  }

  function prepareOrder(selectedSide: "buy" | "sell", selectedSymbol: string) {
    if (!dashboard) return;
    const holding = dashboard.holdings.find((item) => item.symbol === selectedSymbol);
    const marketInstrument = marketInstruments.find((item) => item.symbol === selectedSymbol);
    const opportunity = dashboard.opportunities.find((item) => item.symbol === selectedSymbol);
    setNotice("");
    setSide(selectedSide);
    setSelectedInstrument({
      symbol: selectedSymbol,
      name: marketInstrument?.name ?? holding?.name ?? opportunity?.name ?? selectedSymbol,
      price: marketInstrument?.price ?? holding?.current_price ?? opportunity?.price ?? null,
    });
  }

  function changeMarketPage(nextPage: number) {
    setMarketPage(Math.max(1, Math.min(marketPageCount, nextPage)));
    globalThis.requestAnimationFrame?.(() => {
      document.getElementById("paper-market-table")?.scrollIntoView?.({ block: "start" });
    });
  }

  return (
    <main id="main-content" className="paper-page">
      <section className="paper-hero">
        <div>
          <p className="eyebrow">PHÒNG THỰC HÀNH ĐẦU TƯ</p>
          <h1>Danh mục mô phỏng của bạn</h1>
          <p>Dùng tiền giả định, giá thị trường quan sát và lịch sử giao dịch riêng tư để luyện tập trước khi đầu tư thật.</p>
        </div>
        <div className="paper-market-stamp">
          <span>{dashboard.market.provider_name}</span>
          <strong>{dashboard.market.delay_class}</strong>
          <time dateTime={dashboard.market.market_time}>
            {timeFormat.format(new Date(dashboard.market.market_time))}
          </time>
        </div>
      </section>

      <section className="paper-summary-grid" aria-label="Tổng quan tài khoản mô phỏng">
        <article className="primary">
          <span>Tổng tài sản mô phỏng</span>
          <strong>{moneyOrUnavailable(dashboard.account.total_value)}</strong>
          <em className={tone(dashboard.account.total_pnl ?? 0)}>
            {dashboard.account.total_pnl === null
              ? "Thiếu giá cho một mã"
              : `${money(dashboard.account.total_pnl)} · ${dashboard.account.total_return_percent}%`}
          </em>
        </article>
        <article>
          <span>Tiền khả dụng</span>
          <strong>{money(dashboard.account.available_cash)}</strong>
          <small>
            {Number(dashboard.account.reserved_cash) > 0
              ? `Đang giữ ${money(dashboard.account.reserved_cash)}`
              : "Có thể dùng để mua"}
          </small>
        </article>
        <article>
          <span>Giá vốn đang đầu tư</span>
          <strong>{money(dashboard.account.invested_cost)}</strong>
          <small>{dashboard.holdings.length} / {dashboard.assumptions.max_holdings} mã</small>
        </article>
        <article className="paper-summary-interactive">
          <button type="button" aria-haspopup="dialog" onClick={() => setPnlDialog("unrealized")}>
            <span>Lãi/lỗ chưa chốt</span>
            <strong className={tone(dashboard.account.unrealized_pnl ?? 0)}>
              {moneyOrUnavailable(dashboard.account.unrealized_pnl)}
            </strong>
            <small>Thay đổi theo giá quan sát</small>
            <em>Xem dự kiến theo khối lượng →</em>
          </button>
        </article>
        <article className="paper-summary-interactive">
          <button type="button" aria-haspopup="dialog" onClick={() => setPnlDialog("realized")}>
            <span>Lãi/lỗ đã chốt</span>
            <strong className={tone(dashboard.account.realized_pnl)}>
              {money(dashboard.account.realized_pnl)}
            </strong>
            <small>Sau phí và thuế mô phỏng</small>
            <em>Xem khoản lãi và khoản lỗ →</em>
          </button>
        </article>
      </section>

      <TradingDisciplineCard dashboard={dashboard} />

      {error && <p className="paper-inline-message error" role="alert">{error}</p>}
      {notice && <p className="paper-trade-toast" role="status">{notice}</p>}

      <section className="paper-card paper-chart-card">
        <header>
          <div>
            <p className="eyebrow">HIỆU SUẤT ƯỚC TÍNH</p>
            <h2>Biến động giá trị danh mục</h2>
          </div>
          <span>Tối đa 90 phiên</span>
        </header>
        <EquityChart dashboard={dashboard} />
      </section>

      <section id="paper-market-table" className="paper-section paper-market-section" aria-labelledby="paper-market-title">
        <div className="paper-section-heading">
          <div>
            <p className="eyebrow">BẢNG GIÁ NÂNG CAO</p>
            <h2 id="paper-market-title">Chọn cổ phiếu để giao dịch mô phỏng</h2>
          </div>
          <span>{filteredMarket.length} mã</span>
        </div>
        <div className="paper-market-toolbar">
          <label htmlFor="paper-market-search">Tìm mã hoặc công ty</label>
          <input
            id="paper-market-search"
            value={marketQuery}
            onChange={(event) => {
              setMarketQuery(event.target.value);
              setMarketPage(1);
            }}
            placeholder="Ví dụ: FPT, Hòa Phát"
          />
          <p>Giá quan sát có thể trễ. Lệnh chỉ được gửi sau khi bạn xác nhận số lượng.</p>
        </div>
        {marketLoadError ? (
          <div className="paper-empty compact" role="alert">
            <strong>Không thể tải bảng giá</strong>
            <p>Nguồn dữ liệu thị trường đang gián đoạn. Không có dữ liệu giả được thay thế.</p>
            <button type="button" onClick={() => router.refresh()}>Thử tải lại</button>
          </div>
        ) : visibleMarket.length ? (
          <>
            <div className="market-table-wrap simple-stock-table-wrap paper-market-table-wrap">
              <table aria-label="Bảng cổ phiếu nâng cao để giao dịch mô phỏng" className="market-table simple-stock-table advanced paper-market-table">
                <thead>
                  <tr>
                    <th>Mã &amp; công ty</th>
                    <th>Giá</th>
                    <th>% hôm nay</th>
                    <th>Mở · Cao · Thấp</th>
                    <th>Khối lượng</th>
                    <th>GTGD</th>
                    <th>Khối ngoại</th>
                    <th>Vốn hóa</th>
                    <th>P/E / P/B</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMarket.map((item) => {
                    const holding = holdingBySymbol.get(item.symbol);
                    const fundamentals = fundamentalsBySymbol[item.symbol];
                    const ratiosLoading = (item.pe === null || item.pb === null) && fundamentals === undefined;
                    return (
                      <tr className={item.is_vn30 ? "vn30-row" : undefined} key={item.symbol}>
                        <td className="stock-identity">
                          <div>
                            <Link href={`/market/stocks/${item.symbol}?from=${encodeURIComponent("/portfolio#paper-market-table")}`} prefetch={false}>
                              {item.symbol}
                            </Link>
                            {item.is_vn30 && <span className="vn30-badge">VN30</span>}
                          </div>
                          <span>{item.name}</span>
                          <small>{item.exchange} · {item.sector}</small>
                        </td>
                        <td data-label="Giá">
                          <strong className={priceTone(item.price, item.reference_price, item.ceiling_price, item.floor_price)}>
                            {formatChange(item.price)}
                          </strong>
                          <small className="price-reference">TC {formatChange(item.reference_price)}</small>
                        </td>
                        <td data-label="% hôm nay" className={changeTone(item.change_percent)}>
                          <strong>{formatPercent(item.change_percent)}</strong>
                          <small>{formatChange(item.change)}</small>
                        </td>
                        <td data-label="Mở · Cao · Thấp">
                          <span className={priceTone(item.open_price, item.reference_price, item.ceiling_price, item.floor_price)}>
                            {formatChange(item.open_price)}
                          </span> ·{" "}
                          <span className={priceTone(item.high_price, item.reference_price, item.ceiling_price, item.floor_price)}>
                            {formatChange(item.high_price)}
                          </span> ·{" "}
                          <span className={priceTone(item.low_price, item.reference_price, item.ceiling_price, item.floor_price)}>
                            {formatChange(item.low_price)}
                          </span>
                        </td>
                        <td data-label="Khối lượng">{formatCompact(item.volume)}</td>
                        <td data-label="GTGD">{formatMoney(item.matched_value)}</td>
                        <td data-label="Khối ngoại" className={changeTone(item.foreign_net_value)}>
                          {formatMoney(item.foreign_net_value)}
                        </td>
                        <td data-label="Vốn hóa">{formatMoney(item.market_cap)}</td>
                        <td data-label="P/E / P/B" className="fundamental-ratios">
                          {formatRatioPair(fundamentals?.pe ?? item.pe, fundamentals?.pb ?? item.pb, ratiosLoading)}
                        </td>
                        <td data-label="Thao tác">
                          <div className="paper-stock-actions">
                            <button type="button" onClick={() => prepareOrder("buy", item.symbol)} aria-label={`Mua ${item.symbol}`}>
                              Mua
                            </button>
                            {holding && holding.available_quantity > 0 && (
                              <button
                                type="button"
                                className="sell"
                                onClick={() => prepareOrder("sell", item.symbol)}
                                aria-label={`Bán ${item.symbol}`}
                                title={`Khả dụng ${holding.available_quantity} cổ phiếu`}
                              >
                                Bán
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {marketPageCount > 1 && (
              <nav className="paper-market-pagination" aria-label="Phân trang bảng cổ phiếu">
                <button type="button" disabled={marketPage === 1} onClick={() => changeMarketPage(marketPage - 1)}>
                  ← Trang trước
                </button>
                <strong>Trang {marketPage} / {marketPageCount}</strong>
                <button type="button" disabled={marketPage === marketPageCount} onClick={() => changeMarketPage(marketPage + 1)}>
                  Trang sau →
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="paper-empty compact">
            <strong>Chưa có dữ liệu cổ phiếu</strong>
            <p>Nguồn hiện tại trả về danh sách rỗng hoặc không có mã phù hợp với từ khóa.</p>
          </div>
        )}
      </section>

      <section className="paper-section">
        <div className="paper-section-heading">
          <div>
            <p className="eyebrow">ĐANG SỞ HỮU</p>
            <h2>Quản lý cổ phiếu đã mua</h2>
          </div>
          <span>{dashboard.holdings.length} mã</span>
        </div>
        {dashboard.holdings.length ? (
          <div className="paper-holdings-wrap">
            <table aria-label="Bảng quản lý cổ phiếu đã mua">
              <thead>
                <tr>
                  <th>Mã &amp; công ty</th>
                  <th>Sở hữu / khả dụng</th>
                  <th>Giá vốn TB</th>
                  <th>Giá hiện tại</th>
                  <th>Giá trị</th>
                  <th>Hôm nay</th>
                  <th>Lãi/lỗ chưa chốt</th>
                  <th>Tỷ trọng</th>
                  <th>Xu hướng</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.holdings.map((holding) => (
                  <tr key={holding.symbol}>
                    <td>
                      <Link href={`/market/stocks/${holding.symbol}?from=${encodeURIComponent("/portfolio#paper-market-table")}`} prefetch={false}>
                        {holding.symbol}
                      </Link>
                      <span>{holding.name}</span>
                      <small>{holding.exchange} · {holding.sector ?? "Chưa phân loại"}</small>
                    </td>
                    <td data-label="Sở hữu / khả dụng">
                      {numberFormat.format(holding.quantity)} / {numberFormat.format(holding.available_quantity)} CP
                    </td>
                    <td data-label="Giá vốn TB">{money(holding.average_cost)}</td>
                    <td data-label="Giá hiện tại">{holding.current_price ? money(holding.current_price) : "Chưa có"}</td>
                    <td data-label="Giá trị">{moneyOrUnavailable(holding.market_value)}</td>
                    <td data-label="Hôm nay" className={tone(holding.daily_change_percent ?? 0)}>
                      {holding.daily_change_percent === null ? "—" : `${Number(holding.daily_change_percent) > 0 ? "+" : ""}${holding.daily_change_percent}%`}
                    </td>
                    <td data-label="Lãi/lỗ" className={tone(holding.unrealized_pnl ?? 0)}>
                      {holding.unrealized_pnl === null ? "Chưa đủ giá" : `${money(holding.unrealized_pnl)} · ${holding.unrealized_pnl_percent}%`}
                    </td>
                    <td data-label="Tỷ trọng">
                      {holding.portfolio_weight_percent === null ? "Chưa đủ giá" : `${holding.portfolio_weight_percent}%`}
                    </td>
                    <td data-label="Xu hướng">
                      <Sparkline points={holding.price_history} label={`Lịch sử giá ${holding.symbol}`} />
                    </td>
                    <td data-label="Thao tác">
                      <div className="paper-stock-actions">
                        <button type="button" onClick={() => prepareOrder("buy", holding.symbol)} aria-label={`Mua thêm ${holding.symbol}`}>
                          Mua thêm
                        </button>
                        <button
                          type="button"
                          className="sell"
                          disabled={holding.available_quantity === 0}
                          onClick={() => prepareOrder("sell", holding.symbol)}
                          aria-label={`Bán ${holding.symbol}`}
                        >
                          Bán
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="paper-empty">
            <strong>Chưa có cổ phiếu nào</strong>
            <p>Chọn “Mua” ở bảng giá phía trên. Chỉ lệnh đã khớp mới được tính vào danh mục.</p>
          </div>
        )}
      </section>

      <section className="paper-section" aria-labelledby="paper-orders-title">
        <div className="paper-section-heading">
          <div>
            <p className="eyebrow">SỔ LỆNH</p>
            <h2 id="paper-orders-title">Theo dõi và quản lý lệnh</h2>
          </div>
          <span>{filteredOrders.length} / {dashboard.orders.length} lệnh</span>
        </div>
        <p className="paper-order-execution-note">
          <strong>Tự động khớp trong môi trường học tập:</strong> InvestIQ ghi nhận toàn bộ số lượng theo giá quan sát mới nhất khi bạn xác nhận. Trên hệ thống giao dịch thật, lệnh có thể chờ, khớp một phần hoặc không khớp tùy giá, thanh khoản và trạng thái phiên.
        </p>
        <div className="paper-order-filters">
          <label>
            Chiều lệnh
            <select value={orderSide} onChange={(event) => setOrderSide(event.target.value)}>
              <option value="all">Mua và bán</option>
              <option value="buy">Mua</option>
              <option value="sell">Bán</option>
            </select>
          </label>
          <label>
            Mã cổ phiếu
            <input value={orderSymbol} onChange={(event) => setOrderSymbol(event.target.value)} placeholder="Ví dụ: FPT" />
          </label>
        </div>
        {filteredOrders.length ? (
          <div className="paper-trades-wrap">
            <table aria-label="Danh sách lệnh mô phỏng">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Chiều</th>
                  <th>Mã</th>
                  <th>Kết quả</th>
                  <th>Giá mô phỏng</th>
                  <th>Số lượng</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{timeFormat.format(new Date(order.created_at))}</td>
                    <td><span className={`paper-side ${order.side}`}>{order.side === "buy" ? "Mua" : "Bán"}</span></td>
                    <td><strong>{order.symbol}</strong></td>
                    <td>
                      <span className={`paper-order-status ${order.status}`}>
                        {order.status === "filled"
                          ? "Đã tự động khớp"
                          : order.status === "cancelled"
                          ? "Đã hủy trước đây"
                          : order.status === "expired"
                          ? "Đã hết hạn trước đây"
                          : order.status === "rejected"
                          ? "Bị từ chối"
                          : "Đang đồng bộ"}
                      </span>
                    </td>
                    <td>{money(order.limit_price)}</td>
                    <td>{numberFormat.format(order.filled_quantity || order.quantity)} CP</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="paper-empty compact"><p>Chưa có lệnh mua/bán phù hợp.</p></div>
        )}
      </section>

      {/* AI Daily Email Report Section */}
      <PaperDailyReportSection defaultEmail={auth.user?.email} />

      {/* Social Community Sharing Section */}
      <PaperSocialVisibilitySection
        dashboard={dashboard}
        initialPublic={dashboard.account.is_public ?? false}
        initialNickname={dashboard.account.nickname ?? ""}
        onAccountUpdate={(isPub, nick) => {
          setDashboard({
            ...dashboard,
            account: {
              ...dashboard.account,
              is_public: isPub,
              nickname: nick,
            },
          });
        }}
      />

      <section className="paper-section">
        <div className="paper-section-heading">
          <div>
            <p className="eyebrow">NHẬT KÝ BẤT BIẾN</p>
            <h2>Lịch sử mua bán</h2>
          </div>
          <span>Tối đa 100 lệnh gần nhất</span>
        </div>
        {dashboard.trades.length ? (
          <div className="paper-trades-wrap">
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Lệnh</th>
                  <th>Mã</th>
                  <th>Số lượng</th>
                  <th>Giá khớp</th>
                  <th>Phí + thuế</th>
                  <th>Tiền vào/ra</th>
                  <th>Lãi/lỗ chốt</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.trades.map((trade) => (
                  <tr key={trade.id}>
                    <td>{timeFormat.format(new Date(trade.created_at))}</td>
                    <td><span className={`paper-side ${trade.side}`}>{trade.side === "buy" ? "Mua" : "Bán"}</span></td>
                    <td><strong>{trade.symbol}</strong></td>
                    <td>{numberFormat.format(trade.quantity)}</td>
                    <td>{money(trade.execution_price)}</td>
                    <td>{money(roundVnd(trade.fee_amount) + roundVnd(trade.tax_amount))}</td>
                    <td className={tone(trade.cash_effect)}>{money(trade.cash_effect)}</td>
                    <td className={tone(trade.realized_pnl ?? 0)}>
                      {trade.realized_pnl === null ? "—" : money(trade.realized_pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="paper-empty compact"><p>Chưa có giao dịch mô phỏng.</p></div>
        )}
      </section>

      <footer className="paper-disclaimer">
        <strong>Đây là môi trường học tập.</strong>
        <span>
          {dashboard.assumptions.disclaimer} Giá có thể trễ; mô phỏng chưa bao gồm khớp lệnh từng phần, T+2, cổ tức hoặc chia tách.
        </span>
      </footer>

      {pnlDialog && (
        <ProfitLossDialog
          kind={pnlDialog}
          dashboard={dashboard}
          currentPrices={currentPrices}
          onClose={() => setPnlDialog(null)}
        />
      )}

      <PaperOrderDialog
        open={selectedInstrument !== null}
        side={side}
        instrument={selectedInstrument}
        dashboard={dashboard}
        onClose={() => setSelectedInstrument(null)}
        onDashboard={(value) => {
          setDashboard(value);
          setError("");
        }}
        onSuccess={setNotice}
      />
    </main>
  );
}
