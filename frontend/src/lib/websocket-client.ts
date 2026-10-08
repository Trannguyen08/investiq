export type MarketStreamEvent = {
  version: "1";
  event_id: string;
  type: "hello" | "snapshot" | "heartbeat" | "quote";
  timestamp: string;
  data: Record<string, unknown>;
};

export function marketWebSocketUrl() {
  if (typeof window === "undefined") return "";
  const configuredUrl = process.env.NEXT_PUBLIC_MARKET_WS_URL;
  if (configuredUrl) return configuredUrl;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port === "3000") {
    return `${protocol}//${window.location.hostname}:8000/ws/v1/market`;
  }
  return `${protocol}//${window.location.host}/ws/v1/market`;
}

export function isMarketStreamEvent(value: unknown): value is MarketStreamEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return event.version === "1"
    && typeof event.event_id === "string"
    && ["hello", "snapshot", "heartbeat", "quote"].includes(String(event.type))
    && typeof event.timestamp === "string"
    && Boolean(event.data)
    && typeof event.data === "object";
}
