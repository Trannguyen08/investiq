"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { InfoTip, MarketColorLegend, MarketLineChart } from "@/components/market/beginner-market-ui";
import { changeTone, formatChange, formatCompact, formatMoney, formatPercent } from "@/components/market/formatters";
import { mergeLiveInstrument } from "@/components/market/live-market";
import { MarketCandlestickChart } from "@/components/market/market-candlestick-chart";
import { useMarketStreamState } from "@/hooks/use-realtime-price";
import type { InstrumentCollection, MarketCandle, MarketIndex, MarketInstrument } from "@/types/market";

type StocksViewProps = {
  collection: InstrumentCollection;
  summary: InstrumentCollection;
  filters: Record<string, string>;
  selected: string;
  selectedCandles: MarketCandle[];
  index: MarketIndex | undefined;
};

type SectorSummary = {
  name: string;
  value: number;
  strength: number;
  change: number;
  members: MarketInstrument[];
};

function hrefWith(filters: Record<string, string>, changes: Record<string, string | null>) {
  const query = new URLSearchParams(filters);
  for (const [key, value] of Object.entries(changes)) {
    if (value) query.set(key, value);
    else query.delete(key);
  }
  return `/market/stocks?${query.toString()}`;
}

function companyActivity(item: MarketInstrument) {
  if (!item.sector || item.sector === "Chưa phân loại") return "Chưa có mô tả ngành";
  return `Hoạt động trong ngành ${item.sector.toLocaleLowerCase("vi-VN")}`;
}

function volatility(value: string) {
  const amount = Math.abs(Number(value));
  if (amount < 1) return { label: "Thấp", tone: "low" };
  if (amount < 3) return { label: "Vừa", tone: "medium" };
  return { label: "Cao", tone: "high" };
}

function sectorSummaries(items: MarketInstrument[]) {
  const groups = new Map<string, MarketInstrument[]>();
  for (const item of items) groups.set(item.sector || "Chưa phân loại", [...(groups.get(item.sector || "Chưa phân loại") ?? []), item]);
  return [...groups].map(([name, members]): SectorSummary => {
    const value = members.reduce((sum, item) => sum + Math.max(Number(item.market_cap), Number(item.matched_value), 0), 0);
    const matched = members.reduce((sum, item) => sum + Math.max(Number(item.matched_value), 0), 0);
    const strength = members.reduce((sum, item) => sum + Number(item.matched_value) * Number(item.change_percent) / 100, 0);
    const change = matched ? members.reduce((sum, item) => sum + Number(item.change_percent) * Number(item.matched_value), 0) / matched : 0;
    return { name, value, strength, change, members };
  }).sort((a, b) => b.value - a.value);
}

function reasonFor(item: MarketInstrument, kind: "gain" | "loss" | "liquidity") {
  if (kind === "liquidity") return `Giao dịch ${formatMoney(item.matched_value)} trong phạm vi dữ liệu hiện có.`;
  const movement = kind === "gain" ? "tăng" : "giảm";
  const magnitude = formatPercent(String(Math.abs(Number(item.change_percent)))).replace("+", "");
  return `Giá đang ${movement} ${magnitude}; chưa có tin đã kiểm chứng để kết luận nguyên nhân.`;
}

function TopList({ title, items, kind, filters }: { title: string; items: MarketInstrument[]; kind: "gain" | "loss" | "liquidity"; filters: Record<string, string> }) {
  return <article className="market-top-list"><h3>{title}</h3>{items.map((item) => <Link href={hrefWith(filters, { selected: item.symbol })} prefetch={false} key={`${kind}-${item.symbol}`}><div><strong>{item.symbol}</strong><span className={changeTone(item.change_percent)}>{formatPercent(item.change_percent)}</span></div><p>{reasonFor(item, kind)}</p></Link>)}</article>;
}

