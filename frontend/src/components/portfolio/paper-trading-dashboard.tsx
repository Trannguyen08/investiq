"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { changeTone, formatChange, formatCompact, formatMoney, formatPercent, formatRatioPair, priceTone } from "@/components/market/formatters";
import { PaperOrderDialog, requestPaperDashboard } from "@/components/portfolio/paper-order-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useVisibleFundamentals } from "@/hooks/use-visible-fundamentals";
import type { MarketInstrument } from "@/types/market";
import type {
  PaperDashboard,
  PaperHolding,
  PaperPricePoint,
  PaperTrade,
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

type DecimalFraction = { numerator: bigint; denominator: bigint };
const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BIGINT_TWO = BigInt(2);
const BIGINT_TEN = BigInt(10);
const BIGINT_HUNDRED = BigInt(100);
const BIGINT_TEN_THOUSAND = BigInt(10_000);

function decimalFraction(value: string): DecimalFraction {
  const match = value.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return { numerator: BIGINT_ZERO, denominator: BIGINT_ONE };
  const fraction = match[3] ?? "";
  const denominator = BIGINT_TEN ** BigInt(fraction.length);
  const magnitude = BigInt(`${match[2]}${fraction}`);
  return { numerator: match[1] ? -magnitude : magnitude, denominator };
}

function roundHalfUp(numerator: bigint, denominator: bigint) {
  if (denominator <= BIGINT_ZERO) return BIGINT_ZERO;
  const sign = numerator < BIGINT_ZERO ? -BIGINT_ONE : BIGINT_ONE;
  const magnitude = numerator < BIGINT_ZERO ? -numerator : numerator;
  return sign * ((magnitude + denominator / BIGINT_TWO) / denominator);
}

function roundVnd(value: string) {
  const fraction = decimalFraction(value);
  return roundHalfUp(fraction.numerator, fraction.denominator);
}

function multiplyVnd(value: string, quantity: number) {
  const fraction = decimalFraction(value);
  return roundHalfUp(fraction.numerator * BigInt(quantity), fraction.denominator);
}

function rateAmount(amount: bigint, rate: string) {
  const fraction = decimalFraction(rate);
  return roundHalfUp(amount * fraction.numerator, fraction.denominator);
}

function percentOf(value: bigint, basis: bigint) {
  if (basis <= BIGINT_ZERO) return "—";
  const hundredths = roundHalfUp(value * BIGINT_TEN_THOUSAND, basis);
  const sign = hundredths > BIGINT_ZERO ? "+" : hundredths < BIGINT_ZERO ? "−" : "";
  const magnitude = hundredths < BIGINT_ZERO ? -hundredths : hundredths;
  return `${sign}${magnitude / BIGINT_HUNDRED},${String(magnitude % BIGINT_HUNDRED).padStart(2, "0")}%`;
}

function projectedHolding(
  holding: PaperHolding,
  quantity: number,
  brokerFeeRate: string,
  sellTaxRate: string,
) {
  if (!holding.current_price || quantity <= 0 || holding.quantity <= 0) return null;
  const gross = multiplyVnd(holding.current_price, quantity);
  const fee = rateAmount(gross, brokerFeeRate);
  const tax = rateAmount(gross, sellTaxRate);
  const basis = roundHalfUp(
    roundVnd(holding.total_cost_basis) * BigInt(quantity),
    BigInt(holding.quantity),
  );
  const netProceeds = gross - fee - tax;
  const pnl = netProceeds - basis;
  return { gross, fee, tax, basis, netProceeds, pnl, percent: percentOf(pnl, basis) };
}

function realizedTrade(trade: PaperTrade) {
  const pnl = roundVnd(trade.realized_pnl ?? "0");
  const netProceeds = roundVnd(trade.cash_effect);
  const basis = netProceeds - pnl;
  const averageCost = trade.quantity > 0
    ? roundHalfUp(basis, BigInt(trade.quantity))
    : BIGINT_ZERO;
  return { pnl, basis, averageCost, percent: percentOf(pnl, basis) };
}

function ProfitLossDialog({
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
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(
    dashboard.holdings.map((holding) => [holding.symbol, holding.available_quantity]),
  ));
  const projections = dashboard.holdings.map((holding) => ({
    holding,
    quantity: quantities[holding.symbol] ?? 0,
    result: projectedHolding(
      holding,
      quantities[holding.symbol] ?? 0,
      dashboard.assumptions.broker_fee_rate,
      dashboard.assumptions.sell_tax_rate,
    ),
  }));
  const projectedBasis = projections.reduce((total, item) => total + (item.result?.basis ?? BIGINT_ZERO), BIGINT_ZERO);
  const projectedPnl = projections.reduce((total, item) => total + (item.result?.pnl ?? BIGINT_ZERO), BIGINT_ZERO);
  const sellTrades = dashboard.trades.filter((trade) => trade.side === "sell" && trade.realized_pnl !== null);
  const realizedRows = sellTrades.map((trade) => ({ trade, result: realizedTrade(trade) }));
  const visibleGains = realizedRows.reduce(
    (total, item) => total + (item.result.pnl > BIGINT_ZERO ? item.result.pnl : BIGINT_ZERO),
    BIGINT_ZERO,
  );
  const visibleLosses = realizedRows.reduce(
    (total, item) => total + (item.result.pnl < BIGINT_ZERO ? item.result.pnl : BIGINT_ZERO),
    BIGINT_ZERO,
  );
  const titleId = `paper-${kind}-pnl-title`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled])",
    ));
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
      <button className="paper-order-backdrop" type="button" aria-label="Đóng chi tiết lãi lỗ" onClick={onClose} />
      <section ref={dialogRef} className="paper-pnl-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <div>
            <p className="eyebrow">{kind === "unrealized" ? "KỊCH BẢN CHỈ ĐỂ XEM" : "KẾT QUẢ ĐÃ GHI NHẬN"}</p>
            <h2 id={titleId}>{kind === "unrealized" ? "Lãi/lỗ dự kiến nếu bán" : "Lãi/lỗ thực tế đã chốt"}</h2>
            <span>{kind === "unrealized" ? "Điều chỉnh khối lượng để xem kết quả; popup này không thể đặt lệnh." : "Tách rõ từng giao dịch bán tạo ra lãi hoặc lỗ."}</span>
          </div>
          <button type="button" aria-label="Đóng chi tiết lãi lỗ" onClick={onClose}>×</button>
        </header>

        {kind === "unrealized" ? (
          <div className="paper-pnl-content">
            <div className="paper-pnl-summary" aria-label="Tổng hợp lãi lỗ dự kiến">
              <article><span>Chưa chốt hiện tại</span><strong className={tone(dashboard.account.unrealized_pnl ?? 0)}>{moneyOrUnavailable(dashboard.account.unrealized_pnl)}</strong><small>Chưa trừ chi phí bán giả định</small></article>
              <article><span>Nếu bán khối lượng đã chọn</span><strong className={tone(projectedPnl.toString())}>{money(projectedPnl)}</strong><small>{percentOf(projectedPnl, projectedBasis)} trên giá vốn được chọn</small></article>
              <article><span>Phí + thuế bán giả định</span><strong>{money(projections.reduce((total, item) => total + (item.result?.fee ?? BIGINT_ZERO) + (item.result?.tax ?? BIGINT_ZERO), BIGINT_ZERO))}</strong><small>Theo giả định của tài khoản</small></article>
            </div>
            {dashboard.holdings.length ? (
              <div className="paper-pnl-table-wrap">
                <table aria-label="Chi tiết lãi lỗ dự kiến theo cổ phiếu">
                  <thead><tr><th>Nguồn lãi/lỗ</th><th>Giá mua bình quân</th><th>Giá hiện tại</th><th>Giá bán giả định</th><th>Khối lượng bán</th><th>Phí + thuế</th><th>Lãi/lỗ dự kiến</th></tr></thead>
                  <tbody>{projections.map(({ holding, quantity, result }) => (
                    <tr key={holding.symbol}>
                      <td><strong>{holding.symbol}</strong><span>{holding.name}</span><small className={result ? tone(result.pnl.toString()) : "neutral"}>{result ? (result.pnl > BIGINT_ZERO ? "Lãi từ chênh lệch giá" : result.pnl < BIGINT_ZERO ? "Lỗ từ chênh lệch giá và chi phí" : "Hòa vốn sau chi phí") : "Chưa đủ dữ liệu giá"}</small></td>
                      <td>{money(holding.average_cost)}<small>Đã gồm phí mua</small></td>
                      <td>{holding.current_price ? money(holding.current_price) : "Chưa có"}</td>
                      <td>{holding.current_price ? money(holding.current_price) : "Chưa có"}<small>Giá quan sát, không cam kết khớp</small></td>
                      <td><label className="paper-pnl-quantity"><span className="sr-only">Khối lượng bán giả định {holding.symbol}</span><input aria-label={`Khối lượng bán giả định ${holding.symbol}`} type="number" min="0" max={holding.available_quantity} step="1" value={quantity} onChange={(event) => {
                        const next = Number(event.target.value);
                        setQuantities((current) => ({
                          ...current,
                          [holding.symbol]: Number.isInteger(next) ? Math.max(0, Math.min(holding.available_quantity, next)) : 0,
                        }));
                      }} /></label><small>Tối đa {numberFormat.format(holding.available_quantity)} CP khả dụng</small></td>
                      <td>{result ? money(result.fee + result.tax) : "—"}</td>
                      <td className={result ? tone(result.pnl.toString()) : "neutral"}><strong>{result ? money(result.pnl) : "—"}</strong><small>{result?.percent ?? "—"}</small></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className="paper-empty compact"><p>Chưa có cổ phiếu để lập kịch bản bán.</p></div>}
            <p className="paper-pnl-note"><strong>Chỉ đọc, không bán:</strong> ngoài ô khối lượng, mọi dữ liệu đều khóa. Kết quả dùng giá quan sát hiện tại, phí {dashboard.assumptions.broker_fee_rate} và thuế bán {dashboard.assumptions.sell_tax_rate}; giá thật có thể khác.</p>
          </div>
        ) : (
          <div className="paper-pnl-content">
            <div className="paper-pnl-summary" aria-label="Tổng hợp lãi lỗ thực tế">
              <article><span>Đã chốt toàn tài khoản</span><strong className={tone(dashboard.account.realized_pnl)}>{money(dashboard.account.realized_pnl)}</strong><small>Sau phí và thuế mô phỏng</small></article>
              <article><span>Các khoản lãi đang hiển thị</span><strong className="positive">{money(visibleGains)}</strong><small>{realizedRows.filter((item) => item.result.pnl > BIGINT_ZERO).length} giao dịch bán có lãi</small></article>
              <article><span>Các khoản lỗ đang hiển thị</span><strong className="negative">{money(visibleLosses)}</strong><small>{realizedRows.filter((item) => item.result.pnl < BIGINT_ZERO).length} giao dịch bán bị lỗ</small></article>
            </div>
            {realizedRows.length ? (
              <div className="paper-pnl-table-wrap">
                <table aria-label="Chi tiết lãi lỗ thực tế theo giao dịch bán">
                  <thead><tr><th>Nguồn lãi/lỗ</th><th>Khối lượng</th><th>Giá mua phân bổ</th><th>Giá bán</th><th>Giá hiện tại</th><th>Phí + thuế</th><th>Lãi/lỗ đã chốt</th></tr></thead>
                  <tbody>{realizedRows.map(({ trade, result }) => (
                    <tr key={trade.id}>
                      <td><strong>{trade.symbol}</strong><span>{trade.name}</span><small>{timeFormat.format(new Date(trade.created_at))} · {result.pnl > BIGINT_ZERO ? "Lãi từ giao dịch bán" : result.pnl < BIGINT_ZERO ? "Lỗ từ giao dịch bán" : "Giao dịch hòa vốn"}</small></td>
                      <td>{numberFormat.format(trade.quantity)} CP</td>
                      <td>{money(result.averageCost)}<small>Giá vốn bình quân đã gồm phí mua</small></td>
                      <td>{money(trade.execution_price)}<small>Giá khớp mô phỏng</small></td>
                      <td>{currentPrices.get(trade.symbol) ? money(currentPrices.get(trade.symbol) as string) : "Chưa có"}<small>Chỉ để đối chiếu hiện tại</small></td>
                      <td>{money(roundVnd(trade.fee_amount) + roundVnd(trade.tax_amount))}</td>
                      <td className={tone(result.pnl.toString())}><strong>{money(result.pnl)}</strong><small>{result.percent}</small></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className="paper-empty compact"><strong>Chưa có lãi/lỗ đã chốt</strong><p>Chi tiết sẽ xuất hiện sau giao dịch bán mô phỏng đầu tiên.</p></div>}
            <p className="paper-pnl-note">Giá mua phân bổ được suy ra từ giá vốn bình quân đã ghi nhận tại lúc bán. Danh sách chi tiết giới hạn trong lịch sử giao dịch gần nhất; tổng toàn tài khoản vẫn lấy từ sổ cái danh mục.</p>
          </div>
        )}
        <footer><button type="button" onClick={onClose}>Đóng</button></footer>
      </section>
    </div>
  );
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
  const [pnlDialog, setPnlDialog] = useState<"unrealized" | "realized" | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [nickname, setNickname] = useState("");
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [visibilityMessage, setVisibilityMessage] = useState("");
  const currentPrices = useMemo(
    () => new Map(marketInstruments.map((item) => [item.symbol, item.price])),
    [marketInstruments],
  );

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    requestPaperDashboard().then((value) => {
      if (!cancelled) {
        setDashboard(value);
        setError("");
        setIsPublic(value.account.is_public ?? false);
        setNickname(value.account.nickname ?? "");
      }
    }).catch((value: unknown) => {
      if (!cancelled) setError(value instanceof Error ? value.message : "Không thể tải danh mục.");
    });
    return () => { cancelled = true; };
  }, [auth.status]);

  async function handleSaveVisibility(nextPublic: boolean) {
    if (!nickname.trim() && nextPublic) {
      setVisibilityMessage("Vui lòng nhập biệt danh của bạn khi công khai danh mục.");
      return;
    }
    setSavingVisibility(true);
    setVisibilityMessage("");
    try {
      const csrfRes = await fetch("/auth-api/csrf", { cache: "no-store" });
      const csrfBody = (await csrfRes.json()) as { csrf_token?: string };
      if (!csrfRes.ok || !csrfBody.csrf_token) throw new Error("Không thể xác thực thao tác.");

      const res = await fetch("/portfolio-api/visibility", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfBody.csrf_token,
        },
        body: JSON.stringify({
          is_public: nextPublic,
          nickname: nickname.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(err?.detail || "Không thể cập nhật quyền hiển thị.");
      }
      setIsPublic(nextPublic);
      if (dashboard) {
        setDashboard({
          ...dashboard,
          account: {
            ...dashboard.account,
            is_public: nextPublic,
            nickname: nickname.trim() || null,
          },
        });
      }
      setVisibilityMessage(
        nextPublic
          ? "Đã công khai danh mục lên Bảng Xếp Hạng Cộng Đồng thành công!"
          : "Đã chuyển danh mục về chế độ riêng tư an toàn.",
      );
    } catch (err) {
      setVisibilityMessage(err instanceof Error ? err.message : "Chưa thể lưu cấu hình.");
    } finally {
      setSavingVisibility(false);
    }
  }

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
    visibleMarket.filter((item) => item.pe === null || item.pb === null).map((item) => item.symbol),
  );

  const filteredOrders = useMemo(() => (dashboard?.orders ?? []).filter((order) => (
    (orderSide === "all" || order.side === orderSide)
    && (!orderSymbol.trim() || order.symbol.includes(orderSymbol.trim().toUpperCase()))
  )), [dashboard, orderSide, orderSymbol]);

  const isUnauthenticated = auth.status === "anonymous" || (auth.status !== "loading" && !auth.user) || error.includes("chưa đăng nhập");

  if (auth.status === "loading" && !error) {
    return <main id="main-content" className="paper-page"><div className="paper-state">Đang mở tài khoản mô phỏng…</div></main>;
  }
  if (isUnauthenticated) {
    return (
      <main id="main-content" className="paper-page paper-unauth-page">
        {/* Unauthenticated Hero Showcase */}
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

        {/* 3 Key Feature Highlights */}
        <section className="paper-unauth-features" aria-label="Tính năng nổi bật của danh mục mô phỏng">
          <article className="unauth-feature-card">
            <div className="feature-card-header">
              <span className="feature-card-num">01</span>
              <h3>1 Tỷ Vốn Khởi Đầu</h3>
            </div>
            <p>
              Cấp sẵn 1.000.000.000 VND vốn tiền mặt mô phỏng vào tài khoản để bạn thỏa sức phân bổ danh mục, thử nghiệm chiến lược mua gom, trading ngắn hạn hoặc tích sản dài hạn.
            </p>
          </article>

          <article className="unauth-feature-card">
            <div className="feature-card-header">
              <span className="feature-card-num">02</span>
              <h3>Khớp Lệnh Thực Tế</h3>
            </div>
            <p>
              Khớp lệnh theo giá thị trường quan sát trên sàn HOSE và HNX, tính toán phí và thuế giao dịch giả định chuẩn xác giúp trải nghiệm giao dịch sát sao thực tế nhất.
            </p>
          </article>

          <article className="unauth-feature-card">
            <div className="feature-card-header">
              <span className="feature-card-num">03</span>
              <h3>Minh Bạch Hiệu Suất</h3>
            </div>
            <p>
              Tự động tính toán lãi/lỗ đã chốt, tỷ suất sinh lời theo thời gian thực và tùy chọn công khai thành tích lên Bảng Xếp Hạng Nhà Đầu Tư để cùng cộng đồng so tài.
            </p>
          </article>
        </section>

        {/* Live Market Preview Table */}
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
          <time dateTime={dashboard.market.market_time}>{timeFormat.format(new Date(dashboard.market.market_time))}</time>
        </div>
      </section>

      <section className="paper-summary-grid" aria-label="Tổng quan tài khoản mô phỏng">
        <article className="primary"><span>Tổng tài sản mô phỏng</span><strong>{moneyOrUnavailable(dashboard.account.total_value)}</strong><em className={tone(dashboard.account.total_pnl ?? 0)}>{dashboard.account.total_pnl === null ? "Thiếu giá cho một mã" : `${money(dashboard.account.total_pnl)} · ${dashboard.account.total_return_percent}%`}</em></article>
        <article><span>Tiền khả dụng</span><strong>{money(dashboard.account.available_cash)}</strong><small>{Number(dashboard.account.reserved_cash) > 0 ? `Đang giữ ${money(dashboard.account.reserved_cash)}` : "Có thể dùng để mua"}</small></article>
        <article><span>Giá vốn đang đầu tư</span><strong>{money(dashboard.account.invested_cost)}</strong><small>{dashboard.holdings.length} / {dashboard.assumptions.max_holdings} mã</small></article>
        <article className="paper-summary-interactive"><button type="button" aria-haspopup="dialog" onClick={() => setPnlDialog("unrealized")}><span>Lãi/lỗ chưa chốt</span><strong className={tone(dashboard.account.unrealized_pnl ?? 0)}>{moneyOrUnavailable(dashboard.account.unrealized_pnl)}</strong><small>Thay đổi theo giá quan sát</small><em>Xem dự kiến theo khối lượng →</em></button></article>
        <article className="paper-summary-interactive"><button type="button" aria-haspopup="dialog" onClick={() => setPnlDialog("realized")}><span>Lãi/lỗ đã chốt</span><strong className={tone(dashboard.account.realized_pnl)}>{money(dashboard.account.realized_pnl)}</strong><small>Sau phí và thuế mô phỏng</small><em>Xem khoản lãi và khoản lỗ →</em></button></article>
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
                <thead><tr><th>Mã &amp; công ty</th><th>Giá</th><th>% hôm nay</th><th>Mở · Cao · Thấp</th><th>Khối lượng</th><th>GTGD</th><th>Khối ngoại</th><th>Vốn hóa</th><th>P/E / P/B</th><th>Thao tác</th></tr></thead>
                <tbody>{visibleMarket.map((item) => {
                  const holding = holdingBySymbol.get(item.symbol);
                  const fundamentals = fundamentalsBySymbol[item.symbol];
                  const ratiosLoading = (item.pe === null || item.pb === null) && fundamentals === undefined;
                  return <tr className={item.is_vn30 ? "vn30-row" : undefined} key={item.symbol}>
                    <td className="stock-identity"><div><Link href={`/market/stocks/${item.symbol}?from=${encodeURIComponent("/portfolio#paper-market-table")}`} prefetch={false}>{item.symbol}</Link>{item.is_vn30 && <span className="vn30-badge">VN30</span>}</div><span>{item.name}</span><small>{item.exchange} · {item.sector}</small></td>
                    <td data-label="Giá"><strong className={priceTone(item.price, item.reference_price, item.ceiling_price, item.floor_price)}>{formatChange(item.price)}</strong><small className="price-reference">TC {formatChange(item.reference_price)}</small></td>
                    <td data-label="% hôm nay" className={changeTone(item.change_percent)}><strong>{formatPercent(item.change_percent)}</strong><small>{formatChange(item.change)}</small></td>
                    <td data-label="Mở · Cao · Thấp"><span className={priceTone(item.open_price, item.reference_price, item.ceiling_price, item.floor_price)}>{formatChange(item.open_price)}</span> · <span className={priceTone(item.high_price, item.reference_price, item.ceiling_price, item.floor_price)}>{formatChange(item.high_price)}</span> · <span className={priceTone(item.low_price, item.reference_price, item.ceiling_price, item.floor_price)}>{formatChange(item.low_price)}</span></td>
                    <td data-label="Khối lượng">{formatCompact(item.volume)}</td>
                    <td data-label="GTGD">{formatMoney(item.matched_value)}</td>
                    <td data-label="Khối ngoại" className={changeTone(item.foreign_net_value)}>{formatMoney(item.foreign_net_value)}</td>
                    <td data-label="Vốn hóa">{formatMoney(item.market_cap)}</td>
                    <td data-label="P/E / P/B" className="fundamental-ratios">{formatRatioPair(fundamentals?.pe ?? item.pe, fundamentals?.pb ?? item.pb, ratiosLoading)}</td>
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
        {positiveNews.length ? <div className="paper-news-grid">{positiveNews.map((item) => <article key={item.id}><div>{item.symbols.map((itemSymbol) => <button type="button" key={itemSymbol} onClick={() => prepareOrder("buy", itemSymbol)}>{itemSymbol}</button>)}</div><h3><Link href={`/news/${item.id}`}>{item.title}</Link></h3><p>{item.summary}</p><small>{item.source}{item.publishedAt ? ` · ${timeFormat.format(new Date(item.publishedAt))}` : ""}</small></article>)}</div> : <div className="paper-empty compact"><p>Chưa có tin tích cực đã phân tích và gắn mã trong 24 giờ gần nhất.</p></div>}
        <p className="paper-data-limit">Nhãn tích cực phản ánh nội dung bài viết, không dự báo giá tương lai và không bảo đảm lợi nhuận.</p>
      </section>

      <section className="paper-section social-visibility-section">
        <div className="paper-section-heading">
          <div>
            <p className="eyebrow">CỘNG ĐỒNG & BẢNG XẾP HẠNG</p>
            <h2>Chia sẻ danh mục mô phỏng</h2>
          </div>
          <Link href="/community" className="text-cyan font-semibold">
            Xem Bảng Xếp Hạng Cộng Đồng →
          </Link>
        </div>
        <div className="social-visibility-card">
          <div className="visibility-info">
            <p className="visibility-status-text">
              Trạng thái hiện tại:{" "}
              {isPublic ? (
                <strong className="text-emerald">Đang công khai trên Bảng Xếp Hạng</strong>
              ) : (
                <strong className="text-neutral">Riêng tư (Chỉ mình bạn xem)</strong>
              )}
            </p>
            <p className="visibility-desc">
              Khi bật công khai, danh mục của bạn (tỷ suất sinh lời, cơ cấu danh mục, lịch sử lệnh) sẽ hiển thị minh bạch trên Bảng Xếp Hạng Nhà Đầu Tư tại mục Cộng Đồng. Email cá nhân và thông tin riêng tư được bảo mật 100%.
            </p>
          </div>

          <div className="visibility-controls">
            <div className="nickname-field">
              <label htmlFor="portfolioNickname">Biệt danh hiển thị trên BXH:</label>
              <input
                id="portfolioNickname"
                type="text"
                placeholder="VD: Alpha Trader, Dragon Capital Fan..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={60}
                className="nickname-input"
              />
            </div>

            <div className="visibility-buttons">
              {isPublic ? (
                <button
                  type="button"
                  disabled={savingVisibility}
                  onClick={() => handleSaveVisibility(false)}
                  className="btn-toggle-private"
                >
                  {savingVisibility ? "Đang lưu..." : "Đặt về Riêng tư"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={savingVisibility}
                  onClick={() => handleSaveVisibility(true)}
                  className="btn-toggle-public"
                >
                  {savingVisibility ? "Đang lưu..." : "Công khai Danh mục lên BXH"}
                </button>
              )}
            </div>
          </div>
          {visibilityMessage && (
            <p className="visibility-msg">{visibilityMessage}</p>
          )}
        </div>
      </section>

      <section className="paper-section">
        <div className="paper-section-heading"><div><p className="eyebrow">NHẬT KÝ BẤT BIẾN</p><h2>Lịch sử mua bán</h2></div><span>Tối đa 100 lệnh gần nhất</span></div>
        {dashboard.trades.length ? <div className="paper-trades-wrap"><table><thead><tr><th>Thời gian</th><th>Lệnh</th><th>Mã</th><th>Số lượng</th><th>Giá khớp</th><th>Phí + thuế</th><th>Tiền vào/ra</th><th>Lãi/lỗ chốt</th></tr></thead><tbody>{dashboard.trades.map((trade) => <tr key={trade.id}><td>{timeFormat.format(new Date(trade.created_at))}</td><td><span className={`paper-side ${trade.side}`}>{trade.side === "buy" ? "Mua" : "Bán"}</span></td><td><strong>{trade.symbol}</strong></td><td>{numberFormat.format(trade.quantity)}</td><td>{money(trade.execution_price)}</td><td>{money(roundVnd(trade.fee_amount) + roundVnd(trade.tax_amount))}</td><td className={tone(trade.cash_effect)}>{money(trade.cash_effect)}</td><td className={tone(trade.realized_pnl ?? 0)}>{trade.realized_pnl === null ? "—" : money(trade.realized_pnl)}</td></tr>)}</tbody></table></div> : <div className="paper-empty compact"><p>Chưa có giao dịch mô phỏng.</p></div>}
      </section>

      <footer className="paper-disclaimer"><strong>Đây là môi trường học tập.</strong><span>{dashboard.assumptions.disclaimer} Giá có thể trễ; mô phỏng chưa bao gồm khớp lệnh từng phần, T+2, cổ tức hoặc chia tách.</span></footer>
      {pnlDialog && <ProfitLossDialog kind={pnlDialog} dashboard={dashboard} currentPrices={currentPrices} onClose={() => setPnlDialog(null)} />}
      <PaperOrderDialog open={selectedInstrument !== null} side={side} instrument={selectedInstrument} dashboard={dashboard} onClose={() => setSelectedInstrument(null)} onDashboard={(value) => { setDashboard(value); setError(""); }} onSuccess={setNotice} />
    </main>
  );
}
