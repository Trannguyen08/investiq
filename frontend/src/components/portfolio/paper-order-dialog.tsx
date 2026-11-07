"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import type {
  PaperDashboard,
  PaperExecutionMode,
  PaperOrder,
  PaperOrderTypeCode,
  PaperTrade,
} from "@/types/portfolio";

type Instrument = {
  symbol: string;
  name: string;
  price: string | null;
  exchange?: string;
  reference_price?: string | null;
  ceiling_price?: string | null;
  floor_price?: string | null;
};

const moneyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function money(value: number | string) {
  return moneyFormat.format(Number(value));
}

function roundToTickSize(price: number): number {
  if (price <= 0) return 0;
  if (price < 10_000) return Math.round(price / 10) * 10;
  if (price < 50_000) return Math.round(price / 50) * 50;
  return Math.round(price / 100) * 100;
}

function formatDotNumber(val: string | number): string {
  if (!val && val !== 0) return "";
  const clean = String(val).replace(/[^\d]/g, "");
  if (!clean) return "";
  return Number(clean).toLocaleString("vi-VN");
}

function resolveTriggerPrice(
  rawInput: string,
  basePrice: number,
  isStopLoss: boolean,
): { priceVnd: string; displayHint: string; validationError?: string } {
  if (!rawInput.trim() || basePrice <= 0) {
    return { priceVnd: "", displayHint: "" };
  }
  const clean = rawInput
    .trim()
    .replace(/%/g, "")
    .replace(/\+/g, "")
    .replace(/-/g, "")
    .replace(/\./g, "");
  const num = Number(clean);
  if (Number.isNaN(num) || num <= 0) {
    return { priceVnd: "", displayHint: "" };
  }

  // If input is explicitly percentage (contains %) or is a small number <= 100 without thousand dots
  const isPercent = rawInput.includes("%") || (num <= 100 && !rawInput.includes("."));
  if (isPercent) {
    const pct = num;
    const target = isStopLoss
      ? roundToTickSize(basePrice * (1 - pct / 100))
      : roundToTickSize(basePrice * (1 + pct / 100));
    const sign = isStopLoss ? "-" : "+";

    let validationError: string | undefined;
    if (isStopLoss && target >= basePrice) {
      validationError = `Giá cắt lỗ (${moneyFormat.format(target)}) phải nhỏ hơn giá đặt mua (${moneyFormat.format(basePrice)}).`;
    } else if (!isStopLoss && target <= basePrice) {
      validationError = `Giá chốt lời (${moneyFormat.format(target)}) phải lớn hơn giá đặt mua (${moneyFormat.format(basePrice)}).`;
    }

    return {
      priceVnd: String(target),
      displayHint: `Kích hoạt khi ${isStopLoss ? "≤" : "≥"} ${moneyFormat.format(target)} (${sign}${pct.toFixed(1)}%)`,
      validationError,
    };
  }

  // Otherwise treat as direct VND price (e.g. 18.950, 18950, 27000)
  const target = Math.round(num);
  const diffPct = ((target - basePrice) / basePrice) * 100;
  const sign = diffPct >= 0 ? "+" : "";

  let validationError: string | undefined;
  if (isStopLoss && target >= basePrice) {
    validationError = `Giá cắt lỗ (${moneyFormat.format(target)}) phải nhỏ hơn giá đặt mua (${moneyFormat.format(basePrice)}).`;
  } else if (!isStopLoss && target <= basePrice) {
    validationError = `Giá chốt lời (${moneyFormat.format(target)}) phải lớn hơn giá đặt mua (${moneyFormat.format(basePrice)}).`;
  }

  return {
    priceVnd: String(target),
    displayHint: `Kích hoạt tại ${moneyFormat.format(target)} (${sign}${diffPct.toFixed(1)}%)`,
    validationError,
  };
}

async function csrfToken() {
  const response = await fetch("/auth-api/csrf", { cache: "no-store" });
  const body = await response.json() as { csrf_token?: string };
  if (!response.ok || !body.csrf_token) throw new Error("Không thể xác thực thao tác.");
  return body.csrf_token;
}

let memoryDashboardCache: PaperDashboard | null = null;
let memoryDashboardTimestamp = 0;
const DASHBOARD_CACHE_KEY = "investiq_cached_paper_dashboard";
const CACHE_TTL_MS = 25_000;

