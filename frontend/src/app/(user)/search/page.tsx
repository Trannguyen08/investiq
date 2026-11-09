"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { PaperOrderDialog } from "@/components/portfolio/paper-order-dialog";
import {
  changeTone,
  formatChange,
  formatCompact,
  formatMoney,
  formatPercent,
  formatRatioPair,
  priceTone,
} from "@/components/market/formatters";
import type { PaperDashboard } from "@/types/portfolio";

export const dynamic = "force-dynamic";

type Timeframe = "day" | "week" | "month" | "year";

type StockReport = {
  label: string;
  change_percent: string;
  trend_label?: string;
  high_price?: string;
  low_price?: string;
  amplitude?: string;
  volume_label?: string;
  risk_reward?: string;
  summary: string;
};

type StockData = {
  symbol: string;
  name: string;
  exchange: string;
  sector?: string;
  price: string;
  reference_price: string;
  ceiling_price?: string;
  floor_price?: string;
  open_price?: string;
  high_price?: string;
  low_price?: string;
  change: string;
  change_percent: string;
  volume: string;
  matched_value: string;
  foreign_net_value?: string;
  market_cap?: string;
  pe?: string | null;
  pb?: string | null;
  is_vn30?: boolean;
  reports: Record<Timeframe, StockReport>;
  news: Array<{
    id: string;
    title: string;
    source: string;
    published_at: string;
    sentiment?: string | null;
  }>;
};

type GeneralResult = {
  title: string;
  snippet: string;
  url: string;
  category: string;
};

type StockSuggestion = {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
};

type SearchResponse =
  | { type: "stock"; stock: StockData }
  | {
      type: "general";
      query: string;
      results: GeneralResult[];
      suggestions?: StockSuggestion[];
    }
  | {
      type: "empty";
      message: string;
      suggestions?: StockSuggestion[];
    };

function getPriceColorClass(price: string, ref: string, ceil = "", floor = ""): string {
  const p = Number(price);
  const r = Number(ref);
  const c = Number(ceil);
  const f = Number(floor);
  if (!p || isNaN(p) || !r || isNaN(r)) return "text-slate-100";
  if (c && p >= c) return "text-purple-400";
  if (f && p <= f) return "text-cyan-400";
  if (p > r) return "text-emerald-400";
  if (p < r) return "text-rose-500";
  return "text-amber-400";
}

function getChangeColorClass(val: string | number): string {
  const n = Number(val);
  if (!n || isNaN(n)) return "text-amber-400";
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-rose-500";
  return "text-amber-400";
}

function getForeignColorClass(val: string | number | undefined): string {
  const n = Number(val || 0);
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-rose-500";
  return "text-slate-400";
}

