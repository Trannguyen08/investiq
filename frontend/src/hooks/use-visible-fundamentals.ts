"use client";

import { useEffect, useRef, useState } from "react";

export type VisibleFundamentals = {
  pe: string | null;
  pb: string | null;
};

const BATCH_SIZE = 15;

export function useVisibleFundamentals(symbols: string[], preloadSymbols: string[] = []) {
  const [values, setValues] = useState<Record<string, VisibleFundamentals>>({});
  const completed = useRef(new Set<string>());
  const pending = useRef(new Map<string, Promise<VisibleFundamentalsResponse>>());
  const symbolsKey = symbols.join(",");
  const preloadKey = preloadSymbols.join(",");

  useEffect(() => {
    const candidates = [...new Set(`${symbolsKey},${preloadKey}`.split(",").filter(Boolean))];
    if (!candidates.some((symbol) => !completed.current.has(symbol))) return;
    let active = true;

    async function loadBatches() {
      for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
        if (!active) return;
        const missing = candidates
          .slice(offset, offset + BATCH_SIZE)
          .filter((symbol) => !completed.current.has(symbol));
        if (!missing.length) continue;
        const batchKey = missing.join(",");
        let request = pending.current.get(batchKey);
        if (!request) {
          request = fetch(`/market-data-api/fundamentals?symbols=${encodeURIComponent(batchKey)}`, {
            cache: "no-store",
          }).then(async (response) => {
            if (!response.ok) throw new Error("Không thể tải chỉ số cơ bản.");
            return response.json() as Promise<VisibleFundamentalsResponse>;
          });
          pending.current.set(batchKey, request);
        }
        try {
          const body = await request;
          if (!active) return;
          const received = new Map(body.data.map((item) => [item.symbol, item]));
          missing.forEach((symbol) => completed.current.add(symbol));
          setValues((current) => {
            const next = { ...current };
            missing.forEach((symbol) => {
              const item = received.get(symbol);
              next[symbol] = { pe: item?.pe ?? null, pb: item?.pb ?? null };
            });
            return next;
          });
        } catch {
          if (!active) return;
          setValues((current) => {
            const next = { ...current };
            missing.forEach((symbol) => {
              next[symbol] = { pe: null, pb: null };
            });
            return next;
          });
        } finally {
          if (pending.current.get(batchKey) === request) pending.current.delete(batchKey);
        }
      }
    }
    void loadBatches();

    return () => { active = false; };
  }, [preloadKey, symbolsKey]);

  return values;
}

type VisibleFundamentalsResponse = {
  data: { symbol: string; pe: string | null; pb: string | null }[];
};
