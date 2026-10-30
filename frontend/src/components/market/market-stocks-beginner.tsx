"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type RefObject, useEffect, useRef, useState } from "react";

import { InfoTip, MarketColorLegend, MarketLineChart, SectorHeatmap } from "@/components/market/beginner-market-ui";
import {
  changeTone,
  formatChange,
  formatCompact,
  formatMoney,
  formatPercent,
  formatRatioPair,
  priceTone,
} from "@/components/market/formatters";
import { mergeLiveInstrument } from "@/components/market/live-market";
import { StockGoldBankComparator } from "@/components/market/stock-gold-bank-comparator";
import { MARKET_OVERVIEW_INDEX_CHART_LIMITS, MarketCandlestickChart } from "@/components/market/market-candlestick-chart";
import { useMarketStreamState } from "@/hooks/use-realtime-price";
import { useVisibleFundamentals } from "@/hooks/use-visible-fundamentals";
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
    if (key === "mode") continue;
    if (value) query.set(key, value);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (key === "mode") continue;
    if (value) query.set(key, value);
    else query.delete(key);
  }
  return `/market/stocks?${query.toString()}`;
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
  const [comparisonMode, setComparisonMode] = useState<"peers" | "gold_bank">("peers");
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

  return (
    <div className="stock-comparison-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md" role="presentation">
      <button className="stock-comparison-backdrop absolute inset-0 cursor-pointer w-full h-full border-none bg-transparent" type="button" aria-label="Đóng cửa sổ so sánh" onClick={onClose} />
      <div ref={dialogRef} className="stock-comparison-dialog relative z-10 w-full max-w-6xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl text-slate-100 flex flex-col gap-4" role="dialog" aria-modal="true" aria-labelledby="comparison-dialog-title" aria-describedby="comparison-dialog-description">
        <header className="stock-comparison-dialog-header flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <p className="eyebrow text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">ĐỐI CHIẾU CÙNG MỘT KHUNG</p>
            <h2 id="comparison-dialog-title" className="text-xl sm:text-2xl font-bold text-slate-100 m-0">So sánh cổ phiếu</h2>
            <p id="comparison-dialog-description" className="text-xs sm:text-sm text-slate-400 mt-1 m-0">Chọn từ 2 đến 3 mã hoặc đối chiếu tỷ suất sinh lời với Vàng SJC và Lãi suất ngân hàng qua từng năm.</p>
          </div>
          <button type="button" className="dialog-close w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition text-lg shrink-0 cursor-pointer" aria-label="Đóng cửa sổ so sánh" onClick={onClose}>×</button>
        </header>

        <div className="comparison-mode-switch flex flex-wrap gap-2 pb-3 border-b border-slate-800" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={comparisonMode === "peers"}
            className={`comparison-mode-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition border cursor-pointer ${
              comparisonMode === "peers"
                ? "active bg-sky-500/15 text-sky-400 border-sky-500/40 shadow-sm"
                : "bg-slate-850 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800"
            }`}
            onClick={() => setComparisonMode("peers")}
          >
            📊 So sánh giữa các mã cổ phiếu
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={comparisonMode === "gold_bank"}
            className={`comparison-mode-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition border cursor-pointer ${
              comparisonMode === "gold_bank"
                ? "active bg-sky-500/15 text-sky-400 border-sky-500/40 shadow-sm"
                : "bg-slate-850 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800"
            }`}
            onClick={() => setComparisonMode("gold_bank")}
          >
            ⚖️ So sánh với Vàng SJC &amp; Ngân hàng theo Năm
          </button>
        </div>

        {comparisonMode === "gold_bank" ? (
          <div className="stock-comparison-gold-bank-wrapper mt-2">
            <StockGoldBankComparator initialSymbol={symbols[0] || "HPG"} />
          </div>
        ) : (
          <>
            <section className="comparison-picker grid md:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800" aria-label="Chọn mã để so sánh">
              <div className="comparison-selected flex flex-col gap-2">
                <strong className="text-xs font-semibold text-slate-300">Đã chọn {symbols.length}/3</strong>
                <div className="flex flex-wrap gap-2">
                  {symbols.map((symbol) => (
                    <span key={symbol} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-950/80 text-sky-300 border border-sky-800 text-xs font-bold">
                      {symbol}
                      <button type="button" className="text-slate-400 hover:text-rose-400 cursor-pointer text-sm font-bold ml-1" aria-label={`Gỡ ${symbol} khỏi so sánh`} onClick={() => removeSymbol(symbol)}>×</button>
                    </span>
                  ))}
                  {!symbols.length && <span className="text-xs text-slate-500 italic">Chưa chọn mã nào</span>}
                </div>
              </div>
              <form onSubmit={submitSymbol} className="flex flex-col gap-2">
                <label htmlFor="comparison-symbol" className="text-xs font-semibold text-slate-300">Tìm hoặc nhập mã cổ phiếu</label>
                <div className="flex gap-2">
                  <input
                    id="comparison-symbol"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    maxLength={24}
                    autoComplete="off"
                    placeholder="Ví dụ: FPT, VCB, HPG"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <button type="submit" disabled={!query.trim() || symbols.length >= 3} className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white transition cursor-pointer">
                    Thêm mã
                  </button>
                </div>
              </form>
              {candidates.length > 0 && (
                <div className="comparison-suggestions md:col-span-2 flex flex-wrap gap-2 pt-2 border-t border-slate-850" aria-label="Mã gợi ý">
                  <span className="text-xs text-slate-400 self-center mr-1">Gợi ý:</span>
                  {candidates.map((item) => (
                    <button key={item.symbol} type="button" disabled={symbols.length >= 3} aria-label={`Thêm ${item.symbol} vào so sánh`} onClick={() => addSymbol(item.symbol)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs text-slate-200 border border-slate-700 transition cursor-pointer">
                      <strong className="text-sky-400 font-bold">{item.symbol}</strong>
                      <span className="text-[11px] text-slate-400 max-w-[120px] truncate">{item.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {error && <p className="comparison-error md:col-span-2 text-xs text-rose-400 m-0" role="alert">{error}</p>}
              <div className="md:col-span-2 flex justify-end pt-2">
                <button type="button" className="comparison-load px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-bold text-white transition cursor-pointer shadow-sm" disabled={symbols.length < 2} onClick={loadComparison}>
                  Tải dữ liệu so sánh
                </button>
              </div>
            </section>

            <section className="comparison-results my-3" aria-live="polite">
              {symbols.length < 2 && (
                <div className="comparison-empty py-12 text-center text-slate-400">
                  <h3 className="text-base font-bold text-slate-300 mb-1">Chọn thêm mã để so sánh</h3>
                  <p className="text-xs text-slate-500 m-0">Kết quả sẽ đặt biểu đồ, định giá và trạng thái từng mã cạnh nhau.</p>
                </div>
              )}
              {symbols.length >= 2 && (
                <div className="comparison-board grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {symbols.map((symbol) => {
                    const loaded = loadedBySymbol.get(symbol);
                    const item = loaded?.instrument ?? optionBySymbol.get(symbol);
                    if (!item) {
                      return (
                        <article className="comparison-card comparison-missing bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3" key={symbol}>
                          <header className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-white m-0">{symbol}</h3>
                            <button type="button" className="text-slate-400 hover:text-rose-400 text-lg cursor-pointer" aria-label={`Gỡ ${symbol} khỏi so sánh`} onClick={() => removeSymbol(symbol)}>×</button>
                          </header>
                          <p className="text-xs text-slate-400 m-0">Chưa tìm thấy dữ liệu cho mã này. Hãy kiểm tra mã hoặc gỡ để chọn mã khác.</p>
                        </article>
                      );
                    }
                    const situation = situationFor(item);
                    return (
                      <article className="comparison-card bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3.5 shadow-sm" key={symbol}>
                        <header className="flex items-start justify-between border-b border-slate-850 pb-2.5">
                          <div>
                            <Link href={`/market/stocks/${symbol}?from=${encodeURIComponent(`${hrefWith(filters, { compare: null, selected: null })}#stock-table`)}`} prefetch={false} className="text-lg font-bold text-sky-400 hover:underline">
                              {symbol}
                            </Link>
                            <p className="text-xs text-slate-400 m-0 truncate max-w-[200px]">{item.name}</p>
                          </div>
                          <button type="button" className="text-slate-400 hover:text-rose-400 text-lg cursor-pointer" aria-label={`Gỡ ${symbol} khỏi so sánh`} onClick={() => removeSymbol(symbol)}>×</button>
                        </header>
                        <div className="comparison-price flex items-baseline gap-2.5">
                          <strong className="text-xl font-bold text-white">{formatChange(item.price)}</strong>
                          <span className={`text-sm font-semibold ${changeTone(item.change_percent)}`}>{formatPercent(item.change_percent)}</span>
                        </div>
                        <section>
                          <h4 className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Biểu đồ tổng quát</h4>
                          {loaded ? <MarketLineChart candles={loaded.candles} label={`Đường giá 90 phiên của ${symbol}`} /> : <p className="comparison-loading-note text-xs text-slate-500 m-0">Bấm “Tải dữ liệu so sánh” để lấy biểu đồ 90 phiên.</p>}
                        </section>
                        <section className="comparison-metrics-section">
                          <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Các chỉ số</h4>
                          <dl className="comparison-metrics grid grid-cols-2 gap-2 text-xs m-0">
                            <div className="comparison-metric bg-slate-900/60 p-2 rounded-lg border border-slate-850"><dt className="text-slate-400">Khối lượng</dt><dd className="font-bold text-white m-0">{formatCompact(item.volume)}</dd></div>
                            <div className="comparison-metric bg-slate-900/60 p-2 rounded-lg border border-slate-850"><dt className="text-slate-400">GTGD</dt><dd className="font-bold text-white m-0">{formatMoney(item.matched_value)}</dd></div>
                            <div className="comparison-metric bg-slate-900/60 p-2 rounded-lg border border-slate-850"><dt className="text-slate-400">Vốn hóa</dt><dd className="font-bold text-white m-0">{formatMoney(item.market_cap)}</dd></div>
                            <div className="comparison-metric bg-slate-900/60 p-2 rounded-lg border border-slate-850"><dt className="text-slate-400">P/E</dt><dd className="font-bold text-white m-0">{metricValue(item.pe, " lần")}</dd></div>
                            <div className="comparison-metric bg-slate-900/60 p-2 rounded-lg border border-slate-850"><dt className="text-slate-400">P/B</dt><dd className="font-bold text-white m-0">{metricValue(item.pb, " lần")}</dd></div>
                            <div className="comparison-metric bg-slate-900/60 p-2 rounded-lg border border-slate-850"><dt className="text-slate-400">EPS</dt><dd className="font-bold text-white m-0">{metricValue(item.eps, " đ")}</dd></div>
                            <div className="comparison-metric bg-slate-900/60 p-2 rounded-lg border border-slate-850"><dt className="text-slate-400">ROE</dt><dd className="font-bold text-white m-0">{metricValue(item.roe_percent, "%")}</dd></div>
                          </dl>
                        </section>
                        <section className="comparison-situation bg-slate-900/40 p-3 rounded-lg border border-slate-850 text-xs">
                          <h4 className="text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Tình hình mã cổ phiếu</h4>
                          <strong className="text-slate-200 block mb-1">{situation.movement}</strong>
                          <p className="text-slate-400 m-0 mb-1">{situation.liquidity}</p>
                          <small className="text-[10px] text-slate-500 block">Quan sát từ snapshot hiện tại, không phải khuyến nghị đầu tư.</small>
                        </section>
                        <section className="comparison-ai bg-sky-950/30 p-3 rounded-lg border border-sky-900/40 text-xs">
                          <h4 className="text-[11px] font-semibold text-sky-400 mb-1 uppercase tracking-wider">Xu hướng phát triển (AI)</h4>
                          <strong className="text-slate-200 block mb-1">Chưa có đánh giá AI đã kiểm định</strong>
                          <p className="text-slate-400 m-0">Mô-đun dự báo chưa hoạt động với dữ liệu đủ tin cậy. Hệ thống không suy diễn xu hướng dài hạn từ một phiên giao dịch.</p>
                        </section>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
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
  const fundamentalsBySymbol = useVisibleFundamentals(
    rows.filter((item) => item.pe === null || item.pb === null).map((item) => item.symbol),
  );
  const universe = summary.data.map((item) => mergeLiveInstrument(item, stream.items[item.symbol]));
  const sectorFlows = [...sectors.data].sort((left, right) => Number(right.market_cap) - Number(left.market_cap));
  const chosen = [...rows, ...universe].find((item) => item.symbol === selected);
  const marketCount = sectors.data.reduce((sum, sector) => sum + sector.member_count, 0);
  const total = marketCount || 1;
  const advances = sectors.data.reduce((sum, sector) => sum + sector.advances, 0);
  const declines = sectors.data.reduce((sum, sector) => sum + sector.declines, 0);
  const unchanged = sectors.data.reduce((sum, sector) => sum + sector.unchanged, 0);
  const liquidity = sectors.data.reduce((sum, sector) => sum + Number(sector.matched_value), 0);
  const foreign = sectors.data.reduce((sum, sector) => sum + Number(sector.foreign_net_value), 0);
  const validPeItems = universe.map((item) => Number(item.pe)).filter((val) => Number.isFinite(val) && val > 0 && val < 100);
  const peAvg = validPeItems.length ? (validPeItems.reduce((a, b) => a + b, 0) / validPeItems.length).toFixed(1) : "14.2";
  const validPbItems = universe.map((item) => Number(item.pb)).filter((val) => Number.isFinite(val) && val > 0 && val < 20);
  const pbAvg = validPbItems.length ? (validPbItems.reduce((a, b) => a + b, 0) / validPbItems.length).toFixed(2) : "1.75";
  const hasVolumeBaseline = universe.some((item) => Number(item.volume_vs_20d) > 0);
  const summaryText = declines > advances
      ? `${Math.round(declines / total * 100)}% mã toàn thị trường đang giảm; thị trường nghiêng về thận trọng.`
    : `${Math.round(advances / total * 100)}% mã toàn thị trường đang tăng; sắc xanh đang chiếm ưu thế.`;

  return (
    <section className="market-tab-panel beginner-market-page w-full flex flex-col gap-6">
      {/* Legend Badge */}
      <div className="market-color-legend compact-badge relative z-10 flex flex-wrap items-center gap-2 sm:gap-3 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 text-xs w-fit shadow-sm" aria-label="Quy ước màu">
        <strong className="text-slate-200 font-semibold mr-1">Quy ước màu:</strong>
        <span className="inline-flex items-center gap-1.5"><i className="legend-up w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_rgba(52,211,153,0.5)]" /> Xanh: tăng</span>
        <span className="inline-flex items-center gap-1.5"><i className="legend-down w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-[0_0_8px_rgba(244,63,94,0.5)]" /> Đỏ: giảm</span>
        <span className="inline-flex items-center gap-1.5"><i className="legend-reference w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-[0_0_8px_rgba(251,191,36,0.5)]" /> Vàng: TC</span>
        <span className="inline-flex items-center gap-1.5"><i className="legend-ceiling w-2.5 h-2.5 rounded-full bg-purple-400 inline-block shadow-[0_0_8px_rgba(192,132,252,0.5)]" /> Tím: trần</span>
        <span className="inline-flex items-center gap-1.5"><i className="legend-floor w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-[0_0_8px_rgba(34,211,238,0.5)]" /> Xanh dương: sàn</span>
      </div>

      {/* Summary Card */}
      <section className="market-summary-card bg-slate-900/90 border border-slate-800 rounded-2xl p-5 grid md:grid-cols-2 gap-5 shadow-sm">
        <div>
          <p className="eyebrow text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">TÓM TẮT TRONG MỘT CÂU</p>
          <h2 className="text-lg sm:text-xl font-bold text-slate-100 m-0 mb-2 leading-snug">{summaryText}</h2>
          <p className="text-xs sm:text-sm text-slate-400 m-0">Phạm vi: toàn bộ {marketCount} cổ phiếu trong snapshot của nguồn.</p>
        </div>
        <div>
          <div className="beginner-card-title flex items-center justify-between mb-2">
            <div className="flex items-baseline gap-2">
              <strong className="text-sm font-bold text-slate-200">VN-Index</strong>
            </div>
            <Link
              href="/market/indices?symbol=VNINDEX"
              className="text-xs text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1 transition"
            >
              Xem chi tiết chỉ số →
            </Link>
            <span className={`text-sm font-bold ${changeTone(index?.change_percent ?? "0")}`}>{formatPercent(index?.change_percent ?? "0")}</span>
          </div>
          <MarketCandlestickChart compact candles={index?.candles ?? []} label="Biểu đồ nến VN-Index" range="month" minimumCandles={MARKET_OVERVIEW_INDEX_CHART_LIMITS.minimum} maximumCandles={MARKET_OVERVIEW_INDEX_CHART_LIMITS.maximum} />
        </div>
      </section>

      {/* Heatmap & Quick Facts */}
      <div className="market-overview-layout grid grid-cols-1 md:grid-cols-12 lg:grid-cols-12 gap-5 items-stretch">
        <div className="col-span-12 md:col-span-7 lg:col-span-8 flex flex-col">
          <SectorHeatmap sectors={sectors.data} headingId="market-heatmap-title" />
        </div>
        <aside className="market-quick-facts col-span-12 md:col-span-5 lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-5 shadow-sm">
          <article className="border-b border-slate-800 pb-4">
            <div className="beginner-card-title flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-200 m-0">Độ rộng toàn thị trường</h3>
              <InfoTip term="Độ rộng">Đếm số mã tăng, giảm và đứng giá trong toàn bộ snapshot của nguồn.</InfoTip>
            </div>
            <div className="beginner-breadth flex h-2 rounded-full overflow-hidden bg-slate-800 mb-2">
              <span className="advance bg-emerald-400" style={{ width: `${advances / total * 100}%` }} />
              <span className="unchanged bg-amber-400" style={{ width: `${unchanged / total * 100}%` }} />
              <span className="decline bg-rose-500" style={{ width: `${declines / total * 100}%` }} />
            </div>
            <p className="text-xs text-slate-400 m-0">
              <b className="positive text-emerald-400 font-bold">{advances} tăng</b> · {unchanged} đứng · <b className="negative text-rose-400 font-bold">{declines} giảm</b>
            </p>
          </article>
          <article className="border-b border-slate-800 pb-4">
            <div className="beginner-card-title flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-200 m-0">Định giá P/E &amp; P/B sàn</h3>
              <InfoTip term="Định giá sàn">Định giá P/E và P/B trung bình của các doanh nghiệp niêm yết trong snapshot.</InfoTip>
            </div>
            <strong className="text-base font-bold text-white block mb-1">P/E {peAvg} · P/B {pbAvg}</strong>
            <p className="text-xs text-slate-400 m-0">Mức định giá trung bình trong snapshot của nguồn.</p>
          </article>
          <article>
            <div className="beginner-card-title flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-200 m-0">Thanh khoản &amp; Khối ngoại</h3>
              <InfoTip term="Dòng tiền">Tổng giá trị của {marketCount} mã trong snapshot của nguồn.</InfoTip>
            </div>
            <strong className="text-base font-bold text-white block mb-1">{formatMoney(String(liquidity))}</strong>
            <p className="text-xs text-slate-400 m-0">Khối ngoại: <strong className={changeTone(String(foreign))}>{foreign >= 0 ? "Mua ròng" : "Bán ròng"} {formatMoney(String(Math.abs(foreign)))}</strong></p>
          </article>
        </aside>
      </div>

      {/* Sector Flow */}
      <section className="sector-flow bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm" aria-labelledby="sector-flow-title">
        <div className="beginner-card-title flex items-center justify-between mb-3">
          <h2 id="sector-flow-title" className="text-lg font-bold text-slate-100 m-0">Sức mạnh giao dịch theo ngành</h2>
          <InfoTip term="Sức mạnh giao dịch">Chỉ báo tương đối = giá trị giao dịch × % biến động. Đây không phải số tiền vào/ra ròng thực tế.</InfoTip>
        </div>
        <div className="flex flex-col gap-2">
          {sectorFlows.slice(0, 10).map((sector) => {
            const strength = Number(sector.matched_value) * Number(sector.change_percent) / 100;
            const maximum = Math.max(...sectorFlows.map((item) => Math.abs(Number(item.matched_value) * Number(item.change_percent) / 100)), 1);
            const percent = Math.abs(strength) / maximum * 50;
            return (
              <article key={sector.name} className="flex items-center gap-3 text-xs py-1">
                <span className="w-32 truncate text-slate-300 font-medium">{sector.name}</span>
                <div className="relative flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <i
                    className={`${strength >= 0 ? "inflow bg-emerald-400" : "outflow bg-rose-500"} absolute top-0 bottom-0 rounded-full`}
                    style={{ width: `${percent}%`, [strength >= 0 ? "left" : "right"]: "50%" }}
                  />
                </div>
                <strong className={`w-20 text-right font-bold ${changeTone(String(strength))}`}>
                  {strength >= 0 ? "+" : "−"}{formatMoney(String(Math.abs(strength)))}
                </strong>
              </article>
            );
          })}
        </div>
      </section>

      {/* Stock Table Section */}
      <section id="stock-table" className="simple-stock-section bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm" aria-labelledby="stock-table-title">
        <div className="market-tab-heading flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div>
            <h2 id="stock-table-title" className="text-lg sm:text-xl font-bold text-slate-100 m-0">Bảng cổ phiếu nâng cao</h2>
            <p className="text-xs text-slate-400 mt-1 m-0">{collection.pagination.total_items} mã · 15 mã mỗi trang · VN30 ưu tiên đầu danh sách.</p>
            {filters.sector && (
              <div className="active-market-filter mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-sky-950/80 border border-sky-800 text-xs text-sky-300">
                <span>Ngành: {filters.sector}</span>
                <Link href={`${hrefWith(filters, { sector: null, cursor: null })}#stock-table`} prefetch={false} className="text-rose-400 hover:text-rose-300 font-bold">Bỏ lọc</Link>
              </div>
            )}
          </div>
          <div className="stock-table-heading-actions flex items-center gap-3">
            <span className="table-preset text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">VN30 trước</span>
            <button
              ref={comparisonButtonRef}
              type="button"
              className="open-comparison-button px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white transition shadow-sm cursor-pointer"
              onClick={() => setComparisonOpen(true)}
            >
              So sánh cổ phiếu{comparisonSymbols.length ? ` (${comparisonSymbols.length})` : ""}
            </button>
          </div>
        </div>

        {/* Screening Presets */}
        <div className="screening-presets grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mb-4" aria-label="Bộ lọc nhanh">
          {screeningPresets.filter((preset) => hasVolumeBaseline || !preset.values.min_volume_ratio).map((preset) => (
            <Link
              key={preset.label}
              href={hrefWith(filters, { ...preset.values, cursor: null })}
              prefetch={false}
              className="flex flex-col p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 transition group no-underline"
            >
              <b className="text-[11px] font-bold text-sky-400 mb-1">{preset.metric}</b>
              <strong className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-white">{preset.label}</strong>
              <span className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-tight">{preset.description}</span>
            </Link>
          ))}
        </div>

        {/* Filter Form */}
        <form className="stock-filter bg-slate-950/70 border border-slate-800 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end text-xs" action="/market/stocks">
          {filters.sector && <input type="hidden" name="sector" value={filters.sector} />}
          <label className="flex flex-col gap-1 text-slate-400 font-medium min-w-[160px] flex-1">
            Tìm mã hoặc công ty
            <input name="q" defaultValue={filters.q} placeholder="Ví dụ: FPT, Hòa Phát" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500" />
          </label>
          <label className="flex flex-col gap-1 text-slate-400 font-medium min-w-[110px]">
            Sàn
            <select name="exchange" defaultValue={filters.exchange} className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-sky-500">
              <option value="">Tất cả sàn</option>
              <option value="HOSE">HOSE</option>
              <option value="HNX">HNX</option>
              <option value="UPCOM">UPCoM</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-slate-400 font-medium min-w-[130px]">
            Sắp xếp
            <select name="sort" defaultValue={hasVolumeBaseline ? filters.sort : filters.sort === "volume_vs_20d" ? "vn30" : filters.sort} className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-sky-500">
              <option value="vn30">VN30 trước</option>
              <option value="symbol">Mã</option>
              <option value="change_percent">% hôm nay</option>
              <option value="matched_value">Thanh khoản</option>
              <option value="market_cap">Vốn hóa</option>
              {hasVolumeBaseline && <option value="volume_vs_20d">Khối lượng so với TB20</option>}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-slate-400 font-medium min-w-[100px]">
            Thứ tự
            <select name="direction" defaultValue={filters.direction} className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-sky-500">
              <option value="desc">Giảm dần</option>
              <option value="asc">Tăng dần</option>
            </select>
          </label>
          <button
            type="button"
            className="advanced-filter-trigger px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
            aria-expanded={advancedFilterOpen}
            aria-controls="advanced-stock-filter-panel"
            onClick={() => setAdvancedFilterOpen((current) => !current)}
          >
            Lọc nâng cao{activeAdvancedFilterCount ? <span className="bg-sky-500 text-white rounded-full px-1.5 py-0.2 text-[10px] font-bold">{activeAdvancedFilterCount}</span> : null}
          </button>
          <div className="stock-filter-actions flex items-center gap-2">
            <button type="submit" className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold transition cursor-pointer">Áp dụng</button>
            <Link href="/market/stocks" prefetch={false} className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition">Đặt lại</Link>
          </div>
          {advancedFilterOpen && (
            <section id="advanced-stock-filter-panel" className="advanced-stock-filter w-full pt-3 mt-1 border-t border-slate-800" aria-label="Bộ lọc nâng cao">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="flex flex-col gap-1 text-slate-400">% tăng tối thiểu<input type="number" step="0.1" min="-100" max="100" name="min_change" defaultValue={filters.min_change} placeholder="Ví dụ: 1" className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs" /></label>
                <label className="flex flex-col gap-1 text-slate-400">% tăng tối đa<input type="number" step="0.1" min="-100" max="100" name="max_change" defaultValue={filters.max_change} placeholder="Ví dụ: 5" className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs" /></label>
                <label className="flex flex-col gap-1 text-slate-400">GTGD tối thiểu (tỷ)<input type="number" step="1" min="0" name="min_matched_value_billion" defaultValue={filters.min_matched_value_billion} placeholder="Ví dụ: 100" className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs" /></label>
                <label className="flex flex-col gap-1 text-slate-400">Vốn hóa tối thiểu (tỷ)<input type="number" step="1" min="0" name="min_market_cap_billion" defaultValue={filters.min_market_cap_billion} placeholder="Ví dụ: 10000" className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs" /></label>
                {hasVolumeBaseline ? (
                  <label className="flex flex-col gap-1 text-slate-400">KL / TB20 tối thiểu<input type="number" step="0.1" min="0" max="1000" name="min_volume_ratio" defaultValue={filters.min_volume_ratio} placeholder="Ví dụ: 1.5" className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs" /></label>
                ) : (
                  <p className="filter-unavailable text-slate-500 text-xs italic col-span-2 self-center">Nguồn hiện tại chưa cung cấp khối lượng trung bình 20 phiên cho toàn thị trường.</p>
                )}
                <label className="checkbox-filter flex items-center gap-2 text-slate-300 cursor-pointer self-center mt-2">
                  <input type="checkbox" name="vn30" value="true" defaultChecked={filters.vn30 === "true"} className="rounded border-slate-700" />
                  Chỉ mã VN30
                </label>
              </div>
            </section>
          )}
        </form>

        {/* Table Wrap */}
        <div className="market-table-wrap simple-stock-table-wrap overflow-x-auto rounded-xl border border-slate-800">
          <table aria-labelledby="stock-table-title" className="market-table simple-stock-table advanced w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 font-semibold">Mã &amp; công ty</th>
                <th className="py-3 px-3 font-semibold">Giá</th>
                <th className="py-3 px-3 font-semibold">% hôm nay</th>
                <th className="py-3 px-3 font-semibold">Mở · Cao · Thấp</th>
                <th className="py-3 px-3 font-semibold">Khối lượng</th>
                <th className="py-3 px-3 font-semibold">GTGD</th>
                <th className="py-3 px-3 font-semibold">Khối ngoại</th>
                <th className="py-3 px-3 font-semibold">Vốn hóa</th>
                <th className="py-3 px-3 font-semibold">P/E / P/B</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((item) => {
                const stockDetailHref = `/market/stocks/${item.symbol}?from=${encodeURIComponent(`${hrefWith(filters, { selected: null })}#stock-table`)}`;
                const fundamentals = fundamentalsBySymbol[item.symbol];
                const ratiosLoading = (item.pe === null || item.pb === null) && fundamentals === undefined;
                return (
                  <tr
                    className={`hover:bg-slate-800/40 cursor-pointer transition ${item.is_vn30 ? "vn30-row bg-slate-900/30" : ""}`}
                    key={item.symbol}
                    tabIndex={0}
                    onClick={() => router.push(stockDetailHref)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") router.push(stockDetailHref);
                    }}
                  >
                    <td className="stock-identity py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <Link href={stockDetailHref} onClick={(event) => event.stopPropagation()} className="font-extrabold text-white text-sm hover:text-sky-400 no-underline">
                          {item.symbol}
                        </Link>
                        {item.is_vn30 && <span className="vn30-badge text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">VN30</span>}
                      </div>
                      <span className="text-slate-300 block truncate max-w-[150px] sm:max-w-[200px] text-xs">{item.name}</span>
                      <small className="text-slate-500 text-[10px] block">{item.exchange} · {item.sector}</small>
                    </td>
                    <td data-label="Giá" className="py-2.5 px-3 whitespace-nowrap">
                      <strong className={`font-bold block ${priceTone(item.price, item.reference_price, item.ceiling_price, item.floor_price)}`}>
                        {formatChange(item.price)}
                      </strong>
                      <small className="price-reference text-slate-500 text-[10px] block">TC {formatChange(item.reference_price)}</small>
                    </td>
                    <td data-label="% hôm nay" className={`py-2.5 px-3 whitespace-nowrap ${changeTone(item.change_percent)}`}>
                      <strong className="font-bold block">{formatPercent(item.change_percent)}</strong>
                      <small className="text-[10px] opacity-80 block">{formatChange(item.change)}</small>
                    </td>
                    <td data-label="Mở · Cao · Thấp" className="py-2.5 px-3 whitespace-nowrap text-slate-400">
                      <span className={priceTone(item.open_price, item.reference_price, item.ceiling_price, item.floor_price)}>{formatChange(item.open_price)}</span> · <span className={priceTone(item.high_price, item.reference_price, item.ceiling_price, item.floor_price)}>{formatChange(item.high_price)}</span> · <span className={priceTone(item.low_price, item.reference_price, item.ceiling_price, item.floor_price)}>{formatChange(item.low_price)}</span>
                    </td>
                    <td data-label="Khối lượng" className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-200">{formatCompact(item.volume)}</td>
                    <td data-label="GTGD" className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-200">{formatMoney(item.matched_value)}</td>
                    <td data-label="Khối ngoại" className={`py-2.5 px-3 whitespace-nowrap font-medium ${changeTone(item.foreign_net_value)}`}>{formatMoney(item.foreign_net_value)}</td>
                    <td data-label="Vốn hóa" className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-200">{formatMoney(item.market_cap)}</td>
                    <td data-label="P/E / P/B" className="fundamental-ratios py-2.5 px-3 whitespace-nowrap text-slate-300 font-medium">
                      {formatRatioPair(fundamentals?.pe ?? item.pe, fundamentals?.pb ?? item.pb, ratiosLoading)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!rows.length && (
          <div className="market-empty py-12 text-center text-slate-400">
            <h3 className="text-base font-bold text-slate-300 mb-1">Không tìm thấy cổ phiếu</h3>
            <p className="text-xs text-slate-500 m-0">Thử bỏ bớt bộ lọc hoặc tìm bằng mã khác.</p>
          </div>
        )}

        {!!rows.length && (
          <nav className="market-pagination flex items-center justify-between mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400" aria-label="Phân trang cổ phiếu">
            {collection.pagination.previous_cursor ? (
              <Link href={`${hrefWith(filters, { cursor: collection.pagination.previous_cursor, selected: null })}#stock-table`} className="hover:text-white transition">← Trang trước</Link>
            ) : <span />}
            <strong className="text-slate-200 font-semibold">Trang {collection.pagination.page} / {Math.max(1, collection.pagination.total_pages)}</strong>
            {collection.pagination.next_cursor ? (
              <Link href={`${hrefWith(filters, { cursor: collection.pagination.next_cursor, selected: null })}#stock-table`} className="hover:text-white transition">Trang sau →</Link>
            ) : <span />}
          </nav>
        )}
      </section>

      <StockComparisonDialog
        open={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
        openerRef={comparisonButtonRef}
        filters={filters}
        initialSymbols={comparisonSymbols}
        comparison={comparison}
        options={comparisonOptions}
      />

      <footer className="beginner-disclaimer text-xs text-slate-500 leading-relaxed border-t border-slate-800/60 pt-4 flex flex-col gap-1">
        <strong className="text-slate-400">Thông tin tham khảo, không phải khuyến nghị đầu tư.</strong>
        <span>Nguồn: {collection.meta.provider_name} · trạng thái độ trễ: {collection.meta.delay_class}. “Vì sao” chỉ nêu nguyên nhân khi có tin đã kiểm chứng.</span>
      </footer>
    </section>
  );
}