function SearchContent() {
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q")?.trim() ?? "";

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("day");

  const { status } = useAuth();
  const [dashboard, setDashboard] = useState<PaperDashboard | null>(null);
  const [orderModal, setOrderModal] = useState<{
    open: boolean;
    side: "buy" | "sell";
    instrument: { symbol: string; name: string; price: string } | null;
  }>({ open: false, side: "buy", instrument: null });

  // Load portfolio dashboard to check holding status for Buy/Sell button
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/portfolio-api")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && !data.error) setDashboard(data);
        })
        .catch(() => {});
    }
  }, [status]);

  // Fetch search results
  useEffect(() => {
    if (!currentQuery) {
      setResponse(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    fetch(`/search-api?q=${encodeURIComponent(currentQuery)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SearchResponse | null) => {
        if (cancelled) return;
        if (data) {
          setResponse(data);
        } else {
          setResponse({ type: "empty", message: "Không thể tra cứu thông tin lúc này." });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResponse({ type: "empty", message: "Đã xảy ra sự cố kết nối." });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentQuery]);

  const isHolding = response?.type === "stock" && Boolean(
    dashboard?.holdings?.some((h) => h.symbol === response.stock.symbol)
  );

  return (
    <div className="search-page min-h-screen bg-[#06111f] text-slate-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb & Query Header - Removed giant search input block per user request */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <p className="text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-1">
              KẾT QUẢ TÌM KIẾM &amp; TRA CỨU
            </p>
            <h1 className="text-xl sm:text-2xl font-black text-white m-0 tracking-tight">
              {currentQuery ? (
                <>Từ khóa: <span className="text-sky-400">&ldquo;{currentQuery}&rdquo;</span></>
              ) : (
                "Tra cứu thông tin"
              )}
            </h1>
          </div>
          <Link
            href="/market/stocks"
            className="text-xs font-semibold text-slate-400 hover:text-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 transition"
          >
            ← Bảng giá thị trường
          </Link>
        </div>

        {/* Results area */}
        {loading ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-16 text-center text-slate-400 shadow-xl">
            <div className="inline-block w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium">Đang nạp dữ liệu cho &ldquo;{currentQuery}&rdquo;...</p>
          </div>
        ) : !currentQuery ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-16 text-center text-slate-400 shadow-xl">
            <p className="text-sm">Vui lòng nhập mã cổ phiếu hoặc từ khóa trên thanh tìm kiếm của Header để tra cứu.</p>
          </div>
        ) : response?.type === "stock" ? (
          <div className="space-y-6">
            {/* Stock Header & Timeframe Report Section */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="px-3.5 py-1.5 bg-sky-950 border border-sky-800 text-sky-400 font-black text-lg rounded-xl tracking-wide">
                    {response.stock.symbol}
                  </span>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white m-0">
                      {response.stock.name}
                    </h2>
                    <span className="text-xs text-slate-400">
                      Sàn: {response.stock.exchange} · Ngành: {response.stock.sector || "Chứng khoán"}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/market/stocks/${response.stock.symbol}`}
                  className="text-xs font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-950/60 border border-sky-800/80 transition"
                >
                  Mở biểu đồ nến &amp; BCTC chi tiết →
                </Link>
              </div>

              {/* Timeframe reports with expanded analysis & metrics */}
              <div className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
                  <span className="text-xs font-bold text-slate-300 tracking-wider uppercase flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                    Báo cáo hiệu suất theo khung thời gian
                  </span>
                  <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                    {(["day", "week", "month", "year"] as const).map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setSelectedTimeframe(tf)}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                          selectedTimeframe === tf
                            ? "bg-sky-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {tf === "day" ? "Ngày" : tf === "week" ? "Tuần" : tf === "month" ? "Tháng" : "Năm"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Report Content Card with Rich Metrics */}
                {response.stock.reports[selectedTimeframe] && (
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-5 space-y-4">
                    {/* Top row: Change badge, trend tag & risk/reward assessment */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={`px-3 py-1 rounded-lg text-sm font-black tracking-tight ${
                            Number(response.stock.reports[selectedTimeframe].change_percent.replace("%", "").replace("+", "")) >= 0
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-rose-950 text-rose-400 border border-rose-800"
                          }`}
                        >
                          {Number(response.stock.reports[selectedTimeframe].change_percent.replace("%", "").replace("+", "")) >= 0 ? "+" : ""}
                          {response.stock.reports[selectedTimeframe].change_percent}
                        </span>
                        {response.stock.reports[selectedTimeframe].trend_label && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 border border-slate-700 text-sky-300">
                            {response.stock.reports[selectedTimeframe].trend_label}
                          </span>
                        )}
                      </div>
                      {response.stock.reports[selectedTimeframe].risk_reward && (
                        <span className="text-xs font-semibold text-slate-400 bg-slate-900/60 px-3 py-1 rounded-lg border border-slate-800">
                          {response.stock.reports[selectedTimeframe].risk_reward}
                        </span>
                      )}
                    </div>

                    {/* Detailed text narrative */}
                    <p className="text-xs sm:text-sm text-slate-300 m-0 leading-relaxed">
                      {response.stock.reports[selectedTimeframe].summary}
                    </p>

                    {/* 4 Quantitative KPI measurement cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-900">
                      <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-850">
                        <span className="text-[11px] text-slate-400 block mb-0.5">Đỉnh · Đáy kỳ</span>
                        <strong className="text-xs sm:text-sm font-bold text-white">
                          {response.stock.reports[selectedTimeframe].high_price || "—"} / {response.stock.reports[selectedTimeframe].low_price || "—"}
                        </strong>
                      </div>
                      <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-850">
                        <span className="text-[11px] text-slate-400 block mb-0.5">Biên độ dao động</span>
                        <strong className="text-xs sm:text-sm font-bold text-amber-300">
                          {response.stock.reports[selectedTimeframe].amplitude || "—"}
                        </strong>
                      </div>
                      <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-850">
                        <span className="text-[11px] text-slate-400 block mb-0.5">Thanh khoản</span>
                        <strong className="text-xs sm:text-sm font-bold text-slate-200">
                          {response.stock.reports[selectedTimeframe].volume_label || formatCompact(response.stock.volume)}
                        </strong>
                      </div>
                      <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-850">
                        <span className="text-[11px] text-slate-400 block mb-0.5">Định giá P/E · P/B</span>
                        <strong className="text-xs sm:text-sm font-bold text-sky-400">
                          {formatRatioPair(response.stock.pe, response.stock.pb, false)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 1-row transaction info table exactly formatted like Image 4 */}
              <div className="mt-7 pt-5 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    Thông tin giao dịch &amp; Đặt lệnh nhanh
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Bấm &ldquo;Mua&rdquo; hoặc &ldquo;Bán&rdquo; để mở cửa sổ đặt lệnh ảo
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#081726] shadow-lg">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-[#0b2136] border-b border-slate-800 text-slate-400 text-[11px] font-bold tracking-wider uppercase">
                        <th className="py-2.5 px-3.5 whitespace-nowrap text-left">Mã &amp; công ty</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-center">Giá</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-center">% hôm nay</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-center">Mở · Cao · Thấp</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-center">Khối lượng</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-center">GTGD</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-center">Khối ngoại</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-center">Vốn hóa</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-center">P/E / P/B</th>
                        <th className="py-2.5 px-3.5 whitespace-nowrap text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-slate-900/60 transition bg-[#081726]">
                        {/* 1. Mã & Công ty (Căn trái) */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-left">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/market/stocks/${response.stock.symbol}`}
                              className={`font-black text-sm no-underline hover:underline ${getPriceColorClass(response.stock.price, response.stock.reference_price, response.stock.ceiling_price, response.stock.floor_price)}`}
                            >
                              {response.stock.symbol}
                            </Link>
                            {response.stock.is_vn30 && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                VN30
                              </span>
                            )}
                          </div>
                          <span className="text-slate-300 block truncate max-w-[180px] sm:max-w-[220px] text-xs mt-0.5">
                            {response.stock.name}
                          </span>
                          <small className="text-slate-500 text-[10px] block">
                            {response.stock.exchange} · {response.stock.sector || "Dịch vụ tài chính"}
                          </small>
                        </td>

                        {/* 2. Giá (Căn giữa) */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-center">
                          <strong className={`font-black text-sm block leading-tight ${getPriceColorClass(response.stock.price, response.stock.reference_price, response.stock.ceiling_price, response.stock.floor_price)}`}>
                            {formatChange(response.stock.price)}
                          </strong>
                          <small className="text-amber-400 text-[10px] font-semibold block leading-tight mt-0.5">
                            TC {formatChange(response.stock.reference_price)}
                          </small>
                        </td>

                        {/* 3. % Hôm nay (Căn giữa) */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-center">
                          <strong className={`font-black text-sm block leading-tight ${getChangeColorClass(response.stock.change_percent)}`}>
                            {formatPercent(response.stock.change_percent)}
                          </strong>
                          <small className={`text-[10px] font-semibold block leading-tight mt-0.5 ${getChangeColorClass(response.stock.change)}`}>
                            {formatChange(response.stock.change)}
                          </small>
                        </td>

                        {/* 4. Mở · Cao · Thấp (Căn giữa) */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-xs text-center">
                          <span className={`font-semibold ${getPriceColorClass(response.stock.open_price || response.stock.price, response.stock.reference_price, response.stock.ceiling_price, response.stock.floor_price)}`}>
                            {formatChange(response.stock.open_price || response.stock.price)}
                          </span>
                          <span className="text-slate-600"> · </span>
                          <span className={`font-semibold ${getPriceColorClass(response.stock.high_price || response.stock.price, response.stock.reference_price, response.stock.ceiling_price, response.stock.floor_price)}`}>
                            {formatChange(response.stock.high_price || response.stock.price)}
                          </span>
                          <span className="text-slate-600"> · </span>
                          <span className={`font-semibold ${getPriceColorClass(response.stock.low_price || response.stock.price, response.stock.reference_price, response.stock.ceiling_price, response.stock.floor_price)}`}>
                            {formatChange(response.stock.low_price || response.stock.price)}
                          </span>
                        </td>

                        {/* 5. Khối lượng (Căn giữa) */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-100 text-xs text-center">
                          {formatCompact(response.stock.volume)}
                        </td>

                        {/* 6. GTGD (Căn giữa) */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-100 text-xs text-center">
                          {formatMoney(response.stock.matched_value)}
                        </td>

                        {/* 7. Khối ngoại (Căn giữa) */}
                        <td className={`py-2.5 px-3 whitespace-nowrap font-bold text-xs text-center ${getForeignColorClass(response.stock.foreign_net_value)}`}>
                          {formatMoney(response.stock.foreign_net_value || "0")}
                        </td>

                        {/* 8. Vốn hóa (Căn giữa) */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-100 text-xs text-center">
                          {formatMoney(response.stock.market_cap || "0")}
                        </td>

                        {/* 9. P/E / P/B (Căn giữa) */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-100 font-bold text-xs text-center">
                          {formatRatioPair(response.stock.pe, response.stock.pb, false)}
                        </td>

                        {/* 10. Thao tác: Mua / Bán(nếu đã mua) (Căn giữa) */}
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                setOrderModal({
                                  open: true,
                                  side: "buy",
                                  instrument: {
                                    symbol: response.stock.symbol,
                                    name: response.stock.name,
                                    price: response.stock.price,
                                  },
                                });
                              }}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-black transition shadow-sm cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950"
                            >
                              Mua
                            </button>
                            {isHolding && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOrderModal({
                                    open: true,
                                    side: "sell",
                                    instrument: {
                                      symbol: response.stock.symbol,
                                      name: response.stock.name,
                                      price: response.stock.price,
                                    },
                                  });
                                }}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-black transition shadow-sm cursor-pointer bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950"
                              >
                                Bán
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Related news block */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                Tin tức liên quan đến {response.stock.symbol}
              </h3>
              {response.stock.news.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {response.stock.news.map((item) => (
                    <article
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between"
                    >
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-200 hover:text-sky-400 mb-2 leading-snug">
                        <Link href={`/news/${item.id}`} prefetch={false}>
                          {item.title}
                        </Link>
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-900">
                        <span>Nguồn: {item.source}</span>
                        <span>•</span>
                        <span>{item.published_at}</span>
                        {item.sentiment && (
                          <>
                            <span>•</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                item.sentiment === "positive"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : item.sentiment === "negative"
                                  ? "bg-rose-950 text-rose-400 border border-rose-800"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {item.sentiment === "positive" ? "Tích cực" : item.sentiment === "negative" ? "Tiêu cực" : "Trung tính"}
                            </span>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Chưa ghi nhận tin tức mới cho mã cổ phiếu này.</p>
              )}
            </div>
          </div>
        ) : response?.type === "general" ? (
          <div className="space-y-6">
            {response.suggestions && response.suggestions.length > 0 && (
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-4">
                <div>
                  <h2 className="text-base font-bold text-amber-400 m-0">
                    Không tìm thấy mã cổ phiếu &ldquo;{currentQuery.toUpperCase()}&rdquo; — Gợi ý mã gần đúng
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 m-0">
                    Có phải bạn đang muốn tra cứu một trong các mã cổ phiếu niêm yết sau:
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {response.suggestions.map((sug) => (
                    <Link
                      key={sug.symbol}
                      href={`/search?q=${encodeURIComponent(sug.symbol)}`}
                      className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-sky-500/60 transition flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            {sug.symbol}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {sug.exchange}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-100 group-hover:text-sky-400 transition m-0 mb-1">
                          {sug.name}
                        </p>
                        <p className="text-[11px] text-slate-400 m-0">
                          Ngành: {sug.sector}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-sky-400 mt-3 inline-block">
                        Tra cứu mã {sug.symbol} →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-base font-bold text-white pb-3 border-b border-slate-800">
                Kết quả tìm kiếm phù hợp ({response.results.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {response.results.map((res, index) => (
                  <article
                    key={index}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-950 text-sky-400 border border-sky-800">
                          {res.category}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white mb-1">
                        <Link href={res.url} className="hover:text-sky-400 transition">
                          {res.title}
                        </Link>
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed mb-3">
                        {res.snippet}
                      </p>
                    </div>
                    <Link
                      href={res.url}
                      className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 self-start"
                    >
                      Truy cập ngay →
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-xl space-y-6">
            <div className="text-center">
              <h2 className="text-base sm:text-lg font-bold text-white mb-2">
                Không tìm thấy mã cổ phiếu &ldquo;{currentQuery.toUpperCase()}&rdquo;
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                Không tìm thấy mã cổ phiếu, bài học hay nội dung nào khớp chính xác với từ khóa &ldquo;{currentQuery}&rdquo;.
              </p>
            </div>

            {response?.suggestions && response.suggestions.length > 0 && (
              <div className="pt-4 border-t border-slate-800/80 space-y-3">
                <p className="text-xs font-bold text-amber-400 text-center uppercase tracking-wider m-0">
                  Có phải bạn muốn tìm một trong các mã cổ phiếu gần đúng sau:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl mx-auto">
                  {response.suggestions.map((sug) => (
                    <Link
                      key={sug.symbol}
                      href={`/search?q=${encodeURIComponent(sug.symbol)}`}
                      className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-sky-500/60 transition flex flex-col justify-between text-left group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            {sug.symbol}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {sug.exchange}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-100 group-hover:text-sky-400 transition m-0 mb-1">
                          {sug.name}
                        </p>
                        <p className="text-[11px] text-slate-400 m-0">
                          Ngành: {sug.sector}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-sky-400 mt-3 inline-block">
                        Xem báo cáo {sug.symbol} →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Simulated order popup dialog */}
      {orderModal.open && orderModal.instrument && (
        <PaperOrderDialog
          open={orderModal.open}
          onClose={() => setOrderModal({ open: false, side: "buy", instrument: null })}
          side={orderModal.side}
          instrument={orderModal.instrument}
          dashboard={dashboard}
          onSuccess={() => {
            fetch("/portfolio-api")
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data && !data.error) setDashboard(data);
              })
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#06111f] p-8 text-center text-slate-400">
          Đang nạp trang tìm kiếm...
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
