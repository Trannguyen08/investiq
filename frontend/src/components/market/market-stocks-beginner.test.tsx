import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StocksView } from "@/components/market/market-stocks-beginner";
import type { InstrumentCollection, MarketIndex, MarketInstrument } from "@/types/market";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const instrument: MarketInstrument = {
  symbol: "FPT",
  name: "Công ty Cổ phần FPT",
  exchange: "HOSE",
  sector: "Công nghệ Thông tin",
  price: "100000",
  reference_price: "99000",
  ceiling_price: "106000",
  floor_price: "92000",
  open_price: "99500",
  high_price: "101000",
  low_price: "98500",
  change: "1000",
  change_percent: "1.01",
  volume: "1000000",
  matched_value: "100000000000",
  foreign_net_value: "1000000000",
  market_cap: "150000000000000",
  pe: null,
  pb: null,
  eps: null,
  roe_percent: null,
  volume_vs_20d: "1",
  interest_score: "1",
  interest_reasons: [],
  is_vn30: true,
  candles: [],
};

const meta = {
  schema_version: "1",
  provider: "vnstock-kbs",
  provider_name: "Vnstock · nguồn KBS",
  market_time: "2026-10-07T00:00:00Z",
  received_at: "2026-10-07T00:00:01Z",
  delay_class: "source_delayed",
  freshness: "fresh" as const,
  session: "closed",
  partial: true,
  market_timezone: "Asia/Ho_Chi_Minh",
};

const collection: InstrumentCollection = {
  data: [instrument],
  pagination: { next_cursor: null, previous_cursor: null, has_more: false, limit: 15, total_items: 1, page: 1, total_pages: 1 },
  meta,
};

const index: MarketIndex = {
  symbol: "VNINDEX",
  name: "VN-Index",
  value: "1800",
  reference_value: "1790",
  open_value: "1795",
  high_value: "1810",
  low_value: "1780",
  change: "10",
  change_percent: "0.56",
  volume: "1000",
  matched_value: "1000000",
  advances: 1,
  declines: 0,
  unchanged: 0,
  ceiling_count: 0,
  floor_count: 0,
  candles: [],
};

describe("StocksView navigation", () => {
  beforeEach(() => push.mockReset());
  afterEach(cleanup);

  it("uses App Router navigation when a stock row is clicked", () => {
    render(<StocksView collection={collection} summary={collection} filters={{ q: "", exchange: "", sort: "vn30", direction: "desc", mode: "basic" }} selected="" selectedCandles={[]} index={index} />);

    fireEvent.click(screen.getByRole("row", { name: /FPT/ }));

    expect(push).toHaveBeenCalledWith(expect.stringContaining("selected=FPT"));
  });

  it("supports opening the row with the keyboard", () => {
    render(<StocksView collection={collection} summary={collection} filters={{ q: "", exchange: "", sort: "vn30", direction: "desc", mode: "basic" }} selected="" selectedCandles={[]} index={index} />);

    fireEvent.keyDown(screen.getByRole("row", { name: /FPT/ }), { key: "Enter" });

    expect(push).toHaveBeenCalledWith(expect.stringContaining("selected=FPT"));
  });
});
