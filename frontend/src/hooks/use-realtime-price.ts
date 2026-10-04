"use client";

import { useEffect, useMemo, useState } from "react";

import { isMarketStreamEvent, marketWebSocketUrl } from "@/lib/websocket-client";

type ConnectionState = "connecting" | "connected" | "disconnected" | "unavailable";

export function useMarketStream(symbols: string[]) {
  const subscriptionKey = useMemo(
    () => [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].slice(0, 20).join(","),
    [symbols],
  );
  const [state, setState] = useState<ConnectionState>("connecting");
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

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
        setState("connected");
        socket?.send(JSON.stringify({ type: "subscribe", symbols: subscription }));
      });
      socket.addEventListener("message", (event) => {
        try {
          const value: unknown = JSON.parse(String(event.data));
          if (isMarketStreamEvent(value)) setLastUpdate(value.timestamp);
        } catch {
          setState("unavailable");
        }
      });
      socket.addEventListener("close", (event) => {
        if (closed) return;
        setState(event.code === 1013 ? "unavailable" : "disconnected");
        attempt += 1;
        reconnect = setTimeout(connect, Math.min(10_000, 500 * 2 ** attempt));
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

  return { state, lastUpdate };
}
