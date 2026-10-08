"use client";

import { createContext, createElement, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

import { isMarketStreamEvent, marketWebSocketUrl } from "@/lib/websocket-client";

type ConnectionState = "connecting" | "connected" | "disconnected" | "unavailable";
type LiveItem = Record<string, unknown> & { symbol: string };

export type MarketStreamState = {
  state: ConnectionState;
  lastUpdate: string | null;
  items: Record<string, LiveItem>;
};

const emptyState: MarketStreamState = {
  state: "unavailable",
  lastUpdate: null,
  items: {},
};

const MarketStreamContext = createContext<MarketStreamState>(emptyState);

function streamItems(value: unknown): LiveItem[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const items: LiveItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (typeof row.symbol !== "string" || !/^[A-Z0-9._-]{1,24}$/.test(row.symbol)) return null;
    items.push({ ...row, symbol: row.symbol });
  }
  return items;
}

export function useMarketStream(symbols: string[]): MarketStreamState {
  const subscriptionKey = useMemo(
    () => [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].slice(0, 20).join(","),
    [symbols],
  );
  const [state, setState] = useState<ConnectionState>(
    subscriptionKey ? "connecting" : "unavailable",
  );
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, LiveItem>>({});
  const eventIds = useRef<string[]>([]);
  const lastSequence = useRef(0);

  useEffect(() => {
    if (!subscriptionKey) return;
    const subscription = subscriptionKey.split(",");
    let socket: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let attempt = 0;

    const connect = () => {
      setState("connecting");
      socket = new WebSocket(marketWebSocketUrl());
      socket.addEventListener("open", () => {
        attempt = 0;
        lastSequence.current = 0;
        setState("connected");
        socket?.send(JSON.stringify({ type: "subscribe", symbols: subscription }));
      });
      socket.addEventListener("message", (event) => {
        try {
          const value: unknown = JSON.parse(String(event.data));
          if (!isMarketStreamEvent(value)) return;
          if (eventIds.current.includes(value.event_id)) return;
          eventIds.current = [...eventIds.current.slice(-99), value.event_id];
          setLastUpdate(value.timestamp);
          if (value.type !== "snapshot" && value.type !== "quote") return;
          const sequence = value.data.sequence;
          const receivedItems = streamItems(value.data.items);
          if (typeof sequence !== "number" || !Number.isSafeInteger(sequence) || !receivedItems) {
            socket?.close(1008, "Invalid market event");
            return;
          }
          if (value.type === "quote" && sequence !== lastSequence.current + 1) {
            socket?.close(4000, "Sequence gap");
            return;
          }
          lastSequence.current = sequence;
          setItems((current) => {
            const next = value.type === "snapshot" ? {} : { ...current };
            for (const item of receivedItems) next[item.symbol] = item;
            return next;
          });
        } catch {
          socket?.close(1008, "Invalid market event");
        }
      });
      socket.addEventListener("close", (event) => {
        if (closed) return;
        setState(event.code === 1013 ? "unavailable" : "disconnected");
        attempt += 1;
        reconnect = setTimeout(connect, Math.min(30_000, 500 * 2 ** Math.min(attempt, 6)));
      });
      socket.addEventListener("error", () => setState("unavailable"));
    };

    connect();
    return () => {
      closed = true;
      if (reconnect) clearTimeout(reconnect);
      socket?.close(1000, "View closed");
    };
  }, [subscriptionKey]);

  return { state, lastUpdate, items };
}

export function MarketStreamProvider({
  symbols,
  children,
}: {
  symbols: string[];
  children: ReactNode;
}) {
  const stream = useMarketStream(symbols);
  return createElement(MarketStreamContext.Provider, { value: stream }, children);
}

export function useMarketStreamState(): MarketStreamState {
  return useContext(MarketStreamContext);
}
