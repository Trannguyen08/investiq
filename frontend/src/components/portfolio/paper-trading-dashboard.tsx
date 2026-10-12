"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { changeTone, formatChange, formatCompact, formatMoney, formatPercent } from "@/components/market/formatters";
import { PaperOrderDialog, requestPaperDashboard } from "@/components/portfolio/paper-order-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useVisibleFundamentals } from "@/hooks/use-visible-fundamentals";
import type { MarketInstrument } from "@/types/market";
import type {
  PaperDashboard,
  PaperPricePoint,
  PositivePaperNews,
} from "@/types/portfolio";

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

function money(value: string | number) {
  return moneyFormat.format(Number(value));
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
  const line = values.map((value, index) => {
    const x = index / (values.length - 1) * 120;
    const y = 38 - (value - min) / range * 32;
    return `${x},${y}`;
  }).join(" ");
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
  const line = values.map((value, index) => {
    const x = 10 + index / (values.length - 1) * 580;
    const y = 170 - (value - min) / range * 140;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="paper-equity-chart">
      <svg viewBox="0 0 600 190" role="img" aria-label="Biểu đồ giá trị danh mục mô phỏng">
        <line x1="10" y1="170" x2="590" y2="170" />
        <line x1="10" y1="100" x2="590" y2="100" />
        <line x1="10" y1="30" x2="590" y2="30" />
        <polyline points={line} fill="none" />
      </svg>
      <div><span>{money(min)}</span><span>{money(max)}</span></div>
      <p>Ước tính bằng cách phát lại danh mục hiện tại trên giá đóng cửa có sẵn; không phải NAV lịch sử đã kiểm toán.</p>
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
  const [selectedInstrument, setSelectedInstrument] = useState<{ symbol: string; name: string; price: string | null } | null>(null);
  const [marketQuery, setMarketQuery] = useState("");
  const [marketPage, setMarketPage] = useState(1);
  const [orderSide, setOrderSide] = useState("all");
  const [orderSymbol, setOrderSymbol] = useState("");

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    requestPaperDashboard().then((value) => {
      if (!cancelled) { setDashboard(value); setError(""); }
    }).catch((value: unknown) => {
      if (!cancelled) setError(value instanceof Error ? value.message : "Không thể tải danh mục.");
    });
    return () => { cancelled = true; };
  }, [auth.status]);

  const holdingBySymbol = useMemo(
    () => new Map((dashboard?.holdings ?? []).map((holding) => [holding.symbol, holding])),
    [dashboard],
  );
  const normalizedMarketQuery = marketQuery.trim().toLocaleUpperCase("vi-VN");
  const filteredMarket = useMemo(() => marketInstruments.filter((item) => (
    !normalizedMarketQuery
    || item.symbol.includes(normalizedMarketQuery)
    || item.name.toLocaleUpperCase("vi-VN").includes(normalizedMarketQuery)
  )), [marketInstruments, normalizedMarketQuery]);
  const marketPageCount = Math.max(1, Math.ceil(filteredMarket.length / MARKET_PAGE_SIZE));
  const visibleMarket = useMemo(
    () => filteredMarket.slice((marketPage - 1) * MARKET_PAGE_SIZE, marketPage * MARKET_PAGE_SIZE),
    [filteredMarket, marketPage],
  );
  const fundamentalsBySymbol = useVisibleFundamentals(
    visibleMarket.filter((item) => item.pe === null && item.pb === null).map((item) => item.symbol),
    marketInstruments.filter((item) => item.pe === null && item.pb === null).map((item) => item.symbol),
  );

  const filteredOrders = useMemo(() => (dashboard?.orders ?? []).filter((order) => (
    (orderSide === "all" || order.side === orderSide)
    && (!orderSymbol.trim() || order.symbol.includes(orderSymbol.trim().toUpperCase()))
  )), [dashboard, orderSide, orderSymbol]);

  if (auth.status === "loading") {
    return <main id="main-content" className="paper-page"><div className="paper-state">Đang mở tài khoản mô phỏng…</div></main>;
  }
  if (auth.status !== "authenticated") {
    return (
      <main id="main-content" className="paper-page">
        <section className="paper-auth-gate">
          <span aria-hidden="true">₫</span>
          <p className="eyebrow">TÀI KHOẢN RIÊNG TƯ</p>
          <h1>Thử đầu tư với 100 triệu đồng mô phỏng</h1>
          <p>Mua bán theo giá quan sát, theo dõi lời/lỗ và học cách quản trị rủi ro mà không dùng tiền thật.</p>
          <Link href="/login">Đăng nhập để bắt đầu</Link>
        </section>
      </main>
    );
  }
  if (!dashboard) {
    return <main id="main-content" className="paper-page"><div className="paper-state" role={error ? "alert" : "status"}>{error || "Đang tải danh mục mô phỏng…"}</div></main>;
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
      document.getElementById("paper-market-table")?.scrollIntoView({ block: "start" });
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
          <time dateTime={dashboard.market.market_time}>{timeFormat.format(new Date(dashboard.market.market_time))}</time>
        </div>
      </section>

      <section className="paper-summary-grid" aria-label="Tổng quan tài khoản mô phỏng">
        <article className="primary"><span>Tổng tài sản mô phỏng</span><strong>{moneyOrUnavailable(dashboard.account.total_value)}</strong><em className={tone(dashboard.account.total_pnl ?? 0)}>{dashboard.account.total_pnl === null ? "Thiếu giá cho một mã" : `${money(dashboard.account.total_pnl)} · ${dashboard.account.total_return_percent}%`}</em></article>
        <article><span>Tiền khả dụng</span><strong>{money(dashboard.account.available_cash)}</strong><small>{Number(dashboard.account.reserved_cash) > 0 ? `Đang giữ ${money(dashboard.account.reserved_cash)}` : "Có thể dùng để mua"}</small></article>
        <article><span>Giá vốn đang đầu tư</span><strong>{money(dashboard.account.invested_cost)}</strong><small>{dashboard.holdings.length} / {dashboard.assumptions.max_holdings} mã</small></article>
        <article><span>Lãi/lỗ chưa chốt</span><strong className={tone(dashboard.account.unrealized_pnl ?? 0)}>{moneyOrUnavailable(dashboard.account.unrealized_pnl)}</strong><small>Thay đổi theo giá quan sát</small></article>
        <article><span>Lãi/lỗ đã chốt</span><strong className={tone(dashboard.account.realized_pnl)}>{money(dashboard.account.realized_pnl)}</strong><small>Sau phí và thuế mô phỏng</small></article>
      </section>

      {error && <p className="paper-inline-message error" role="alert">{error}</p>}
      {notice && <p className="paper-trade-toast" role="status">{notice}</p>}

      <section className="paper-card paper-chart-card">
        <header><div><p className="eyebrow">HIỆU SUẤT ƯỚC TÍNH</p><h2>Biến động giá trị danh mục</h2></div><span>Tối đa 90 phiên</span></header>
        <EquityChart dashboard={dashboard} />
      </section>

      <section id="paper-market-table" className="paper-section paper-market-section" aria-labelledby="paper-market-title">
        <div className="paper-section-heading">
          <div><p className="eyebrow">BẢNG GIÁ NÂNG CAO</p><h2 id="paper-market-title">Chọn cổ phiếu để giao dịch mô phỏng</h2></div>
          <span>{filteredMarket.length} mã</span>
        </div>
        <div className="paper-market-toolbar">
          <label htmlFor="paper-market-search">Tìm mã hoặc công ty</label>
          <input
            id="paper-market-search"
            value={marketQuery}
            onChange={(event) => { setMarketQuery(event.target.value); setMarketPage(1); }}
            placeholder="Ví dụ: FPT, Hòa Phát"
          />
          <p>Giá quan sát có thể trễ. Lệnh chỉ được gửi sau khi bạn xác nhận số lượng.</p>
        </div>
        {marketLoadError ? (
          <div className="paper-empty compact" role="alert"><strong>Không thể tải bảng giá</strong><p>Nguồn dữ liệu thị trường đang gián đoạn. Không có dữ liệu giả được thay thế.</p><button type="button" onClick={() => router.refresh()}>Thử tải lại</button></div>
        ) : visibleMarket.length ? (
          <>
            <div className="market-table-wrap simple-stock-table-wrap paper-market-table-wrap">
              <table aria-label="Bảng cổ phiếu nâng cao để giao dịch mô phỏng" className="market-table simple-stock-table advanced paper-market-table">
                <thead><tr><th>Mã &amp; công ty</th><th>Giá</th><th>% hôm nay</th><th>Mở · Cao · Thấp</th><th>Khối lượng</th><th>GTGD</th><th>Khối ngoại</th><th>Vốn hóa</th><th>P/E · P/B</th><th>Thao tác</th></tr></thead>
                <tbody>{visibleMarket.map((item) => {
                  const holding = holdingBySymbol.get(item.symbol);
                  return <tr className={item.is_vn30 ? "vn30-row" : undefined} key={item.symbol}>
                    <td className="stock-identity"><div><Link href={`/market/stocks/${item.symbol}?from=${encodeURIComponent("/portfolio#paper-market-table")}`} prefetch={false}>{item.symbol}</Link>{item.is_vn30 && <span className="vn30-badge">VN30</span>}</div><span>{item.name}</span><small>{item.exchange} · {item.sector}</small></td>
                    <td data-label="Giá"><strong>{formatChange(item.price)}</strong><small>TC {formatChange(item.reference_price)}</small></td>
                    <td data-label="% hôm nay" className={changeTone(item.change_percent)}><strong>{formatPercent(item.change_percent)}</strong><small>{formatChange(item.change)}</small></td>
                    <td data-label="Mở · Cao · Thấp">{formatChange(item.open_price)} · {formatChange(item.high_price)} · {formatChange(item.low_price)}</td>
                    <td data-label="Khối lượng">{formatCompact(item.volume)}</td>
                    <td data-label="GTGD">{formatMoney(item.matched_value)}</td>
                    <td data-label="Khối ngoại" className={changeTone(item.foreign_net_value)}>{formatMoney(item.foreign_net_value)}</td>
                    <td data-label="Vốn hóa">{formatMoney(item.market_cap)}</td>
                    <td data-label="P/E · P/B">{fundamentalsBySymbol[item.symbol]?.pe ?? item.pe ?? "—"} · {fundamentalsBySymbol[item.symbol]?.pb ?? item.pb ?? "—"}</td>
                    <td data-label="Thao tác"><div className="paper-stock-actions"><button type="button" onClick={() => prepareOrder("buy", item.symbol)} aria-label={`Mua ${item.symbol}`}>Mua</button>{holding && holding.available_quantity > 0 && <button type="button" className="sell" onClick={() => prepareOrder("sell", item.symbol)} aria-label={`Bán ${item.symbol}`} title={`Khả dụng ${holding.available_quantity} cổ phiếu`}>Bán</button>}</div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
            {marketPageCount > 1 && <nav className="paper-market-pagination" aria-label="Phân trang bảng cổ phiếu"><button type="button" disabled={marketPage === 1} onClick={() => changeMarketPage(marketPage - 1)}>← Trang trước</button><strong>Trang {marketPage} / {marketPageCount}</strong><button type="button" disabled={marketPage === marketPageCount} onClick={() => changeMarketPage(marketPage + 1)}>Trang sau →</button></nav>}
          </>
        ) : <div className="paper-empty compact"><strong>Chưa có dữ liệu cổ phiếu</strong><p>Nguồn hiện tại trả về danh sách rỗng hoặc không có mã phù hợp với từ khóa.</p></div>}
      </section>

      <section className="paper-section">
        <div className="paper-section-heading"><div><p className="eyebrow">ĐANG SỞ HỮU</p><h2>Quản lý cổ phiếu đã mua</h2></div><span>{dashboard.holdings.length} mã</span></div>
        {dashboard.holdings.length ? <div className="paper-holdings-wrap"><table aria-label="Bảng quản lý cổ phiếu đã mua"><thead><tr><th>Mã &amp; công ty</th><th>Sở hữu / khả dụng</th><th>Giá vốn TB</th><th>Giá hiện tại</th><th>Giá trị</th><th>Hôm nay</th><th>Lãi/lỗ chưa chốt</th><th>Tỷ trọng</th><th>Xu hướng</th><th>Thao tác</th></tr></thead><tbody>{dashboard.holdings.map((holding) => <tr key={holding.symbol}><td><Link href={`/market/stocks/${holding.symbol}?from=${encodeURIComponent("/portfolio#paper-market-table")}`} prefetch={false}>{holding.symbol}</Link><span>{holding.name}</span><small>{holding.exchange} · {holding.sector ?? "Chưa phân loại"}</small></td><td data-label="Sở hữu / khả dụng">{numberFormat.format(holding.quantity)} / {numberFormat.format(holding.available_quantity)} CP</td><td data-label="Giá vốn TB">{money(holding.average_cost)}</td><td data-label="Giá hiện tại">{holding.current_price ? money(holding.current_price) : "Chưa có"}</td><td data-label="Giá trị">{moneyOrUnavailable(holding.market_value)}</td><td data-label="Hôm nay" className={tone(holding.daily_change_percent ?? 0)}>{holding.daily_change_percent === null ? "—" : `${Number(holding.daily_change_percent) > 0 ? "+" : ""}${holding.daily_change_percent}%`}</td><td data-label="Lãi/lỗ" className={tone(holding.unrealized_pnl ?? 0)}>{holding.unrealized_pnl === null ? "Chưa đủ giá" : `${money(holding.unrealized_pnl)} · ${holding.unrealized_pnl_percent}%`}</td><td data-label="Tỷ trọng">{holding.portfolio_weight_percent === null ? "Chưa đủ giá" : `${holding.portfolio_weight_percent}%`}</td><td data-label="Xu hướng"><Sparkline points={holding.price_history} label={`Lịch sử giá ${holding.symbol}`} /></td><td data-label="Thao tác"><div className="paper-stock-actions"><button type="button" onClick={() => prepareOrder("buy", holding.symbol)} aria-label={`Mua thêm ${holding.symbol}`}>Mua thêm</button><button type="button" className="sell" disabled={holding.available_quantity === 0} onClick={() => prepareOrder("sell", holding.symbol)} aria-label={`Bán ${holding.symbol}`}>Bán</button></div></td></tr>)}</tbody></table></div> : <div className="paper-empty"><strong>Chưa có cổ phiếu nào</strong><p>Chọn “Mua” ở bảng giá phía trên. Chỉ lệnh đã khớp mới được tính vào danh mục.</p></div>}
      </section>

      <section className="paper-section" aria-labelledby="paper-orders-title">
        <div className="paper-section-heading"><div><p className="eyebrow">SỔ LỆNH</p><h2 id="paper-orders-title">Theo dõi và quản lý lệnh</h2></div><span>{filteredOrders.length} / {dashboard.orders.length} lệnh</span></div>
        <p className="paper-order-execution-note"><strong>Tự động khớp trong môi trường học tập:</strong> InvestIQ ghi nhận toàn bộ số lượng theo giá quan sát mới nhất khi bạn xác nhận. Trên hệ thống giao dịch thật, lệnh có thể chờ, khớp một phần hoặc không khớp tùy giá, thanh khoản và trạng thái phiên.</p>
        <div className="paper-order-filters">
          <label>Chiều lệnh<select value={orderSide} onChange={(event) => setOrderSide(event.target.value)}><option value="all">Mua và bán</option><option value="buy">Mua</option><option value="sell">Bán</option></select></label>
          <label>Mã cổ phiếu<input value={orderSymbol} onChange={(event) => setOrderSymbol(event.target.value)} placeholder="Ví dụ: FPT" /></label>
        </div>
        {filteredOrders.length ? <div className="paper-trades-wrap"><table aria-label="Danh sách lệnh mô phỏng"><thead><tr><th>Thời gian</th><th>Chiều</th><th>Mã</th><th>Kết quả</th><th>Giá mô phỏng</th><th>Số lượng</th></tr></thead><tbody>{filteredOrders.map((order) => <tr key={order.id}><td>{timeFormat.format(new Date(order.created_at))}</td><td><span className={`paper-side ${order.side}`}>{order.side === "buy" ? "Mua" : "Bán"}</span></td><td><strong>{order.symbol}</strong></td><td><span className={`paper-order-status ${order.status}`}>{order.status === "filled" ? "Đã tự động khớp" : order.status === "cancelled" ? "Đã hủy trước đây" : order.status === "expired" ? "Đã hết hạn trước đây" : order.status === "rejected" ? "Bị từ chối" : "Đang đồng bộ"}</span></td><td>{money(order.limit_price)}</td><td>{numberFormat.format(order.filled_quantity || order.quantity)} CP</td></tr>)}</tbody></table></div> : <div className="paper-empty compact"><p>Chưa có lệnh mua/bán phù hợp.</p></div>}
      </section>

      <section className="paper-insights-grid">
        <div className="paper-card">
          <header><div><p className="eyebrow">CẢNH BÁO HỌC TẬP</p><h2>Điểm cần xem lại</h2></div></header>
          <div className="paper-notices">{dashboard.notices.map((item, index) => <article className={item.level} key={`${item.title}-${index}`}><span aria-hidden="true">{item.level === "warning" ? "!" : "i"}</span><div><strong>{item.title}</strong><p>{item.message}</p></div></article>)}</div>
        </div>
        <div className="paper-card">
          <header><div><p className="eyebrow">ĐANG KHỞI SẮC</p><h2>Tăng giá theo dữ liệu quan sát</h2></div><small>Không phải gợi ý mua</small></header>
          <div className="paper-opportunities">{dashboard.opportunities.map((item) => <button type="button" key={item.symbol} onClick={() => prepareOrder("buy", item.symbol)}><span><strong>{item.symbol}</strong><small>{item.name}</small></span><span><b>+{item.change_percent}%</b><small>{money(item.price)}</small></span><em>KL {compactFormat.format(Number(item.volume))} · GT {compactFormat.format(Number(item.matched_value))}</em></button>)}</div>
          <p className="paper-data-limit">Nguồn hiện tại không định nghĩa lượt mua/bán chủ động, nên InvestIQ không suy diễn con số này.</p>
        </div>
      </section>

      <section className="paper-section">
        <div className="paper-section-heading"><div><p className="eyebrow">TIN TÍCH CỰC TRONG 24 GIỜ</p><h2>Mã được nhắc đến trong tin tốt</h2></div><Link href="/news?sentiment=positive">Xem toàn bộ tin</Link></div>
        {positiveNews.length ? <div className="paper-news-grid">{positiveNews.map((item) => <article key={item.id}><div>{item.symbols.map((itemSymbol) => <button type="button" key={itemSymbol} onClick={() => prepareOrder("buy", itemSymbol)}>{itemSymbol}</button>)}</div><h3><Link href={`/news/${item.id}`}>{item.title}</Link></h3><p>{item.summary}</p><small>{item.source}{item.publishedAt ? ` · ${timeFormat.format(new Date(item.publishedAt))}` : ""}</small></article>)}</div> : <div className="paper-empty compact"><p>Chưa có tin tích cực đã phân tích và gắn mã trong 24 giờ gần nhất.</p></div>}
        <p className="paper-data-limit">Nhãn tích cực phản ánh nội dung bài viết, không dự báo giá tương lai và không bảo đảm lợi nhuận.</p>
      </section>

      <section className="paper-section">
        <div className="paper-section-heading"><div><p className="eyebrow">NHẬT KÝ BẤT BIẾN</p><h2>Lịch sử mua bán</h2></div><span>Tối đa 100 lệnh gần nhất</span></div>
        {dashboard.trades.length ? <div className="paper-trades-wrap"><table><thead><tr><th>Thời gian</th><th>Lệnh</th><th>Mã</th><th>Số lượng</th><th>Giá khớp</th><th>Phí + thuế</th><th>Tiền vào/ra</th><th>Lãi/lỗ chốt</th></tr></thead><tbody>{dashboard.trades.map((trade) => <tr key={trade.id}><td>{timeFormat.format(new Date(trade.created_at))}</td><td><span className={`paper-side ${trade.side}`}>{trade.side === "buy" ? "Mua" : "Bán"}</span></td><td><strong>{trade.symbol}</strong></td><td>{numberFormat.format(trade.quantity)}</td><td>{money(trade.execution_price)}</td><td>{money(Number(trade.fee_amount) + Number(trade.tax_amount))}</td><td className={tone(trade.cash_effect)}>{money(trade.cash_effect)}</td><td className={tone(trade.realized_pnl ?? 0)}>{trade.realized_pnl === null ? "—" : money(trade.realized_pnl)}</td></tr>)}</tbody></table></div> : <div className="paper-empty compact"><p>Chưa có giao dịch mô phỏng.</p></div>}
      </section>

      <footer className="paper-disclaimer"><strong>Đây là môi trường học tập.</strong><span>{dashboard.assumptions.disclaimer} Giá có thể trễ; mô phỏng chưa bao gồm khớp lệnh từng phần, T+2, cổ tức hoặc chia tách.</span></footer>
      <PaperOrderDialog open={selectedInstrument !== null} side={side} instrument={selectedInstrument} dashboard={dashboard} onClose={() => setSelectedInstrument(null)} onDashboard={(value) => { setDashboard(value); setError(""); }} onSuccess={setNotice} />
    </main>
  );
}
