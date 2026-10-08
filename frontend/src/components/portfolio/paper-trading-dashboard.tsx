"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import type {
  PaperDashboard,
  PaperHolding,
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

async function csrfToken() {
  const response = await fetch("/auth-api/csrf", { cache: "no-store" });
  const body = await response.json() as { csrf_token?: string };
  if (!response.ok || !body.csrf_token) throw new Error("Không thể xác thực thao tác.");
  return body.csrf_token;
}

async function requestDashboard(): Promise<PaperDashboard> {
  const response = await fetch("/portfolio-api", { cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? "Không thể tải danh mục mô phỏng.");
  }
  return response.json() as Promise<PaperDashboard>;
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

function HoldingRow({ holding, onSell }: { holding: PaperHolding; onSell: (symbol: string) => void }) {
  return (
    <article className="paper-holding-card">
      <header>
        <div><strong>{holding.symbol}</strong><span>{holding.name}</span></div>
        <Sparkline points={holding.price_history} label={`Lịch sử giá ${holding.symbol}`} />
      </header>
      <dl>
        <div><dt>Đang giữ</dt><dd>{numberFormat.format(holding.quantity)} CP</dd></div>
        <div><dt>Giá vốn TB</dt><dd>{money(holding.average_cost)}</dd></div>
        <div><dt>Giá quan sát</dt><dd>{holding.current_price ? money(holding.current_price) : "Chưa có"}</dd></div>
        <div><dt>Giá trị hiện tại</dt><dd>{moneyOrUnavailable(holding.market_value)}</dd></div>
        <div><dt>Tỷ trọng</dt><dd>{holding.portfolio_weight_percent === null ? "Chưa đủ giá" : `${holding.portfolio_weight_percent}%`}</dd></div>
        <div><dt>Lãi/lỗ chưa chốt</dt><dd className={tone(holding.unrealized_pnl ?? 0)}>{holding.unrealized_pnl === null ? "Chưa đủ giá" : `${money(holding.unrealized_pnl)} · ${holding.unrealized_pnl_percent}%`}</dd></div>
      </dl>
      <button type="button" onClick={() => onSell(holding.symbol)}>Bán mã này</button>
    </article>
  );
}

export function PaperTradingDashboard({ positiveNews }: { positiveNews: PositivePaperNews[] }) {
  const auth = useAuth();
  const [dashboard, setDashboard] = useState<PaperDashboard | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("100");

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    requestDashboard().then((value) => {
      if (!cancelled) { setDashboard(value); setError(""); }
    }).catch((value: unknown) => {
      if (!cancelled) setError(value instanceof Error ? value.message : "Không thể tải danh mục.");
    });
    return () => { cancelled = true; };
  }, [auth.status]);

  const selectedPrice = useMemo(() => {
    if (!dashboard || !symbol) return null;
    return dashboard.holdings.find((item) => item.symbol === symbol)?.current_price
      ?? dashboard.opportunities.find((item) => item.symbol === symbol)?.price
      ?? null;
  }, [dashboard, symbol]);
  const estimatedGross = selectedPrice ? Number(selectedPrice) * Number(quantity || 0) : 0;

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

  function prepareSell(selected: string) {
    setSide("sell");
    setSymbol(selected);
    document.getElementById("paper-order-symbol")?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setNotice(""); setPending(true);
    try {
      const csrf = await csrfToken();
      const response = await fetch("/portfolio-api/orders", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ side, symbol: symbol.trim().toUpperCase(), quantity: Number(quantity) }),
      });
      const body = await response.json() as {
        data?: PaperDashboard;
        trade?: { side: "buy" | "sell"; symbol: string; quantity: number; execution_price: string };
        error?: { message?: string };
      };
      if (!response.ok || !body.data || !body.trade) {
        throw new Error(body.error?.message ?? "Không thể ghi nhận lệnh mô phỏng.");
      }
      setDashboard(body.data);
      setNotice(`${body.trade.side === "buy" ? "Đã mua" : "Đã bán"} ${body.trade.quantity} ${body.trade.symbol} ở ${money(body.trade.execution_price)}.`);
      setQuantity("100");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không thể ghi nhận lệnh mô phỏng.");
    } finally {
      setPending(false);
    }
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
        <article><span>Tiền còn trong ví</span><strong>{money(dashboard.account.cash_balance)}</strong><small>Có thể dùng để mua</small></article>
        <article><span>Giá vốn đang đầu tư</span><strong>{money(dashboard.account.invested_cost)}</strong><small>{dashboard.holdings.length} / {dashboard.assumptions.max_holdings} mã</small></article>
        <article><span>Lãi/lỗ chưa chốt</span><strong className={tone(dashboard.account.unrealized_pnl ?? 0)}>{moneyOrUnavailable(dashboard.account.unrealized_pnl)}</strong><small>Thay đổi theo giá quan sát</small></article>
        <article><span>Lãi/lỗ đã chốt</span><strong className={tone(dashboard.account.realized_pnl)}>{money(dashboard.account.realized_pnl)}</strong><small>Sau phí và thuế mô phỏng</small></article>
      </section>

      {(notice || error) && <p className={`paper-inline-message ${error ? "error" : "success"}`} role={error ? "alert" : "status"}>{error || notice}</p>}

      <section className="paper-main-grid">
        <div className="paper-card paper-chart-card">
          <header><div><p className="eyebrow">HIỆU SUẤT ƯỚC TÍNH</p><h2>Biến động giá trị danh mục</h2></div><span>Tối đa 90 phiên</span></header>
          <EquityChart dashboard={dashboard} />
        </div>
        <form className="paper-card paper-order-card" onSubmit={submit}>
          <p className="eyebrow">LỆNH MÔ PHỎNG</p><h2>Mua hoặc bán cổ phiếu</h2>
          <div className="paper-side-control" role="group" aria-label="Loại lệnh">
            <button type="button" className={side === "buy" ? "active" : ""} onClick={() => setSide("buy")}>Mua</button>
            <button type="button" className={side === "sell" ? "active sell" : ""} onClick={() => setSide("sell")}>Bán</button>
          </div>
          <label htmlFor="paper-order-symbol">Mã cổ phiếu</label>
          <input id="paper-order-symbol" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} maxLength={24} pattern="[A-Za-z0-9._-]+" placeholder="Ví dụ: FPT" required />
          <label htmlFor="paper-order-quantity">Số lượng cổ phiếu</label>
          <input id="paper-order-quantity" type="number" min="1" max="1000000" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
          <div className="paper-order-estimate"><span>Giá trị lệnh dự kiến</span><strong>{selectedPrice ? money(estimatedGross) : "Nhập mã để lấy giá"}</strong></div>
          <button className={`paper-submit ${side}`} type="submit" disabled={pending}>{pending ? "Đang ghi nhận…" : `${side === "buy" ? "Mua" : "Bán"} bằng tiền mô phỏng`}</button>
          <small>Khớp ngay theo giá quan sát gần nhất; phí 0,15% và thuế bán 0,1% là giả định mô phỏng.</small>
        </form>
      </section>

      <section className="paper-section">
        <div className="paper-section-heading"><div><p className="eyebrow">ĐANG SỞ HỮU</p><h2>Cổ phiếu trong danh mục</h2></div><span>{dashboard.holdings.length} mã</span></div>
        {dashboard.holdings.length ? <div className="paper-holdings-grid">{dashboard.holdings.map((holding) => <HoldingRow key={holding.symbol} holding={holding} onSell={prepareSell} />)}</div> : <div className="paper-empty"><strong>Chưa có cổ phiếu nào</strong><p>Bắt đầu bằng một lệnh nhỏ ở khung phía trên. Hệ thống sẽ lưu giá mua và tính lời/lỗ từ lần đăng nhập tiếp theo.</p></div>}
      </section>

      <section className="paper-insights-grid">
        <div className="paper-card">
          <header><div><p className="eyebrow">CẢNH BÁO HỌC TẬP</p><h2>Điểm cần xem lại</h2></div></header>
          <div className="paper-notices">{dashboard.notices.map((item, index) => <article className={item.level} key={`${item.title}-${index}`}><span aria-hidden="true">{item.level === "warning" ? "!" : "i"}</span><div><strong>{item.title}</strong><p>{item.message}</p></div></article>)}</div>
        </div>
        <div className="paper-card">
          <header><div><p className="eyebrow">ĐANG KHỞI SẮC</p><h2>Tăng giá theo dữ liệu quan sát</h2></div><small>Không phải gợi ý mua</small></header>
          <div className="paper-opportunities">{dashboard.opportunities.map((item) => <button type="button" key={item.symbol} onClick={() => { setSide("buy"); setSymbol(item.symbol); }}><span><strong>{item.symbol}</strong><small>{item.name}</small></span><span><b>+{item.change_percent}%</b><small>{money(item.price)}</small></span><em>KL {compactFormat.format(Number(item.volume))} · GT {compactFormat.format(Number(item.matched_value))}</em></button>)}</div>
          <p className="paper-data-limit">Nguồn hiện tại không định nghĩa lượt mua/bán chủ động, nên InvestIQ không suy diễn con số này.</p>
        </div>
      </section>

      <section className="paper-section">
        <div className="paper-section-heading"><div><p className="eyebrow">TIN TÍCH CỰC TRONG 24 GIỜ</p><h2>Mã được nhắc đến trong tin tốt</h2></div><Link href="/news?sentiment=positive">Xem toàn bộ tin</Link></div>
        {positiveNews.length ? <div className="paper-news-grid">{positiveNews.map((item) => <article key={item.id}><div>{item.symbols.map((itemSymbol) => <button type="button" key={itemSymbol} onClick={() => { setSide("buy"); setSymbol(itemSymbol); }}>{itemSymbol}</button>)}</div><h3><Link href={`/news/${item.id}`}>{item.title}</Link></h3><p>{item.summary}</p><small>{item.source}{item.publishedAt ? ` · ${timeFormat.format(new Date(item.publishedAt))}` : ""}</small></article>)}</div> : <div className="paper-empty compact"><p>Chưa có tin tích cực đã phân tích và gắn mã trong 24 giờ gần nhất.</p></div>}
        <p className="paper-data-limit">Nhãn tích cực phản ánh nội dung bài viết, không dự báo giá tương lai và không bảo đảm lợi nhuận.</p>
      </section>

      <section className="paper-section">
        <div className="paper-section-heading"><div><p className="eyebrow">NHẬT KÝ BẤT BIẾN</p><h2>Lịch sử mua bán</h2></div><span>Tối đa 100 lệnh gần nhất</span></div>
        {dashboard.trades.length ? <div className="paper-trades-wrap"><table><thead><tr><th>Thời gian</th><th>Lệnh</th><th>Mã</th><th>Số lượng</th><th>Giá khớp</th><th>Phí + thuế</th><th>Tiền vào/ra</th><th>Lãi/lỗ chốt</th></tr></thead><tbody>{dashboard.trades.map((trade) => <tr key={trade.id}><td>{timeFormat.format(new Date(trade.created_at))}</td><td><span className={`paper-side ${trade.side}`}>{trade.side === "buy" ? "Mua" : "Bán"}</span></td><td><strong>{trade.symbol}</strong></td><td>{numberFormat.format(trade.quantity)}</td><td>{money(trade.execution_price)}</td><td>{money(Number(trade.fee_amount) + Number(trade.tax_amount))}</td><td className={tone(trade.cash_effect)}>{money(trade.cash_effect)}</td><td className={tone(trade.realized_pnl ?? 0)}>{trade.realized_pnl === null ? "—" : money(trade.realized_pnl)}</td></tr>)}</tbody></table></div> : <div className="paper-empty compact"><p>Chưa có giao dịch mô phỏng.</p></div>}
      </section>

      <footer className="paper-disclaimer"><strong>Đây là môi trường học tập.</strong><span>{dashboard.assumptions.disclaimer} Giá có thể trễ; mô phỏng chưa bao gồm khớp lệnh từng phần, T+2, cổ tức hoặc chia tách.</span></footer>
    </main>
  );
}
