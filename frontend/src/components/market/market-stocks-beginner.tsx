"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type RefObject, useEffect, useRef, useState } from "react";

import { InfoTip, MarketColorLegend, MarketLineChart, SectorHeatmap } from "@/components/market/beginner-market-ui";
import { changeTone, formatChange, formatCompact, formatMoney, formatPercent } from "@/components/market/formatters";
import { mergeLiveInstrument } from "@/components/market/live-market";
import { MarketCandlestickChart } from "@/components/market/market-candlestick-chart";
import { useMarketStreamState } from "@/hooks/use-realtime-price";
import type { InstrumentCollection, MarketCandle, MarketIndex, MarketInstrument, SectorCollection } from "@/types/market";

type StocksViewProps = {
  collection: InstrumentCollection;
  summary: InstrumentCollection;
  sectors: SectorCollection;
  filters: Record<string, string>;
  selected: string;
  selectedCandles: MarketCandle[];
  index: MarketIndex | undefined;
  comparisonSymbols?: string[];
  comparison?: StockComparison[];
  comparisonOptions?: MarketInstrument[];
};

type StockComparison = {
  instrument: MarketInstrument;
  candles: MarketCandle[];
};

const screeningPresets: { label: string; metric: string; description: string; values: Record<string, string> }[] = [
  { label: "VN30", metric: "30 mã", description: "Nhóm vốn hóa và thanh khoản hàng đầu HOSE", values: { vn30: "true", sort: "change_percent", direction: "desc" } },
  { label: "Tăng mạnh", metric: "+2% trở lên", description: "Biến động giá trong phiên", values: { min_change: "2", sort: "change_percent", direction: "desc" } },
  { label: "Giảm mạnh", metric: "−2% trở xuống", description: "Biến động giá trong phiên", values: { max_change: "-2", sort: "change_percent", direction: "asc" } },
  { label: "Thanh khoản cao", metric: "≥ 100 tỷ", description: "Giá trị giao dịch trong phiên", values: { min_matched_value_billion: "100", sort: "matched_value", direction: "desc" } },
  { label: "Khối lượng đột biến", metric: "≥ 1,5× TB20", description: "So với trung bình 20 phiên", values: { min_volume_ratio: "1.5", sort: "volume_vs_20d", direction: "desc" } },
];

