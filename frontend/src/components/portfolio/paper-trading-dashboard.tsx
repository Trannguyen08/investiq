"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { useMarketStreamState } from "@/hooks/use-realtime-price";
import {
  PaperOrderDialog,
  requestPaperDashboard,
  getCachedPaperDashboard,
  invalidatePaperDashboardCache,
} from "@/components/portfolio/paper-order-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useVisibleFundamentals } from "@/hooks/use-visible-fundamentals";
import { roundVnd } from "@/lib/portfolio-math";
import type { MarketInstrument } from "@/types/market";
import type {
  PaperDashboard,
  PaperExecutionMode,
  PaperPricePoint,
  PositivePaperNews,
} from "@/types/portfolio";
import { ProfitLossDialog } from "./paper-pnl-dialog";
import { PaperDailyReportSection } from "./paper-daily-report-card";
import { PaperSocialVisibilitySection } from "./paper-social-card";
import { TradingDisciplineCard } from "./trading-discipline-card";
import { Pagination } from "@/components/ui/pagination";

const moneyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });
const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

function money(value: string | number | bigint) {
  if (typeof value === "bigint") return moneyFormat.format(value);
  if (typeof value === "string") return moneyFormat.format(roundVnd(value));
  return moneyFormat.format(value);
}

function moneyOrUnavailable(value: string | null) {
  return value === null ? "Chưa đủ giá" : money(value);
}

function tone(value: string | number) {
  const numeric = Number(value);
  return numeric > 0 ? "positive" : numeric < 0 ? "negative" : "neutral";
}

function Sparkline({ points, label }: { points: PaperPricePoint[]; label: string }) {
  if (points.length < 2) return <span className="paper-no-chart">Chưa đủ lịch sử giá</span>;
  const values = points.map((item) => Number(item.close));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const line = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 120;
      const y = 38 - ((value - min) / range) * 32;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="paper-sparkline" viewBox="0 0 120 44" role="img" aria-label={label}>
      <polyline points={line} fill="none" />
    </svg>
  );
}

type EquityResolutionMode = "auto" | "day" | "week" | "month" | "year";

function getWeekKey(iso: string): string {
  try {
    const d = new Date(iso);
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  } catch {
    return iso.slice(0, 10);
  }
}

function getMonthKey(iso: string): string {
  return iso.slice(0, 7);
}

function getYearKey(iso: string): string {
  return iso.slice(0, 4);
}

function formatResolutionDate(iso: string, res: "day" | "week" | "month" | "year"): string {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    if (res === "year") return `${year}`;
    if (res === "month") return `${month}/${year}`;
    if (res === "week") return `${day}/${month}/${year}`;
    return `${day}/${month}/${year}`;
  } catch {
    return iso;
  }
}

function resolutionLabel(res: "day" | "week" | "month" | "year"): string {
  switch (res) {
    case "day":
      return "Ngày";
    case "week":
      return "Tuần";
    case "month":
      return "Tháng";
    case "year":
      return "Năm";
  }
}

