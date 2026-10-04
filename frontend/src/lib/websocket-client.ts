export type MarketStreamEvent = {
  version: "1";
  event_id: string;
  type: "hello" | "snapshot" | "heartbeat" | "quote";
  timestamp: string;
  data: Record<string, unknown>;
};

export function marketWebSocketUrl() {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/v1/market`;
}

export function isMarketStreamEvent(value: unknown): value is MarketStreamEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return event.version === "1"
    && typeof event.event_id === "string"
    && typeof event.type === "string"
    && typeof event.timestamp === "string"
    && Boolean(event.data)
    && typeof event.data === "object";
}
