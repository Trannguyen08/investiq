import { changeTone, formatChange, formatCompact, formatDecimal, formatPercent } from "@/components/market/formatters";
import type { MarketDepthLevel, MarketIntradayTrade, MarketMeta } from "@/types/market";

const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function sideLabel(side: MarketIntradayTrade["match_side"]) {
  if (side === "buy") return "M";
  if (side === "sell") return "B";
  if (side === "ato") return "ATO";
  if (side === "atc") return "ATC";
  return "—";
}

function sumVolume(levels: MarketDepthLevel[]) {
  return levels.reduce((total, level) => total + Number(level.volume), 0);
}

export function StockIntradayTable({
  symbol,
  trades,
  bidLevels,
  askLevels,
  meta,
}: {
  symbol: string;
  trades: MarketIntradayTrade[];
  bidLevels: MarketDepthLevel[];
  askLevels: MarketDepthLevel[];
  meta: MarketMeta;
}) {
  const depthRows = Array.from(
    { length: Math.max(bidLevels.length, askLevels.length) },
    (_, index) => ({ bid: bidLevels[index], ask: askLevels[index] }),
  );
  const bidTotal = sumVolume(bidLevels);
  const askTotal = sumVolume(askLevels);
  const depthTotal = bidTotal + askTotal;
  const maxDepth = Math.max(
    ...bidLevels.map((level) => Number(level.volume)),
    ...askLevels.map((level) => Number(level.volume)),
    1,
  );
  const totalMatched = trades.reduce((total, trade) => total + Number(trade.volume), 0);
  const buyMatched = trades.reduce(
    (total, trade) => total + (trade.match_side === "buy" ? Number(trade.volume) : 0),
    0,
  );
  const sellMatched = trades.reduce(
    (total, trade) => total + (trade.match_side === "sell" ? Number(trade.volume) : 0),
    0,
  );

  return (
    <section className="stock-intraday-card" aria-labelledby="stock-intraday-title">
      <header>
        <div>
          <p className="eyebrow">THỐNG KÊ GIAO DỊCH TRONG NGÀY</p>
          <h2 id="stock-intraday-title">Độ sâu thị trường · Khớp lệnh</h2>
          <p>Ba mức giá chờ tốt nhất và {trades.length} giao dịch gần nhất của {symbol}.</p>
        </div>
        <span>{meta.delay_class}</span>
      </header>

      <div className="stock-trading-statistics">
        <section className="market-depth-panel" aria-labelledby="market-depth-title">
          <div className="trading-panel-heading">
            <h3 id="market-depth-title">Độ sâu thị trường</h3>
            <span>Tối đa 3 mức mỗi bên</span>
          </div>
          {depthRows.length ? <>
            <table aria-label={`Độ sâu thị trường của ${symbol}`}>
              <thead><tr><th>KL mua</th><th>Giá mua</th><th>Giá bán</th><th>KL bán</th></tr></thead>
              <tbody>{depthRows.map(({ bid, ask }, index) => <tr key={index}>
                <td>{bid ? formatCompact(bid.volume) : "—"}</td>
                <td className="depth-bid">{bid ? formatDecimal(bid.price) : "—"}</td>
                <td className="depth-ask">{ask ? formatDecimal(ask.price) : "—"}</td>
                <td>{ask ? formatCompact(ask.volume) : "—"}</td>
              </tr>)}</tbody>
            </table>
            <div className="market-depth-balance" aria-label={`Tỷ trọng ba mức mua ${depthTotal ? Math.round(bidTotal / depthTotal * 100) : 0} phần trăm`}>
              <i style={{ width: `${depthTotal ? bidTotal / depthTotal * 100 : 50}%` }} />
            </div>
            <div className="market-depth-totals">
              <span>Dư mua 3 mức: <strong>{formatCompact(String(bidTotal))}</strong></span>
              <span>Dư bán 3 mức: <strong>{formatCompact(String(askTotal))}</strong></span>
            </div>
            <div className="market-depth-chart" role="img" aria-label={`Biểu đồ độ sâu ba mức của ${symbol}`}>
              {depthRows.map(({ bid, ask }, index) => <div className="market-depth-chart-row" key={index}>
                <div className="depth-bar-side bid"><i style={{ width: `${bid ? Number(bid.volume) / maxDepth * 100 : 0}%` }} /></div>
                <span>{bid?.price ? formatDecimal(bid.price) : "—"}</span>
                <span>{ask?.price ? formatDecimal(ask.price) : "—"}</span>
                <div className="depth-bar-side ask"><i style={{ width: `${ask ? Number(ask.volume) / maxDepth * 100 : 0}%` }} /></div>
              </div>)}
            </div>
          </> : <div className="market-empty compact"><p>Nguồn hiện tại chưa trả dữ liệu lệnh đang chờ cho mã này.</p></div>}
        </section>

        <section className="matched-tape-panel" aria-labelledby="matched-tape-title">
          <div className="trading-panel-heading matched">
            <h3 id="matched-tape-title">Khớp lệnh</h3>
            <p><span>KL: <strong>{formatCompact(String(totalMatched))}</strong></span><span className="buy">M: <strong>{formatCompact(String(buyMatched))}</strong></span><span className="sell">B: <strong>{formatCompact(String(sellMatched))}</strong></span></p>
          </div>
          {trades.length ? (
            <div className="stock-intraday-table-wrap">
              <table aria-label={`Giao dịch trong ngày của ${symbol}`}>
                <thead><tr><th>Thời gian</th><th>KL</th><th>Giá</th><th>+/-</th><th>+/-%</th><th>M/B</th></tr></thead>
                <tbody>{[...trades].reverse().map((trade, index) => {
                  const tone = trade.change === null ? "neutral" : changeTone(trade.change);
                  return <tr key={`${trade.timestamp}-${trade.price}-${trade.volume}-${index}`}>
                    <td><time dateTime={trade.timestamp}>{timeFormat.format(new Date(trade.timestamp))}</time></td>
                    <td>{formatCompact(trade.volume)}</td>
                    <td className={tone}>{formatDecimal(trade.price)}</td>
                    <td className={tone}>{trade.change === null ? "—" : formatChange(trade.change)}</td>
                    <td className={tone}>{trade.change_percent === null ? "—" : formatPercent(trade.change_percent)}</td>
                    <td className={`matched-side ${trade.match_side}`}>{sideLabel(trade.match_side)}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          ) : <div className="market-empty compact"><p>Nguồn hiện tại chưa trả dữ liệu khớp lệnh trong phiên cho mã này.</p></div>}
        </section>
      </div>

      <footer>
        <span>Nguồn: {meta.provider_name} · {meta.delay_class}</span>
        <span>Độ sâu chỉ gồm các mức chờ mua/bán nguồn đang công bố; M/B là phía chủ động tại giao dịch đã khớp. Các tổng khớp lệnh chỉ tính trên mẫu {trades.length} giao dịch đang hiển thị.</span>
      </footer>
    </section>
  );
}
