"use client";

import { useEffect, useRef, useState } from "react";

export type VisibleFundamentals = {
  pe: string | null;
  pb: string | null;
};

const BATCH_SIZE = 15;

export function useVisibleFundamentals(symbols: string[], preloadSymbols: string[] = []) {
  const [values, setValues] = useState<Record<string, VisibleFundamentals>>({});
  const requested = useRef(new Set<string>());
  const symbolsKey = symbols.join(",");
  const preloadKey = preloadSymbols.join(",");

  useEffect(() => {
    const candidates = [...new Set(`${symbolsKey},${preloadKey}`.split(",").filter(Boolean))];
    if (!candidates.some((symbol) => !requested.current.has(symbol))) return;
    const controller = new AbortController();

    async function loadBatches() {
      for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
        if (controller.signal.aborted) return;
        const missing = candidates
          .slice(offset, offset + BATCH_SIZE)
          .filter((symbol) => !requested.current.has(symbol));
        if (!missing.length) continue;
        missing.forEach((symbol) => requested.current.add(symbol));
        try {
          const response = await fetch(`/market-data-api/fundamentals?symbols=${encodeURIComponent(missing.join(","))}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Không thể tải chỉ số cơ bản.");
          const body = await response.json() as {
            data: { symbol: string; pe: string | null; pb: string | null }[];
          };
          setValues((current) => {
            const next = { ...current };
            body.data.forEach((item) => {
              next[item.symbol] = { pe: item.pe, pb: item.pb };
            });
            return next;
          });
        } catch {
          if (controller.signal.aborted) {
            missing.forEach((symbol) => requested.current.delete(symbol));
            return;
          }
          setValues((current) => {
            const next = { ...current };
            missing.forEach((symbol) => {
              next[symbol] = { pe: null, pb: null };
            });
            return next;
          });
        }
      }
    }
    void loadBatches();

    return () => controller.abort();
  }, [preloadKey, symbolsKey]);

  return values;
}
