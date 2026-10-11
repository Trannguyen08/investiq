"use client";

import { useEffect, useRef, useState } from "react";

export type VisibleFundamentals = {
  pe: string | null;
  pb: string | null;
};

export function useVisibleFundamentals(symbols: string[]) {
  const [values, setValues] = useState<Record<string, VisibleFundamentals>>({});
  const requested = useRef(new Set<string>());
  const symbolsKey = symbols.join(",");

  useEffect(() => {
    const missing = symbolsKey
      .split(",")
      .filter(Boolean)
      .filter((symbol) => !requested.current.has(symbol));
    if (!missing.length) return;
    missing.forEach((symbol) => requested.current.add(symbol));
    const controller = new AbortController();

    fetch(`/market-data-api/fundamentals?symbols=${encodeURIComponent(missing.join(","))}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải chỉ số cơ bản.");
        return response.json() as Promise<{
          data: { symbol: string; pe: string | null; pb: string | null }[];
        }>;
      })
      .then((body) => {
        setValues((current) => {
          const next = { ...current };
          body.data.forEach((item) => {
            next[item.symbol] = { pe: item.pe, pb: item.pb };
          });
          return next;
        });
      })
      .catch(() => {
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
      });

    return () => controller.abort();
  }, [symbolsKey]);

  return values;
}
