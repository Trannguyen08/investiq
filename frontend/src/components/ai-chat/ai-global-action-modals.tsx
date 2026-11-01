"use client";

import { useEffect, useState } from "react";
import { DCASimulatorModal } from "@/components/market/dca-simulator-modal";
import { PaperOrderDialog, requestPaperDashboard } from "@/components/portfolio/paper-order-dialog";
import { useAuth } from "@/hooks/use-auth";
import type { PaperDashboard } from "@/types/portfolio";

export function AiGlobalActionModals() {
  const auth = useAuth();
  const [mounted, setMounted] = useState(false);

  // Comparator Modal State
  const [comparatorOpen, setComparatorOpen] = useState(false);
  const [comparatorSymbol, setComparatorSymbol] = useState("HPG");

  // Trade Order Modal State
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [tradeInstrument, setTradeInstrument] = useState<{ symbol: string; name: string; price: string | null } | null>(null);
  const [tradeQuantity, setTradeQuantity] = useState(1000);
  const [dashboard, setDashboard] = useState<PaperDashboard | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated" || !tradeOpen) return;
    let cancelled = false;
    requestPaperDashboard()
      .then((val) => {
        if (!cancelled) setDashboard(val);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [auth.status, tradeOpen]);

  useEffect(() => {
    const handleOpenComparator = (e: Event) => {
      const detail = (e as CustomEvent<{ symbol?: string }>).detail;
      const targetSym = (detail?.symbol || "HPG").toUpperCase();
      setComparatorSymbol(targetSym);
      setComparatorOpen(true);
    };

    const handleOpenTrade = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          symbol?: string;
          side?: "buy" | "sell";
          quantity?: number;
          name?: string;
          price?: string;
        }>
      ).detail;
      const sym = (detail?.symbol || "HPG").toUpperCase();
      setTradeInstrument({
        symbol: sym,
        name: detail?.name || `Cổ phiếu ${sym}`,
        price: detail?.price || null,
      });
      setTradeSide(detail?.side || "buy");
      setTradeQuantity(detail?.quantity || 1000);
      setTradeOpen(true);
    };

    window.addEventListener("open-global-comparator", handleOpenComparator);
    window.addEventListener("open-global-trade", handleOpenTrade);

    return () => {
      window.removeEventListener("open-global-comparator", handleOpenComparator);
      window.removeEventListener("open-global-trade", handleOpenTrade);
    };
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* Global DCASimulator / Asset Comparator Modal */}
      <DCASimulatorModal
        initialSymbol={comparatorSymbol}
        isOpen={comparatorOpen}
        onClose={() => setComparatorOpen(false)}
      />

      {/* Global Paper Order Simulation Dialog */}
      {tradeInstrument && (
        <PaperOrderDialog
          open={tradeOpen}
          side={tradeSide}
          instrument={tradeInstrument}
          dashboard={dashboard}
          initialQuantity={tradeQuantity}
          onClose={() => setTradeOpen(false)}
          onDashboard={setDashboard}
        />
      )}
    </>
  );
}
