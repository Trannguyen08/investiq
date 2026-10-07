import { describe, expect, it } from "vitest";

import { isMarketStreamEvent, marketWebSocketUrl } from "@/lib/websocket-client";

describe("market WebSocket URL", () => {
  it("connects directly to the backend while the frontend runs locally", () => {
    window.history.replaceState({}, "", "http://localhost:3000/market/stocks");

    expect(marketWebSocketUrl()).toBe("ws://localhost:8000/ws/v1/market");
  });
});

describe("market WebSocket contract", () => {
  it("accepts a versioned snapshot envelope", () => {
    expect(
      isMarketStreamEvent({
        version: "1",
        event_id: "event-1",
        type: "snapshot",
        timestamp: "2026-10-06T08:00:00Z",
        data: { sequence: 1, items: [] },
      }),
    ).toBe(true);
  });

  it("rejects unknown event types and malformed data", () => {
    expect(
      isMarketStreamEvent({
        version: "1",
        event_id: "event-2",
        type: "provider-secret",
        timestamp: "2026-10-06T08:00:00Z",
        data: {},
      }),
    ).toBe(false);
    expect(isMarketStreamEvent({ version: "1", data: null })).toBe(false);
  });
});
