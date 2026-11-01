"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PaperOrderDialog, requestPaperDashboard } from "@/components/portfolio/paper-order-dialog";
import { useAuth } from "@/hooks/use-auth";
import type { PaperDashboard } from "@/types/portfolio";

export function StockTradeActions({
  symbol,
  name,
  price,
}: {
  symbol: string;
  name: string;
  price: string | null;
}) {
  const auth = useAuth();
  const searchParams = useSearchParams();
  const tradeParam = searchParams.get("trade");
  const qtyParam = searchParams.get("qty");

  const [side, setSide] = useState<"buy" | "sell" | null>(() =>
    tradeParam === "buy" || tradeParam === "sell" ? tradeParam : null
  );
  const [targetQuantity, setTargetQuantity] = useState<number | string | undefined>(() => qtyParam || undefined);
  const [dashboard, setDashboard] = useState<PaperDashboard | null>(null);
  const [notice, setNotice] = useState("");
  const instrument = { symbol, name, price };
  const holding = dashboard?.holdings.find((item) => item.symbol === symbol);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    requestPaperDashboard()
      .then((value) => { if (!cancelled) setDashboard(value); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [auth.status]);

  // Sync with searchParams
  useEffect(() => {
    if (tradeParam === "buy" || tradeParam === "sell") {
      setNotice("");
      setSide(tradeParam);
      if (qtyParam) {
        setTargetQuantity(qtyParam);
      }
    }
  }, [tradeParam, qtyParam]);

  // Listen to custom window event
  useEffect(() => {
    const handleOpenTrade = (e: Event) => {
      const customEvent = e as CustomEvent<{ side: "buy" | "sell"; quantity?: number | string }>;
      setNotice("");
      setSide(customEvent.detail?.side || "buy");
      if (customEvent.detail?.quantity) {
        setTargetQuantity(customEvent.detail.quantity);
      }
    };
    window.addEventListener("open-stock-trade", handleOpenTrade);
    return () => window.removeEventListener("open-stock-trade", handleOpenTrade);
  }, []);

  const handleClose = () => {
    setSide(null);
    setTargetQuantity(undefined);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("trade") || url.searchParams.has("qty")) {
        url.searchParams.delete("trade");
        url.searchParams.delete("qty");
        window.history.replaceState({}, "", url.toString());
      }
    }
  };

  return (
    <>
      <div className="stock-trade-actions" aria-label={`Giao dịch mô phỏng ${symbol}`}>
        <button type="button" aria-label={`Mua ${symbol}`} onClick={() => { setNotice(""); setSide("buy"); }}>Mua</button>
        {holding && holding.available_quantity > 0 && <button type="button" className="sell" aria-label={`Bán ${symbol}`} onClick={() => { setNotice(""); setSide("sell"); }}>Bán</button>}
      </div>
      <p className="stock-trade-session-note">Lệnh luyện tập vẫn tự động khớp theo giá quan sát mới nhất khi thị trường thật đóng cửa, kể cả cuối tuần.</p>
      {notice && <p className="paper-trade-toast" role="status">{notice}</p>}
      <PaperOrderDialog
        open={side !== null}
        side={side ?? "buy"}
        instrument={instrument}
        dashboard={dashboard}
        initialQuantity={targetQuantity}
        onClose={handleClose}
        onDashboard={setDashboard}
        onSuccess={setNotice}
      />
    </>
  );
}