function hrefWith(filters: Record<string, string>, changes: Record<string, string | null>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
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

function reasonFor(item: MarketInstrument, kind: "gain" | "loss" | "liquidity") {
  if (kind === "liquidity") return `Giao dịch ${formatMoney(item.matched_value)} trong phạm vi dữ liệu hiện có.`;
  const movement = kind === "gain" ? "tăng" : "giảm";
  const magnitude = formatPercent(String(Math.abs(Number(item.change_percent)))).replace("+", "");
  return `Giá đang ${movement} ${magnitude}; chưa có tin đã kiểm chứng để kết luận nguyên nhân.`;
}

function TopList({ title, items, kind, filters }: { title: string; items: MarketInstrument[]; kind: "gain" | "loss" | "liquidity"; filters: Record<string, string> }) {
  return <article className="market-top-list"><h3>{title}</h3>{items.map((item) => <Link href={hrefWith(filters, { selected: item.symbol })} prefetch={false} key={`${kind}-${item.symbol}`}><div><strong>{item.symbol}</strong><span className={changeTone(item.change_percent)}>{formatPercent(item.change_percent)}</span></div><p>{reasonFor(item, kind)}</p></Link>)}</article>;
}

function situationFor(item: MarketInstrument) {
  const change = Number(item.change_percent);
  const volumeRatio = Number(item.volume_vs_20d);
  const movement = change >= 2
    ? "Tăng mạnh trong phiên"
    : change <= -2
      ? "Giảm mạnh trong phiên"
      : change >= 0
        ? "Ổn định hoặc tăng nhẹ"
        : "Điều chỉnh nhẹ";
  const liquidity = volumeRatio > 0
    ? `Khối lượng bằng ${volumeRatio.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} lần trung bình 20 phiên.`
    : `Giá trị giao dịch hiện ghi nhận ${formatMoney(item.matched_value)}.`;
  return { movement, liquidity };
}

function metricValue(value: string | null | undefined, suffix = "") {
  return value === null || value === undefined || value === "" ? "Chưa có" : `${value}${suffix}`;
}

function StockComparisonDialog({
  open,
  onClose,
  openerRef,
  filters,
  initialSymbols,
  comparison,
  options,
}: {
  open: boolean;
  onClose: () => void;
  openerRef: RefObject<HTMLButtonElement | null>;
  filters: Record<string, string>;
  initialSymbols: string[];
  comparison: StockComparison[];
  options: MarketInstrument[];
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [symbols, setSymbols] = useState(initialSymbols);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const normalizedQuery = query.trim().toUpperCase();
  const candidates = options
    .filter((item) => !symbols.includes(item.symbol))
    .filter((item) => !normalizedQuery || item.symbol.includes(normalizedQuery) || item.name.toLocaleUpperCase("vi-VN").includes(normalizedQuery))
    .slice(0, 8);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const opener = openerRef.current;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), a[href]") ?? []);
    focusables()[0]?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusables();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      opener?.focus();
    };
  }, [open, onClose, openerRef]);

  if (!open) return null;

  function addSymbol(rawSymbol: string) {
    const symbol = rawSymbol.trim().toUpperCase();
    if (!/^[A-Z0-9._-]{1,24}$/.test(symbol)) {
      setError("Nhập mã hợp lệ, ví dụ FPT hoặc VCB.");
      return;
    }
    if (symbols.includes(symbol)) {
      setError(`${symbol} đã có trong danh sách so sánh.`);
      return;
    }
    if (symbols.length >= 3) {
      setError("Chỉ có thể so sánh tối đa 3 mã cùng lúc.");
      return;
    }
    setSymbols((current) => [...current, symbol]);
    setQuery("");
    setError("");
  }

  function submitSymbol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addSymbol(query);
  }

  function removeSymbol(symbol: string) {
    setSymbols((current) => current.filter((item) => item !== symbol));
    setError("");
  }

  function loadComparison() {
    if (symbols.length < 2) {
      setError("Chọn ít nhất 2 mã để bắt đầu so sánh.");
      return;
    }
    router.push(hrefWith(filters, { compare: symbols.join(","), selected: null, cursor: null }));
  }

  const loadedBySymbol = new Map(comparison.map((item) => [item.instrument.symbol, item]));
  const optionBySymbol = new Map(options.map((item) => [item.symbol, item]));

  return <div className="stock-comparison-modal" role="presentation">
    <button className="stock-comparison-backdrop" type="button" aria-label="Đóng cửa sổ so sánh" onClick={onClose} />
    <div ref={dialogRef} className="stock-comparison-dialog" role="dialog" aria-modal="true" aria-labelledby="comparison-dialog-title" aria-describedby="comparison-dialog-description">
      <header className="stock-comparison-dialog-header"><div><p className="eyebrow">ĐỐI CHIẾU CÙNG MỘT KHUNG</p><h2 id="comparison-dialog-title">So sánh cổ phiếu</h2><p id="comparison-dialog-description">Chọn từ 2 đến 3 mã. Bạn có thể gỡ một mã rồi thêm mã khác ngay tại đây.</p></div><button type="button" className="dialog-close" aria-label="Đóng cửa sổ so sánh" onClick={onClose}>×</button></header>
      <section className="comparison-picker" aria-label="Chọn mã để so sánh">
        <div className="comparison-selected"><strong>Đã chọn {symbols.length}/3</strong><div>{symbols.map((symbol) => <span key={symbol}>{symbol}<button type="button" aria-label={`Gỡ ${symbol} khỏi so sánh`} onClick={() => removeSymbol(symbol)}>×</button></span>)}</div></div>
        <form onSubmit={submitSymbol}><label htmlFor="comparison-symbol">Tìm hoặc nhập mã cổ phiếu</label><div><input id="comparison-symbol" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={24} autoComplete="off" placeholder="Ví dụ: FPT, VCB, HPG" /><button type="submit" disabled={!query.trim() || symbols.length >= 3}>Thêm mã</button></div></form>
        {candidates.length > 0 && <div className="comparison-suggestions" aria-label="Mã gợi ý">{candidates.map((item) => <button key={item.symbol} type="button" disabled={symbols.length >= 3} aria-label={`Thêm ${item.symbol} vào so sánh`} onClick={() => addSymbol(item.symbol)}><strong>{item.symbol}</strong><span>{item.name}</span></button>)}</div>}
        {error && <p className="comparison-error" role="alert">{error}</p>}
        <button type="button" className="comparison-load" disabled={symbols.length < 2} onClick={loadComparison}>Tải dữ liệu so sánh</button>
      </section>
      <section className="comparison-results" aria-live="polite">
        {symbols.length < 2 && <div className="comparison-empty"><h3>Chọn thêm mã để so sánh</h3><p>Kết quả sẽ đặt biểu đồ, định giá và trạng thái từng mã cạnh nhau.</p></div>}
        {symbols.length >= 2 && <div className="comparison-board">{symbols.map((symbol) => {
          const loaded = loadedBySymbol.get(symbol);
          const item = loaded?.instrument ?? optionBySymbol.get(symbol);
          if (!item) return <article className="comparison-card comparison-missing" key={symbol}><header><h3>{symbol}</h3><button type="button" aria-label={`Gỡ ${symbol} khỏi so sánh`} onClick={() => removeSymbol(symbol)}>×</button></header><p>Chưa tìm thấy dữ liệu cho mã này. Hãy kiểm tra mã hoặc gỡ để chọn mã khác.</p></article>;
          const situation = situationFor(item);
          return <article className="comparison-card" key={symbol}>
            <header><div><Link href={`/market/stocks/${symbol}`} prefetch={false}>{symbol}</Link><p>{item.name}</p></div><button type="button" aria-label={`Gỡ ${symbol} khỏi so sánh`} onClick={() => removeSymbol(symbol)}>×</button></header>
            <div className="comparison-price"><strong>{formatChange(item.price)}</strong><span className={changeTone(item.change_percent)}>{formatPercent(item.change_percent)}</span></div>
            <section><h4>Biểu đồ tổng quát</h4>{loaded ? <MarketLineChart candles={loaded.candles} label={`Đường giá 90 phiên của ${symbol}`} /> : <p className="comparison-loading-note">Bấm “Tải dữ liệu so sánh” để lấy biểu đồ 90 phiên.</p>}</section>
            <section className="comparison-metrics-section"><h4>Các chỉ số</h4><dl className="comparison-metrics"><div className="comparison-metric"><dt>Khối lượng</dt><dd>{formatCompact(item.volume)}</dd></div><div className="comparison-metric"><dt>GTGD</dt><dd>{formatMoney(item.matched_value)}</dd></div><div className="comparison-metric"><dt>Vốn hóa</dt><dd>{formatMoney(item.market_cap)}</dd></div><div className="comparison-metric"><dt>P/E</dt><dd>{metricValue(item.pe, " lần")}</dd></div><div className="comparison-metric"><dt>P/B</dt><dd>{metricValue(item.pb, " lần")}</dd></div><div className="comparison-metric"><dt>EPS</dt><dd>{metricValue(item.eps, " đ")}</dd></div><div className="comparison-metric"><dt>ROE</dt><dd>{metricValue(item.roe_percent, "%")}</dd></div></dl></section>
            <section className="comparison-situation"><h4>Tình hình mã cổ phiếu</h4><strong>{situation.movement}</strong><p>{situation.liquidity}</p><small>Quan sát từ snapshot hiện tại, không phải khuyến nghị đầu tư.</small></section>
            <section className="comparison-ai"><h4>Xu hướng phát triển (AI)</h4><strong>Chưa có đánh giá AI đã kiểm định</strong><p>Mô-đun dự báo chưa hoạt động với dữ liệu đủ tin cậy. Hệ thống không suy diễn xu hướng dài hạn từ một phiên giao dịch.</p></section>
          </article>;
        })}</div>}
      </section>
    </div>
  </div>;
}