export function StocksView({ collection, summary, filters, selected, selectedCandles, index }: StocksViewProps) {
  const router = useRouter();
  const stream = useMarketStreamState();
  const rows = collection.data.map((item) => mergeLiveInstrument(item, stream.items[item.symbol]));
  const universe = summary.data.map((item) => mergeLiveInstrument(item, stream.items[item.symbol]));
  const sectors = sectorSummaries(universe);
  const sectorTotal = sectors.reduce((sum, item) => sum + item.value, 0) || 1;
  const chosen = [...rows, ...universe].find((item) => item.symbol === selected);
  const advanced = filters.mode === "advanced";
  const total = universe.length || 1;
  const advances = universe.filter((item) => Number(item.change_percent) > 0).length;
  const declines = universe.filter((item) => Number(item.change_percent) < 0).length;
  const unchanged = total - advances - declines;
  const liquidity = universe.reduce((sum, item) => sum + Number(item.matched_value), 0);
  const foreign = universe.reduce((sum, item) => sum + Number(item.foreign_net_value), 0);
  const topGain = [...universe].sort((a, b) => Number(b.change_percent) - Number(a.change_percent)).slice(0, 3);
  const topLoss = [...universe].sort((a, b) => Number(a.change_percent) - Number(b.change_percent)).slice(0, 3);
  const topLiquidity = [...universe].sort((a, b) => Number(b.matched_value) - Number(a.matched_value)).slice(0, 3);
  const summaryText = declines > advances
    ? `${Math.round(declines / total * 100)}% mã trong phạm vi đang giảm; thị trường nghiêng về thận trọng.`
    : `${Math.round(advances / total * 100)}% mã trong phạm vi đang tăng; sắc xanh đang chiếm ưu thế.`;

  return <section className="market-tab-panel beginner-market-page">
    <MarketColorLegend />
    <section className="market-summary-card">
      <div><p className="eyebrow">TÓM TẮT TRONG MỘT CÂU</p><h2>{summaryText}</h2><p>Phạm vi: {universe.length} cổ phiếu có giá trị giao dịch cao đang tải.</p><div className="market-mode-toggle" aria-label="Chọn mức độ chi tiết"><Link className={!advanced ? "active" : ""} href={hrefWith(filters, { mode: "basic", selected: null })} prefetch={false}>Cơ bản</Link><Link className={advanced ? "active" : ""} href={hrefWith(filters, { mode: "advanced", selected: null })} prefetch={false}>Nâng cao</Link></div></div>
      <div><div className="beginner-card-title"><strong>VN-Index</strong><span className={changeTone(index?.change_percent ?? "0")}>{formatPercent(index?.change_percent ?? "0")}</span></div>{advanced ? <MarketCandlestickChart candles={index?.candles ?? []} label="Biểu đồ nến VN-Index" /> : <MarketLineChart candles={index?.candles ?? []} label="Đường giá VN-Index" />}</div>
    </section>

    <div className="market-overview-layout">
      <section className="sector-heatmap" aria-labelledby="heatmap-title"><div className="beginner-card-title"><h2 id="heatmap-title">Ngành nào đang kéo thị trường?</h2><InfoTip term="Bản đồ nhiệt">Ô lớn thể hiện nhóm có quy mô hoặc giao dịch lớn hơn trong phạm vi. Màu cho biết mức tăng giảm bình quân có trọng số.</InfoTip></div><p>Nhìn ô lớn và màu sắc để nhận ra khu vực đang ảnh hưởng mạnh.</p><div className="heatmap-grid">{sectors.slice(0, 16).map((sector) => <article className={changeTone(String(sector.change))} style={{ flexGrow: Math.max(1, sector.value / sectorTotal * 100), flexBasis: `${Math.max(12, sector.value / sectorTotal * 100)}%` }} key={sector.name}><strong>{sector.name}</strong><span>{formatPercent(String(sector.change))}</span><small>{sector.members.length} mã</small></article>)}</div></section>
      <aside className="market-quick-facts"><article><div className="beginner-card-title"><h3>Bao nhiêu mã tăng/giảm?</h3><InfoTip term="Độ rộng">Đếm số mã tăng, giảm và đứng giá trong phạm vi dữ liệu đang hiển thị.</InfoTip></div><div className="beginner-breadth"><span className="advance" style={{ width: `${advances / total * 100}%` }} /><span className="unchanged" style={{ width: `${unchanged / total * 100}%` }} /><span className="decline" style={{ width: `${declines / total * 100}%` }} /></div><p><b className="positive">{advances} tăng</b> · {unchanged} đứng · <b className="negative">{declines} giảm</b></p></article><article><h3>Giao dịch có sôi động?</h3><strong>{formatMoney(String(liquidity))}</strong><p>Tổng giá trị của {universe.length} mã trong phạm vi, không phải toàn sàn.</p></article><article><h3>Khối ngoại mua hay bán?</h3><strong className={changeTone(String(foreign))}>{foreign >= 0 ? "Mua ròng" : "Bán ròng"} {formatMoney(String(Math.abs(foreign)))}</strong><p>Có thể là số ước tính tùy dữ liệu nguồn.</p></article></aside>
    </div>

    <section className="sector-flow" aria-labelledby="sector-flow-title"><div className="beginner-card-title"><h2 id="sector-flow-title">Sức mạnh giao dịch theo ngành</h2><InfoTip term="Sức mạnh giao dịch">Chỉ báo tương đối = giá trị giao dịch × % biến động. Đây không phải số tiền vào/ra ròng thực tế.</InfoTip></div><div>{sectors.slice(0, 10).map((sector) => { const maximum = Math.max(...sectors.map((item) => Math.abs(item.strength)), 1); const percent = Math.abs(sector.strength) / maximum * 50; return <article key={sector.name}><span>{sector.name}</span><div><i className={sector.strength >= 0 ? "inflow" : "outflow"} style={{ width: `${percent}%`, [sector.strength >= 0 ? "left" : "right"]: "50%" }} /></div><strong className={changeTone(String(sector.strength))}>{sector.strength >= 0 ? "+" : "−"}{formatMoney(String(Math.abs(sector.strength)))}</strong></article>; })}</div></section>

    <section className="market-top-grid" aria-label="Cổ phiếu nổi bật"><TopList title="Top tăng" items={topGain} kind="gain" filters={filters} /><TopList title="Top giảm" items={topLoss} kind="loss" filters={filters} /><TopList title="Top thanh khoản" items={topLiquidity} kind="liquidity" filters={filters} /></section>

    <div className="stocks-and-guide">
      <section className="simple-stock-section" aria-labelledby="stock-table-title"><div className="market-tab-heading"><div><h2 id="stock-table-title">Bảng cổ phiếu {advanced ? "nâng cao" : "dễ đọc"}</h2><p>{collection.pagination.total_items} mã · 15 mã mỗi trang · VN30 ưu tiên đầu danh sách.</p></div><span className="table-preset">VN30 trước</span></div>
        <form className="stock-filter" action="/market/stocks"><input type="hidden" name="mode" value={filters.mode} /><label>Tìm mã hoặc công ty<input name="q" defaultValue={filters.q} placeholder="Ví dụ: FPT, Hòa Phát" /></label><label>Sàn<select name="exchange" defaultValue={filters.exchange}><option value="">Tất cả sàn</option><option value="HOSE">HOSE</option><option value="HNX">HNX</option><option value="UPCOM">UPCoM</option></select></label><label>Sắp xếp<select name="sort" defaultValue={filters.sort}><option value="vn30">VN30 trước</option><option value="symbol">Mã</option><option value="change_percent">% hôm nay</option><option value="matched_value">Thanh khoản</option><option value="market_cap">Vốn hóa</option></select></label><label>Thứ tự<select name="direction" defaultValue={filters.direction}><option value="desc">Giảm dần</option><option value="asc">Tăng dần</option></select></label><button type="submit">Áp dụng</button></form>
        <div className="market-table-wrap"><table className="market-table simple-stock-table"><thead>{advanced ? <tr><th>Mã &amp; công ty</th><th>Giá</th><th>% hôm nay</th><th>Mở · Cao · Thấp</th><th>Khối lượng</th><th>GTGD</th><th>Khối ngoại</th><th>Vốn hóa</th><th>P/E · P/B</th></tr> : <tr><th>Mã &amp; tên công ty</th><th>Giá</th><th>% hôm nay</th><th>Công ty làm gì?</th><th>Mức biến động</th></tr>}</thead><tbody>{rows.map((item) => { const movement = volatility(item.change_percent); const rowHref = hrefWith(filters, { selected: item.symbol }); return <tr className={item.is_vn30 ? "vn30-row" : undefined} key={item.symbol} tabIndex={0} onClick={() => router.push(rowHref)} onKeyDown={(event) => { if (event.key === "Enter") router.push(rowHref); }}><td className="stock-identity"><div><Link href={rowHref} prefetch={false} onClick={(event) => event.stopPropagation()}>{item.symbol}</Link>{item.is_vn30 && <span className="vn30-badge">VN30</span>}</div><span>{item.name}</span><small>{item.exchange} · {item.sector}</small></td><td><strong>{formatChange(item.price)}</strong><small>TC {formatChange(item.reference_price)}</small></td><td className={changeTone(item.change_percent)}><strong>{formatPercent(item.change_percent)}</strong><small>{formatChange(item.change)}</small></td>{advanced ? <><td>{formatChange(item.open_price)} · {formatChange(item.high_price)} · {formatChange(item.low_price)}</td><td>{formatCompact(item.volume)}</td><td>{formatMoney(item.matched_value)}</td><td className={changeTone(item.foreign_net_value)}>{formatMoney(item.foreign_net_value)}</td><td>{formatMoney(item.market_cap)}</td><td>{item.pe ?? "—"} · {item.pb ?? "—"}</td></> : <><td>{companyActivity(item)}</td><td><span className={`volatility-badge ${movement.tone}`}>{movement.label}</span></td></>}</tr>; })}</tbody></table></div>
        {!rows.length && <div className="market-empty"><h3>Không tìm thấy cổ phiếu</h3><p>Thử bỏ bớt bộ lọc hoặc tìm bằng mã khác.</p></div>}
        {!!rows.length && <nav className="market-pagination" aria-label="Phân trang cổ phiếu">{collection.pagination.previous_cursor ? <Link href={hrefWith(filters, { cursor: collection.pagination.previous_cursor, selected: null })} prefetch={false}>← Trang trước</Link> : <span />}<strong>Trang {collection.pagination.page} / {Math.max(1, collection.pagination.total_pages)}</strong>{collection.pagination.next_cursor ? <Link href={hrefWith(filters, { cursor: collection.pagination.next_cursor, selected: null })} prefetch={false}>Trang sau →</Link> : <span />}</nav>}
      </section>
      <aside className="how-to-read"><h2>Cách đọc trang này</h2><ol><li>Đọc câu kết luận ở đầu trang.</li><li>Nhìn bản đồ nhiệt để biết ngành nổi bật.</li><li>So sánh số mã tăng và giảm.</li><li>Chỉ mở Nâng cao khi cần nến và chỉ số chuyên sâu.</li></ol><MarketColorLegend /><p><strong>Lưu ý:</strong> dữ liệu thị trường có thể có độ trễ. Không dùng riêng một màu hoặc một chỉ số để quyết định đầu tư.</p></aside>
    </div>

    {chosen && <aside className="stock-drawer" aria-labelledby="drawer-title"><div className="stock-drawer-backdrop"><Link href={hrefWith(filters, { selected: null })} prefetch={false} aria-label="Đóng ngăn chi tiết" /></div><div className="stock-drawer-panel"><header><div><p>{chosen.exchange} · {chosen.sector}</p><h2 id="drawer-title">{chosen.symbol} <small>{chosen.name}</small></h2></div><Link href={hrefWith(filters, { selected: null })} prefetch={false} aria-label="Đóng">×</Link></header><div className="drawer-price"><strong>{formatChange(chosen.price)}</strong><span className={changeTone(chosen.change_percent)}>{formatPercent(chosen.change_percent)}</span></div><MarketLineChart candles={selectedCandles} label={`Đường giá 90 phiên của ${chosen.symbol}`} /><section><h3>Công ty làm gì?</h3><p>{companyActivity(chosen)}. Mô tả này dựa trên phân loại ngành của nguồn dữ liệu, chưa phải hồ sơ doanh nghiệp đầy đủ.</p></section><section><h3>Thảo luận cộng đồng</h3><p>Chưa có thảo luận đã kiểm duyệt cho mã này. Khi mở cộng đồng, bài viết phải nêu rủi ro và việc người viết có đang sở hữu cổ phiếu.</p></section><Link className="market-primary-link" href={`/market/stocks/${chosen.symbol}`} prefetch={false}>Mở trang chi tiết đầy đủ →</Link></div></aside>}

    <footer className="beginner-disclaimer"><strong>Thông tin tham khảo, không phải khuyến nghị đầu tư.</strong><span>Nguồn: {collection.meta.provider_name} · trạng thái độ trễ: {collection.meta.delay_class}. “Vì sao” chỉ nêu nguyên nhân khi có tin đã kiểm chứng.</span></footer>
  </section>;
}
