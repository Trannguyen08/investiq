import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StockIntradayTable } from "@/components/market/stock-intraday-table";
import type { MarketMeta } from "@/types/market";

const meta: MarketMeta = {
  schema_version: "1",
  provider: "vnstock-kbs",
  provider_name: "Vnstock · KBS",
  market_time: "2026-10-12T07:45:06Z",
  received_at: "2026-10-12T07:45:10Z",
  delay_class: "source_delayed",
  freshness: "fresh",
  session: "closed",
  partial: true,
  market_timezone: "Asia/Ho_Chi_Minh",
};

describe("StockIntradayTable", () => {
  afterEach(() => cleanup());

  it("shows resting depth and a provider-classified execution tape", () => {
    render(<StockIntradayTable symbol="FPT" meta={meta}
      bidLevels={[{ price: "57100", volume: "147400" }]}
      askLevels={[{ price: "57300", volume: "618200" }]}
      trades={[
        { timestamp: "2026-10-12T07:29:53Z", price: "57200", volume: "400", match_side: "buy", change: "100", change_percent: "0.18" },
        { timestamp: "2026-10-12T07:29:54Z", price: "57100", volume: "200", match_side: "sell", change: "0", change_percent: "0" },
      ]} />);

    expect(screen.getByRole("table", { name: "Giao dịch trong ngày của FPT" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Độ sâu thị trường của FPT" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Biểu đồ độ sâu ba mức của FPT" })).toBeInTheDocument();
    expect(screen.getByText("+0,18%")).toBeInTheDocument();
    expect(screen.getByText(/M\/B là phía chủ động/)).toBeInTheDocument();
  });

  it("shows an honest empty state when the provider has no intraday trades", () => {
    render(<StockIntradayTable symbol="FPT" meta={meta} trades={[]} bidLevels={[]} askLevels={[]} />);

    expect(screen.getByText(/chưa trả dữ liệu khớp lệnh/)).toBeInTheDocument();
    expect(screen.getByText(/chưa trả dữ liệu lệnh đang chờ/)).toBeInTheDocument();
  });
});
