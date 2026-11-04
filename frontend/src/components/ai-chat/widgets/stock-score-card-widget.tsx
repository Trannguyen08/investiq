"use client";

import type { StockScoreCardWidgetData } from "@/types/ai-chat";

export function StockScoreCardWidget({ data }: { data: StockScoreCardWidgetData }) {
  const {
    symbol,
    name,
    current_price,
    change_percent,
    pe,
    pb,
    roe_percent,
    scores,
    verdict,
    key_support,
    key_resistance,
    analysis_points,
  } = data;

  // Radar chart 5 vertices math (center: 120, 96, maxRadius: 54 in a 240x192 viewBox so labels never clip)
  const cx = 120;
  const cy = 96;
  const rMax = 54;
  const labels = [
    { name: "Định giá", short: "Định giá", score: scores.valuation, angle: -90 },
    { name: "Sức khỏe TC", short: "SKTC", score: scores.financial_health, angle: -18 },
    { name: "Tăng trưởng", short: "T.Trưởng", score: scores.growth, angle: 54 },
    { name: "Kỹ thuật", short: "Kỹ thuật", score: scores.technical, angle: 126 },
    { name: "Dòng tiền", short: "Dòng tiền", score: scores.cashflow, angle: 198 },
  ];

  const getPoint = (angleDeg: number, radius: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return `${cx + radius * Math.cos(rad)},${cy + radius * Math.sin(rad)}`;
  };

  const bgPolygons = [0.25, 0.5, 0.75, 1.0].map((level) =>
    labels.map((l) => getPoint(l.angle, rMax * level)).join(" "),
  );

  const valuePolygon = labels
    .map((l) => getPoint(l.angle, (Math.max(10, Math.min(100, l.score)) / 100) * rMax))
    .join(" ");

  const isPositive = change_percent >= 0;

  return (
    <div className="w-full max-w-xl bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-2xl my-2.5 text-slate-200 overflow-hidden">
      {/* 1. Header: Symbol, Company Name, Price & Verdict Badge (no wrapping on badge) */}
      <div className="flex items-start justify-between gap-2.5 border-b border-slate-800/80 pb-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-400 flex items-center justify-center font-black text-white text-sm shrink-0 shadow-md">
            {symbol}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h4 className="text-sm sm:text-base font-extrabold text-white m-0 shrink-0">
                {symbol}
              </h4>
              <span className="text-xs text-slate-400 truncate" title={name}>
                {name}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap">
              <span className="font-extrabold text-white text-sm whitespace-nowrap font-mono">
                {current_price.toLocaleString("vi-VN")} đ
              </span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded text-[11px] font-mono whitespace-nowrap ${
                  isPositive
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                    : "bg-rose-950 text-rose-400 border border-rose-800/60"
                }`}
              >
                {isPositive ? "+" : ""}
                {change_percent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right flex flex-col items-end">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold whitespace-nowrap mb-1">
            Đánh giá
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black whitespace-nowrap shadow-sm ${
              verdict === "TÍCH CỰC"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : verdict === "THEO DÕI"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
            }`}
          >
            {verdict}
          </span>
        </div>
      </div>

      {/* 2. Key Fundamental Ratios Row (P/E, P/B, ROE) — Full width 3-column grid so numbers never collide */}
      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl py-2 px-2 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
            P/E
          </span>
          <strong className="text-xs sm:text-sm font-extrabold text-amber-300 font-mono whitespace-nowrap">
            {pe ? `${pe.toFixed(1)}x` : "--"}
          </strong>
        </div>
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl py-2 px-2 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
            P/B
          </span>
          <strong className="text-xs sm:text-sm font-extrabold text-sky-300 font-mono whitespace-nowrap">
            {pb ? `${pb.toFixed(1)}x` : "--"}
          </strong>
        </div>
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl py-2 px-2 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
            ROE
          </span>
          <strong className="text-xs sm:text-sm font-extrabold text-emerald-400 font-mono whitespace-nowrap">
            {roe_percent ? `${roe_percent.toFixed(1)}%` : "--"}
          </strong>
        </div>
      </div>

      {/* 3. Support & Resistance Levels — Full width 2-column grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-950/60 border border-slate-800/70 rounded-xl px-3 py-2 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-medium">Hỗ trợ quan trọng</span>
          <span className="text-xs font-extrabold text-sky-400 font-mono whitespace-nowrap mt-0.5">
            {key_support ? `${key_support.toLocaleString("vi-VN")} đ` : "Đang kiểm định"}
          </span>
        </div>
        <div className="bg-slate-950/60 border border-slate-800/70 rounded-xl px-3 py-2 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-medium">Kháng cự gần</span>
          <span className="text-xs font-extrabold text-amber-400 font-mono whitespace-nowrap mt-0.5">
            {key_resistance ? `${key_resistance.toLocaleString("vi-VN")} đ` : "Đang kiểm định"}
          </span>
        </div>
      </div>

      {/* 4. Multi-Factor Quantitative Radar & Score Breakdown */}
      <div className="bg-slate-950/50 border border-slate-800/70 rounded-xl p-3 mb-2.5">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center mb-1">
          Mô hình đa nhân tố InvestIQ
        </div>
        <svg viewBox="0 0 240 192" className="w-full max-w-[220px] h-auto mx-auto block filter drop-shadow">
          {/* Background Polygons */}
          {bgPolygons.map((poly, i) => (
            <polygon
              key={i}
              points={poly}
              fill={i === 3 ? "rgba(15, 23, 42, 0.45)" : "none"}
              stroke="rgba(51, 65, 85, 0.65)"
              strokeWidth="1"
            />
          ))}
          {/* Axis spokes */}
          {labels.map((l, i) => {
            const [px, py] = getPoint(l.angle, rMax).split(",");
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={px}
                y2={py}
                stroke="rgba(51, 65, 85, 0.8)"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            );
          })}
          {/* Filled Value Polygon */}
          <polygon
            points={valuePolygon}
            fill="rgba(56, 189, 248, 0.25)"
            stroke="#38bdf8"
            strokeWidth="2"
          />
          {/* Vertex dots */}
          {labels.map((l, i) => {
            const [vx, vy] = getPoint(
              l.angle,
              (Math.max(10, Math.min(100, l.score)) / 100) * rMax,
            ).split(",");
            return (
              <circle
                key={i}
                cx={vx}
                cy={vy}
                r="3"
                fill="#38bdf8"
                stroke="#0f172a"
                strokeWidth="1"
              />
            );
          })}
          {/* Labels */}
          {labels.map((l, i) => {
            const [tx, ty] = getPoint(l.angle, rMax + 18).split(",");
            return (
              <text
                key={i}
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[9px] fill-slate-300 font-bold"
              >
                {l.name}
              </text>
            );
          })}
        </svg>

        {/* 5 Factor Score Pills */}
        <div className="grid grid-cols-5 gap-1 pt-2 mt-1 border-t border-slate-800/60 text-center">
          {labels.map((l) => (
            <div key={l.name} className="bg-slate-900/80 rounded-lg py-1 px-0.5">
              <span className="text-[9px] text-slate-400 block truncate">{l.short}</span>
              <span className="text-[11px] font-extrabold text-sky-300 font-mono">
                {l.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Analysis Points */}
      {analysis_points.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/70 rounded-xl p-2.5 space-y-1.5">
          {analysis_points.slice(0, 3).map((pt, idx) => (
            <div key={idx} className="text-[11px] text-slate-300 flex items-start gap-2 leading-relaxed">
              <span className="text-teal-400 font-bold shrink-0 mt-0.5">•</span>
              <span className="min-w-0 break-words">{pt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
