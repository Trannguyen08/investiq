"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  changeTone,
  formatChange,
  formatCompact,
  formatMoney,
  formatPercent,
} from "@/components/market/formatters";
import type { MarketCandle, MarketIndex } from "@/types/market";

type Props = {
  currentIndex: MarketIndex;
  allIndices: MarketIndex[];
};

export function IndexAnalyticsPanel({ currentIndex, allIndices }: Props) {
  const candles = currentIndex.candles ?? [];
  const currentVal = Number(currentIndex.value) || 0;

  // 1. Multi-horizon returns & 52-week statistics
  const horizonStats = useMemo(() => {
    if (!candles.length || currentVal <= 0) return null;

    const count = candles.length;
    const getPastReturn = (daysBack: number) => {
      if (count <= 1) return null;
      const targetIdx = Math.max(0, count - 1 - daysBack);
      const pastClose = Number(candles[targetIdx]?.close) || 0;
      if (pastClose <= 0) return null;
      return Number((((currentVal - pastClose) / pastClose) * 100).toFixed(2));
    };

    // 1W ~ 5 sessions, 1M ~ 21 sessions, 3M ~ 63 sessions, 6M ~ 126 sessions, 1Y ~ first candle
    const r1W = getPastReturn(5);
    const r1M = getPastReturn(21);
    const r3M = getPastReturn(63);
    const r6M = getPastReturn(126);
    const r1Y = getPastReturn(count - 1);

    // 52-week High / Low
    let high52w = -Infinity;
    let low52w = Infinity;
    for (const c of candles) {
      const h = Number(c.high) || 0;
      const l = Number(c.low) || 0;
      if (h > high52w) high52w = h;
      if (l > 0 && l < low52w) low52w = l;
    }

    if (!Number.isFinite(high52w)) high52w = currentVal;
    if (!Number.isFinite(low52w)) low52w = currentVal;

    const range52w = high52w - low52w || 1;
    const positionPercent = Math.min(100, Math.max(0, ((currentVal - low52w) / range52w) * 100));
    const drawdownFromPeak = high52w > 0 ? Number((((currentVal - high52w) / high52w) * 100).toFixed(2)) : 0;

    return {
      r1W,
      r1M,
      r3M,
      r6M,
      r1Y,
      high52w,
      low52w,
      positionPercent,
      drawdownFromPeak,
    };
  }, [candles, currentVal]);

  // 2. Technical Averages & Liquidity Comparison
  const technicalStats = useMemo(() => {
    if (!candles.length) return null;

    const count = candles.length;
    const calcMA = (period: number) => {
      const slice = candles.slice(-period);
      if (!slice.length) return 0;
      const sum = slice.reduce((acc, c) => acc + (Number(c.close) || 0), 0);
      return Number((sum / slice.length).toFixed(2));
    };

    const calcVolMA = (period: number) => {
      const slice = candles.slice(-period);
      if (!slice.length) return 0;
      const sum = slice.reduce((acc, c) => acc + (Number(c.volume) || 0), 0);
      return Number((sum / slice.length).toFixed(0));
    };

    const ma5 = calcMA(5);
    const ma20 = calcMA(20);
    const ma50 = calcMA(50);
    const avgVol20 = calcVolMA(20);

    const currentVol = Number(currentIndex.volume) || 0;
    const volRatioVs20 = avgVol20 > 0 ? Number((((currentVol - avgVol20) / avgVol20) * 100).toFixed(1)) : 0;

    // Last 30 sessions win/loss days
    const recent30 = candles.slice(-30);
    let upSessions = 0;
    let downSessions = 0;
    let flatSessions = 0;
    recent30.forEach((c) => {
      const open = Number(c.open) || 0;
      const close = Number(c.close) || 0;
      if (close > open) upSessions++;
      else if (close < open) downSessions++;
      else flatSessions++;
    });

    const winRate = recent30.length > 0 ? Number(((upSessions / recent30.length) * 100).toFixed(0)) : 50;

    return {
      ma5,
      ma20,
      ma50,
      avgVol20,
      volRatioVs20,
      upSessions,
      downSessions,
      flatSessions,
      winRate,
    };
  }, [candles, currentIndex.volume]);

  // 3. Market Breadth & Sentiment Breakdown
  const breadthStats = useMemo(() => {
    const total = currentIndex.advances + currentIndex.declines + currentIndex.unchanged || 1;
    const advPct = Number(((currentIndex.advances / total) * 100).toFixed(1));
    const decPct = Number(((currentIndex.declines / total) * 100).toFixed(1));
    const unchPct = Number(((currentIndex.unchanged / total) * 100).toFixed(1));

    // Intraday Volatility Spread
    const high = Number(currentIndex.high_value) || currentVal;
    const low = Number(currentIndex.low_value) || currentVal;
    const spreadPoints = Number((high - low).toFixed(2));
    const spreadPercent = low > 0 ? Number(((spreadPoints / low) * 100).toFixed(2)) : 0;

    // Market Sentiment evaluation
    let sentimentLabel = "Cân bằng giằng co";
    let sentimentTone = "text-slate-300";
    if (advPct >= 60) {
      sentimentLabel = "Bên mua chiếm ưu thế áp đảo";
      sentimentTone = "text-emerald-400";
    } else if (advPct >= 50) {
      sentimentLabel = "Nghiêng về sắc xanh tích cực";
      sentimentTone = "text-emerald-400";
    } else if (decPct >= 60) {
      sentimentLabel = "Áp lực bán tháo lan rộng";
      sentimentTone = "text-rose-400";
    } else if (decPct >= 50) {
      sentimentLabel = "Bên bán kiểm soát nhịp độ";
      sentimentTone = "text-rose-400";
    }

    return {
      total,
      advPct,
      decPct,
      unchPct,
      spreadPoints,
      spreadPercent,
      sentimentLabel,
      sentimentTone,
    };
  }, [currentIndex, currentVal]);

  return (
    <div className="index-analytics-wrapper flex flex-col gap-6 mt-6">
      {/* SECTION HEADING */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-lg sm:text-xl font-black text-white m-0 tracking-tight">
            Thống Kê Chuyên Sâu &amp; Phân Tích Dòng Tiền: {currentIndex.name}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 m-0 mt-0.5">
            Dữ liệu hiệu suất đa chu kỳ, độ rộng phân bổ dòng tiền và so sánh tương quan thị trường.
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800/80 text-sky-400 border border-sky-500/20 w-fit">
          Dữ liệu định lượng tự động
        </span>
      </div>

      {/* 3 COLUMN ANALYTICS CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* CARD 1: MULTI-HORIZON PERFORMANCE & 52W RANGE */}
        <div className="index-analytics-card bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">HIỆU SUẤT ĐA KỲ HẠN</span>
              <span className="text-[11px] font-semibold text-slate-400">Tỷ suất sinh lời</span>
            </div>

            {/* Performance Grid */}
            <div className="grid grid-cols-5 gap-2 text-center mb-5">
              {[
                { label: "1 Tuần", val: horizonStats?.r1W },
                { label: "1 Tháng", val: horizonStats?.r1M },
                { label: "3 Tháng", val: horizonStats?.r3M },
                { label: "6 Tháng", val: horizonStats?.r6M },
                { label: "1 Năm", val: horizonStats?.r1Y },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 p-2 rounded-xl bg-slate-950/60 border border-slate-850">
                  <span className="text-[10px] font-semibold text-slate-400">{item.label}</span>
                  <strong className={`text-xs font-black font-mono ${item.val !== null && item.val !== undefined ? changeTone(String(item.val)) : "text-slate-400"}`}>
                    {item.val !== null && item.val !== undefined ? `${item.val >= 0 ? "+" : ""}${item.val}%` : "—"}
                  </strong>
                </div>
              ))}
            </div>

            {/* 52-Week Range Bar */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Biên độ 52 tuần:</span>
                <span className="font-bold text-slate-200">
                  {horizonStats?.low52w.toLocaleString("vi-VN")} — {horizonStats?.high52w.toLocaleString("vi-VN")}
                </span>
              </div>

              <div className="relative w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${horizonStats?.positionPercent ?? 50}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Đáy 52T</span>
                <span className="text-sky-300 font-semibold font-mono">
                  Vị trí {horizonStats?.positionPercent.toFixed(0)}%
                </span>
                <span>Đỉnh 52T</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Cách đỉnh 52 tuần:</span>
            <strong className={`font-mono font-bold ${(horizonStats?.drawdownFromPeak ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {horizonStats?.drawdownFromPeak !== undefined ? `${horizonStats.drawdownFromPeak}%` : "—"}
            </strong>
          </div>
        </div>

        {/* CARD 2: MARKET BREADTH & INTRADAY SPREAD */}
        <div className="index-analytics-card bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">ĐỘ RỘNG &amp; SỨC NÓNG PHIÊN</span>
              <span className="text-[11px] font-semibold text-slate-400">{breadthStats.total} mã theo dõi</span>
            </div>

            {/* Breadth Visual Bar */}
            <div className="flex flex-col gap-2 mb-4">
              <div className="w-full h-3 rounded-full flex overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${breadthStats.advPct}%` }}
                  title={`Tăng: ${currentIndex.advances} mã (${breadthStats.advPct}%)`}
                />
                <div
                  className="h-full bg-slate-600 transition-all duration-500"
                  style={{ width: `${breadthStats.unchPct}%` }}
                  title={`Đứng giá: ${currentIndex.unchanged} mã (${breadthStats.unchPct}%)`}
                />
                <div
                  className="h-full bg-rose-500 transition-all duration-500"
                  style={{ width: `${breadthStats.decPct}%` }}
                  title={`Giảm: ${currentIndex.declines} mã (${breadthStats.decPct}%)`}
                />
              </div>

              {/* Counts Breakdown */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
                  <span className="text-[11px] text-emerald-400 font-semibold block">Mã Tăng</span>
                  <strong className="text-sm font-black text-emerald-300 font-mono">
                    {currentIndex.advances} <small className="text-[10px] font-normal">({breadthStats.advPct}%)</small>
                  </strong>
                </div>

                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400 font-semibold block">Đứng Giá</span>
                  <strong className="text-sm font-black text-slate-200 font-mono">
                    {currentIndex.unchanged} <small className="text-[10px] font-normal">({breadthStats.unchPct}%)</small>
                  </strong>
                </div>

                <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-800/40">
                  <span className="text-[11px] text-rose-400 font-semibold block">Mã Giảm</span>
                  <strong className="text-sm font-black text-rose-300 font-mono">
                    {currentIndex.declines} <small className="text-[10px] font-normal">({breadthStats.decPct}%)</small>
                  </strong>
                </div>
              </div>
            </div>

            {/* Ceiling / Floor highlight */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-850 text-xs">
                <span className="text-slate-400 font-medium">Tăng trần:</span>
                <strong className="text-emerald-400 font-bold font-mono">{currentIndex.ceiling_count} mã</strong>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-850 text-xs">
                <span className="text-slate-400 font-medium">Giảm sàn:</span>
                <strong className="text-rose-400 font-bold font-mono">{currentIndex.floor_count} mã</strong>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Biên độ trong ngày:</span>
            <strong className="text-slate-200 font-mono font-bold">
              {breadthStats.spreadPoints} điểm ({breadthStats.spreadPercent}%)
            </strong>
          </div>
        </div>

        {/* CARD 3: TECHNICAL TRENDS & VOLUME VS MA20 */}
        <div className="index-analytics-card bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">DÒNG TIỀN &amp; XU HƯỚNG MA</span>
              <span className="text-[11px] font-semibold text-slate-400">Phân tích kỹ thuật</span>
            </div>

            {/* Moving Averages List */}
            <div className="space-y-2.5 mb-4">
              <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60 border border-slate-850">
                <span className="text-slate-400">Đường MA5 (Ngắn hạn):</span>
                <div className="flex items-center gap-2">
                  <strong className="font-mono text-slate-100 font-bold">{technicalStats?.ma5}</strong>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${currentVal >= (technicalStats?.ma5 ?? 0) ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"}`}>
                    {currentVal >= (technicalStats?.ma5 ?? 0) ? "Trên MA5" : "Dưới MA5"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60 border border-slate-850">
                <span className="text-slate-400">Đường MA20 (Trung hạn):</span>
                <div className="flex items-center gap-2">
                  <strong className="font-mono text-slate-100 font-bold">{technicalStats?.ma20}</strong>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${currentVal >= (technicalStats?.ma20 ?? 0) ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"}`}>
                    {currentVal >= (technicalStats?.ma20 ?? 0) ? "Trên MA20" : "Dưới MA20"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60 border border-slate-850">
                <span className="text-slate-400">Đường MA50 (Dài hạn):</span>
                <div className="flex items-center gap-2">
                  <strong className="font-mono text-slate-100 font-bold">{technicalStats?.ma50}</strong>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${currentVal >= (technicalStats?.ma50 ?? 0) ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"}`}>
                    {currentVal >= (technicalStats?.ma50 ?? 0) ? "Trên MA50" : "Dưới MA50"}
                  </span>
                </div>
              </div>
            </div>

            {/* Volume vs MA20 */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-850 text-xs flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Thanh khoản so với TB20 phiên:</span>
                <strong className={`font-mono font-bold ${(technicalStats?.volRatioVs20 ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {(technicalStats?.volRatioVs20 ?? 0) >= 0 ? `+${technicalStats?.volRatioVs20}%` : `${technicalStats?.volRatioVs20}%`}
                </strong>
              </div>
              <p className="text-[11px] text-slate-400 m-0 leading-relaxed">
                {(technicalStats?.volRatioVs20 ?? 0) >= 15
                  ? "Dòng tiền bùng nổ mạnh mẽ, vượt trên 15% mức trung bình 20 phiên."
                  : (technicalStats?.volRatioVs20 ?? 0) <= -15
                  ? "Thanh khoản co hẹp dưới mức trung bình, tâm lý giao dịch đang thận trọng."
                  : "Thanh khoản duy trì ở mức cân bằng so với mức trung bình 20 phiên."}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Tỷ lệ phiên tăng (30 phiên):</span>
            <strong className="text-emerald-400 font-mono font-bold">
              {technicalStats
                ? `${technicalStats.upSessions} / ${technicalStats.upSessions + technicalStats.downSessions} phiên (${technicalStats.winRate}%)`
                : "--"}
            </strong>
          </div>
        </div>
      </div>

      {/* SECTION 4: COMPARATIVE BENCHMARK TABLE ACROSS 4 INDICES */}
      <div className="index-comparison-table-wrap bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h4 className="text-base font-bold text-white m-0">
              Đối Chiếu Sức Mạnh Dòng Tiền Giữa Các Chỉ Số Trọng Điểm
            </h4>
            <p className="text-xs text-slate-400 m-0 mt-0.5">
              So sánh tương quan hiệu suất, thanh khoản và phân bổ độ rộng giữa các sàn giao dịch.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {allIndices.length} chỉ số
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Chỉ số</th>
                <th className="py-2.5 px-3 text-right">Điểm số</th>
                <th className="py-2.5 px-3 text-right">Thay đổi</th>
                <th className="py-2.5 px-3 text-right">Khối lượng</th>
                <th className="py-2.5 px-3 text-right">Giá trị GD</th>
                <th className="py-2.5 px-3 text-center">Độ rộng (Tăng / Giảm / Đứng)</th>
                <th className="py-2.5 px-3 text-center">Trần / Sàn</th>
                <th className="py-2.5 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {allIndices.map((idxItem) => {
                const isSelected = idxItem.symbol === currentIndex.symbol;
                const changeVal = Number(idxItem.change_percent || 0);

                return (
                  <tr
                    key={idxItem.symbol}
                    className={`transition hover:bg-slate-800/40 ${
                      isSelected ? "bg-sky-950/30" : ""
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                        )}
                        <div>
                          <strong className="text-white font-bold block">{idxItem.name}</strong>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">{idxItem.symbol}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-100">
                      {formatChange(idxItem.value)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold">
                      <span className={`px-2 py-0.5 rounded-md inline-block ${
                        changeVal > 0 ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/40" :
                        changeVal < 0 ? "bg-rose-950/80 text-rose-400 border border-rose-800/40" :
                        "bg-slate-800 text-slate-300"
                      }`}>
                        {changeVal >= 0 ? "+" : ""}{formatPercent(idxItem.change_percent)}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {formatCompact(idxItem.volume)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {formatMoney(idxItem.matched_value)}
                    </td>

                    <td className="py-3 px-3 text-center font-mono">
                      <span className="text-emerald-400 font-bold">{idxItem.advances}</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className="text-rose-400 font-bold">{idxItem.declines}</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className="text-slate-400">{idxItem.unchanged}</span>
                    </td>

                    <td className="py-3 px-3 text-center font-mono text-xs">
                      <span className="text-emerald-400 font-bold">{idxItem.ceiling_count}</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className="text-rose-400 font-bold">{idxItem.floor_count}</span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      {isSelected ? (
                        <span className="text-[11px] font-bold text-sky-400 bg-sky-950 px-2.5 py-1 rounded-lg border border-sky-800/60">
                          Đang xem
                        </span>
                      ) : (
                        <Link
                          href={`/market/indices?symbol=${idxItem.symbol}`}
                          className="text-[11px] font-semibold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition inline-block"
                        >
                          Xem chi tiết →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
