"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import type { PaperDashboard, PaperOrder, PaperTrade } from "@/types/portfolio";

type Instrument = { symbol: string; name: string; price: string | null };

const moneyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function money(value: number | string) {
  return moneyFormat.format(Number(value));
}

async function csrfToken() {
  const response = await fetch("/auth-api/csrf", { cache: "no-store" });
  const body = await response.json() as { csrf_token?: string };
  if (!response.ok || !body.csrf_token) throw new Error("Không thể xác thực thao tác.");
  return body.csrf_token;
}

export async function requestPaperDashboard(): Promise<PaperDashboard> {
  const response = await fetch("/portfolio-api", { cache: "no-store" });
  const body = await response.json().catch(() => null) as (PaperDashboard & {
    error?: { message?: string };
  }) | null;
  if (!response.ok || !body || body.error) {
    throw new Error(body?.error
      ? body.error.message ?? "Không thể tải tài khoản mô phỏng."
      : "Không thể tải tài khoản mô phỏng.");
  }
  return body;
}

type PaperOrderDialogProps = {
  open: boolean;
  side: "buy" | "sell";
  instrument: Instrument | null;
  dashboard?: PaperDashboard | null;
  onClose: () => void;
  onDashboard?: (dashboard: PaperDashboard) => void;
  onSuccess?: (message: string) => void;
};

export function PaperOrderDialog(props: PaperOrderDialogProps) {
  if (!props.open || !props.instrument) return null;
  return <PaperOrderDialogContent
    key={`${props.side}-${props.instrument.symbol}`}
    side={props.side}
    instrument={props.instrument}
    suppliedDashboard={props.dashboard}
    onClose={props.onClose}
    onDashboard={props.onDashboard}
    onSuccess={props.onSuccess}
  />;
}