function aggregatePoints(
  rawPoints: { timestamp: string; value: string }[],
  res: "day" | "week" | "month" | "year"
): { timestamp: string; value: string }[] {
  if (res === "day" || rawPoints.length <= 2) {
    return rawPoints;
  }

  const grouped = new Map<string, { timestamp: string; value: string }>();
  const baseline = rawPoints[0];
  const latest = rawPoints[rawPoints.length - 1];

  for (let i = 0; i < rawPoints.length; i++) {
    const pt = rawPoints[i];
    let key = pt.timestamp.slice(0, 10);
    if (res === "week") key = getWeekKey(pt.timestamp);
    else if (res === "month") key = getMonthKey(pt.timestamp);
    else if (res === "year") key = getYearKey(pt.timestamp);

    grouped.set(key, pt);
  }

  const aggregated = Array.from(grouped.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (aggregated.length > 0 && aggregated[0].timestamp !== baseline.timestamp) {
    aggregated.unshift(baseline);
  }
  if (aggregated.length > 0 && aggregated[aggregated.length - 1].timestamp !== latest.timestamp) {
    aggregated.push(latest);
  }

  return aggregated.length >= 2 ? aggregated : rawPoints;
}

function EquityChart({ dashboard }: { dashboard: PaperDashboard }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedResolution, setSelectedResolution] = useState<EquityResolutionMode>("auto");

  const rawPoints = useMemo(() => {
    const curve = dashboard.equity_curve ?? [];
    if (curve.length >= 2) return curve;
    const startingCapital = dashboard.account.starting_cash || "100000000";
    const liveTotalValue = dashboard.account.total_value || startingCapital;
    const createdAt = dashboard.account.created_at || "2026-11-01T08:00:00Z";
    const todayIso = curve[0]?.timestamp || "2026-11-10T08:00:00Z";

    if (curve.length === 1) {
      return [
        { timestamp: createdAt, value: startingCapital },
        curve[0],
      ];
    }
    if ((dashboard.holdings && dashboard.holdings.length > 0) || (dashboard.trades && dashboard.trades.length > 0)) {
      return [
        { timestamp: createdAt, value: startingCapital },
        { timestamp: todayIso, value: liveTotalValue },
      ];
    }
    return curve;
  }, [dashboard]);

  const firstBuyTrade = useMemo(() => {
    const buys = (dashboard.trades ?? []).filter((t) => t.side === "buy");
    if (buys.length > 0) {
      return buys.reduce((earliest, cur) => (cur.created_at < earliest.created_at ? cur : earliest), buys[0]);
    }
    return null;
  }, [dashboard.trades]);

  const autoResolution = useMemo<"day" | "week" | "month" | "year">(() => {
    if (!rawPoints || rawPoints.length < 2) return "day";
    const first = new Date(rawPoints[0].timestamp).getTime();
    const last = new Date(rawPoints[rawPoints.length - 1].timestamp).getTime();
    const days = Math.max(1, Math.round((last - first) / (1000 * 60 * 60 * 24)));
    const count = rawPoints.length;

    if (days > 730 || count > 500) return "year";
    if (days > 180 || count > 120) return "month";
    if (days > 60 || count > 45) return "week";
    return "day";
  }, [rawPoints]);

  const effectiveResolution = selectedResolution === "auto" ? autoResolution : selectedResolution;

  const points = useMemo(() => {
    return aggregatePoints(rawPoints, effectiveResolution);
  }, [rawPoints, effectiveResolution]);

  if (points.length < 2) {
    return (
      <div className="paper-chart-empty">
        <strong>Biểu đồ sẽ xuất hiện sau khi bạn mua cổ phiếu</strong>
        <span>Dữ liệu cần ít nhất hai phiên giá quan sát.</span>
      </div>
    );
  }

  const startingCapital = Number(dashboard.account.starting_cash || "100000000");
  const liveTotalValue = Number(dashboard.account.total_value || startingCapital);
  const values = points.map((item, idx) => {
    if (idx === points.length - 1 && liveTotalValue > 0) {
      return liveTotalValue;
    }
    return Number(item.value);
  });
  const latestValue = liveTotalValue > 0 ? liveTotalValue : (values[values.length - 1] || startingCapital);
  const totalReturnVnd = latestValue - startingCapital;
  const totalReturnPercent = startingCapital > 0 ? ((totalReturnVnd / startingCapital) * 100).toFixed(2) : "0.00";

  let minVal = values[0];
  let minIdx = 0;
  let maxVal = values[0];
  let maxIdx = 0;
  values.forEach((v, i) => {
    if (v < minVal) {
      minVal = v;
      minIdx = i;
    }
    if (v > maxVal) {
      maxVal = v;
      maxIdx = i;
    }
  });

  const chartMin = Math.min(minVal, startingCapital) * 0.995;
  const chartMax = Math.max(maxVal, startingCapital) * 1.005;
  const range = chartMax - chartMin || 1;

  const width = 1000;
  const height = 260;
  const padLeft = 24;
  const padRight = 24;
  const padTop = 18;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const baselineY = padTop + plotH - ((startingCapital - chartMin) / range) * plotH;

  const coords = values.map((val, i) => {
    const x = padLeft + (i / (values.length - 1)) * plotW;
    const y = padTop + plotH - ((val - chartMin) / range) * plotH;
    return { x, y, val, timestamp: points[i].timestamp };
  });

  const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPoints = `${coords[0].x},${padTop + plotH} ${polylinePoints} ${coords[coords.length - 1].x},${padTop + plotH}`;

  const hoveredPoint = hoveredIndex !== null ? coords[hoveredIndex] : null;

  return (
    <div className="paper-equity-remake space-y-3.5">
      {/* 4 Thẻ KPI Tóm tắt tài sản trực quan */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-sm">
          <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Vốn ban đầu</span>
          <strong className="text-white text-base sm:text-lg font-extrabold">{money(startingCapital)}</strong>
          <small className="text-slate-500 block text-xs mt-0.5">Mốc khởi điểm</small>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-sm">
          <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Giá trị hiện tại</span>
          <strong className="text-sky-300 text-base sm:text-lg font-extrabold">{money(latestValue)}</strong>
          <small className={`block text-xs font-semibold mt-0.5 ${totalReturnVnd >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {totalReturnVnd >= 0 ? "+" : ""}{money(totalReturnVnd)} ({totalReturnVnd >= 0 ? "+" : ""}{totalReturnPercent}%)
          </small>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-sm">
          <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Đỉnh cao nhất</span>
          <strong className="text-emerald-400 text-base sm:text-lg font-extrabold">{money(maxVal)}</strong>
          <small className="text-slate-400 block text-xs mt-0.5">{formatResolutionDate(points[maxIdx].timestamp, "day")}</small>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-sm">
          <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Đáy thấp nhất</span>
          <strong className="text-amber-400 text-base sm:text-lg font-extrabold">{money(minVal)}</strong>
          <small className="text-slate-400 block text-xs mt-0.5">{formatResolutionDate(points[minIdx].timestamp, "day")}</small>
        </div>
      </div>

      {/* Thanh công cụ chọn chu kỳ hiển thị: Tự động, Ngày, Tuần, Tháng, Năm */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-1">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>
            {firstBuyTrade
              ? `Vẽ theo ngày kể từ khi mua (${formatResolutionDate(firstBuyTrade.created_at, "day")})`
              : `Mốc khởi điểm (${formatResolutionDate(dashboard.account.created_at, "day")})`}
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-sky-300 font-semibold">
            {effectiveResolution === "day" && `Hiển thị theo ngày (${points.length} phiên)`}
            {effectiveResolution === "week" && `Hiển thị theo tuần (${points.length} tuần)`}
            {effectiveResolution === "month" && `Hiển thị theo tháng (${points.length} tháng)`}
            {effectiveResolution === "year" && `Hiển thị theo năm (${points.length} năm)`}
          </span>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setSelectedResolution("auto")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedResolution === "auto"
                ? "bg-sky-500 text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
            title={`Tự động chuyển đổi chu kỳ (Hiện tại: Theo ${resolutionLabel(autoResolution)})`}
          >
            Tự động {selectedResolution === "auto" ? `(${resolutionLabel(autoResolution)})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setSelectedResolution("day")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedResolution === "day"
                ? "bg-sky-500 text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Ngày
          </button>
          <button
            type="button"
            onClick={() => setSelectedResolution("week")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedResolution === "week"
                ? "bg-sky-500 text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Tuần
          </button>
          <button
            type="button"
            onClick={() => setSelectedResolution("month")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedResolution === "month"
                ? "bg-sky-500 text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Tháng
          </button>
          <button
            type="button"
            onClick={() => setSelectedResolution("year")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedResolution === "year"
                ? "bg-sky-500 text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Năm
          </button>
        </div>
      </div>

      {/* Khung biểu đồ tương tác */}
      <div className="relative bg-slate-950/95 border border-slate-850 rounded-xl p-3 shadow-inner">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-[260px] overflow-visible cursor-crosshair block"
          onMouseLeave={() => setHoveredIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (rect.width <= 0) return;
            const clientX = e.clientX - rect.left;
            const svgX = (clientX / rect.width) * width;
            let closestIdx = 0;
            let closestDist = Math.abs(coords[0].x - svgX);
            coords.forEach((c, idx) => {
              const dist = Math.abs(c.x - svgX);
              if (dist < closestDist) {
                closestDist = dist;
                closestIdx = idx;
              }
            });
            setHoveredIndex(closestIdx);
          }}
        >
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#52dbae" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#52dbae" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Đường gióng ngang chuẩn (Gridlines trơn không đứt nét) */}
          <line x1={padLeft} y1={padTop} x2={width - padRight} y2={padTop} stroke="#1e293b" strokeWidth="1" />
          <line x1={padLeft} y1={padTop + plotH / 2} x2={width - padRight} y2={padTop + plotH / 2} stroke="#1e293b" strokeWidth="1" />
          <line x1={padLeft} y1={padTop + plotH} x2={width - padRight} y2={padTop + plotH} stroke="#1e293b" strokeWidth="1" />

          {/* Đường Baseline 100M VND chuẩn (Đường liền trơn không đứt nét) */}
          <line
            x1={padLeft}
            y1={baselineY}
            x2={width - padRight}
            y2={baselineY}
            stroke="#475569"
            strokeWidth="1.2"
          />
          <text x={padLeft + 6} y={baselineY - 6} fill="#94a3b8" fontSize="11" fontWeight="bold">
            Vốn gốc {money(startingCapital)}
          </text>

          {/* Vùng đổ màu gradient */}
          <polygon points={areaPoints} fill="url(#equityGradient)" />

          {/* Đường polyline giá trị */}
          <polyline points={polylinePoints} fill="none" stroke="#52dbae" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Điểm hover và đường gióng đứng (Liền trơn) */}
          {hoveredPoint && (
            <>
              <line
                x1={hoveredPoint.x}
                y1={padTop}
                x2={hoveredPoint.x}
                y2={padTop + plotH}
                stroke="#38bdf8"
                strokeWidth="1.5"
              />
              <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
            </>
          )}
        </svg>

        {/* Tooltip khi di chuột */}
        {hoveredPoint && (
          <div
            className="absolute top-4 pointer-events-none bg-slate-900/95 border border-sky-500/60 shadow-2xl rounded-lg p-3 text-xs text-slate-200 z-10"
            style={{
              left: `${Math.min(85, Math.max(15, (hoveredPoint.x / width) * 100))}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-bold text-sky-300 text-xs mb-1">
              {effectiveResolution === "week"
                ? `Mốc tuần: ${formatResolutionDate(hoveredPoint.timestamp, "week")}`
                : effectiveResolution === "month"
                ? `Mốc tháng: ${formatResolutionDate(hoveredPoint.timestamp, "month")}`
                : effectiveResolution === "year"
                ? `Mốc năm: ${formatResolutionDate(hoveredPoint.timestamp, "year")}`
                : `Phiên ngày: ${formatResolutionDate(hoveredPoint.timestamp, "day")}`}
            </div>
            <div>Giá trị danh mục: <strong className="text-white font-extrabold text-sm">{money(hoveredPoint.val)}</strong></div>
            <div className="text-xs mt-1">
              So với vốn ban đầu:{" "}
              <span className={hoveredPoint.val >= startingCapital ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {hoveredPoint.val >= startingCapital ? "+" : ""}{money(hoveredPoint.val - startingCapital)} ({(((hoveredPoint.val - startingCapital) / startingCapital) * 100).toFixed(2)}%)
              </span>
            </div>
          </div>
        )}

        {/* Mốc thời gian trục X */}
        <div className="flex justify-between items-center text-xs text-slate-400 px-2 pt-2 border-t border-slate-800/80">
          <span>{formatResolutionDate(points[0].timestamp, effectiveResolution)}</span>
          <span className="text-slate-400 font-medium">
            {effectiveResolution === "day" && `Chu kỳ: ${points.length} phiên (Theo ngày)`}
            {effectiveResolution === "week" && `Chu kỳ: ${points.length} mốc tuần (Theo tuần)`}
            {effectiveResolution === "month" && `Chu kỳ: ${points.length} mốc tháng (Theo tháng)`}
            {effectiveResolution === "year" && `Chu kỳ: ${points.length} mốc năm (Theo năm)`}
          </span>
          <span>{formatResolutionDate(points[points.length - 1].timestamp, effectiveResolution)}</span>
        </div>
      </div>

      <p className="text-xs text-slate-400 m-0 leading-relaxed italic">
        Biểu đồ tự động vẽ kể từ ngày mua cổ phiếu đầu tiên{firstBuyTrade ? ` (${formatResolutionDate(firstBuyTrade.created_at, "day")})` : ""}. Hệ thống tự động chuyển đổi sang hiển thị theo tuần, tháng hoặc năm khi số phiên giao dịch lớn để giữ đồ thị luôn thoáng rõ và dễ quan sát.
      </p>
    </div>
  );
}

const MARKET_PAGE_SIZE = 15;
const HOLDINGS_PAGE_SIZE = 10;
const ORDERS_PAGE_SIZE = 10;
const TRADES_PAGE_SIZE = 10;

export function PaperTradingDashboard({
  positiveNews,
  marketInstruments,
  marketLoadError = false,
  initialDashboard = null,
}: {
  positiveNews: PositivePaperNews[];
  marketInstruments: MarketInstrument[];
  marketLoadError?: boolean;
  initialDashboard?: PaperDashboard | null;
}) {
  const router = useRouter();
  const auth = useAuth();
  const [dashboard, setDashboard] = useState<PaperDashboard | null>(() => initialDashboard ?? getCachedPaperDashboard());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [selectedInstrument, setSelectedInstrument] = useState<{
    symbol: string;
    name: string;
    price: string | null;
  } | null>(null);
  const [orderTargetQuantity, setOrderTargetQuantity] = useState<number | string | undefined>(undefined);
  const [marketQuery, setMarketQuery] = useState("");
  const [marketPage, setMarketPage] = useState(1);
  const [holdingsPage, setHoldingsPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const [tradesPage, setTradesPage] = useState(1);
  const [orderSide, setOrderSide] = useState("all");
  const [orderSymbol, setOrderSymbol] = useState("");
  const [pnlDialog, setPnlDialog] = useState<"unrealized" | "realized" | null>(null);
  const [isTogglingMode, setIsTogglingMode] = useState(false);
  const [isAdvancingCash, setIsAdvancingCash] = useState(false);
  const [fillingOrderId, setFillingOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const csrfTokenRef = useRef<string | null>(null);
  const stream = useMarketStreamState();

  // Merge market instruments with live stream in real time (identical to /market/stocks)
  const rows = useMemo(
    () => marketInstruments.map((item) => mergeLiveInstrument(item, stream.items[item.symbol])),
    [marketInstruments, stream.items]
  );

  // Active price map tracking latest real-time prices across instruments and stream
  const activePriceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of rows) {
      if (item.price) map.set(item.symbol, item.price);
    }
    for (const [symbol, liveItem] of Object.entries(stream.items)) {
      if (liveItem && typeof (liveItem as any).price === "string") {
        map.set(symbol, (liveItem as any).price);
      }
    }
    return map;
  }, [rows, stream.items]);

  const currentPrices = useMemo(
    () => new Map(rows.map((item) => [item.symbol, item.price])),
    [rows]
  );

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    requestPaperDashboard()
      .then((value) => {
        if (!cancelled) {
          setDashboard(value);
          setError("");
        }
      })
      .catch((value: unknown) => {
        if (!cancelled) setError(value instanceof Error ? value.message : "Không thể tải danh mục.");
      });
    return () => {
      cancelled = true;
    };
  }, [auth.status]);

  // Periodic background re-sync every 15s to guarantee fresh portfolio state
  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const interval = setInterval(() => {
      requestPaperDashboard()
        .then((fresh) => {
          setDashboard(fresh);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [auth.status]);

  const exchangeSim = dashboard?.exchange_simulation;
  const activeExecutionMode: PaperExecutionMode = exchangeSim?.execution_mode ?? "instant";
  const t2Summary = exchangeSim?.t2_settlement;

  // Auto-dismiss notice toast after 3 seconds
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      setNotice("");
    }, 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Listen for query params or custom events to trigger paper trading order dialog
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkQueryParams = () => {
      const url = new URL(window.location.href);
      const action = url.searchParams.get("action");
      const sym = url.searchParams.get("symbol")?.toUpperCase();
      const sideParam = url.searchParams.get("side")?.toLowerCase();
      const qtyParam = url.searchParams.get("qty");

      if (action === "trade" && sym) {
        const found = rows.find((r) => r.symbol === sym) || {
          symbol: sym,
          name: sym,
          price: activePriceMap.get(sym) || null,
        };
        setSide(sideParam === "sell" ? "sell" : "buy");
        if (qtyParam) setOrderTargetQuantity(qtyParam);
        setSelectedInstrument(found);

        url.searchParams.delete("action");
        url.searchParams.delete("symbol");
        url.searchParams.delete("side");
        url.searchParams.delete("qty");
        window.history.replaceState({}, "", url.toString());
      }
    };

    checkQueryParams();

    const handleCustomTrade = (e: Event) => {
      const customEvent = e as CustomEvent<{
        symbol?: string;
        side?: "buy" | "sell";
        quantity?: number | string;
      }>;
      const detail = customEvent.detail;
      if (!detail?.symbol) return;
      const sym = detail.symbol.toUpperCase();
      const found = rows.find((r) => r.symbol === sym) || {
        symbol: sym,
        name: sym,
        price: activePriceMap.get(sym) || null,
      };
      setSide(detail.side === "sell" ? "sell" : "buy");
      if (detail.quantity) setOrderTargetQuantity(String(detail.quantity));
      setSelectedInstrument(found);
    };

    window.addEventListener("open-stock-trade", handleCustomTrade);
    return () => window.removeEventListener("open-stock-trade", handleCustomTrade);
  }, [rows, activePriceMap]);

  // Dynamically re-evaluate holdings with real-time market prices
  const liveHoldings = useMemo(() => {
    if (!dashboard?.holdings) return [];
    return dashboard.holdings.map((holding) => {
      const activePrice = activePriceMap.get(holding.symbol) ?? holding.current_price;
      const pendingBuyQty = activeExecutionMode === "exchange_hours"
        ? (t2Summary?.pending_buy_shares_by_symbol?.[holding.symbol] ?? 0)
        : 0;
      const liveAvailableQty = Math.max(0, holding.available_quantity - pendingBuyQty);

      if (!activePrice) return { ...holding, available_quantity: liveAvailableQty };

      const numPrice = Number(activePrice);
      const numAvgCost = Number(holding.average_cost);
      const qty = Number(holding.quantity);

      if (numPrice <= 0 || qty <= 0) return { ...holding, available_quantity: liveAvailableQty, current_price: activePrice };

      const marketVal = Math.round(numPrice * qty);
      const costBasis = numAvgCost > 0 ? Math.round(numAvgCost * qty) : Number(holding.total_cost_basis);
      const unrealizedPnl = marketVal - costBasis;
      const unrealizedPnlPct = costBasis > 0 ? ((unrealizedPnl / costBasis) * 100).toFixed(2) : holding.unrealized_pnl_percent;

      const liveInstrument = rows.find((r) => r.symbol === holding.symbol);
      const dailyChange = liveInstrument ? liveInstrument.change_percent : holding.daily_change_percent;

      return {
        ...holding,
        available_quantity: liveAvailableQty,
        current_price: activePrice,
        market_value: String(marketVal),
        unrealized_pnl: String(unrealizedPnl),
        unrealized_pnl_percent: unrealizedPnlPct,
        daily_change_percent: dailyChange,
      };
    });
  }, [dashboard, activePriceMap, rows, activeExecutionMode, t2Summary]);

  const holdingBySymbol = useMemo(
    () => new Map(liveHoldings.map((holding) => [holding.symbol, holding])),
    [liveHoldings]
  );
  const holdingsPageCount = Math.max(1, Math.ceil(liveHoldings.length / HOLDINGS_PAGE_SIZE));
  const visibleHoldings = useMemo(
    () =>
      liveHoldings.slice(
        (holdingsPage - 1) * HOLDINGS_PAGE_SIZE,
        holdingsPage * HOLDINGS_PAGE_SIZE
      ),
    [liveHoldings, holdingsPage]
  );

  useEffect(() => {
    if (holdingsPage > holdingsPageCount) {
      setHoldingsPage(holdingsPageCount);
    }
  }, [holdingsPage, holdingsPageCount]);

  const normalizedMarketQuery = marketQuery.trim().toLocaleUpperCase("vi-VN");
  const filteredMarket = useMemo(
    () =>
      rows.filter(
        (item) =>
          !normalizedMarketQuery ||
          item.symbol.includes(normalizedMarketQuery) ||
          item.name.toLocaleUpperCase("vi-VN").includes(normalizedMarketQuery)
      ),
    [rows, normalizedMarketQuery]
  );
  const marketPageCount = Math.max(1, Math.ceil(filteredMarket.length / MARKET_PAGE_SIZE));
  const visibleMarket = useMemo(
    () =>
      filteredMarket.slice(
        (marketPage - 1) * MARKET_PAGE_SIZE,
        marketPage * MARKET_PAGE_SIZE
      ),
    [filteredMarket, marketPage]
  );
  const fundamentalsBySymbol = useVisibleFundamentals(
    visibleMarket
      .filter((item) => item.pe === null || item.pb === null)
      .map((item) => item.symbol)
  );

  const filteredOrders = useMemo(
    () =>
      (dashboard?.orders ?? []).filter(
        (order) =>
          (orderSide === "all" || order.side === orderSide) &&
          (!orderSymbol.trim() || order.symbol.includes(orderSymbol.trim().toUpperCase()))
      ),
    [dashboard, orderSide, orderSymbol]
  );
  const ordersPageCount = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE));
  const visibleOrders = useMemo(
    () =>
      filteredOrders.slice(
        (ordersPage - 1) * ORDERS_PAGE_SIZE,
        ordersPage * ORDERS_PAGE_SIZE
      ),
    [filteredOrders, ordersPage]
  );

  useEffect(() => {
    if (ordersPage > ordersPageCount) {
      setOrdersPage(ordersPageCount);
    }
  }, [ordersPage, ordersPageCount]);

  const allTrades = useMemo(() => dashboard?.trades ?? [], [dashboard?.trades]);
  const tradesPageCount = Math.max(1, Math.ceil(allTrades.length / TRADES_PAGE_SIZE));
  const visibleTrades = useMemo(
    () =>
      allTrades.slice(
        (tradesPage - 1) * TRADES_PAGE_SIZE,
        tradesPage * TRADES_PAGE_SIZE
      ),
    [allTrades, tradesPage]
  );

  useEffect(() => {
    if (tradesPage > tradesPageCount) {
      setTradesPage(tradesPageCount);
    }
  }, [tradesPage, tradesPageCount]);

  const pendingBuyEntries = useMemo(() => {
    if (!t2Summary?.pending_buy_shares_by_symbol || activeExecutionMode === "instant") return [];
    return Object.entries(t2Summary.pending_buy_shares_by_symbol).filter(([, qty]) => qty > 0);
  }, [t2Summary, activeExecutionMode]);

  const hasActionableOrders = useMemo(
    () =>
      activeExecutionMode === "exchange_hours" &&
      filteredOrders.some((order) => order.status === "open" || order.status === "pending"),
    [activeExecutionMode, filteredOrders]
  );

  const nextSettlementDate = useMemo(() => {
    if (!t2Summary?.pending_buy_settlements?.length) return null;
    const items = t2Summary.pending_buy_settlements;
    if (items.length === 1) {
      try {
        return timeFormat.format(new Date(items[0].settles_at));
      } catch {
        return null;
      }
    }
    try {
      const datesBySymbol: string[] = [];
      const seen = new Set<string>();
      for (const it of items) {
        if (!seen.has(it.symbol)) {
          seen.add(it.symbol);
          datesBySymbol.push(`${it.symbol} (${timeFormat.format(new Date(it.settles_at))})`);
        }
      }
      return datesBySymbol.join(", ");
    } catch {
      return null;
    }
  }, [t2Summary]);

  const fetchCsrfToken = useCallback(async (): Promise<string> => {
    if (csrfTokenRef.current && process.env.NODE_ENV !== "test") return csrfTokenRef.current;
    const res = await fetch("/auth-api/csrf", { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { csrf_token?: string } | null;
    if (!res.ok || !body?.csrf_token) throw new Error("Không thể xác thực thao tác.");
    csrfTokenRef.current = body.csrf_token;
    return body.csrf_token;
  }, []);

  const toggleExecutionMode = useCallback(async (nextMode: PaperExecutionMode) => {
    if (!dashboard || isTogglingMode) return;
    const previousDashboard = dashboard;
    setIsTogglingMode(true);
    setError("");
    const startTime = Date.now();

    try {
      let csrf = await fetchCsrfToken();
      let res = await fetch("/portfolio-api/execution-mode", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify({ execution_mode: nextMode }),
      });
      if (res.status === 403) {
        csrfTokenRef.current = null;
        csrf = await fetchCsrfToken();
        res = await fetch("/portfolio-api/execution-mode", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf,
          },
          body: JSON.stringify({ execution_mode: nextMode }),
        });
      }
      const body = await res.json().catch(() => null) as (PaperDashboard & { detail?: string }) | null;
      if (!res.ok || !body?.account) {
        throw new Error(body?.detail ?? "Không thể chuyển chế độ khớp lệnh.");
      }
      if (process.env.NODE_ENV !== "test") {
        const elapsed = Date.now() - startTime;
        if (elapsed < 350) {
          await new Promise((resolve) => setTimeout(resolve, 350 - elapsed));
        }
      }
      invalidatePaperDashboardCache();
      setDashboard(body);
      setNotice(
        nextMode === "exchange_hours"
          ? "Đã chuyển sang chế độ Giờ sàn thật HOSE/HNX (09:00-11:30 & 13:00-14:45, kiểm tra biên độ Trần/Sàn & sổ lệnh 3 bước giá)."
          : "Đã chuyển sang chế độ Khớp tức thì 24/7 (tự động khớp toàn bộ theo giá quan sát mới nhất)."
      );
    } catch (reason) {
      setDashboard(previousDashboard);
      setError(reason instanceof Error ? reason.message : "Không thể chuyển chế độ khớp lệnh.");
    } finally {
      setIsTogglingMode(false);
    }
  }, [dashboard, isTogglingMode, fetchCsrfToken]);

  const handleAdvanceSaleCash = useCallback(async () => {
    if (isAdvancingCash) return;
    setIsAdvancingCash(true);
    setError("");
    setNotice("");
    try {
      let csrf = await fetchCsrfToken();
      let res = await fetch("/portfolio-api/advance-cash", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify({}),
      });
      if (res.status === 403) {
        csrfTokenRef.current = null;
        csrf = await fetchCsrfToken();
        res = await fetch("/portfolio-api/advance-cash", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf,
          },
          body: JSON.stringify({}),
        });
      }
      const body = await res.json().catch(() => null) as {
        advance?: { net_received: string; fee_amount: string };
        data?: PaperDashboard;
        detail?: string;
      } | null;
      if (!res.ok || !body?.data || !body?.advance) {
        throw new Error(body?.detail ?? "Không thể ứng trước tiền bán T+2.");
      }
      invalidatePaperDashboardCache();
      setDashboard(body.data);
      setNotice(
        `Ứng trước tiền bán T+2 thành công: Thực nhận ${money(body.advance.net_received)} (Phí ứng 0,03%/ngày: ${money(body.advance.fee_amount)}).`
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể ứng trước tiền bán T+2.");
    } finally {
      setIsAdvancingCash(false);
    }
  }, [isAdvancingCash, fetchCsrfToken]);

  const handleCancelWaitingOrder = useCallback(async (orderId: string) => {
    if (cancellingOrderId) return;
    setCancellingOrderId(orderId);
    setError("");
    setNotice("");
    try {
      let csrf = await fetchCsrfToken();
      let res = await fetch(`/portfolio-api/orders/${orderId}`, {
        method: "DELETE",
        cache: "no-store",
        headers: { "X-CSRF-Token": csrf },
      });
      if (res.status === 403) {
        csrfTokenRef.current = null;
        csrf = await fetchCsrfToken();
        res = await fetch(`/portfolio-api/orders/${orderId}`, {
          method: "DELETE",
          cache: "no-store",
          headers: { "X-CSRF-Token": csrf },
        });
      }
      const body = await res.json().catch(() => null) as {
        data?: PaperDashboard;
        order?: { symbol: string };
        detail?: string;
      } | null;
      if (!res.ok || !body?.data) {
        throw new Error(body?.detail ?? "Không thể hủy lệnh đang chờ.");
      }
      invalidatePaperDashboardCache();
      setDashboard(body.data);
      setNotice(`Đã hủy lệnh chờ ${body.order?.symbol ?? ""} và hoàn lại sức mua/cổ phiếu khả dụng.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể hủy lệnh đang chờ.");
    } finally {
      setCancellingOrderId(null);
    }
  }, [cancellingOrderId, fetchCsrfToken]);

  const handleForceFillWaitingOrder = useCallback(async (orderId: string) => {
    if (fillingOrderId) return;
    setFillingOrderId(orderId);
    setError("");
    setNotice("");
    try {
      let csrf = await fetchCsrfToken();
      let res = await fetch(`/portfolio-api/orders/${orderId}/fill`, {
        method: "POST",
        cache: "no-store",
        headers: { "X-CSRF-Token": csrf },
      });
      if (res.status === 403) {
        csrfTokenRef.current = null;
        csrf = await fetchCsrfToken();
        res = await fetch(`/portfolio-api/orders/${orderId}/fill`, {
          method: "POST",
          cache: "no-store",
          headers: { "X-CSRF-Token": csrf },
        });
      }
      const body = await res.json().catch(() => null) as {
        data?: PaperDashboard;
        trade?: { symbol: string; quantity: number; execution_price: string };
        detail?: string;
      } | null;
      if (!res.ok || !body?.data || !body?.trade) {
        throw new Error(body?.detail ?? "Không thể khớp nhanh lệnh đang chờ.");
      }
      invalidatePaperDashboardCache();
      setDashboard(body.data);
      setNotice(
        `Đã khớp nhanh ${body.trade.quantity} ${body.trade.symbol} tại giá ${money(body.trade.execution_price)}.`
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể khớp nhanh lệnh đang chờ.");
    } finally {
      setFillingOrderId(null);
    }
  }, [fillingOrderId, fetchCsrfToken]);

  const isUnauthenticated =
    auth.status === "anonymous" ||
    (auth.status !== "loading" && !auth.user) ||
    error.includes("chưa đăng nhập");

  if (auth.status === "loading" && !error) {
    return (
      <main id="main-content" className="paper-page">
        <div className="paper-state">Đang mở tài khoản mô phỏng…</div>
      </main>
    );
  }

  if (isUnauthenticated) {
    return (
      <main id="main-content" className="paper-page paper-unauth-page">
        <section className="paper-unauth-hero">
          <span className="paper-unauth-kicker">GIAO DỊCH MÔ PHỎNG THỰC TẾ</span>
          <h1 className="paper-unauth-title">Trải nghiệm Đầu tư Thực chiến với 1 Tỷ đồng Vốn Giả lập</h1>
          <p className="paper-unauth-subtitle">
            Hệ thống quản lý danh mục và khớp lệnh theo giá quan sát thời gian thực sàn HOSE & HNX. Rèn luyện tư duy kỷ luật, kiểm chứng chiến lược quản trị vốn và tích lũy kinh nghiệm mà không chịu bất kỳ rủi ro tài chính nào.
          </p>
          <div className="paper-unauth-actions">
            <Link href="/login" className="btn-unauth-primary">
              Đăng nhập để bắt đầu
            </Link>
            <Link href="/register" className="btn-unauth-secondary">
              Tạo tài khoản miễn phí
            </Link>
            <Link href="/community" className="link-unauth-community">
              Khám phá Bảng Xếp Hạng Cộng Đồng →
            </Link>
          </div>
        </section>

        <section className="paper-unauth-features" aria-label="Tính năng nổi bật của danh mục mô phỏng">
          <article className="unauth-feature-card">
            <div className="feature-card-header">
              <span className="feature-card-num">01</span>
              <h3>1.000.000.000 đ Vốn Sẵn Sàng</h3>
            </div>
            <p>Khởi đầu với 1 tỷ đồng tiền mặt mô phỏng. Trải nghiệm cảm giác phân bổ tài sản, giải ngân từng phần và quản lý rủi ro như một nhà đầu tư chuyên nghiệp.</p>
          </article>
          <article className="unauth-feature-card">
            <div className="feature-card-header">
              <span className="feature-card-num">02</span>
              <h3>Giá Thị Trường Sống Động</h3>
            </div>
            <p>Khớp lệnh mua/bán theo dữ liệu giá và bước giá thời gian thực từ sàn HOSE, HNX và UPCoM. Tính toán chính xác thuế, phí giao dịch giả lập.</p>
          </article>
          <article className="unauth-feature-card">
            <div className="feature-card-header">
              <span className="feature-card-num">03</span>
              <h3>Cộng Đồng & Bảng Xếp Hạng</h3>
            </div>
            <p>Tùy chọn công khai danh mục để so tài hiệu suất sinh lời cùng cộng đồng nhà đầu tư InvestIQ. Học hỏi chiến lược từ các danh mục dẫn đầu.</p>
          </article>
        </section>

      </main>
    );
  }

  if (!dashboard) {
    return (
      <main id="main-content" className="paper-page">
        <div className="paper-state" role={error ? "alert" : "status"}>
          {error || "Đang tải danh mục mô phỏng…"}
        </div>
      </main>
    );
  }

  function prepareOrder(selectedSide: "buy" | "sell", selectedSymbol: string) {
    if (!dashboard) return;
    const holding = holdingBySymbol.get(selectedSymbol);
    const marketInstrument = rows.find((item) => item.symbol === selectedSymbol);
    const opportunity = dashboard.opportunities.find((item) => item.symbol === selectedSymbol);
    const activePrice = activePriceMap.get(selectedSymbol) ?? marketInstrument?.price ?? holding?.current_price ?? opportunity?.price ?? null;
    setNotice("");
    setSide(selectedSide);
    setSelectedInstrument({
      symbol: selectedSymbol,
      name: marketInstrument?.name ?? holding?.name ?? opportunity?.name ?? selectedSymbol,
      price: activePrice,
    });
  }

  function changeMarketPage(nextPage: number) {
    setMarketPage(Math.max(1, Math.min(marketPageCount, nextPage)));
    globalThis.requestAnimationFrame?.(() => {
      document.getElementById("paper-market-table")?.scrollIntoView?.({ block: "start" });
    });
  }

  return (
    <main id="main-content" className="paper-page">
      <section className="paper-hero">
        <div>
          <p className="eyebrow">PHÒNG THỰC HÀNH ĐẦU TƯ</p>
          <h1>Danh mục mô phỏng của bạn</h1>
          <p>Dùng tiền giả định, giá thị trường quan sát và lịch sử giao dịch riêng tư để luyện tập trước khi đầu tư thật.</p>
        </div>
        <div className="paper-market-stamp">
          <span>{dashboard.market.provider_name}</span>
          <strong>{dashboard.market.delay_class}</strong>
          <time dateTime={dashboard.market.market_time}>
            {timeFormat.format(new Date(dashboard.market.market_time))}
          </time>
        </div>
      </section>

      <section className="paper-summary-grid" aria-label="Tổng quan tài khoản mô phỏng">
        <article className="primary">
          <span>Tổng tài sản mô phỏng</span>
          <strong>{moneyOrUnavailable(dashboard.account.total_value)}</strong>
          <em className={tone(dashboard.account.total_pnl ?? 0)}>
            {dashboard.account.total_pnl === null
              ? "Thiếu giá cho một mã"
              : `${money(dashboard.account.total_pnl)} · ${dashboard.account.total_return_percent}%`}
          </em>
        </article>
        <article>
          <span>Tiền khả dụng</span>
          <strong>{money(dashboard.account.available_cash)}</strong>
          <small>
            {Number(dashboard.account.reserved_cash) > 0
              ? `Đang giữ ${money(dashboard.account.reserved_cash)}`
              : "Có thể dùng để mua"}
          </small>
        </article>
        <article>
          <span>Giá vốn đang đầu tư</span>
          <strong>{money(dashboard.account.invested_cost)}</strong>
          <small>{dashboard.holdings.length} / {dashboard.assumptions.max_holdings} mã</small>
        </article>
        <article className="paper-summary-interactive">
          <button type="button" aria-haspopup="dialog" onClick={() => setPnlDialog("unrealized")}>
            <span>Lãi/lỗ chưa chốt</span>
            <strong className={tone(dashboard.account.unrealized_pnl ?? 0)}>
              {moneyOrUnavailable(dashboard.account.unrealized_pnl)}
            </strong>
            <small>Thay đổi theo giá quan sát</small>
            <em>Xem dự kiến theo khối lượng →</em>
          </button>
        </article>
        <article className="paper-summary-interactive">
          <button type="button" aria-haspopup="dialog" onClick={() => setPnlDialog("realized")}>
            <span>Lãi/lỗ đã chốt</span>
            <strong className={tone(dashboard.account.realized_pnl)}>
              {money(dashboard.account.realized_pnl)}
            </strong>
            <small>Sau phí và thuế mô phỏng</small>
            <em>Xem khoản lãi và khoản lỗ →</em>
          </button>
        </article>
      </section>

      <TradingDisciplineCard dashboard={dashboard} />

      <section className="paper-card paper-exchange-sim-bar" aria-label="Cấu hình mô phỏng sàn HOSE/HNX và Chu kỳ T+2">
        <div className="paper-exchange-sim-header">
          <div>
            <p className="eyebrow">CHẾ ĐỘ KHỚP LỆNH &amp; CHU KỲ BÙ TRỪ VSDC T+2</p>
            <h2>
              {activeExecutionMode === "exchange_hours"
                ? "Chế độ Giờ sàn thật HOSE/HNX (09:00-11:30 & 13:00-14:45)"
                : "Chế độ Khớp tức thì 24/7 (Môi trường học tập linh hoạt)"}
            </h2>
            <p>
              {exchangeSim?.session_message ??
                "Hỗ trợ đầy đủ lệnh LO, MP, ATO, ATC, biên độ Trần/Sàn, bước giá 10/50/100 ₫, sổ lệnh 3 bước giá và chu kỳ T+2."}
            </p>
          </div>
          <div className="paper-mode-switch" role="group" aria-label="Chọn chế độ khớp lệnh">
            <button
              type="button"
              className={activeExecutionMode === "instant" ? "active" : ""}
              aria-pressed={activeExecutionMode === "instant"}
              disabled={isTogglingMode}
              onClick={() => toggleExecutionMode("instant")}
            >
              {isTogglingMode && activeExecutionMode !== "instant" ? "Đang đồng bộ..." : "Khớp tức thì 24/7"}
            </button>
            <button
              type="button"
              className={activeExecutionMode === "exchange_hours" ? "active" : ""}
              aria-pressed={activeExecutionMode === "exchange_hours"}
              disabled={isTogglingMode}
              onClick={() => toggleExecutionMode("exchange_hours")}
            >
              {isTogglingMode && activeExecutionMode !== "exchange_hours" ? "Đang đồng bộ..." : "Giờ sàn thật HOSE/HNX"}
            </button>
          </div>
        </div>
        {t2Summary && (
          <div className="paper-t2-summary-grid">
            <div>
              <span>Cổ phiếu mua chờ về (T+2)</span>
              <strong>
                {pendingBuyEntries.length > 0
                  ? pendingBuyEntries
                      .map(([sym, qty]) => `${sym}: ${numberFormat.format(qty)} CP`)
                      .join(", ")
                  : "0 CP"}
              </strong>
              <small>
                {pendingBuyEntries.length > 0
                  ? nextSettlementDate
                    ? `Dự kiến về tài khoản: ${nextSettlementDate} (T+2)`
                    : "Về tài khoản lúc 13:00 ngày T+2"
                  : "Tất cả cổ phiếu đã về tài khoản và sẵn sàng giao dịch"}
              </small>
            </div>
            <div>
              <span>Tiền bán chờ về (T+2)</span>
              <strong>{money(t2Summary.receivable_cash_t2)}</strong>
              {Number(t2Summary.receivable_cash_t2) > 0 ? (
                <small>Khả dụng ứng trước: {money(t2Summary.advanceable_cash)}</small>
              ) : Number(t2Summary.already_advanced_cash) > 0 ? (
                <small className="text-emerald-400">
                  Đã ứng trước: {money(t2Summary.already_advanced_cash)} (đã cộng vào tiền mặt)
                </small>
              ) : (
                <small>Không có khoản tiền bán chờ về</small>
              )}
            </div>
            <div>
              <span>Ứng trước tiền bán (Phí 0,03%/ngày)</span>
              {Number(t2Summary.advanceable_cash) > 0 ? (
                <button
                  type="button"
                  disabled={isAdvancingCash}
                  onClick={handleAdvanceSaleCash}
                >
                  {isAdvancingCash
                    ? "Đang xử lý ứng trước..."
                    : `Ứng trước tiền bán (${money(t2Summary.net_advance_available)})`}
                </button>
              ) : Number(t2Summary.already_advanced_cash) > 0 ? (
                <small className="text-emerald-400">
                  Toàn bộ tiền bán đã được ứng trước về tài khoản
                </small>
              ) : (
                <small>Chưa có khoản tiền bán chờ về cần ứng</small>
              )}
            </div>
          </div>
        )}
      </section>

      {error && <p className="paper-inline-message error" role="alert">{error}</p>}
      {notice && (
        <div className="paper-trade-toast" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}

      <section className="paper-card paper-chart-card">
        <header>
          <div>
            <p className="eyebrow">HIỆU SUẤT ƯỚC TÍNH</p>
            <h2>Biến động giá trị danh mục</h2>
          </div>
          <span>Tối đa 90 phiên</span>
        </header>
        <EquityChart dashboard={dashboard} />
      </section>

      <section id="paper-market-table" className="paper-section paper-market-section" aria-labelledby="paper-market-title">
        <div className="paper-section-heading">
          <div>
            <p className="eyebrow">BẢNG GIÁ NÂNG CAO</p>
            <h2 id="paper-market-title">Chọn cổ phiếu để giao dịch mô phỏng</h2>
          </div>
          <span>{filteredMarket.length} mã</span>
        </div>
        <div className="paper-market-toolbar">
          <label htmlFor="paper-market-search">Tìm mã hoặc công ty</label>
          <input
            id="paper-market-search"
            value={marketQuery}
            onChange={(event) => {
              setMarketQuery(event.target.value);
              setMarketPage(1);
            }}
            placeholder="Ví dụ: FPT, Hòa Phát"
          />
          <p>Giá quan sát có thể trễ. Lệnh chỉ được gửi sau khi bạn xác nhận số lượng.</p>
        </div>
        {marketLoadError ? (
          <div className="paper-empty compact" role="alert">
            <strong>Không thể tải bảng giá</strong>
            <p>Nguồn dữ liệu thị trường đang gián đoạn. Không có dữ liệu giả được thay thế.</p>
            <button type="button" onClick={() => router.refresh()}>Thử tải lại</button>
          </div>
        ) : visibleMarket.length ? (
          <>
            <div className="market-table-wrap simple-stock-table-wrap paper-market-table-wrap">
              <table aria-label="Bảng cổ phiếu nâng cao để giao dịch mô phỏng" className="market-table simple-stock-table advanced paper-market-table">
                <thead>
                  <tr>
                    <th>Mã &amp; công ty</th>
                    <th>Giá</th>
                    <th>% hôm nay</th>
                    <th>Mở · Cao · Thấp</th>
                    <th>Khối lượng</th>
                    <th>GTGD</th>
                    <th>Khối ngoại</th>
                    <th>Vốn hóa</th>
                    <th>P/E / P/B</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMarket.map((item) => {
                    const holding = holdingBySymbol.get(item.symbol);
                    const fundamentals = fundamentalsBySymbol[item.symbol];
                    const ratiosLoading = (item.pe === null || item.pb === null) && fundamentals === undefined;
                    return (
                      <tr className={item.is_vn30 ? "vn30-row" : undefined} key={item.symbol}>
                        <td className="stock-identity">
                          <div>
                            <Link href={`/market/stocks/${item.symbol}?from=${encodeURIComponent("/portfolio#paper-market-table")}`} prefetch={false}>
                              {item.symbol}
                            </Link>
                            {item.is_vn30 && <span className="vn30-badge">VN30</span>}
                          </div>
                          <span>{item.name}</span>
                          <small>{item.exchange} · {item.sector}</small>
                        </td>
                        <td data-label="Giá">
                          <strong className={priceTone(item.price, item.reference_price, item.ceiling_price, item.floor_price)}>
                            {formatChange(item.price)}
                          </strong>
                          <small className="price-reference">TC {formatChange(item.reference_price)}</small>
                        </td>
                        <td data-label="% hôm nay" className={changeTone(item.change_percent)}>
                          <strong>{formatPercent(item.change_percent)}</strong>
                          <small>{formatChange(item.change)}</small>
                        </td>
                        <td data-label="Mở · Cao · Thấp">
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
                        <td data-label="Khối lượng">{formatCompact(item.volume)}</td>
                        <td data-label="GTGD">{formatMoney(item.matched_value)}</td>
                        <td data-label="Khối ngoại" className={changeTone(item.foreign_net_value)}>
                          {formatMoney(item.foreign_net_value)}
                        </td>
                        <td data-label="Vốn hóa">{formatMoney(item.market_cap)}</td>
                        <td data-label="P/E / P/B" className="fundamental-ratios">
                          {formatRatioPair(fundamentals?.pe ?? item.pe, fundamentals?.pb ?? item.pb, ratiosLoading)}
                        </td>
                        <td data-label="Thao tác">
                          <div className="paper-stock-actions">
                            <button type="button" onClick={() => prepareOrder("buy", item.symbol)} aria-label={`Mua ${item.symbol}`}>
                              Mua
                            </button>
                            {holding && holding.available_quantity > 0 && (
                              <button
                                type="button"
                                className="sell"
                                onClick={() => prepareOrder("sell", item.symbol)}
                                aria-label={`Bán ${item.symbol}`}
                                title={`Khả dụng ${holding.available_quantity} cổ phiếu`}
                              >
                                Bán
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={marketPage}
              totalPages={marketPageCount}
              totalItems={filteredMarket.length}
              pageSize={MARKET_PAGE_SIZE}
              itemLabel="mã cổ phiếu"
              onPageChange={(nextPage) => changeMarketPage(nextPage)}
              ariaLabel="Phân trang bảng cổ phiếu"
            />
          </>
        ) : (
          <div className="paper-empty compact">
            <strong>Chưa có dữ liệu cổ phiếu</strong>
            <p>Nguồn hiện tại trả về danh sách rỗng hoặc không có mã phù hợp với từ khóa.</p>
          </div>
        )}
      </section>

      <section className="paper-section">
        <div className="paper-section-heading">
          <div>
            <p className="eyebrow">ĐANG SỞ HỮU</p>
            <h2>Quản lý cổ phiếu đã mua</h2>
          </div>
          <span>{liveHoldings.length} mã</span>
        </div>
        {liveHoldings.length ? (
          <>
            <div className="paper-holdings-wrap">
            <table aria-label="Bảng quản lý cổ phiếu đã mua">
              <thead>
                <tr>
                  <th className="text-left">Mã &amp; công ty</th>
                  <th className="text-center">Sở hữu / khả dụng</th>
                  <th className="text-center">Giá vốn TB</th>
                  <th className="text-center">Giá hiện tại</th>
                  <th className="text-center">Giá trị</th>
                  <th className="text-center">Hôm nay</th>
                  <th className="text-center">Lãi/lỗ chưa chốt</th>
                  <th className="text-center">Tỷ trọng</th>
                  <th className="text-center">Xu hướng</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visibleHoldings.map((holding) => (
                  <tr key={holding.symbol}>
                    <td className="text-left">
                      <Link href={`/market/stocks/${holding.symbol}?from=${encodeURIComponent("/portfolio#paper-market-table")}`} prefetch={false}>
                        {holding.symbol}
                      </Link>
                      <span>{holding.name}</span>
                      <small>{holding.exchange} · {holding.sector ?? "Chưa phân loại"}</small>
                    </td>
                    <td className="text-center" data-label="Sở hữu / khả dụng">
                      {numberFormat.format(holding.quantity)} / {numberFormat.format(holding.available_quantity)} CP
                    </td>
                    <td className="text-center" data-label="Giá vốn TB">{money(holding.average_cost)}</td>
                    <td className="text-center" data-label="Giá hiện tại">{holding.current_price ? money(holding.current_price) : "Chưa có"}</td>
                    <td className="text-center" data-label="Giá trị">{moneyOrUnavailable(holding.market_value)}</td>
                    <td className={`text-center ${tone(holding.daily_change_percent ?? 0)}`} data-label="Hôm nay">
                      {holding.daily_change_percent === null ? "—" : `${Number(holding.daily_change_percent) > 0 ? "+" : ""}${holding.daily_change_percent}%`}
                    </td>
                    <td className={`text-center ${tone(holding.unrealized_pnl ?? 0)}`} data-label="Lãi/lỗ">
                      {holding.unrealized_pnl === null ? "Chưa đủ giá" : `${money(holding.unrealized_pnl)} · ${holding.unrealized_pnl_percent}%`}
                    </td>
                    <td className="text-center" data-label="Tỷ trọng">
                      {holding.portfolio_weight_percent === null ? "Chưa đủ giá" : `${holding.portfolio_weight_percent}%`}
                    </td>
                    <td className="text-center" data-label="Xu hướng">
                      <Sparkline points={holding.price_history} label={`Lịch sử giá ${holding.symbol}`} />
                    </td>
                    <td className="text-center" data-label="Thao tác">
                      <div className="paper-stock-actions">
                        <button type="button" onClick={() => prepareOrder("buy", holding.symbol)} aria-label={`Mua thêm ${holding.symbol}`}>
                          Mua thêm
                        </button>
                        <button
                          type="button"
                          className="sell"
                          disabled={holding.available_quantity === 0}
                          onClick={() => prepareOrder("sell", holding.symbol)}
                          aria-label={`Bán ${holding.symbol}`}
                        >
                          Bán
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={holdingsPage}
            totalPages={holdingsPageCount}
            totalItems={liveHoldings.length}
            pageSize={HOLDINGS_PAGE_SIZE}
            itemLabel="mã cổ phiếu"
            onPageChange={setHoldingsPage}
            ariaLabel="Phân trang danh mục cổ phiếu đã mua"
          />
        </>
        ) : (
          <div className="paper-empty">
            <strong>Chưa có cổ phiếu nào</strong>
            <p>Chọn “Mua” ở bảng giá phía trên. Chỉ lệnh đã khớp mới được tính vào danh mục.</p>
          </div>
        )}
      </section>

      <section className="paper-section" aria-labelledby="paper-orders-title">
        <div className="paper-section-heading">
          <div>
            <p className="eyebrow">SỔ LỆNH</p>
            <h2 id="paper-orders-title">Theo dõi và quản lý lệnh</h2>
          </div>
          <span>{filteredOrders.length} / {dashboard.orders.length} lệnh</span>
        </div>
        <p className="paper-order-execution-note">
          <strong>Tự động khớp trong môi trường học tập:</strong> InvestIQ ghi nhận toàn bộ số lượng theo giá quan sát mới nhất khi bạn xác nhận. Trên hệ thống giao dịch thật, lệnh có thể chờ, khớp một phần hoặc không khớp tùy giá, thanh khoản và trạng thái phiên.
        </p>
        <div className="paper-order-filters">
          <label>
            Chiều lệnh
            <select
              value={orderSide}
              onChange={(event) => {
                setOrderSide(event.target.value);
                setOrdersPage(1);
              }}
            >
              <option value="all">Mua và bán</option>
              <option value="buy">Mua</option>
              <option value="sell">Bán</option>
            </select>
          </label>
          <label>
            Mã cổ phiếu
            <input
              value={orderSymbol}
              onChange={(event) => {
                setOrderSymbol(event.target.value);
                setOrdersPage(1);
              }}
              placeholder="Ví dụ: FPT"
            />
          </label>
        </div>
        {filteredOrders.length ? (
          <>
            <div className="paper-trades-wrap">
              <table aria-label="Danh sách lệnh mô phỏng">
                <thead>
                  <tr>
                    <th className="text-left">Thời gian đặt</th>
                    <th className="text-center">Chiều</th>
                    <th className="text-center">Mã</th>
                    <th className="text-center">Thời gian khớp</th>
                    <th className="text-center">Kết quả</th>
                    <th className="text-center">Giá mô phỏng</th>
                    <th className="text-center">Số lượng</th>
                    {hasActionableOrders && <th className="text-center">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => {
                  const meta = exchangeSim?.order_meta?.[order.id];
                  const displayType = meta?.display_order_type ?? order.order_type;
                  return (
                    <tr key={order.id}>
                      <td className="text-left">{timeFormat.format(new Date(order.created_at))}</td>
                      <td className="text-center">
                        <span className={`paper-side ${order.side}`}>
                          {order.side === "buy" ? "Mua" : "Bán"} ({displayType})
                        </span>
                      </td>
                      <td className="text-center"><strong>{order.symbol}</strong></td>
                      <td className="text-center">
                        {order.status === "filled" ? (
                          <span className="text-slate-200">
                            {timeFormat.format(new Date(order.updated_at || order.created_at))}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="text-center">
                        <span
                          className={`paper-order-status ${order.status}`}
                          title={meta?.pending_reason || undefined}
                        >
                          {order.status === "filled"
                            ? activeExecutionMode === "exchange_hours"
                              ? "Đã khớp lệnh"
                              : "Đã tự động khớp"
                            : order.status === "cancelled"
                            ? "Đã hủy trước đây"
                            : order.status === "expired"
                            ? "Đã hết hạn trước đây"
                            : order.status === "rejected"
                            ? "Bị từ chối"
                            : activeExecutionMode === "exchange_hours"
                            ? "Đang chờ khớp trên sàn"
                            : "Đang đồng bộ"}
                        </span>
                      </td>
                      <td className="text-center">{money(order.limit_price)}</td>
                      <td className="text-center">{numberFormat.format(order.filled_quantity || order.quantity)} CP</td>
                      {hasActionableOrders && (
                        <td className="text-center">
                          {order.status === "open" || order.status === "pending" ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                disabled={Boolean(fillingOrderId || cancellingOrderId)}
                                className="paper-order-btn fill text-xs px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium"
                                onClick={() => handleForceFillWaitingOrder(order.id)}
                              >
                                {fillingOrderId === order.id ? "Đang khớp..." : `Khớp nhanh ${order.symbol}`}
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(fillingOrderId || cancellingOrderId)}
                                className="paper-order-btn cancel text-xs px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-500 disabled:opacity-50 text-white font-medium"
                                onClick={() => handleCancelWaitingOrder(order.id)}
                              >
                                {cancellingOrderId === order.id ? "Đang hủy..." : "Hủy lệnh"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={ordersPage}
            totalPages={ordersPageCount}
            totalItems={filteredOrders.length}
            pageSize={ORDERS_PAGE_SIZE}
            itemLabel="lệnh"
            onPageChange={setOrdersPage}
            ariaLabel="Phân trang sổ lệnh"
          />
        </>
        ) : (
          <div className="paper-empty compact"><p>Chưa có lệnh mua/bán phù hợp.</p></div>
        )}
      </section>

      {/* AI Daily Email Report Section */}
      <PaperDailyReportSection defaultEmail={auth.user?.email} />

      {/* Social Community Sharing Section */}
      <PaperSocialVisibilitySection
        dashboard={dashboard}
        initialPublic={dashboard.account.is_public ?? false}
        initialNickname={dashboard.account.nickname ?? ""}
        onAccountUpdate={(isPub, nick) => {
          setDashboard({
            ...dashboard,
            account: {
              ...dashboard.account,
              is_public: isPub,
              nickname: nick,
            },
          });
        }}
      />

      <section className="paper-section">
        <div className="paper-section-heading">
          <div>
            <p className="eyebrow">NHẬT KÝ BẤT BIẾN</p>
            <h2>Lịch sử mua bán</h2>
          </div>
          <span>Tối đa 100 lệnh gần nhất</span>
        </div>
        {dashboard.trades.length ? (
          <>
            <div className="paper-trades-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Thời gian</th>
                    <th className="text-center">Lệnh</th>
                    <th className="text-center">Mã</th>
                    <th className="text-center">Số lượng</th>
                    <th className="text-center">Giá khớp</th>
                    <th className="text-center">Phí + thuế</th>
                    <th className="text-center">Tiền vào/ra</th>
                    <th className="text-center">Lãi/lỗ chốt</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td className="text-left">{timeFormat.format(new Date(trade.created_at))}</td>
                      <td className="text-center"><span className={`paper-side ${trade.side}`}>{trade.side === "buy" ? "Mua" : "Bán"}</span></td>
                      <td className="text-center"><strong>{trade.symbol}</strong></td>
                      <td className="text-center">{numberFormat.format(trade.quantity)}</td>
                      <td className="text-center">{money(trade.execution_price)}</td>
                      <td className="text-center">{money(roundVnd(trade.fee_amount) + roundVnd(trade.tax_amount))}</td>
                      <td className={`text-center ${tone(trade.cash_effect)}`}>{money(trade.cash_effect)}</td>
                      <td className={`text-center ${tone(trade.realized_pnl ?? 0)}`}>
                        {trade.realized_pnl === null ? "—" : money(trade.realized_pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={tradesPage}
              totalPages={tradesPageCount}
              totalItems={allTrades.length}
              pageSize={TRADES_PAGE_SIZE}
              itemLabel="giao dịch"
              onPageChange={setTradesPage}
              ariaLabel="Phân trang lịch sử mua bán"
            />
          </>
        ) : (
          <div className="paper-empty compact"><p>Chưa có giao dịch mô phỏng.</p></div>
        )}
      </section>

      <footer className="paper-disclaimer">
        <strong>Đây là môi trường học tập.</strong>
        <span>
          {dashboard.assumptions.disclaimer} Giá có thể trễ; mô phỏng chưa bao gồm khớp lệnh từng phần, T+2, cổ tức hoặc chia tách.
        </span>
      </footer>

      {pnlDialog && (
        <ProfitLossDialog
          kind={pnlDialog}
          dashboard={dashboard}
          currentPrices={currentPrices}
          onClose={() => setPnlDialog(null)}
        />
      )}

      <PaperOrderDialog
        open={selectedInstrument !== null}
        side={side}
        instrument={selectedInstrument}
        dashboard={dashboard}
        initialQuantity={orderTargetQuantity}
        onClose={() => {
          setSelectedInstrument(null);
          setOrderTargetQuantity(undefined);
        }}
        onDashboard={(value) => {
          setDashboard(value);
          setError("");
        }}
        onSuccess={setNotice}
      />
    </main>
  );
}
