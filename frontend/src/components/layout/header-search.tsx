"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { PaperOrderDialog } from "@/components/portfolio/paper-order-dialog";
import type { PaperDashboard } from "@/types/portfolio";

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

export function HeaderSearch() {
  const { status } = useAuth();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("day");
  const [dashboard, setDashboard] = useState<PaperDashboard | null>(null);
  const [orderModal, setOrderModal] = useState<{
    open: boolean;
    side: "buy" | "sell";
    instrument: { symbol: string; name: string; price: string } | null;
  }>({ open: false, side: "buy", instrument: null });

  const containerRef = useRef<HTMLDivElement>(null);

  // Tải danh mục sở hữu nếu người dùng đã đăng nhập để xác định quyền Bán
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

  // Đóng dropdown khi click ngoài hoặc ấn ESC
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Gọi API tìm kiếm khi query thay đổi (debounce 250ms)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResponse(null);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/search-api?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data: SearchResponse = await res.json();
          setResponse(data);
          setIsOpen(true);
        } else {
          setResponse({ type: "empty", message: "Không thể tra cứu thông tin lúc này." });
          setIsOpen(true);
        }
      } catch {
        setResponse({ type: "empty", message: "Đã xảy ra sự cố kết nối." });
        setIsOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Kiểm tra xem người dùng có sở hữu mã đang hiển thị không
  const isStockOwned = Boolean(
    response?.type === "stock" &&
      dashboard?.holdings?.some(
        (h) => h.symbol.toUpperCase() === response.stock.symbol.toUpperCase() && Number(h.quantity) > 0,
      ),
  );

  const openOrder = (side: "buy" | "sell", stock: StockData) => {
    setOrderModal({
      open: true,
      side,
      instrument: {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price || stock.reference_price || "0",
      },
    });
    setIsOpen(false);
  };

  return (
    <>
      <div className="relative flex items-center" ref={containerRef}>
        {/* Search Input Bar */}
        <div className="flex items-center relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (response) setIsOpen(true);
            }}
            placeholder="Tìm mã hoặc từ khóa..."
            className="w-36 sm:w-52 md:w-64 px-3 py-1.5 pl-8 pr-7 text-xs rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:w-72 transition-all shadow-inner"
          />
          {/* Search Icon */}
          <svg
            className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {/* Clear Button / Spinner */}
          {loading ? (
            <div className="absolute right-2.5 w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResponse(null);
                setIsOpen(false);
              }}
              className="absolute right-2 text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Dropdown Popover */}
        {isOpen && response && (
          <div className="header-search-popover absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-[92vw] sm:w-[480px] md:w-[540px] max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-4 text-xs text-slate-200">
            {/* TRƯỜNG HỢP A: BÁO CÁO CỔ PHIẾU */}
            {response.type === "stock" && (
              <div className="stock-quick-report flex flex-col gap-3.5">
                {/* Header mã CP */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-extrabold text-white tracking-wide">
                      {response.stock.symbol}
                    </span>
                    <span className="text-slate-400 truncate max-w-[200px] sm:max-w-[280px]">
                      {response.stock.name}
                    </span>
                  </div>
                  <Link
                    href={`/market/stocks/${response.stock.symbol}`}
                    onClick={() => setIsOpen(false)}
                    className="text-sky-400 hover:text-sky-300 text-[11px] font-semibold"
                  >
                    Xem chi tiết →
                  </Link>
                </div>

                {/* Tùy chọn khung thời gian Ngày, Tuần, Tháng, Năm */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Báo cáo theo khung thời gian
                    </span>
                    {/* Timeframe Toggle */}
                    <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                      {(["day", "week", "month", "year"] as const).map((tf) => {
                        const labels: Record<Timeframe, string> = {
                          day: "Ngày",
                          week: "Tuần",
                          month: "Tháng",
                          year: "Năm",
                        };
                        const active = selectedTimeframe === tf;
                        return (
                          <button
                            key={tf}
                            type="button"
                            onClick={() => setSelectedTimeframe(tf)}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                              active
                                ? "bg-sky-600 text-white shadow-sm"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {labels[tf]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Report Card */}
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 flex items-start gap-3">
                    <span
                      className={`text-sm font-extrabold px-2 py-0.5 rounded-md ${
                        response.stock.reports[selectedTimeframe].change_percent.startsWith("+")
                          ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                          : response.stock.reports[selectedTimeframe].change_percent.startsWith("-")
                            ? "bg-rose-950/80 text-rose-400 border border-rose-800/50"
                            : "bg-amber-950/80 text-amber-400 border border-amber-800/50"
                      }`}
                    >
                      {response.stock.reports[selectedTimeframe].change_percent}
                    </span>
                    <p className="text-slate-300 text-[11px] leading-relaxed m-0 flex-1">
                      {response.stock.reports[selectedTimeframe].summary}
                    </p>
                  </div>
                </div>

                {/* Bảng 1 dòng thông tin Giá, Khối lượng, Tăng giảm, Nút Mua/Bán */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Thông tin giao dịch &amp; Đặt lệnh
                  </span>
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                          <th className="py-2 px-3 font-semibold">Giá khớp</th>
                          <th className="py-2 px-3 font-semibold">Khối lượng</th>
                          <th className="py-2 px-3 font-semibold">Tăng / Giảm</th>
                          <th className="py-2 px-3 text-right font-semibold">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-medium">
                          <td className="py-2.5 px-3 font-bold text-white text-sm">
                            {Number(response.stock.price || response.stock.reference_price || 0).toLocaleString(
                              "vi-VN",
                            )}{" "}
                            <span className="text-[10px] text-slate-400 font-normal">đ</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-mono">
                            {Number(response.stock.volume || 0).toLocaleString("vi-VN")} CP
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`font-bold ${
                                Number(response.stock.change || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {Number(response.stock.change || 0) >= 0 ? "+" : ""}
                              {response.stock.change || "0"} (
                              {Number(response.stock.change_percent || 0) >= 0 ? "+" : ""}
                              {response.stock.change_percent || "0"}%)
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openOrder("buy", response.stock)}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition cursor-pointer"
                              >
                                Mua
                              </button>
                              {isStockOwned && (
                                <button
                                  type="button"
                                  onClick={() => openOrder("sell", response.stock)}
                                  className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow transition cursor-pointer"
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

                {/* Khối tin tức về mã cổ phiếu */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Tin tức liên quan {response.stock.symbol}
                  </span>
                  {response.stock.news.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {response.stock.news.map((item) => (
                        <Link
                          key={item.id}
                          href={`/news/${item.id}`}
                          onClick={() => setIsOpen(false)}
                          className="p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/60 transition flex flex-col gap-0.5 group"
                        >
                          <strong className="text-slate-200 group-hover:text-sky-300 font-semibold line-clamp-1">
                            {item.title}
                          </strong>
                          <span className="text-[10px] text-slate-500">
                            Nguồn: {item.source} · {new Date(item.published_at).toLocaleDateString("vi-VN")}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-[11px] italic m-0">
                      Chưa có tin tức mới nhất về mã này.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TRƯỜNG HỢP B: TÌM THẤY KẾT QUẢ TỔNG QUÁT */}
            {response.type === "general" && (
              <div className="general-search-results flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400 text-[11px] font-semibold">
                    Kết quả liên quan đến &ldquo;<b className="text-white">{response.query}</b>&rdquo;
                  </span>
                  <span className="text-slate-500 text-[10px]">{response.results.length} mục</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {response.results.map((item, idx) => (
                    <Link
                      key={idx}
                      href={item.url}
                      onClick={() => setIsOpen(false)}
                      className="p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800/80 transition flex flex-col gap-1 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-slate-200 group-hover:text-sky-300 font-bold line-clamp-1">
                          {item.title}
                        </strong>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/60 font-semibold shrink-0">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed m-0">
                        {item.snippet}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* TRƯỜNG HỢP C: KHÔNG CÓ THÔNG TIN */}
            {response.type === "empty" && (
              <div className="py-6 text-center flex flex-col items-center justify-center gap-1.5">
                <span className="text-2xl" aria-hidden="true">🔍</span>
                <strong className="text-slate-300 font-bold text-xs">{response.message}</strong>
                <p className="text-[11px] text-slate-500 m-0">
                  Thử tìm kiếm theo mã cổ phiếu (ví dụ: FPT, SSI, MBB) hoặc từ khóa bài học, tin tức.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Đặt lệnh Paper Trading */}
      {orderModal.open && orderModal.instrument && (
        <PaperOrderDialog
          open={orderModal.open}
          side={orderModal.side}
          instrument={orderModal.instrument}
          dashboard={dashboard}
          onClose={() => setOrderModal({ open: false, side: "buy", instrument: null })}
          onDashboard={setDashboard}
        />
      )}
    </>
  );
}
