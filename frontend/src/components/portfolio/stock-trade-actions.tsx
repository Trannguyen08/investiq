"use client";

import { useEffect, useState } from "react";

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
  const [side, setSide] = useState<"buy" | "sell" | null>(null);
  const [dashboard, setDashboard] = useState<PaperDashboard | null>(null);
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

  return (
    <>
      <div className="stock-trade-actions" aria-label={`Giao dịch mô phỏng ${symbol}`}>
        <button type="button" aria-label={`Mua ${symbol}`} onClick={() => setSide("buy")}>Mua</button>
        {holding && holding.available_quantity > 0 && <button type="button" className="sell" aria-label={`Bán ${symbol}`} onClick={() => setSide("sell")}>Bán</button>}
      </div>
      <p className="stock-trade-session-note">Lệnh luyện tập vẫn tự động khớp theo giá quan sát mới nhất khi thị trường thật đóng cửa, kể cả cuối tuần.</p>
      <PaperOrderDialog
        open={side !== null}
        side={side ?? "buy"}
        instrument={instrument}
        dashboard={dashboard}
        onClose={() => setSide(null)}
        onDashboard={setDashboard}
      />
    </>
  );
}
