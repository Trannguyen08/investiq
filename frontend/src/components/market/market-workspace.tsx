"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import {
  changeTone,
  formatChange,
  formatCompact,
  formatMoney,
  formatPercent,
  formatRatioPair,
  priceTone,
} from "@/components/market/formatters";
import { MarketStatus } from "@/components/market/market-status";
import { MiniCandles } from "@/components/market/mini-candles";
import { mergeLiveInstrument } from "@/components/market/live-market";
import { WatchlistPanel } from "@/components/market/watchlist-panel";
import { EcosystemGraph } from "@/components/market/ecosystem-graph";
import { MarketStreamProvider, useMarketStreamState } from "@/hooks/use-realtime-price";
import { useVisibleFundamentals } from "@/hooks/use-visible-fundamentals";
import { marketPath, type MarketTab } from "@/lib/market-routes";
import { Pagination, encodeCursor } from "@/components/ui/pagination";
import type {
  EcosystemDetailData,
  EcosystemSummary,
  InstrumentCollection,
  MarketMeta,
} from "@/types/market";

export { IndicesView } from "./indices-view";
export { EventsView } from "./events-view";
export { PeopleView } from "./people-view";

const tabs: { value: MarketTab; label: string }[] = [
  { value: "stocks", label: "Cổ phiếu" },
  { value: "indices", label: "Chỉ số" },
  { value: "events", label: "Sự kiện" },
  { value: "people", label: "Doanh nhân" },
  { value: "ecosystems", label: "Hệ sinh thái" },
];