export function getCachedPaperDashboard(): PaperDashboard | null {
  if (process.env.NODE_ENV === "test") return null;
  if (memoryDashboardCache && Date.now() - memoryDashboardTimestamp < CACHE_TTL_MS) {
    return memoryDashboardCache;
  }
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          typeof parsed.timestamp === "number" &&
          Date.now() - parsed.timestamp < CACHE_TTL_MS
        ) {
          memoryDashboardCache = parsed.data;
          memoryDashboardTimestamp = parsed.timestamp;
          return memoryDashboardCache;
        }
      }
    } catch {}
  }
  return null;
}

export function invalidatePaperDashboardCache(): void {
  memoryDashboardCache = null;
  memoryDashboardTimestamp = 0;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(DASHBOARD_CACHE_KEY);
    } catch {}
  }
}

export async function requestPaperDashboard(forceRefresh = false): Promise<PaperDashboard> {
  if (process.env.NODE_ENV !== "test") {
    const cached = getCachedPaperDashboard();
    if (!forceRefresh && cached) {
      if (Date.now() - memoryDashboardTimestamp > 5000) {
        fetch("/portfolio-api", { cache: "no-store" })
          .then((res) => (res.ok ? res.json() : null))
          .then((fresh) => {
            if (fresh && !fresh.error) {
              memoryDashboardCache = fresh;
              memoryDashboardTimestamp = Date.now();
              try {
                sessionStorage.setItem(
                  DASHBOARD_CACHE_KEY,
                  JSON.stringify({ timestamp: Date.now(), data: fresh })
                );
              } catch {}
            }
          })
          .catch(() => {});
      }
      return cached;
    }
  }

  const response = await fetch("/portfolio-api", { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as (PaperDashboard & {
    error?: { message?: string };
  }) | null;
  if (!response.ok || !body || body.error) {
    throw new Error(
      body?.error
        ? body.error.message ?? "Không thể tải tài khoản mô phỏng."
        : "Không thể tải tài khoản mô phỏng."
    );
  }
  memoryDashboardCache = body;
  memoryDashboardTimestamp = Date.now();
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(
        DASHBOARD_CACHE_KEY,
        JSON.stringify({ timestamp: Date.now(), data: body })
      );
    } catch {}
  }
  return body;
}

type PaperOrderDialogProps = {
  open: boolean;
  side: "buy" | "sell";
  instrument: Instrument | null;
  dashboard?: PaperDashboard | null;
  initialQuantity?: number | string;
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
    initialQuantity={props.initialQuantity}
    onClose={props.onClose}
    onDashboard={props.onDashboard}
    onSuccess={props.onSuccess}
  />;
}