function PaperOrderDialogContent({
  side,
  instrument,
  suppliedDashboard,
  onClose,
  onDashboard,
  onSuccess,
}: {
  side: "buy" | "sell";
  instrument: Instrument;
  suppliedDashboard?: PaperDashboard | null;
  onClose: () => void;
  onDashboard?: (dashboard: PaperDashboard) => void;
  onSuccess?: (message: string) => void;
}) {
  const auth = useAuth();
  const dialogRef = useRef<HTMLElement>(null);
  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [loadedDashboard, setLoadedDashboard] = useState<PaperDashboard | null>(null);
  const [pending, setPending] = useState(false);
  const initialHolding = suppliedDashboard?.holdings.find((item) => item.symbol === instrument.symbol);
  const [quantity, setQuantity] = useState(
    side === "sell" ? String(initialHolding?.available_quantity ?? 0) : "100",
  );
  const [error, setError] = useState("");
  const dashboard = suppliedDashboard ?? loadedDashboard;
  const holding = dashboard?.holdings.find((item) => item.symbol === instrument.symbol) ?? null;
  const executionPrice = instrument.price ?? holding?.current_price ?? "";
  const loading = auth.status === "authenticated" && !dashboard && !error;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const returnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]",
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

  useEffect(() => {
    if (suppliedDashboard || auth.status !== "authenticated") return;
    let cancelled = false;
    requestPaperDashboard()
      .then((value) => {
        if (cancelled) return;
        const loadedHolding = value.holdings.find((item) => item.symbol === instrument.symbol);
        setLoadedDashboard(value);
        if (side === "sell") setQuantity(String(loadedHolding?.available_quantity ?? 0));
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải tài khoản mô phỏng.");
      });
    return () => { cancelled = true; };
  }, [auth.status, instrument.price, instrument.symbol, side, suppliedDashboard]);

  const estimate = useMemo(() => {
    const gross = Number(executionPrice) * Number(quantity);
    const fee = Math.round(gross * 0.0015);
    const tax = side === "sell" ? Math.round(gross * 0.001) : 0;
    return { gross, fee, tax, total: side === "buy" ? gross + fee : gross - fee - tax };
  }, [executionPrice, quantity, side]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current || !dashboard) return;
    const numericQuantity = Number(quantity);
    const numericPrice = Number(executionPrice);
    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      setError("Số lượng phải là số nguyên lớn hơn 0.");
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError("Chưa có giá quan sát hợp lệ để mô phỏng giao dịch.");
      return;
    }
    if (side === "buy" && estimate.total > Number(dashboard.account.available_cash)) {
      setError("Số dư khả dụng không đủ cho giá trị lệnh và phí dự kiến.");
      return;
    }
    if (side === "sell" && numericQuantity > (holding?.available_quantity ?? 0)) {
      setError("Số lượng bán vượt quá số cổ phiếu khả dụng.");
      return;
    }
    submittingRef.current = true;
    setPending(true);
    setError("");
    try {
      const csrf = await csrfToken();
      const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
      idempotencyKeyRef.current = idempotencyKey;
      const response = await fetch("/portfolio-api/orders", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          side,
          order_type: "LO",
          symbol: instrument.symbol,
          quantity: numericQuantity,
          limit_price: executionPrice,
        }),
      });
      const body = await response.json() as {
        data?: PaperDashboard;
        order?: PaperOrder;
        trade?: PaperTrade | null;
        error?: { message?: string };
      };
      if (!response.ok || !body.data || !body.order) {
        throw new Error(body.error?.message ?? "Không thể đặt lệnh mô phỏng.");
      }
      if (!body.trade) throw new Error("Giao dịch chưa được tự động khớp. Vui lòng tải lại dữ liệu giá và thử lại.");
      const successMessage = `${side === "buy" ? "Mua" : "Bán"} thành công: Đã tự động khớp ${body.trade.quantity} ${body.trade.symbol} tại ${money(body.trade.execution_price)}.`;
      setLoadedDashboard(body.data);
      idempotencyKeyRef.current = null;
      onDashboard?.(body.data);
      onSuccess?.(successMessage);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đặt lệnh mô phỏng.");
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="paper-order-modal" role="presentation">
      <button className="paper-order-backdrop" type="button" aria-label="Đóng phiếu đặt lệnh" onClick={onClose} />
      <section ref={dialogRef} className={`paper-order-dialog ${side}`} role="dialog" aria-modal="true" aria-labelledby="paper-order-dialog-title">
      <header>
        <div><p className="eyebrow">GIAO DỊCH MÔ PHỎNG TỰ ĐỘNG</p><h2 id="paper-order-dialog-title">{side === "buy" ? "Mua" : "Bán"} {instrument.symbol}</h2><span>{instrument.name}</span></div>
        <button type="button" aria-label="Đóng phiếu đặt lệnh" onClick={onClose}>×</button>
      </header>
      {auth.status !== "authenticated" ? (
        <div className="paper-order-auth"><p>Đăng nhập để sử dụng tài khoản và lệnh mô phỏng riêng tư.</p><Link href="/login">Đăng nhập</Link></div>
      ) : loading || !dashboard ? (
        <div className="paper-order-loading" role={error ? "alert" : "status"}>{error || "Đang tải sức mua và vị thế…"}</div>
      ) : (
        <form onSubmit={submit}>
          <div className="paper-order-quote"><span>Giá tự động khớp dự kiến</span><strong>{executionPrice ? money(executionPrice) : "Chưa có giá"}</strong><small>{dashboard.market.provider_name} · {dashboard.market.delay_class}</small></div>
          <label>Chế độ khớp<select value="automatic" disabled><option value="automatic">Tự động · Giá quan sát mới nhất</option></select></label>
          <label>Số lượng cổ phiếu<input aria-label="Số lượng cổ phiếu" type="number" min="1" max={side === "sell" ? holding?.available_quantity ?? 0 : 1_000_000} step="1" value={quantity} onChange={(event) => { idempotencyKeyRef.current = null; setQuantity(event.target.value); }} required /></label>
          <dl className="paper-order-totals">
            <div><dt>Giá trị dự kiến</dt><dd>{money(estimate.gross || 0)}</dd></div>
            <div><dt>Phí mô phỏng 0,15%</dt><dd>{money(estimate.fee || 0)}</dd></div>
            {side === "sell" && <div><dt>Thuế bán 0,1%</dt><dd>{money(estimate.tax || 0)}</dd></div>}
            <div className="total"><dt>{side === "buy" ? "Tổng tiền dự kiến" : "Tiền thu dự kiến"}</dt><dd>{money(estimate.total || 0)}</dd></div>
          </dl>
          <div className="paper-order-capacity">
            {side === "buy" ? <><span>Tiền khả dụng</span><strong>{money(dashboard.account.available_cash)}</strong><small>Giao dịch mô phỏng được ghi nhận ngay sau xác nhận.</small></> : <><span>Cổ phiếu khả dụng</span><strong>{holding?.available_quantity ?? 0} CP</strong><small>Đang sở hữu: {holding?.quantity ?? 0} CP</small></>}
          </div>
          {error && <p className="paper-order-feedback error" role="alert">{error}</p>}
          <p className="paper-order-rule">Trong InvestIQ, giao dịch luyện tập được tự động khớp toàn bộ theo giá quan sát hợp lệ mới nhất, kể cả khi thị trường thật đang đóng cửa. Trên hệ thống giao dịch thật, lệnh có thể chờ, khớp một phần hoặc không khớp do giá, thanh khoản và trạng thái phiên.</p>
          <footer><button type="submit" className={`paper-submit ${side}`} disabled={pending || !executionPrice || (side === "sell" && !holding?.available_quantity)}>{pending ? "Đang ghi nhận…" : `Xác nhận ${side === "buy" ? "mua" : "bán"}`}</button><button type="button" onClick={onClose}>Đóng</button></footer>
        </form>
      )}
      </section>
    </div>
  );
}
