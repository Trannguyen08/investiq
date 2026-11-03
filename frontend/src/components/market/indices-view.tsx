"use client";

import Link from "next/link";
import { changeTone, formatChange, formatCompact, formatMoney, formatPercent } from "@/components/market/formatters";
import { INDEX_DETAIL_CHART_LIMITS, MarketCandlestickChart } from "@/components/market/market-candlestick-chart";
import { mergeLiveIndex } from "@/components/market/live-market";
import { IndexAnalyticsPanel } from "@/components/market/index-analytics-panel";
import { useMarketStreamState } from "@/hooks/use-realtime-price";
import type { IndexCollection } from "@/types/market";

export function IndicesView({
  collection,
  selected,
}: {
  collection: IndexCollection;
  selected: string;
}) {
  const stream = useMarketStreamState();
  const rows = collection.data.map((item) => mergeLiveIndex(item, stream.items[item.symbol]));
  const current = rows.find((item) => item.symbol === selected) ?? rows[0];

  return (
    <section className="market-tab-panel">
      <div className="market-index-selector">
        {rows.map((item) => (
          <Link
            className={`${item.symbol === current?.symbol ? "active" : ""} index-${changeTone(item.change_percent)}`}
            href={`/market/indices?symbol=${item.symbol}`}
            key={item.symbol}
          >
            <span>{item.name}</span>
            <strong className={changeTone(item.change_percent)}>{formatChange(item.value)}</strong>
            <small className={changeTone(item.change_percent)}>{formatPercent(item.change_percent)}</small>
          </Link>
        ))}
      </div>

      {current && (
        <article className="index-detail">
          <div className="index-detail-heading">
            <div className="index-detail-identity">
              <p className="eyebrow">{current.symbol}</p>
              <h2>{current.name}</h2>
              <strong className={changeTone(current.change_percent)}>{formatChange(current.value)}</strong>
              <span className={changeTone(current.change_percent)}>
                {formatChange(current.change)} · {formatPercent(current.change_percent)}
              </span>
            </div>
            <div className="index-detail-chart-note">
              <strong>Diễn biến từng phiên</strong>
              <span>{Math.min(current.candles.length, INDEX_DETAIL_CHART_LIMITS.maximum)} nến ngày gần nhất</span>
            </div>
          </div>

          <div className="index-detail-chart">
            <MarketCandlestickChart
              candles={current.candles}
              label={`Biểu đồ nến chi tiết ${current.name}`}
              range="year"
              explain
              minimumCandles={INDEX_DETAIL_CHART_LIMITS.minimum}
              maximumCandles={INDEX_DETAIL_CHART_LIMITS.maximum}
            />
          </div>

          <dl className="index-detail-stats">
            <div>
              <dt>Mở cửa</dt>
              <dd>{formatChange(current.open_value)}</dd>
            </div>
            <div>
              <dt>Cao nhất</dt>
              <dd>{formatChange(current.high_value)}</dd>
            </div>
            <div>
              <dt>Thấp nhất</dt>
              <dd>{formatChange(current.low_value)}</dd>
            </div>
            <div>
              <dt>Khối lượng</dt>
              <dd>{formatCompact(current.volume)}</dd>
            </div>
            <div>
              <dt>Giá trị GD</dt>
              <dd>{formatMoney(current.matched_value)}</dd>
            </div>
            <div>
              <dt>Tăng / Giảm / Đứng</dt>
              <dd>
                <span className="positive">{current.advances}</span> /{" "}
                <span className="negative">{current.declines}</span> / {current.unchanged}
              </dd>
            </div>
          </dl>

          <IndexAnalyticsPanel currentIndex={current} allIndices={rows} />
        </article>
      )}
    </section>
  );
}