export function MarketShell({
  tab,
  meta,
  symbols,
  children,
}: {
  tab: MarketTab;
  meta: MarketMeta;
  symbols: string[];
  children: ReactNode;
}) {
  return (
    <MarketStreamProvider symbols={symbols}>
      <main id="main-content" className="market-page max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 text-slate-100">
        <header className="market-page-hero flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-sm">
          <div>
            <p className="eyebrow text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">INVESTIQ MARKET</p>
            <h1 className="text-2xl sm:text-3xl font-black text-white m-0 tracking-tight">Trung tâm thị trường</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5 m-0">Dữ liệu giá, chỉ số, sự kiện và bối cảnh được trình bày cùng nguồn và thời điểm.</p>
          </div>
          <MarketStatus meta={meta} />
        </header>

        <nav className="market-tabs flex items-center gap-1.5 sm:gap-2 overflow-x-auto border-b border-slate-800 pb-2.5 scrollbar-none" aria-label="Các mục thị trường">
          {tabs.map((item) => (
            <Link
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition border ${
                item.value === tab
                  ? "active bg-sky-500/15 text-sky-300 border-sky-500/35 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent"
              }`}
              aria-current={item.value === tab ? "page" : undefined}
              href={marketPath(item.value)}
              prefetch={false}
              key={item.value}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {children}

        {meta.freshness === "fixture" && (
          <p className="market-fixture-note">
            Toàn bộ số liệu trong màn hình này là dữ liệu minh họa phục vụ phát triển, không phải dữ liệu giao dịch hiện tại.
          </p>
        )}
      </main>
    </MarketStreamProvider>
  );
}

function stockPageHref(filters: Record<string, string>, cursor: string | null) {
  const query = new URLSearchParams(filters);
  if (cursor) query.set("cursor", cursor);
  else query.delete("cursor");
  return `/market/stocks?${query.toString()}`;
}

export function StocksView({
  collection,
  filters,
}: {
  collection: InstrumentCollection;
  filters: Record<string, string>;
}) {
  const stream = useMarketStreamState();
  const rows = collection.data.map((item) => mergeLiveInstrument(item, stream.items[item.symbol]));
  const fundamentalsBySymbol = useVisibleFundamentals(
    rows.filter((item) => item.pe === null || item.pb === null).map((item) => item.symbol)
  );

  return (
    <section className="market-tab-panel">
      <div className="market-tab-heading">
        <div>
          <h2>Bảng giá cổ phiếu</h2>
          <p>{collection.pagination.total_items} mã · 15 mã mỗi trang · VN30 hiển thị trước.</p>
        </div>
        <span className="table-preset">Ưu tiên VN30</span>
      </div>

      <form className="stock-filter" action="/market/stocks">
        <label>
          Tìm mã hoặc công ty
          <input name="q" defaultValue={filters.q} placeholder="Ví dụ: FPT, Hòa Phát" />
        </label>
        <label>
          Sàn
          <select name="exchange" defaultValue={filters.exchange}>
            <option value="">Tất cả sàn</option>
            <option value="HOSE">HOSE</option>
            <option value="HNX">HNX</option>
            <option value="UPCOM">UPCoM</option>
          </select>
        </label>
        <label>
          Sắp xếp
          <select name="sort" defaultValue={filters.sort}>
            <option value="vn30">VN30 trước</option>
            <option value="symbol">Mã</option>
            <option value="trending">Thanh khoản nổi bật</option>
            <option value="change_percent">% thay đổi</option>
            <option value="matched_value">Giá trị giao dịch</option>
            <option value="market_cap">Vốn hóa</option>
          </select>
        </label>
        <label>
          Thứ tự
          <select name="direction" defaultValue={filters.direction}>
            <option value="desc">Giảm dần</option>
            <option value="asc">Tăng dần</option>
          </select>
        </label>
        <button type="submit">Áp dụng</button>
      </form>

      <div className="market-table-wrap">
        <table className="market-table stock-table">
          <thead>
            <tr>
              <th>Mã / Công ty</th>
              <th>Giá</th>
              <th>Thay đổi</th>
              <th>Mở · Cao · Thấp</th>
              <th>Khối lượng</th>
              <th>GTGD</th>
              <th>So TB20</th>
              <th>Khối ngoại ròng</th>
              <th>Vốn hóa</th>
              <th>P/E / P/B</th>
              <th>Biểu đồ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const fundamentals = fundamentalsBySymbol[item.symbol];
              const ratiosLoading = (item.pe === null || item.pb === null) && fundamentals === undefined;
              return (
                <tr className={item.is_vn30 ? "vn30-row" : undefined} key={item.symbol}>
                  <td className="stock-identity">
                    <div>
                      <Link href={`/market/stocks/${item.symbol}`}>{item.symbol}</Link>
                      {item.is_vn30 && <span className="vn30-badge">VN30</span>}
                    </div>
                    <span>{item.name}</span>
                    <small>{item.exchange} · {item.sector}</small>
                  </td>
                  <td>
                    <strong className={priceTone(item.price, item.reference_price, item.ceiling_price, item.floor_price)}>
                      {formatChange(item.price)}
                    </strong>
                    <small className="price-reference">TC {formatChange(item.reference_price)}</small>
                  </td>
                  <td className={changeTone(item.change_percent)}>
                    <strong>{formatPercent(item.change_percent)}</strong>
                    <small>{formatChange(item.change)}</small>
                  </td>
                  <td>
                    <span className={priceTone(item.open_price, item.reference_price, item.ceiling_price, item.floor_price)}>
                      {formatChange(item.open_price)}
                    </span> ·{" "}
                    <span className={priceTone(item.high_price, item.reference_price, item.ceiling_price, item.floor_price)}>
                      {formatChange(item.high_price)}
                    </span> ·{" "}
                    <span className={priceTone(item.low_price, item.reference_price, item.ceiling_price, item.floor_price)}>
                      {formatChange(item.low_price)}
                    </span>
                  </td>
                  <td>{formatCompact(item.volume)}</td>
                  <td>{formatMoney(item.matched_value)}</td>
                  <td>{item.volume_vs_20d !== null ? `${item.volume_vs_20d}×` : "—"}</td>
                  <td className={changeTone(item.foreign_net_value)}>{formatMoney(item.foreign_net_value)}</td>
                  <td>{formatMoney(item.market_cap)}</td>
                  <td className="fundamental-ratios">
                    {formatRatioPair(fundamentals?.pe ?? item.pe, fundamentals?.pb ?? item.pb, ratiosLoading)}
                  </td>
                  <td className="table-chart">
                    <Link href={`/market/stocks/${item.symbol}`} aria-label={`Xem biểu đồ và chi tiết ${item.symbol}`}>
                      <MiniCandles candles={item.candles} label={`Nến ngày ${item.symbol}`} />
                      <span>Xem chi tiết →</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!collection.data.length && (
        <div className="market-empty">
          <h3>Không tìm thấy cổ phiếu</h3>
          <p>Thử bỏ bớt bộ lọc hoặc tìm bằng mã khác.</p>
        </div>
      )}

      {collection.data.length > 0 && (
        <Pagination
          currentPage={collection.pagination.page}
          totalPages={Math.max(1, collection.pagination.total_pages)}
          totalItems={collection.pagination.total_items}
          pageSize={collection.pagination.limit || 15}
          itemLabel="mã cổ phiếu"
          getPageUrl={(targetPage) => {
            const limit = collection.pagination.limit || 15;
            let cursor: string | null = null;
            if (targetPage === collection.pagination.page + 1 && collection.pagination.next_cursor) {
              cursor = collection.pagination.next_cursor;
            } else if (targetPage === collection.pagination.page - 1 && collection.pagination.previous_cursor) {
              cursor = collection.pagination.previous_cursor;
            } else if (targetPage > 1) {
              cursor = encodeCursor((targetPage - 1) * limit);
            }
            return stockPageHref(filters, cursor);
          }}
          ariaLabel="Phân trang cổ phiếu"
        />
      )}
    </section>
  );
}

export function WatchlistView({ instruments }: { instruments: InstrumentCollection }) {
  return (
    <section className="market-tab-panel watchlist-panel">
      <WatchlistPanel instruments={instruments.data} />
    </section>
  );
}

export function EcosystemsView({
  initialEcosystems,
  initialEcoId,
  initialDetail,
}: {
  initialEcosystems?: EcosystemSummary[];
  initialEcoId?: string;
  initialDetail?: EcosystemDetailData | null;
}) {
  return (
    <section className="market-tab-panel ecosystems-view">
      <EcosystemGraph
        initialEcosystemId={initialEcoId}
        initialEcosystems={initialEcosystems}
        initialDetail={initialDetail}
      />
    </section>
  );
}
