"use client";

import { useMemo, useState } from "react";

export type YearlyAssetComparisonPoint = {
  year: number;
  stockPrice: number;
  stockValue: number;
  stockRoi: number;
  goldPricePerTael: number; // Triệu VND / lượng SJC
  goldValue: number;
  goldRoi: number;
  bankRate: number; // %/năm
  bankValue: number;
  bankRoi: number;
  winner: "stock" | "gold" | "bank";
};

// Historical gold SJC prices (Trieu VND / tael at beginning of year)
export const HISTORICAL_GOLD_SJC: Record<number, number> = {
  2016: 35.2, // ~35.2 tr/lượng
  2017: 36.5, // ~36.5 tr/lượng
  2018: 36.8, // ~36.8 tr/lượng
  2019: 36.7, // Đầu năm 2019 ~36.7 tr/lượng
  2020: 43.8, // Đầu năm 2020 ~43.8 tr/lượng (đỉnh Covid 56 tr)
  2021: 56.5, // ~56.5 tr/lượng
  2022: 61.5, // Đầu năm 2022 ~61.5 tr/lượng
  2023: 67.2, // Đầu năm 2023 ~67.2 tr/lượng
  2024: 75.5, // Đầu năm 2024 ~75.5 tr/lượng (đỉnh tháng 5 đạt 92.4 tr)
  2025: 85.5, // ~85.5 tr/lượng
  2026: 89.5, // ~89.5 tr/lượng
};

// Historical 12M bank savings rates (% / year)
export const HISTORICAL_BANK_RATES: Record<number, number> = {
  2016: 6.8,
  2017: 6.9,
  2018: 7.0,
  2019: 7.0,
  2020: 5.8,
  2021: 5.6,
  2022: 7.4,
  2023: 5.5,
  2024: 5.2,
  2025: 5.4,
  2026: 5.5,
};

// Historical adjusted stock prices (Nghìn VND at beginning of year)
export const HISTORICAL_STOCK_PRICES: Record<string, Record<number, number>> = {
  HPG: {
    2016: 6.5, 2017: 8.2, 2018: 13.5, 2019: 11.2, 2020: 10.8,
    2021: 22.5, 2022: 24.8, 2023: 18.0, 2024: 27.5, 2025: 28.5, 2026: 29.8,
  },
  FPT: {
    2016: 18.0, 2017: 21.5, 2018: 27.0, 2019: 29.5, 2020: 36.0,
    2021: 54.0, 2022: 72.0, 2023: 82.0, 2024: 115.0, 2025: 132.0, 2026: 145.0,
  },
  VCB: {
    2016: 32.0, 2017: 35.0, 2018: 52.0, 2019: 56.0, 2020: 68.0,
    2021: 78.0, 2022: 81.0, 2023: 84.0, 2024: 89.0, 2025: 92.0, 2026: 95.0,
  },
  VNM: {
    2016: 72.0, 2017: 84.0, 2018: 108.0, 2019: 98.0, 2020: 89.0,
    2021: 82.0, 2022: 74.0, 2023: 68.0, 2024: 67.0, 2025: 66.0, 2026: 67.5,
  },
  MWG: {
    2016: 15.0, 2017: 24.0, 2018: 32.0, 2019: 38.0, 2020: 36.0,
    2021: 52.0, 2022: 60.0, 2023: 42.0, 2024: 48.0, 2025: 62.0, 2026: 68.0,
  },
  SSI: {
    2016: 12.0, 2017: 15.0, 2018: 24.0, 2019: 18.0, 2020: 16.0,
    2021: 32.0, 2022: 36.0, 2023: 20.0, 2024: 32.0, 2025: 35.0, 2026: 38.0,
  },
  DGC: {
    2016: 14.0, 2017: 16.0, 2018: 22.0, 2019: 24.0, 2020: 28.0,
    2021: 58.0, 2022: 98.0, 2023: 75.0, 2024: 118.0, 2025: 122.0, 2026: 128.0,
  },
  TCB: {
    2018: 16.0, 2019: 14.5, 2020: 13.5, 2021: 28.0, 2022: 26.0,
    2023: 17.5, 2024: 22.0, 2025: 24.0, 2026: 25.5,
  },
  MBB: {
    2016: 9.5, 2017: 12.0, 2018: 18.5, 2019: 15.0, 2020: 14.0,
    2021: 24.0, 2022: 23.5, 2023: 18.0, 2024: 23.0, 2025: 25.0, 2026: 26.2,
  },
  VIC: {
    2016: 42.0, 2017: 44.0, 2018: 78.0, 2019: 88.0, 2020: 82.0,
    2021: 85.0, 2022: 65.0, 2023: 52.0, 2024: 44.0, 2025: 42.0, 2026: 43.5,
  },
};

