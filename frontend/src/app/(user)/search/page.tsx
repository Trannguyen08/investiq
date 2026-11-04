"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/hooks/use-auth";
import { PaperOrderDialog } from "@/components/portfolio/paper-order-dialog";
import type { PaperDashboard } from "@/types/portfolio";

export const dynamic = "force-dynamic";

type Timeframe = "day" | "week" | "month" | "year";

type StockReport = {
  label: string;
  change_percent: string;
  summary: string;
};

type StockData = {
  symbol: string;
  name: string;
  exchange: string;
  price: string;
  reference_price: string;
  change: string;
  change_percent: string;
  volume: string;
  matched_value: string;
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

type SearchResponse =
  | { type: "stock"; stock: StockData }
  | { type: "general"; query: string; results: GeneralResult[] }
  | { type: "empty"; message: string };

const SUGGESTED_TICKERS = ["SSI", "HPG", "FPT", "VCB", "MBB", "VNM", "MWG", "VHM", "VIX", "VND"];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";

  const [inputVal, setInputVal] = useState(initialQ);
  const [currentQuery, setCurrentQuery] = useState(initialQ);
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

  // Sync with searchParams
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setInputVal(q);
    setCurrentQuery(q);
  }, [searchParams]);

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
    const trimmed = currentQuery.trim();
    if (!trimmed) {
      setResponse(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    fetch(`/search-api?q=${encodeURIComponent(trimmed)}`)
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

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleSelectTicker(ticker: string) {
    setInputVal(ticker);
    router.push(`/search?q=${encodeURIComponent(ticker)}`);
  }

  const isHolding = response?.type === "stock" && Boolean(
    dashboard?.holdings?.some((h) => h.symbol === response.stock.symbol)
  );

  return (
    <div className="search-page min-h-screen bg-[#06111f] text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Search header & input */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
            Tìm kiếm &amp; Tra cứu thông tin
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mb-4">
            Nhập mã cổ phiếu (ví dụ: SSI, HPG, FPT) để xem báo cáo đa khung thời gian và đặt lệnh, hoặc từ khóa để tra cứu bài học, tin tức và tính năng.
          </p>

          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="search"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Nhập mã cổ phiếu hoặc từ khóa..."
                className="w-full h-11 pl-10 pr-10 bg-slate-950 text-white placeholder-slate-400 text-sm rounded-xl border border-slate-700/80 focus:border-sky-500 focus:outline-none transition shadow-inner"
                autoFocus
              />
              <span className="absolute left-3 top-3.5 text-slate-400" aria-hidden="true">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 1114 0z" />
                </svg>
              </span>
              {inputVal && (
                <button
                  type="button"
                  onClick={() => setInputVal("")}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white text-sm"
                  aria-label="Xóa từ khóa"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-5 h-11 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm rounded-xl transition shadow-md shadow-sky-600/20 cursor-pointer shrink-0"
            >
              Tìm kiếm
            </button>
          </form>

          {/* Suggested tickers */}
          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-slate-800/80">
            <span className="text-xs text-slate-400 mr-1">Gợi ý nhanh:</span>
            {SUGGESTED_TICKERS.map((ticker) => (
              <button
                key={ticker}
                type="button"
                onClick={() => handleSelectTicker(ticker)}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer border ${
                  currentQuery.toUpperCase() === ticker
                    ? "bg-sky-600/20 border-sky-500 text-sky-400"
                    : "bg-slate-800/60 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/80"
                }`}
              >
                {ticker}
              </button>
            ))}
          </div>
        </div>

        {/* Results area */}
        {loading ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 shadow-xl">
            <div className="inline-block w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium">Đang tra cứu dữ liệu cho &quot;{currentQuery}&quot;...</p>
          </div>
        ) : !currentQuery ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 shadow-xl">
            <p className="text-sm">Vui lòng nhập từ khóa hoặc chọn một mã cổ phiếu gợi ý ở trên để bắt đầu tra cứu.</p>
          </div>
        ) : response?.type === "stock" ? (
          <div className="space-y-6">
            {/* Stock header summary card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-sky-950 border border-sky-800 text-sky-400 font-extrabold text-base rounded-xl">
                    {response.stock.symbol}
                  </span>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white m-0">
                      {response.stock.name}
                    </h2>
                    <span className="text-xs text-slate-400">
                      Sàn: {response.stock.exchange}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/market/stocks/${response.stock.symbol}`}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 transition"
                >
                  Xem chi tiết biểu đồ nến &amp; BCTC →
                </Link>
              </div>

              {/* Timeframe reports */}
              <div className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                    Báo cáo theo khung thời gian
                  </span>
                  <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                    {(["day", "week", "month", "year"] as const).map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setSelectedTimeframe(tf)}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
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

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-start gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold shrink-0 ${
                      Number(response.stock.reports[selectedTimeframe].change_percent) >= 0
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/80"
                        : "bg-rose-950/80 text-rose-400 border border-rose-800/80"
                    }`}
                  >
                    {Number(response.stock.reports[selectedTimeframe].change_percent) >= 0 ? "+" : ""}
                    {response.stock.reports[selectedTimeframe].change_percent}%
                  </span>
                  <p className="text-xs sm:text-sm text-slate-300 m-0 leading-relaxed">
                    {response.stock.reports[selectedTimeframe].summary}
                  </p>
                </div>
              </div>

              {/* 1-row transaction info table */}
              <div className="mt-6 pt-5 border-t border-slate-800">
                <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3">
                  Thông tin giao dịch &amp; Đặt lệnh nhanh
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">Giá khớp</th>
                        <th className="py-2.5 px-4">Khối lượng</th>
                        <th className="py-2.5 px-4">Tăng / Giảm</th>
                        <th className="py-2.5 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-bold text-white text-sm">
                          {Number(response.stock.price).toLocaleString("vi-VN")} đ
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-medium">
                          {Number(response.stock.volume).toLocaleString("vi-VN")} CP
                        </td>
                        <td
                          className={`py-3 px-4 font-bold ${
                            Number(response.stock.change) >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {Number(response.stock.change) >= 0 ? "+" : ""}
                          {Number(response.stock.change).toLocaleString("vi-VN")} (
                          {Number(response.stock.change_percent) >= 0 ? "+" : ""}
                          {response.stock.change_percent}%)
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (response?.type === "stock") {
                                setOrderModal({
                                  open: true,
                                  side: isHolding ? "sell" : "buy",
                                  instrument: {
                                    symbol: response.stock.symbol,
                                    name: response.stock.name,
                                    price: response.stock.price,
                                  },
                                });
                              }
                            }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer ${
                              isHolding
                                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20"
                                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                            }`}
                          >
                            {isHolding ? "Bán" : "Mua"}
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Related news block */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-4">
                Tin tức liên quan đến {response.stock.symbol}
              </h3>
              {response.stock.news.length ? (
                <div className="space-y-2.5">
                  {response.stock.news.map((item) => (
                    <article
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition"
                    >
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-200 hover:text-sky-400 mb-1 leading-snug">
                        <Link href={`/news/${item.id}`} prefetch={false}>
                          {item.title}
                        </Link>
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
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
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white pb-3 border-b border-slate-800">
              Kết quả tìm kiếm phù hợp ({response.results.length})
            </h2>
            <div className="space-y-3">
              {response.results.map((res, index) => (
                <article
                  key={index}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition"
                >
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
                  <p className="text-xs text-slate-300 leading-relaxed mb-2">
                    {res.snippet}
                  </p>
                  <Link
                    href={res.url}
                    className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1"
                  >
                    Truy cập ngay →
                  </Link>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-10 text-center shadow-xl">
            <span className="text-4xl block mb-3" aria-hidden="true">🔍</span>
            <h2 className="text-base sm:text-lg font-bold text-white mb-2">
              Không tìm thấy thông tin
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
              Không tìm thấy mã cổ phiếu, bài học hay nội dung nào khớp với từ khóa &quot;{currentQuery}&quot;. Vui lòng kiểm tra lại chính tả hoặc thử một mã cổ phiếu khác.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_TICKERS.slice(0, 6).map((ticker) => (
                <button
                  key={ticker}
                  type="button"
                  onClick={() => handleSelectTicker(ticker)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                >
                  Tra cứu {ticker}
                </button>
              ))}
            </div>
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