export function StocksView({
  collection,
  summary,
  sectors,
  filters,
  selected,
  selectedCandles,
  index,
  comparisonSymbols = [],
  comparison = [],
  comparisonOptions = [],
}: StocksViewProps) {
  const router = useRouter();
  const stream = useMarketStreamState();
  const comparisonButtonRef = useRef<HTMLButtonElement>(null);
  const [comparisonOpen, setComparisonOpen] = useState(comparisonSymbols.length >= 2);
  const activeAdvancedFilterCount = [filters.min_change, filters.max_change, filters.min_matched_value_billion, filters.min_market_cap_billion, filters.min_volume_ratio, filters.vn30].filter(Boolean).length;
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(activeAdvancedFilterCount > 0);
  const rows = collection.data.map((item) => mergeLiveInstrument(item, stream.items[item.symbol]));
  const universe = summary.data.map((item) => mergeLiveInstrument(item, stream.items[item.symbol]));
  const sectorFlows = [...sectors.data].sort((left, right) => Number(right.market_cap) - Number(left.market_cap));
  const chosen = [...rows, ...universe].find((item) => item.symbol === selected);
  const advanced = filters.mode === "advanced";
  const marketCount = sectors.data.reduce((sum, sector) => sum + sector.member_count, 0);
  const total = marketCount || 1;
  const advances = sectors.data.reduce((sum, sector) => sum + sector.advances, 0);
  const declines = sectors.data.reduce((sum, sector) => sum + sector.declines, 0);
  const unchanged = sectors.data.reduce((sum, sector) => sum + sector.unchanged, 0);
  const liquidity = sectors.data.reduce((sum, sector) => sum + Number(sector.matched_value), 0);
  const foreign = sectors.data.reduce((sum, sector) => sum + Number(sector.foreign_net_value), 0);
  const topGain = [...universe].sort((a, b) => Number(b.change_percent) - Number(a.change_percent)).slice(0, 3);
  const topLoss = [...universe].sort((a, b) => Number(a.change_percent) - Number(b.change_percent)).slice(0, 3);
  const topLiquidity = [...universe].sort((a, b) => Number(b.matched_value) - Number(a.matched_value)).slice(0, 3);
  const hasVolumeBaseline = universe.some((item) => Number(item.volume_vs_20d) > 0);
  const summaryText = declines > advances
      ? `${Math.round(declines / total * 100)}% mã toàn thị trường đang giảm; thị trường nghiêng về thận trọng.`
    : `${Math.round(advances / total * 100)}% mã toàn thị trường đang tăng; sắc xanh đang chiếm ưu thế.`;

  return <section className="market-tab-panel beginner-market-page">
    <MarketColorLegend />
    <section className="market-summary-card">
      <div><p className="eyebrow">TÓM TẮT TRONG MỘT CÂU</p><h2>{summaryText}</h2><p>Phạm vi: toàn bộ {marketCount} cổ phiếu trong snapshot của nguồn.</p><div className="market-mode-toggle" aria-label="Chọn mức độ chi tiết"><Link className={!advanced ? "active" : ""} href={hrefWith(filters, { mode: "basic", selected: null })} prefetch={false}>Cơ bản</Link><Link className={advanced ? "active" : ""} href={hrefWith(filters, { mode: "advanced", selected: null })} prefetch={false}>Nâng cao</Link></div></div>
      <div><div className="beginner-card-title"><strong>VN-Index</strong><span className={changeTone(index?.change_percent ?? "0")}>{formatPercent(index?.change_percent ?? "0")}</span></div>{advanced ? <MarketCandlestickChart candles={index?.candles ?? []} label="Biểu đồ nến VN-Index" /> : <MarketLineChart candles={index?.candles ?? []} label="Đường giá VN-Index" />}</div>
    </section>

    <div className="market-overview-layout">
      <SectorHeatmap sectors={sectors.data} headingId="market-heatmap-title" />
      <aside className="market-quick-facts"><article><div className="beginner-card-title"><h3>Bao nhiêu mã tăng/giảm?</h3><InfoTip term="Độ rộng">Đếm số mã tăng, giảm và đứng giá trong toàn bộ snapshot của nguồn.</InfoTip></div><div className="beginner-breadth"><span className="advance" style={{ width: `${advances / total * 100}%` }} /><span className="unchanged" style={{ width: `${unchanged / total * 100}%` }} /><span className="decline" style={{ width: `${declines / total * 100}%` }} /></div><p><b className="positive">{advances} tăng</b> · {unchanged} đứng · <b className="negative">{declines} giảm</b></p></article><article><h3>Giao dịch có sôi động?</h3><strong>{formatMoney(String(liquidity))}</strong><p>Tổng giá trị của {marketCount} mã trong snapshot của nguồn.</p></article><article><h3>Khối ngoại mua hay bán?</h3><strong className={changeTone(String(foreign))}>{foreign >= 0 ? "Mua ròng" : "Bán ròng"} {formatMoney(String(Math.abs(foreign)))}</strong><p>Có thể là số ước tính tùy dữ liệu nguồn.</p></article></aside>
    </div>

    <section className="sector-flow" aria-labelledby="sector-flow-title"><div className="beginner-card-title"><h2 id="sector-flow-title">Sức mạnh giao dịch theo ngành</h2><InfoTip term="Sức mạnh giao dịch">Chỉ báo tương đối = giá trị giao dịch × % biến động. Đây không phải số tiền vào/ra ròng thực tế.</InfoTip></div><div>{sectorFlows.slice(0, 10).map((sector) => { const strength = Number(sector.matched_value) * Number(sector.change_percent) / 100; const maximum = Math.max(...sectorFlows.map((item) => Math.abs(Number(item.matched_value) * Number(item.change_percent) / 100)), 1); const percent = Math.abs(strength) / maximum * 50; return <article key={sector.name}><span>{sector.name}</span><div><i className={strength >= 0 ? "inflow" : "outflow"} style={{ width: `${percent}%`, [strength >= 0 ? "left" : "right"]: "50%" }} /></div><strong className={changeTone(String(strength))}>{strength >= 0 ? "+" : "−"}{formatMoney(String(Math.abs(strength)))}</strong></article>; })}</div></section>

    <section className="market-top-grid" aria-label="Cổ phiếu nổi bật"><TopList title="Top tăng" items={topGain} kind="gain" filters={filters} /><TopList title="Top giảm" items={topLoss} kind="loss" filters={filters} /><TopList title="Top thanh khoản" items={topLiquidity} kind="liquidity" filters={filters} /></section>

    <div className="stocks-and-guide">
      <section className="simple-stock-section" aria-labelledby="stock-table-title"><div className="market-tab-heading"><div><h2 id="stock-table-title">Bảng cổ phiếu {advanced ? "nâng cao" : "dễ đọc"}</h2><p>{collection.pagination.total_items} mã · 15 mã mỗi trang · VN30 ưu tiên đầu danh sách.</p>{filters.sector && <div className="active-market-filter"><span>Ngành: {filters.sector}</span><Link href={hrefWith(filters, { sector: null, cursor: null })} prefetch={false}>Bỏ lọc</Link></div>}</div><div className="stock-table-heading-actions"><span className="table-preset">VN30 trước</span><button ref={comparisonButtonRef} type="button" className="open-comparison-button" onClick={() => setComparisonOpen(true)}>So sánh cổ phiếu{comparisonSymbols.length ? ` (${comparisonSymbols.length})` : ""}</button></div></div>
        <div className="screening-presets" aria-label="Bộ lọc nhanh">{screeningPresets.filter((preset) => hasVolumeBaseline || !preset.values.min_volume_ratio).map((preset) => <Link key={preset.label} href={hrefWith({ mode: filters.mode }, { ...preset.values, cursor: null })} prefetch={false}><b>{preset.metric}</b><strong>{preset.label}</strong><span>{preset.description}</span></Link>)}</div>
        <form className="stock-filter" action="/market/stocks">
          <input type="hidden" name="mode" value={filters.mode} />
          {filters.sector && <input type="hidden" name="sector" value={filters.sector} />}
          <label>Tìm mã hoặc công ty<input name="q" defaultValue={filters.q} placeholder="Ví dụ: FPT, Hòa Phát" /></label>
          <label>Sàn<select name="exchange" defaultValue={filters.exchange}><option value="">Tất cả sàn</option><option value="HOSE">HOSE</option><option value="HNX">HNX</option><option value="UPCOM">UPCoM</option></select></label>
          <label>Sắp xếp<select name="sort" defaultValue={hasVolumeBaseline ? filters.sort : filters.sort === "volume_vs_20d" ? "vn30" : filters.sort}><option value="vn30">VN30 trước</option><option value="symbol">Mã</option><option value="change_percent">% hôm nay</option><option value="matched_value">Thanh khoản</option><option value="market_cap">Vốn hóa</option>{hasVolumeBaseline && <option value="volume_vs_20d">Khối lượng so với TB20</option>}</select></label>
          <label>Thứ tự<select name="direction" defaultValue={filters.direction}><option value="desc">Giảm dần</option><option value="asc">Tăng dần</option></select></label>
          <button type="button" className="advanced-filter-trigger" aria-expanded={advancedFilterOpen} aria-controls="advanced-stock-filter-panel" onClick={() => setAdvancedFilterOpen((current) => !current)}>Lọc nâng cao{activeAdvancedFilterCount ? <span>{activeAdvancedFilterCount}</span> : null}</button>
          <div className="stock-filter-actions"><button type="submit">Áp dụng</button><Link href={`/market/stocks?mode=${filters.mode}`} prefetch={false}>Đặt lại</Link></div>
          {advancedFilterOpen && <section id="advanced-stock-filter-panel" className="advanced-stock-filter" aria-label="Bộ lọc nâng cao">
            <div>
              <label>% tăng tối thiểu<input type="number" step="0.1" min="-100" max="100" name="min_change" defaultValue={filters.min_change} placeholder="Ví dụ: 1" /></label>
              <label>% tăng tối đa<input type="number" step="0.1" min="-100" max="100" name="max_change" defaultValue={filters.max_change} placeholder="Ví dụ: 5" /></label>
              <label>GTGD tối thiểu (tỷ đồng)<input type="number" step="1" min="0" name="min_matched_value_billion" defaultValue={filters.min_matched_value_billion} placeholder="Ví dụ: 100" /></label>
              <label>Vốn hóa tối thiểu (tỷ đồng)<input type="number" step="1" min="0" name="min_market_cap_billion" defaultValue={filters.min_market_cap_billion} placeholder="Ví dụ: 10000" /></label>
              {hasVolumeBaseline ? <label>Khối lượng / TB20 tối thiểu<input type="number" step="0.1" min="0" max="1000" name="min_volume_ratio" defaultValue={filters.min_volume_ratio} placeholder="Ví dụ: 1.5" /></label> : <p className="filter-unavailable">Nguồn hiện tại chưa cung cấp khối lượng trung bình 20 phiên cho toàn thị trường.</p>}
              <label className="checkbox-filter"><input type="checkbox" name="vn30" value="true" defaultChecked={filters.vn30 === "true"} /> Chỉ mã VN30</label>
            </div>
          </section>}
        </form>
        <div className="market-table-wrap simple-stock-table-wrap"><table aria-labelledby="stock-table-title" className={`market-table simple-stock-table ${advanced ? "advanced" : "basic"}`}><thead>{advanced ? <tr><th>Mã &amp; công ty</th><th>Giá</th><th>% hôm nay</th><th>Mở · Cao · Thấp</th><th>Khối lượng</th><th>GTGD</th><th>Khối ngoại</th><th>Vốn hóa</th><th>P/E · P/B</th></tr> : <tr><th>Mã &amp; tên công ty</th><th>Giá</th><th>% hôm nay</th><th>Công ty làm gì?</th><th>Mức biến động</th></tr>}</thead><tbody>{rows.map((item) => { const movement = volatility(item.change_percent); const rowHref = hrefWith(filters, { selected: item.symbol }); return <tr className={item.is_vn30 ? "vn30-row" : undefined} key={item.symbol} tabIndex={0} onClick={() => router.push(rowHref)} onKeyDown={(event) => { if (event.key === "Enter") router.push(rowHref); }}><td className="stock-identity"><div><Link href={rowHref} prefetch={false} onClick={(event) => event.stopPropagation()}>{item.symbol}</Link>{item.is_vn30 && <span className="vn30-badge">VN30</span>}</div><span>{item.name}</span><small>{item.exchange} · {item.sector}</small></td><td data-label="Giá"><strong>{formatChange(item.price)}</strong><small>TC {formatChange(item.reference_price)}</small></td><td data-label="% hôm nay" className={changeTone(item.change_percent)}><strong>{formatPercent(item.change_percent)}</strong><small>{formatChange(item.change)}</small></td>{advanced ? <><td data-label="Mở · Cao · Thấp">{formatChange(item.open_price)} · {formatChange(item.high_price)} · {formatChange(item.low_price)}</td><td data-label="Khối lượng">{formatCompact(item.volume)}</td><td data-label="GTGD">{formatMoney(item.matched_value)}</td><td data-label="Khối ngoại" className={changeTone(item.foreign_net_value)}>{formatMoney(item.foreign_net_value)}</td><td data-label="Vốn hóa">{formatMoney(item.market_cap)}</td><td data-label="P/E · P/B">{item.pe ?? "—"} · {item.pb ?? "—"}</td></> : <><td data-label="Công ty làm gì?">{companyActivity(item)}</td><td data-label="Mức biến động"><span className={`volatility-badge ${movement.tone}`}>{movement.label}</span></td></>}</tr>; })}</tbody></table></div>
        {!rows.length && <div className="market-empty"><h3>Không tìm thấy cổ phiếu</h3><p>Thử bỏ bớt bộ lọc hoặc tìm bằng mã khác.</p></div>}
        {!!rows.length && <nav className="market-pagination" aria-label="Phân trang cổ phiếu">{collection.pagination.previous_cursor ? <Link href={hrefWith(filters, { cursor: collection.pagination.previous_cursor, selected: null })} prefetch={false}>← Trang trước</Link> : <span />}<strong>Trang {collection.pagination.page} / {Math.max(1, collection.pagination.total_pages)}</strong>{collection.pagination.next_cursor ? <Link href={hrefWith(filters, { cursor: collection.pagination.next_cursor, selected: null })} prefetch={false}>Trang sau →</Link> : <span />}</nav>}
      </section>
      <aside className="how-to-read"><h2>Cách đọc trang này</h2><ol><li>Đọc câu kết luận ở đầu trang.</li><li>Nhìn bản đồ nhiệt để biết ngành nổi bật.</li><li>So sánh số mã tăng và giảm.</li><li>Chỉ mở Nâng cao khi cần nến và chỉ số chuyên sâu.</li></ol><MarketColorLegend /><p><strong>Lưu ý:</strong> dữ liệu thị trường có thể có độ trễ. Không dùng riêng một màu hoặc một chỉ số để quyết định đầu tư.</p></aside>
    </div>

    {chosen && <aside className="stock-drawer" aria-labelledby="drawer-title"><div className="stock-drawer-backdrop"><Link href={hrefWith(filters, { selected: null })} prefetch={false} aria-label="Đóng ngăn chi tiết" /></div><div className="stock-drawer-panel"><header><div><p>{chosen.exchange} · {chosen.sector}</p><h2 id="drawer-title">{chosen.symbol} <small>{chosen.name}</small></h2></div><Link href={hrefWith(filters, { selected: null })} prefetch={false} aria-label="Đóng">×</Link></header><div className="drawer-price"><strong>{formatChange(chosen.price)}</strong><span className={changeTone(chosen.change_percent)}>{formatPercent(chosen.change_percent)}</span></div><MarketLineChart candles={selectedCandles} label={`Đường giá 90 phiên của ${chosen.symbol}`} /><section><h3>Công ty làm gì?</h3><p>{companyActivity(chosen)}. Mô tả này dựa trên phân loại ngành của nguồn dữ liệu, chưa phải hồ sơ doanh nghiệp đầy đủ.</p></section><section><h3>Thảo luận cộng đồng</h3><p>Chưa có thảo luận đã kiểm duyệt cho mã này. Khi mở cộng đồng, bài viết phải nêu rủi ro và việc người viết có đang sở hữu cổ phiếu.</p></section><Link className="market-primary-link" href={`/market/stocks/${chosen.symbol}`} prefetch={false}>Mở trang chi tiết đầy đủ →</Link></div></aside>}

    <StockComparisonDialog
      open={comparisonOpen}
      onClose={() => setComparisonOpen(false)}
      openerRef={comparisonButtonRef}
      filters={filters}
      initialSymbols={comparisonSymbols}
      comparison={comparison}
      options={comparisonOptions}
    />

    <footer className="beginner-disclaimer"><strong>Thông tin tham khảo, không phải khuyến nghị đầu tư.</strong><span>Nguồn: {collection.meta.provider_name} · trạng thái độ trễ: {collection.meta.delay_class}. “Vì sao” chỉ nêu nguyên nhân khi có tin đã kiểm chứng.</span></footer>
  </section>;
}