export const SUPPORTED_SYMBOLS = [
  "HPG",
  "FPT",
  "VCB",
  "MWG",
  "SSI",
  "DGC",
  "VNM",
  "TCB",
  "MBB",
  "VIC",
];

export const AVAILABLE_START_YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

export function StockGoldBankComparator({
  initialSymbol = "HPG",
  compact = false,
}: {
  initialSymbol?: string;
  compact?: boolean;
}) {
  const [symbol, setSymbol] = useState<string>(initialSymbol.toUpperCase());
  const [startYear, setStartYear] = useState<number>(2018);
  const [initialCapital, setInitialCapital] = useState<number>(100000000); // 100M VND

  // Compute year-by-year comparison timeline
  const comparisonTimeline: YearlyAssetComparisonPoint[] = useMemo(() => {
    const years: number[] = [];
    for (let y = startYear; y <= 2026; y++) {
      years.push(y);
    }

    const stockHistory =
      HISTORICAL_STOCK_PRICES[symbol] ??
      HISTORICAL_STOCK_PRICES["HPG"];

    const baseStockPrice = stockHistory[startYear] ?? stockHistory[2018] ?? 20;
    const baseGoldPrice = HISTORICAL_GOLD_SJC[startYear] ?? 36.5; // Triệu VND / lượng

    // Shares bought at year 0
    const initialShares = Math.floor(initialCapital / (baseStockPrice * 1000));
    // Gold taels bought at year 0
    const initialTaels = initialCapital / (baseGoldPrice * 1000000);

    let accumulatedBank = initialCapital;

    return years.map((year, idx) => {
      const currentStockPrice = stockHistory[year] ?? baseStockPrice;
      const currentGoldPrice = HISTORICAL_GOLD_SJC[year] ?? baseGoldPrice;
      const currentBankRate = HISTORICAL_BANK_RATES[year] ?? 6.0;

      // Compound interest for bank savings
      if (idx > 0) {
        accumulatedBank = Math.round(accumulatedBank * (1 + currentBankRate / 100));
      }

      const stockVal = Math.round(initialShares * currentStockPrice * 1000);
      const goldVal = Math.round(initialTaels * currentGoldPrice * 1000000);
      const bankVal = accumulatedBank;

      const stockRoi = Number((((stockVal - initialCapital) / initialCapital) * 100).toFixed(1));
      const goldRoi = Number((((goldVal - initialCapital) / initialCapital) * 100).toFixed(1));
      const bankRoi = Number((((bankVal - initialCapital) / initialCapital) * 100).toFixed(1));

      let winner: "stock" | "gold" | "bank" = "stock";
      if (goldVal > stockVal && goldVal > bankVal) {
        winner = "gold";
      } else if (bankVal > stockVal && bankVal > goldVal) {
        winner = "bank";
      }

      return {
        year,
        stockPrice: currentStockPrice * 1000,
        stockValue: stockVal,
        stockRoi,
        goldPricePerTael: currentGoldPrice,
        goldValue: goldVal,
        goldRoi,
        bankRate: currentBankRate,
        bankValue: bankVal,
        bankRoi,
        winner,
      };
    });
  }, [symbol, startYear, initialCapital]);

  const latest = comparisonTimeline[comparisonTimeline.length - 1];

  const formatVND = (v: number) => {
    return `${v.toLocaleString("vi-VN")} đ`;
  };

  // SVG Chart calculation
  const maxVal = Math.max(
    ...comparisonTimeline.map((p) => Math.max(p.stockValue, p.goldValue, p.bankValue)),
    initialCapital * 1.2
  );
  const minVal = initialCapital * 0.7;
  const valRange = maxVal - minVal || 1;

  const chartW = 680;
  const chartH = 220;
  const padX = 50;
  const padTop = 20;
  const padBtm = 30;
  const usableH = chartH - padTop - padBtm;

  const getY = (val: number) => {
    return padTop + usableH - ((val - minVal) / valRange) * usableH;
  };
  const getX = (idx: number, count: number) => {
    return padX + (idx / (count - 1 || 1)) * (chartW - padX * 2);
  };

  const stockPoints = comparisonTimeline
    .map((p, i) => `${getX(i, comparisonTimeline.length).toFixed(1)},${getY(p.stockValue).toFixed(1)}`)
    .join(" ");
  const goldPoints = comparisonTimeline
    .map((p, i) => `${getX(i, comparisonTimeline.length).toFixed(1)},${getY(p.goldValue).toFixed(1)}`)
    .join(" ");
  const bankPoints = comparisonTimeline
    .map((p, i) => `${getX(i, comparisonTimeline.length).toFixed(1)},${getY(p.bankValue).toFixed(1)}`)
    .join(" ");

  return (
    <div className={`invest-comparator-card bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 text-slate-100 shadow-2xl font-sans ${compact ? "compact-mode" : ""}`}>
      {/* HEADER CONTROLS */}
      <div className="invest-comparator-header flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
        <div>
          <span className="invest-badge inline-block text-[11px] font-bold text-sky-400 uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-sky-950 border border-sky-800/60 mb-2">
            SO SÁNH DANH MỤC TÀI SẢN THỰC CHIẾN
          </span>
          <h2 className="invest-title text-xl sm:text-2xl font-extrabold text-white tracking-tight my-1">
            Hiệu Suất Đầu Tư: Cổ Phiếu {symbol} vs Vàng SJC vs Tiết Kiệm Ngân Hàng
          </h2>
          <p className="invest-desc text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed m-0 mt-1">
            Chọn năm bắt đầu giải ngân và theo dõi diễn biến thực tế giá trị dòng tiền lũy kế qua các năm tiếp theo tới hiện tại.
          </p>
        </div>

        <div className="invest-controls-cluster flex flex-wrap items-center gap-4 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl shadow-inner">
          {/* Symbol Select */}
          <div className="invest-control-box flex flex-col gap-1">
            <label htmlFor="symbol-select" className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Mã cổ phiếu:</label>
            <select
              id="symbol-select"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="invest-select bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-bold"
            >
              {SUPPORTED_SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Start Year Select */}
          <div className="invest-control-box flex flex-col gap-1">
            <label htmlFor="year-select" className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Năm bắt đầu:</label>
            <select
              id="year-select"
              value={startYear}
              onChange={(e) => setStartYear(Number(e.target.value))}
              className="invest-select bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-bold"
            >
              {AVAILABLE_START_YEARS.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          {/* Initial Capital Pills */}
          <div className="invest-control-box flex flex-col gap-1">
            <label htmlFor="custom-capital-input" className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Vốn ban đầu:</label>
            <div className="capital-pills-row flex items-center gap-1.5">
              {[50000000, 100000000, 200000000, 500000000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`capital-pill px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                    initialCapital === amt
                      ? "active bg-sky-500 text-white shadow-sm"
                      : "bg-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                  onClick={() => setInitialCapital(amt)}
                >
                  {amt / 1000000} triệu
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3 SUMMARY KPI CARDS */}
      <div className="invest-kpi-grid grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        {/* Stock Card */}
        <div className="invest-kpi-card stock-border bg-slate-950/90 border-2 border-blue-500/60 rounded-xl p-4.5 flex flex-col justify-between shadow-lg shadow-blue-500/5">
          <div className="invest-kpi-head flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-400">📈 CỔ PHIẾU {symbol}</span>
            <span className={`kpi-roi-badge text-xs font-black px-2 py-0.5 rounded-full ${
              latest.stockRoi >= 0 ? "up bg-emerald-950 text-emerald-400 border border-emerald-800/60" : "down bg-rose-950 text-rose-400 border border-rose-800/60"
            }`}>
              {latest.stockRoi >= 0 ? `+${latest.stockRoi}%` : `${latest.stockRoi}%`}
            </span>
          </div>
          <div className="invest-kpi-amount text-xl sm:text-2xl font-black text-white my-1">{formatVND(latest.stockValue)}</div>
          <div className="invest-kpi-sub text-xs text-slate-400">
            Lãi ròng: <b className="text-blue-400 font-bold">{formatVND(latest.stockValue - initialCapital)}</b> (từ {startYear} đến nay)
          </div>
        </div>

        {/* Gold SJC Card */}
        <div className="invest-kpi-card gold-border bg-slate-950/90 border-2 border-amber-500/60 rounded-xl p-4.5 flex flex-col justify-between shadow-lg shadow-amber-500/5">
          <div className="invest-kpi-head flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-400">🥇 VÀNG MIẾNG SJC</span>
            <span className={`kpi-roi-badge text-xs font-black px-2 py-0.5 rounded-full ${
              latest.goldRoi >= 0 ? "up bg-emerald-950 text-emerald-400 border border-emerald-800/60" : "down bg-rose-950 text-rose-400 border border-rose-800/60"
            }`}>
              {latest.goldRoi >= 0 ? `+${latest.goldRoi}%` : `${latest.goldRoi}%`}
            </span>
          </div>
          <div className="invest-kpi-amount text-gold text-xl sm:text-2xl font-black text-amber-300 my-1">{formatVND(latest.goldValue)}</div>
          <div className="invest-kpi-sub text-xs text-slate-400">
            Lãi ròng: <b className="text-amber-400 font-bold">{formatVND(latest.goldValue - initialCapital)}</b> ({latest.goldPricePerTael} tr/lượng)
          </div>
        </div>

        {/* Bank Savings Card */}
        <div className="invest-kpi-card bank-border bg-slate-950/90 border-2 border-emerald-500/60 rounded-xl p-4.5 flex flex-col justify-between shadow-lg shadow-emerald-500/5">
          <div className="invest-kpi-head flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-400">🏦 TIẾT KIỆM NGÂN HÀNG</span>
            <span className="kpi-roi-badge up text-xs font-black px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              +{latest.bankRoi}%
            </span>
          </div>
          <div className="invest-kpi-amount text-green text-xl sm:text-2xl font-black text-emerald-300 my-1">{formatVND(latest.bankValue)}</div>
          <div className="invest-kpi-sub text-xs text-slate-400">
            Tiền lãi tích lũy: <b className="text-emerald-400 font-bold">{formatVND(latest.bankValue - initialCapital)}</b> (Lãi kép)
          </div>
        </div>
      </div>

      {/* SVG MULTI-LINE TIMELINE CHART */}
      <div className="invest-chart-box bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 my-6 shadow-xl">
        <div className="invest-chart-legend flex items-center justify-between flex-wrap gap-3 text-xs text-slate-400 mb-4">
          <span className="font-bold text-slate-200">Biểu đồ tăng trưởng tài sản (Vốn ban đầu: {formatVND(initialCapital)})</span>
          <div className="flex items-center gap-4">
            <span className="text-blue-400 font-bold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></span> Cổ phiếu {symbol}
            </span>
            <span className="text-amber-400 font-bold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm"></span> Vàng miếng SJC
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> Tiết kiệm Ngân hàng
            </span>
          </div>
        </div>

        <svg
          className="invest-svg-canvas w-full h-[220px]"
          viewBox={`0 0 ${chartW} ${chartH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Horizontal Grid lines */}
          <line x1={padX} y1={padTop} x2={chartW - padX} y2={padTop} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1={padX} y1={padTop + usableH * 0.5} x2={chartW - padX} y2={padTop + usableH * 0.5} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1={padX} y1={chartH - padBtm} x2={chartW - padX} y2={chartH - padBtm} stroke="#1e293b" />

          {/* Y Axis Labels */}
          <text x={padX - 8} y={padTop + 4} fontSize="10" fill="#94a3b8" textAnchor="end">
            {(maxVal / 1000000).toFixed(0)} tr
          </text>
          <text x={padX - 8} y={padTop + usableH * 0.5 + 3} fontSize="10" fill="#94a3b8" textAnchor="end">
            {(((maxVal + minVal) / 2) / 1000000).toFixed(0)} tr
          </text>
          <text x={padX - 8} y={chartH - padBtm + 3} fontSize="10" fill="#94a3b8" textAnchor="end">
            {(minVal / 1000000).toFixed(0)} tr
          </text>

          {/* 3 Polylines */}
          <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={stockPoints} />
          <polyline fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={goldPoints} />
          <polyline fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={bankPoints} />

          {/* Points & X-Labels */}
          {comparisonTimeline.map((p, idx) => {
            const x = getX(idx, comparisonTimeline.length);
            return (
              <g key={p.year}>
                <line x1={x} y1={chartH - padBtm} x2={x} y2={chartH - padBtm + 4} stroke="#475569" />
                <text x={x} y={chartH - padBtm + 16} fontSize="10" fill="#94a3b8" textAnchor="middle" fontWeight="600">
                  {p.year}
                </text>
                {/* Dots on latest year */}
                {idx === comparisonTimeline.length - 1 && (
                  <g>
                    <circle cx={x} cy={getY(p.stockValue)} r={4} fill="#3b82f6" />
                    <circle cx={x} cy={getY(p.goldValue)} r={4} fill="#f59e0b" />
                    <circle cx={x} cy={getY(p.bankValue)} r={4} fill="#10b981" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* YEAR-BY-YEAR DATA TABLE */}
      <div className="invest-table-wrapper my-6">
        <h3 className="invest-table-heading text-base sm:text-lg font-bold text-white mb-3">
          Bảng Chi Tiết Số Tiền Lũy Kế Qua Từng Năm Tiếp Theo ({startYear} → Hiện tại)
        </h3>
        <div className="invest-table-container overflow-x-auto rounded-xl border border-slate-800">
          <table className="invest-table-unified w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Mốc Năm</th>
                <th className="py-3 px-4 font-bold">Giá CP {symbol}</th>
                <th className="py-3 px-4 font-bold text-right">Tài sản CP (VND)</th>
                <th className="py-3 px-4 font-bold">Giá Vàng SJC</th>
                <th className="py-3 px-4 font-bold text-right">Tài sản Vàng (VND)</th>
                <th className="py-3 px-4 font-bold">Lãi suất NH</th>
                <th className="py-3 px-4 font-bold text-right">Tiền gửi NH (VND)</th>
                <th className="py-3 px-4 font-bold text-center">Kênh dẫn đầu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {comparisonTimeline.map((pt) => {
                const winnerLabel =
                  pt.winner === "stock"
                    ? `Cổ phiếu ${symbol}`
                    : pt.winner === "gold"
                    ? "Vàng SJC"
                    : "Tiết kiệm NH";
                const winnerTagCls =
                  pt.winner === "stock"
                    ? "bg-blue-950 text-blue-400 border border-blue-800/60"
                    : pt.winner === "gold"
                    ? "bg-amber-950 text-amber-400 border border-amber-800/60"
                    : "bg-emerald-950 text-emerald-400 border border-emerald-800/60";

                return (
                  <tr key={pt.year} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                      Năm {pt.year}
                    </td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">{pt.stockPrice.toLocaleString("vi-VN")} đ</td>
                    <td className="py-3 px-4 text-right font-bold text-blue-400 whitespace-nowrap">
                      {formatVND(pt.stockValue)}
                      <span className={`text-[11px] block font-semibold ${pt.stockRoi >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        ({pt.stockRoi >= 0 ? `+${pt.stockRoi}%` : `${pt.stockRoi}%`})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">{pt.goldPricePerTael} tr/lượng</td>
                    <td className="py-3 px-4 text-right font-bold text-amber-400 whitespace-nowrap">
                      {formatVND(pt.goldValue)}
                      <span className="text-[11px] block font-semibold text-emerald-400">
                        (+{pt.goldRoi}%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">{pt.bankRate}%/năm</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400 whitespace-nowrap">
                      {formatVND(pt.bankValue)}
                      <span className="text-[11px] block font-semibold text-emerald-400">
                        (+{pt.bankRoi}%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`admin-tag inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${winnerTagCls}`}>
                        {winnerLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FINANCIAL ADVISOR TAKEAWAY */}
      <div className="invest-insight-box bg-slate-950/80 border border-slate-800 rounded-xl p-5 text-xs sm:text-sm leading-relaxed text-slate-300 shadow-inner">
        <h4 className="text-sm sm:text-base font-bold text-white m-0 mb-2 flex items-center gap-2">
          <span>💡</span> Nhận Định Tài Chính &amp; Góc Nhìn Đầu Tư
        </h4>
        <p className="m-0 mb-3">
          Trong chu kỳ từ <b className="text-white">{startYear}</b> đến <b className="text-white">2026</b>, kênh <b className="text-sky-400">
            {latest.winner === "stock"
              ? `Cổ phiếu ${symbol}`
              : latest.winner === "gold"
              ? "Vàng miếng SJC"
              : "Tiết kiệm ngân hàng"}
          </b> đang giữ vị trí quán quân về tổng giá trị sinh lời với mức ROI đạt <b className="text-emerald-400">
            +{latest.winner === "stock"
              ? latest.stockRoi
              : latest.winner === "gold"
              ? latest.goldRoi
              : latest.bankRoi}%
          </b>.
        </p>
        <ul className="space-y-1.5 m-0 pl-4 list-disc text-slate-400 text-xs sm:text-sm">
          <li><b className="text-slate-200">Cổ phiếu ({symbol}):</b> Có tiềm năng sinh lời vượt trội nhờ tăng trưởng doanh nghiệp và chia cổ tức, nhưng biến động giá mạnh theo chu kỳ thị trường.</li>
          <li><b className="text-slate-200">Vàng SJC:</b> Là tài sản phòng thủ chống lạm phát và mất giá tiền tệ hoàn hảo trong thời kỳ bất ổn vĩ mô.</li>
          <li><b className="text-slate-200">Gửi tiết kiệm:</b> Bảo toàn vốn 100% với lãi kép đều đặn, phù hợp làm khoản dự phòng thanh khoản ngắn hạn.</li>
        </ul>
      </div>
    </div>
  );
}
