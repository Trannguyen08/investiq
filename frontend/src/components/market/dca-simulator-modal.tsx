"use client";

import { useEffect, useState, useTransition } from "react";
import { simulateDCA } from "@/lib/api-client";
import type { DCASimulatorData } from "@/types/market";

type Props = {
  initialSymbol?: string;
  isOpen: boolean;
  onClose: () => void;
};

const DURATION_OPTIONS = [
  { value: 1, label: "1 Năm" },
  { value: 2, label: "2 Năm" },
  { value: 3, label: "3 Năm" },
  { value: 5, label: "5 Năm" },
];

export function DCASimulatorModal({ initialSymbol = "HPG", isOpen, onClose }: Props) {
  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());
  const [monthlyAmount, setMonthlyAmount] = useState<number>(3000000); // 3M VND
  const [durationYears, setDurationYears] = useState<number>(3);
  const [data, setData] = useState<DCASimulatorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Keep symbol in sync with endpoint's selected stock
  useEffect(() => {
    if (initialSymbol) {
      setSymbol(initialSymbol.toUpperCase());
    }
  }, [initialSymbol, isOpen]);

  // Fetch simulation data
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    startTransition(async () => {
      setError(null);
      try {
        const res = await simulateDCA({
          symbol,
          duration_years: durationYears,
          monthly_amount: monthlyAmount,
        });
        if (!cancelled) {
          setData(res.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Không thể tải mô phỏng tích sản cho mã này. Vui lòng thử lại.");
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, symbol, monthlyAmount, durationYears]);

  if (!isOpen) return null;

  const formatVND = (val: string | number) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return "0 đ";
    return `${num.toLocaleString("vi-VN")} đ`;
  };

  // Generate SVG points for timeline
  const timeline = data?.timeline ?? [];
  const maxVal = Math.max(
    ...timeline.map((t) => Math.max(parseFloat(t.portfolio_value) || 0, parseFloat(t.savings_value) || 0)),
    1,
  );
  const chartWidth = 540;
  const chartHeight = 180;
  const padding = 20;

  const getCoordinates = (valStr: string, index: number, total: number) => {
    const val = parseFloat(valStr) || 0;
    const x = padding + (index / (total - 1 || 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - (val / maxVal) * (chartHeight - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  const stockPoints = timeline
    .map((t, idx) => getCoordinates(t.portfolio_value, idx, timeline.length))
    .join(" ");

  const savingsPoints = timeline
    .map((t, idx) => getCoordinates(t.savings_value, idx, timeline.length))
    .join(" ");

  return (
    <div className="dca-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dca-title">
      <div className="dca-modal-backdrop" onClick={onClose} />
      <div className="dca-modal-content">
        <header className="dca-modal-header">
          <div>
            <span className="dca-badge">CHIẾN LƯỢC TÍCH SẢN DCA</span>
            <h2 id="dca-title" className="dca-heading">
              Mô Phỏng Tích Sản: {symbol} vs Gửi Tiết Kiệm
            </h2>
            <p className="dca-subheading">
              So sánh hiệu quả mua định kỳ đều đặn mỗi tháng với gửi tiết kiệm ngân hàng lãi suất 6%/năm.
            </p>
          </div>
          <button type="button" className="dca-close-btn" onClick={onClose} aria-label="Đóng cửa sổ">
            ✕
          </button>
        </header>

        {/* Simulator Controls */}
        <section className="dca-controls-grid">
          <div className="control-group">
            <label className="control-label">
              Mã cổ phiếu tích sản:
            </label>
            <div className="symbol-input-wrapper">
              <div className="dca-endpoint-stock-badge">
                <span className="badge-ticker">{symbol}</span>
                <span className="badge-tag">Cổ phiếu đang xem</span>
              </div>
            </div>
          </div>

          <div className="control-group">
            <div className="slider-header">
              <label htmlFor="dca-amount-slider" className="control-label">
                Số tiền tích lũy mỗi tháng:
              </label>
              <strong className="slider-val-highlight">{formatVND(monthlyAmount)}</strong>
            </div>
            <input
              id="dca-amount-slider"
              type="range"
              min={1000000}
              max={20000000}
              step={500000}
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(Number(e.target.value))}
              className="dca-slider"
            />
            <div className="slider-ticks">
              <span>1 triệu</span>
              <span>5 triệu</span>
              <span>10 triệu</span>
              <span>20 triệu</span>
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Thời gian tích sản:</label>
            <div className="duration-buttons">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`duration-btn ${durationYears === opt.value ? "active" : ""}`}
                  onClick={() => setDurationYears(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Content Area: Loading / Error / Results */}
        {isPending && !data ? (
          <div className="dca-loading-state">
            <div className="dca-spinner" />
            <p>Đang tính toán dữ liệu tích sản và lịch sử giá {symbol}...</p>
          </div>
        ) : error ? (
          <div className="dca-error-box">
            <p>{error}</p>
          </div>
        ) : data ? (
          <div className="dca-results-area">
            {/* Outperformance Banner */}
            <div className={`dca-alpha-banner ${data.outperformed ? "alpha-win" : "alpha-loss"}`}>
              <div className="alpha-icon">{data.outperformed ? "🚀" : "🛡️"}</div>
              <div className="alpha-text">
                <strong>
                  {data.outperformed
                    ? `Tích sản ${symbol} tạo Alpha vượt trội +${data.alpha_percent}% so với tiết kiệm!`
                    : `Gửi tiết kiệm đang an toàn hơn ${symbol} trong giai đoạn này (+${data.alpha_percent}%)`}
                </strong>
                <p>
                  Chênh lệch giá trị tài sản ròng:{" "}
                  <b>{formatVND(Math.abs(parseFloat(data.alpha_amount)))}</b> sau {data.duration_years} năm tích lũy.
                </p>
              </div>
            </div>

            {/* Comparison Cards */}
            <div className="dca-comparison-grid">
              {/* Stock Accumulation Card */}
              <div className="dca-result-card card-stock">
                <div className="card-badge-row">
                  <span className="badge-type stock">TÍCH SẢN CỔ PHIẾU ({symbol})</span>
                  <span className="badge-shares">{data.total_shares.toLocaleString("vi-VN")} CP</span>
                </div>
                <div className="result-main-val">
                  <span className="val-label">Giá trị danh mục:</span>
                  <strong className="val-amount text-stock">{formatVND(data.portfolio_value)}</strong>
                </div>
                <div className="result-stats-row">
                  <div>
                    <span className="stat-sub">Vốn tích lũy:</span>
                    <span className="stat-sub-val">{formatVND(data.total_invested)}</span>
                  </div>
                  <div>
                    <span className="stat-sub">Lợi nhuận ròng:</span>
                    <span className={`stat-sub-val ${parseFloat(data.stock_profit) >= 0 ? "positive" : "negative"}`}>
                      {parseFloat(data.stock_profit) >= 0 ? "+" : ""}
                      {formatVND(data.stock_profit)} ({data.stock_roi_percent}%)
                    </span>
                  </div>
                  <div>
                    <span className="stat-sub">Giá mua trung bình:</span>
                    <span className="stat-sub-val">{formatVND(data.average_buy_price)}</span>
                  </div>
                </div>
              </div>

              {/* Bank Savings Card */}
              <div className="dca-result-card card-savings">
                <div className="card-badge-row">
                  <span className="badge-type savings">GỬI TIẾT KIỆM NGÂN HÀNG</span>
                  <span className="badge-rate">Lãi suất {data.savings_rate_percent}%/năm</span>
                </div>
                <div className="result-main-val">
                  <span className="val-label">Tổng tiền gốc + lãi:</span>
                  <strong className="val-amount text-savings">{formatVND(data.savings_value)}</strong>
                </div>
                <div className="result-stats-row">
                  <div>
                    <span className="stat-sub">Vốn tích lũy:</span>
                    <span className="stat-sub-val">{formatVND(data.total_invested)}</span>
                  </div>
                  <div>
                    <span className="stat-sub">Tiền lãi nhận được:</span>
                    <span className="stat-sub-val positive">
                      +{formatVND(data.savings_profit)} ({data.savings_roi_percent}%)
                    </span>
                  </div>
                  <div>
                    <span className="stat-sub">Kỳ hạn gửi:</span>
                    <span className="stat-sub-val">12 tháng xoay vòng</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SVG Timeline Chart */}
            <div className="dca-chart-card">
              <div className="chart-header">
                <span className="chart-title">Biểu đồ tăng trưởng tài sản theo tháng</span>
                <div className="chart-legend">
                  <span className="legend-item legend-stock">
                    <span className="legend-line line-stock" /> Cổ phiếu {symbol}
                  </span>
                  <span className="legend-item legend-savings">
                    <span className="legend-line line-savings" /> Gửi tiết kiệm
                  </span>
                </div>
              </div>

              <div className="svg-container">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="dca-svg-chart"
                  preserveAspectRatio="none"
                >
                  {/* Grid lines */}
                  <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="rgba(255,255,255,0.08)" />
                  <line
                    x1={padding}
                    y1={chartHeight / 2}
                    x2={chartWidth - padding}
                    y2={chartHeight / 2}
                    stroke="rgba(255,255,255,0.08)"
                  />
                  <line
                    x1={padding}
                    y1={chartHeight - padding}
                    x2={chartWidth - padding}
                    y2={chartHeight - padding}
                    stroke="rgba(255,255,255,0.15)"
                  />

                  {/* Savings Polyline */}
                  <polyline
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                    points={savingsPoints}
                  />

                  {/* Stock Polyline */}
                  <polyline
                    fill="none"
                    stroke="#38e1b0"
                    strokeWidth="3"
                    points={stockPoints}
                  />
                </svg>
                <div className="chart-x-labels">
                  <span>Tháng 1</span>
                  <span>Tháng {Math.round(timeline.length / 2)}</span>
                  <span>Tháng {timeline.length} (Hiện tại)</span>
                </div>
              </div>
            </div>

            {/* Rule of DCA note */}
            <p className="dca-method-note">
              💡 <b>Nguyên lý DCA (Dollar Cost Averaging):</b> Giúp nhà đầu tư triệt tiêu tâm lý FOMO, tự động mua được
              nhiều cổ phiếu hơn khi thị trường giảm điểm và làm phẳng giá vốn bình quân.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DCASimulatorButton({ symbol }: { symbol: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="dca-trigger-button"
        onClick={() => setIsOpen(true)}
        title="Mở mô phỏng tích sản DCA"
      >
        <span aria-hidden="true">📈</span>
        <span>Mô phỏng tích sản DCA</span>
      </button>

      <DCASimulatorModal
        initialSymbol={symbol}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