function PaperOrderDialogContent({
  side,
  instrument,
  suppliedDashboard,
  initialQuantity,
  onClose,
  onDashboard,
  onSuccess,
}: {
  side: "buy" | "sell";
  instrument: Instrument;
  suppliedDashboard?: PaperDashboard | null;
  initialQuantity?: number | string;
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
    initialQuantity ? String(initialQuantity) : (side === "sell" ? String(initialHolding?.available_quantity ?? 0) : "100"),
  );
  const [error, setError] = useState("");
  const dashboard = suppliedDashboard ?? loadedDashboard;
  const holding = dashboard?.holdings.find((item) => item.symbol === instrument.symbol) ?? null;
  const marketPrice = instrument.price ?? holding?.current_price ?? "";
  const activeExecutionMode: PaperExecutionMode =
    dashboard?.exchange_simulation?.execution_mode ?? "instant";
  const [orderType, setOrderType] = useState<PaperOrderTypeCode>("LO");
  const [customLimitPrice, setCustomLimitPrice] = useState<string>(marketPrice);
  const [useOrderbookDepth, setUseOrderbookDepth] = useState<boolean>(false);
  const [stopLossInput, setStopLossInput] = useState<string>("");
  const [takeProfitInput, setTakeProfitInput] = useState<string>("");

  const executionPrice =
    orderType === "LO" && (activeExecutionMode === "exchange_hours" || useOrderbookDepth) && customLimitPrice
      ? customLimitPrice
      : marketPrice;

  const basePriceNum = Number(executionPrice || marketPrice || 0);
  const resolvedStopLoss = useMemo(
    () => resolveTriggerPrice(stopLossInput, basePriceNum, true),
    [stopLossInput, basePriceNum],
  );
  const resolvedTakeProfit = useMemo(
    () => resolveTriggerPrice(takeProfitInput, basePriceNum, false),
    [takeProfitInput, basePriceNum],
  );

  const rangeError =
    resolvedStopLoss.priceVnd &&
    resolvedTakeProfit.priceVnd &&
    Number(resolvedStopLoss.priceVnd) >= Number(resolvedTakeProfit.priceVnd)
      ? "Giá cắt lỗ (Stop-Loss) phải nhỏ hơn giá chốt lời (Take-Profit)."
      : null;

  const hasValidationError = Boolean(
    resolvedStopLoss.validationError ||
    resolvedTakeProfit.validationError ||
    rangeError
  );

  function handleIntegerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (
      [
        "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End", "Enter",
      ].includes(event.key) ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    if (!/[\d]/.test(event.key)) {
      event.preventDefault();
    }
  }

  function handleNumericKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (
      [
        "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End", "Enter",
      ].includes(event.key) ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    if (!/[\d]/.test(event.key)) {
      event.preventDefault();
    }
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (
      [
        "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End", "Enter",
      ].includes(event.key) ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    if (!/[\d.%\-+]/.test(event.key)) {
      event.preventDefault();
    }
  }

  function handleTriggerChange(
    event: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void,
  ) {
    const raw = event.target.value.replace(/[^\d.%\-+]/g, "");
    if (!raw) {
      setter("");
      return;
    }
    // If it's a percentage (e.g. -7%, +15%, -5, +10)
    if (raw.includes("%") || raw.startsWith("-") || raw.startsWith("+")) {
      setter(raw);
      return;
    }
    const cleanDigits = raw.replace(/[^\d]/g, "");
    if (!cleanDigits) {
      setter("");
      return;
    }
    const num = Number(cleanDigits);
    // If > 100, format with thousand dots (e.g. 21500 -> 21.500)
    if (num > 100) {
      setter(num.toLocaleString("vi-VN"));
      return;
    }
    setter(raw);
  }

  function handleTriggerBlur(
    val: string,
    setter: (val: string) => void,
    isStopLoss: boolean,
  ) {
    if (!val.trim()) return;
    const cleanDigits = val.replace(/[^\d]/g, "");
    if (!cleanDigits) return;
    const num = Number(cleanDigits);
    if (num <= 100 && !val.includes("%")) {
      setter(`${isStopLoss ? "-" : "+"}${num}%`);
    } else if (num > 100) {
      setter(num.toLocaleString("vi-VN"));
    }
  }

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
    if (side === "buy" && hasValidationError) {
      setError(
        resolvedStopLoss.validationError ||
        resolvedTakeProfit.validationError ||
        rangeError ||
        "Thông số cắt lỗ / chốt lời không hợp lệ."
      );
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
      const payload: Record<string, unknown> = {
        side,
        order_type: orderType,
        symbol: instrument.symbol,
        quantity: numericQuantity,
        limit_price: executionPrice,
      };
      if (useOrderbookDepth) {
        payload.use_orderbook_depth = true;
      }
      if (side === "buy" && resolvedStopLoss.priceVnd) {
        payload.stop_loss_price = resolvedStopLoss.priceVnd;
      }
      if (side === "buy" && resolvedTakeProfit.priceVnd) {
        payload.take_profit_price = resolvedTakeProfit.priceVnd;
      }

      const response = await fetch("/portfolio-api/orders", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null) as {
        data?: PaperDashboard;
        order?: PaperOrder;
        trade?: PaperTrade | null;
        error?: { message?: string };
        detail?: string;
      } | null;
      if (!response.ok || !body?.data || !body?.order) {
        const errorText = body?.detail ?? body?.error?.message ?? "Không thể đặt lệnh mô phỏng.";
        throw new Error(errorText);
      }
      let successMessage: string;
      if (body.trade) {
        successMessage = `${side === "buy" ? "Mua" : "Bán"} thành công: Đã tự động khớp ${body.trade.quantity} ${body.trade.symbol} tại ${money(body.trade.execution_price)}.`;
      } else {
        const meta = body.data.exchange_simulation?.order_meta?.[body.order.id];
        const reason = meta?.pending_reason ?? "Đang xếp hàng chờ khớp trên sổ lệnh theo quy tắc sàn.";
        successMessage = `Đã đặt lệnh chờ ${side === "buy" ? "Mua" : "Bán"} ${body.order.quantity} ${body.order.symbol} (${orderType}) tại ${money(body.order.limit_price)}. ${reason}`;
      }
      setLoadedDashboard(body.data);
      memoryDashboardCache = body.data;
      memoryDashboardTimestamp = Date.now();
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(
            DASHBOARD_CACHE_KEY,
            JSON.stringify({ timestamp: Date.now(), data: body.data })
          );
        } catch {}
      }
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
          <div className="paper-order-quote">
            <span>Giá tự động khớp dự kiến</span>
            <strong>{executionPrice ? money(executionPrice) : "Chưa có giá"}</strong>
            <small>{dashboard.market.provider_name} · {dashboard.market.delay_class}</small>
          </div>
          <div className="paper-order-type-group">
            <label htmlFor="paper-order-type-select">
              Loại lệnh sàn HOSE/HNX
              <span className="paper-order-type-hint">
                Mặc định: LO (Khớp theo giá quan sát)
              </span>
            </label>
            <select
              id="paper-order-type-select"
              aria-label="Loại lệnh sàn HOSE/HNX"
              value={orderType}
              onChange={(event) => {
                idempotencyKeyRef.current = null;
                setOrderType(event.target.value as PaperOrderTypeCode);
              }}
            >
              <option value="LO">LO · Lệnh giới hạn (Khớp tại giá chỉ định hoặc tốt hơn)</option>
              <option value="MP">MP · Lệnh thị trường (Khớp ngay tại giá đối ứng tốt nhất)</option>
              <option value="ATO">ATO · Lệnh khớp định kỳ mở cửa (09:00 - 09:15)</option>
              <option value="ATC">ATC · Lệnh khớp định kỳ đóng cửa (14:30 - 14:45)</option>
            </select>
          </div>
          <label>
            Số lượng cổ phiếu
            <input
              aria-label="Số lượng cổ phiếu"
              type="number"
              min="1"
              max={side === "sell" ? holding?.available_quantity ?? 0 : 1_000_000}
              step="1"
              value={quantity}
              onKeyDown={handleIntegerKeyDown}
              onChange={(event) => {
                idempotencyKeyRef.current = null;
                const clean = event.target.value.replace(/[^\d]/g, "");
                setQuantity(clean);
              }}
              required
            />
          </label>
          {orderType === "LO" && (activeExecutionMode === "exchange_hours" || useOrderbookDepth) ? (
            <label>
              Giá đặt giới hạn (VND)
              <input
                aria-label="Giá đặt giới hạn (VND)"
                type="text"
                inputMode="numeric"
                value={formatDotNumber(customLimitPrice)}
                onKeyDown={handleNumericKeyDown}
                onChange={(event) => {
                  idempotencyKeyRef.current = null;
                  const clean = event.target.value.replace(/[^\d]/g, "");
                  setCustomLimitPrice(clean);
                }}
              />
            </label>
          ) : (
            <label>
              Giá khớp tham chiếu
              <input
                aria-label="Giá khớp tham chiếu"
                type="text"
                disabled
                readOnly
                value={executionPrice ? `${money(executionPrice)} (Thị trường)` : "Chưa có giá"}
              />
            </label>
          )}
          <label className="paper-order-checkbox">
            <input
              type="checkbox"
              checked={useOrderbookDepth || activeExecutionMode === "exchange_hours"}
              disabled={activeExecutionMode === "exchange_hours"}
              onChange={(event) => {
                idempotencyKeyRef.current = null;
                setUseOrderbookDepth(event.target.checked);
              }}
            />
            <span>Khớp theo độ sâu sổ lệnh 3 bước giá (Bid/Ask 1..3 &amp; trượt giá thực tế)</span>
          </label>
          {side === "buy" && (
            <div className="paper-order-conditional-grid">
              <div className="paper-conditional-header">
                <span>Thiết lập Cắt lỗ &amp; Chốt lời tự động</span>
                <small>Hỗ trợ nhập % hoặc VND</small>
              </div>
              <div className="paper-conditional-col">
                <label htmlFor="paper-stop-loss-input">
                  Cắt lỗ tự động (Stop-Loss)
                </label>
                <div className="paper-conditional-input-wrap">
                  <input
                    id="paper-stop-loss-input"
                    aria-label="Cắt lỗ tự động (Stop-Loss)"
                    type="text"
                    placeholder="VD: -7% hoặc 18.950"
                    value={stopLossInput}
                    onKeyDown={handleTriggerKeyDown}
                    onChange={(event) => handleTriggerChange(event, setStopLossInput)}
                    onBlur={() => handleTriggerBlur(stopLossInput, setStopLossInput, true)}
                  />
                  {stopLossInput && (
                    <button
                      type="button"
                      className="paper-conditional-clear"
                      aria-label="Xóa cắt lỗ"
                      onClick={() => setStopLossInput("")}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="paper-quick-pills">
                  <button
                    type="button"
                    className={stopLossInput === "-5%" || stopLossInput === "5" ? "active" : ""}
                    onClick={() => setStopLossInput("-5%")}
                  >
                    -5%
                  </button>
                  <button
                    type="button"
                    className={stopLossInput === "-7%" || stopLossInput === "7" ? "active" : ""}
                    onClick={() => setStopLossInput("-7%")}
                  >
                    -7%
                  </button>
                  <button
                    type="button"
                    className={stopLossInput === "-10%" || stopLossInput === "10" ? "active" : ""}
                    onClick={() => setStopLossInput("-10%")}
                  >
                    -10%
                  </button>
                </div>
                {resolvedStopLoss.validationError ? (
                  <span className="paper-conditional-hint error" role="alert">
                    {resolvedStopLoss.validationError}
                  </span>
                ) : resolvedStopLoss.displayHint ? (
                  <span className="paper-conditional-hint loss">
                    {resolvedStopLoss.displayHint}
                  </span>
                ) : null}
              </div>
              <div className="paper-conditional-col">
                <label htmlFor="paper-take-profit-input">
                  Chốt lời tự động (Take-Profit)
                </label>
                <div className="paper-conditional-input-wrap">
                  <input
                    id="paper-take-profit-input"
                    aria-label="Chốt lời tự động (Take-Profit)"
                    type="text"
                    placeholder="VD: +15% hoặc 23.500"
                    value={takeProfitInput}
                    onKeyDown={handleTriggerKeyDown}
                    onChange={(event) => handleTriggerChange(event, setTakeProfitInput)}
                    onBlur={() => handleTriggerBlur(takeProfitInput, setTakeProfitInput, false)}
                  />
                  {takeProfitInput && (
                    <button
                      type="button"
                      className="paper-conditional-clear"
                      aria-label="Xóa chốt lời"
                      onClick={() => setTakeProfitInput("")}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="paper-quick-pills">
                  <button
                    type="button"
                    className={takeProfitInput === "+10%" || takeProfitInput === "10" ? "active" : ""}
                    onClick={() => setTakeProfitInput("+10%")}
                  >
                    +10%
                  </button>
                  <button
                    type="button"
                    className={takeProfitInput === "+15%" || takeProfitInput === "15" ? "active" : ""}
                    onClick={() => setTakeProfitInput("+15%")}
                  >
                    +15%
                  </button>
                  <button
                    type="button"
                    className={takeProfitInput === "+20%" || takeProfitInput === "20" ? "active" : ""}
                    onClick={() => setTakeProfitInput("+20%")}
                  >
                    +20%
                  </button>
                </div>
                {resolvedTakeProfit.validationError ? (
                  <span className="paper-conditional-hint error" role="alert">
                    {resolvedTakeProfit.validationError}
                  </span>
                ) : resolvedTakeProfit.displayHint ? (
                  <span className="paper-conditional-hint profit">
                    {resolvedTakeProfit.displayHint}
                  </span>
                ) : null}
              </div>
              {rangeError && (
                <div className="paper-conditional-range-error" role="alert">
                  {rangeError}
                </div>
              )}
            </div>
          )}
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
          <footer><button type="submit" className={`paper-submit ${side}`} disabled={pending || !executionPrice || hasValidationError || (side === "sell" && !holding?.available_quantity)}>{pending ? "Đang ghi nhận…" : `Xác nhận ${side === "buy" ? "mua" : "bán"}`}</button><button type="button" onClick={onClose}>Đóng</button></footer>
        </form>
      )}
      </section>
    </div>
  );
}
