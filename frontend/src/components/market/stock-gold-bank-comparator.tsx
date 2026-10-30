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
      const stockPrice = stockHistory[year] ?? baseStockPrice;
      const stockVal = initialShares * stockPrice * 1000;
      const stockRoi = ((stockVal - initialCapital) / initialCapital) * 100;

      const goldPrice = HISTORICAL_GOLD_SJC[year] ?? baseGoldPrice;
      const goldVal = initialTaels * goldPrice * 1000000;
      const goldRoi = ((goldVal - initialCapital) / initialCapital) * 100;

      if (idx > 0) {
        const prevYear = years[idx - 1];
        const rate = (HISTORICAL_BANK_RATES[prevYear] ?? 6.0) / 100;
        accumulatedBank = accumulatedBank * (1 + rate);
      }
      const bankVal = accumulatedBank;
      const bankRoi = ((bankVal - initialCapital) / initialCapital) * 100;

      const rateThisYear = HISTORICAL_BANK_RATES[year] ?? 6.0;

      let winner: "stock" | "gold" | "bank" = "stock";
      if (goldVal > stockVal && goldVal > bankVal) {
        winner = "gold";
      } else if (bankVal > stockVal && bankVal > goldVal) {
        winner = "bank";
      }

      return {
        year,
        stockPrice,
        stockValue: Math.round(stockVal),
        stockRoi: parseFloat(stockRoi.toFixed(1)),
        goldPricePerTael: goldPrice,
        goldValue: Math.round(goldVal),
        goldRoi: parseFloat(goldRoi.toFixed(1)),
        bankRate: rateThisYear,
        bankValue: Math.round(bankVal),
        bankRoi: parseFloat(bankRoi.toFixed(1)),
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
    <div className={`invest-comparator-card ${compact ? "compact-mode" : ""}`}>
      {/* HEADER CONTROLS */}
      <div className="invest-comparator-header">
        <div>
          <span className="invest-badge">SO SÁNH DANH MỤC TÀI SẢN THỰC CHIẾN</span>
          <h2 className="invest-title">
            Hiệu Suất Đầu Tư: Cổ Phiếu {symbol} vs Vàng SJC vs Tiết Kiệm Ngân Hàng
          </h2>
          <p className="invest-desc">
            Chọn năm bắt đầu giải ngân và theo dõi diễn biến thực tế giá trị dòng tiền lũy kế qua các năm tiếp theo tới hiện tại.
          </p>
        </div>

        <div className="invest-controls-cluster">
          {/* Symbol Select */}
          <div className="invest-control-box">
            <label htmlFor="symbol-select">Mã cổ phiếu:</label>
            <select
              id="symbol-select"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="invest-select"
            >
              {SUPPORTED_SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Start Year Select */}
          <div className="invest-control-box">
            <label htmlFor="year-select">Năm bắt đầu:</label>
            <select
              id="year-select"
              value={startYear}
              onChange={(e) => setStartYear(Number(e.target.value))}
              className="invest-select"
            >
              {AVAILABLE_START_YEARS.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          {/* Initial Capital Pills */}
          <div className="invest-control-box">
            <label htmlFor="custom-capital-input">Vốn ban đầu:</label>
            <div className="capital-pills-row">
              {[50000000, 100000000, 200000000, 500000000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`capital-pill ${initialCapital === amt ? "active" : ""}`}
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
      <div className="invest-kpi-grid">
        {/* Stock Card */}
        <div className="invest-kpi-card stock-border">
          <div className="invest-kpi-head">
            <span>📈 CỔ PHIẾU {symbol}</span>
            <span className={`kpi-roi-badge ${latest.stockRoi >= 0 ? "up" : "down"}`}>
              {latest.stockRoi >= 0 ? `+${latest.stockRoi}%` : `${latest.stockRoi}%`}
            </span>
          </div>
          <div className="invest-kpi-amount">{formatVND(latest.stockValue)}</div>
          <div className="invest-kpi-sub">
            Lãi ròng: <b>{formatVND(latest.stockValue - initialCapital)}</b> (từ {startYear} đến nay)
          </div>
        </div>

        {/* Gold SJC Card */}
        <div className="invest-kpi-card gold-border">
          <div className="invest-kpi-head">
            <span>🥇 VÀNG MIẾNG SJC</span>
            <span className={`kpi-roi-badge ${latest.goldRoi >= 0 ? "up" : "down"}`}>
              {latest.goldRoi >= 0 ? `+${latest.goldRoi}%` : `${latest.goldRoi}%`}
            </span>
          </div>
          <div className="invest-kpi-amount text-gold">{formatVND(latest.goldValue)}</div>
          <div className="invest-kpi-sub">
            Lãi ròng: <b>{formatVND(latest.goldValue - initialCapital)}</b> ({latest.goldPricePerTael} tr/lượng)
          </div>
        </div>

        {/* Bank Savings Card */}
        <div className="invest-kpi-card bank-border">
          <div className="invest-kpi-head">
            <span>🏦 TIẾT KIỆM NGÂN HÀNG</span>
            <span className="kpi-roi-badge up">+{latest.bankRoi}%</span>
          </div>
          <div className="invest-kpi-amount text-green">{formatVND(latest.bankValue)}</div>
          <div className="invest-kpi-sub">
            Tiền lãi tích lũy: <b>{formatVND(latest.bankValue - initialCapital)}</b> (Lãi kép)
          </div>
        </div>
      </div>

      {/* SVG MULTI-LINE TIMELINE CHART */}
      <div className="invest-chart-box">
        <div className="invest-chart-legend">
          <span>Biểu đồ tăng trưởng tài sản (Vốn ban đầu: {formatVND(initialCapital)})</span>
          <div style={{ display: "flex", gap: "1.25rem" }}>
            <span style={{ color: "#2563eb", fontWeight: 700 }}>■ Cổ phiếu {symbol}</span>
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>■ Vàng miếng SJC</span>
            <span style={{ color: "#10b981", fontWeight: 700 }}>■ Tiết kiệm Ngân hàng</span>
          </div>
        </div>

        <svg
          className="invest-svg-canvas"
          viewBox={`0 0 ${chartW} ${chartH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Horizontal Grid lines */}
          <line x1={padX} y1={padTop} x2={chartW - padX} y2={padTop} stroke="#e2e8f0" strokeDasharray="3 3" />
          <line x1={padX} y1={padTop + usableH * 0.5} x2={chartW - padX} y2={padTop + usableH * 0.5} stroke="#e2e8f0" strokeDasharray="3 3" />
          <line x1={padX} y1={chartH - padBtm} x2={chartW - padX} y2={chartH - padBtm} stroke="#e2e8f0" />

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
          <polyline fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={stockPoints} />
          <polyline fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={goldPoints} />
          <polyline fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={bankPoints} />

          {/* Points & X-Labels */}
          {comparisonTimeline.map((p, idx) => {
            const x = getX(idx, comparisonTimeline.length);
            return (
              <g key={p.year}>
                <line x1={x} y1={chartH - padBtm} x2={x} y2={chartH - padBtm + 4} stroke="#94a3b8" />
                <text x={x} y={chartH - padBtm + 16} fontSize="10" fill="#64748b" textAnchor="middle" fontWeight="600">
                  {p.year}
                </text>
                {/* Dots on latest year */}
                {idx === comparisonTimeline.length - 1 && (
                  <g>
                    <circle cx={x} cy={getY(p.stockValue)} r={4} fill="#2563eb" />
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
      <div className="invest-table-wrapper">
        <h3 className="invest-table-heading">
          Bảng Chi Tiết Số Tiền Lũy Kế Qua Từng Năm Tiếp Theo ({startYear} → Hiện tại)
        </h3>
        <div className="invest-table-container">
          <table className="invest-table-unified">
            <thead>
              <tr>
                <th>Mốc Năm</th>
                <th>Giá CP {symbol}</th>
                <th style={{ textAlign: "right" }}>Tài sản CP (VND)</th>
                <th>Giá Vàng SJC</th>
                <th style={{ textAlign: "right" }}>Tài sản Vàng (VND)</th>
                <th>Lãi suất NH</th>
                <th style={{ textAlign: "right" }}>Tiền gửi NH (VND)</th>
                <th style={{ textAlign: "center" }}>Kênh dẫn đầu</th>
              </tr>
            </thead>
            <tbody>
              {comparisonTimeline.map((pt) => {
                const winnerLabel =
                  pt.winner === "stock"
                    ? `Cổ phiếu ${symbol}`
                    : pt.winner === "gold"
                    ? "Vàng SJC"
                    : "Tiết kiệm NH";
                const winnerTagCls =
                  pt.winner === "stock"
                    ? "blue"
                    : pt.winner === "gold"
                    ? "amber"
                    : "green";

                return (
                  <tr key={pt.year}>
                    <td>
                      <strong>Năm {pt.year}</strong>
                    </td>
                    <td>{pt.stockPrice.toLocaleString("vi-VN")} đ</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#2563eb" }}>
                      {formatVND(pt.stockValue)}
                      <span style={{ fontSize: "0.75rem", display: "block", color: pt.stockRoi >= 0 ? "#16a34a" : "#dc2626" }}>
                        ({pt.stockRoi >= 0 ? `+${pt.stockRoi}%` : `${pt.stockRoi}%`})
                      </span>
                    </td>
                    <td>{pt.goldPricePerTael} tr/lượng</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#d97706" }}>
                      {formatVND(pt.goldValue)}
                      <span style={{ fontSize: "0.75rem", display: "block", color: pt.goldRoi >= 0 ? "#16a34a" : "#dc2626" }}>
                        (+{pt.goldRoi}%)
                      </span>
                    </td>
                    <td>{pt.bankRate}%/năm</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#16a34a" }}>
                      {formatVND(pt.bankValue)}
                      <span style={{ fontSize: "0.75rem", display: "block", color: "#16a34a" }}>
                        (+{pt.bankRoi}%)
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`admin-tag ${winnerTagCls}`}>{winnerLabel}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FINANCIAL ADVISOR TAKEAWAY */}
      <div className="invest-insight-box">
        <h4>💡 Nhận Định Tài Chính & Góc Nhìn Đầu Tư</h4>
        <p>
          Trong chu kỳ từ <b>{startYear}</b> đến <b>2026</b>, kênh <b>
            {latest.winner === "stock"
              ? `Cổ phiếu ${symbol}`
              : latest.winner === "gold"
              ? "Vàng miếng SJC"
              : "Tiết kiệm ngân hàng"}
          </b> đang giữ vị trí quán quân về tổng giá trị sinh lời với mức ROI đạt <b>
            +{latest.winner === "stock"
              ? latest.stockRoi
              : latest.winner === "gold"
              ? latest.goldRoi
              : latest.bankRoi}%
          </b>.
        </p>
        <ul>
          <li><b>Cổ phiếu ({symbol}):</b> Có tiềm năng sinh lời vượt trội nhờ tăng trưởng doanh nghiệp và chia cổ tức, nhưng biến động giá mạnh theo chu kỳ thị trường.</li>
          <li><b>Vàng SJC:</b> Là tài sản phòng thủ chống lạm phát và mất giá tiền tệ hoàn hảo trong thời kỳ bất ổn vĩ mô.</li>
          <li><b>Gửi tiết kiệm:</b> Bảo toàn vốn 100% với lãi kép đều đặn, phù hợp làm khoản dự phòng thanh khoản ngắn hạn.</li>
        </ul>
      </div>
    </div>
  );
}

