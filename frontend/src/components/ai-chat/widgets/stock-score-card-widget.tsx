"use client";

import type { StockScoreCardWidgetData } from "@/types/ai-chat";

export function StockScoreCardWidget({ data }: { data: StockScoreCardWidgetData }) {
  const { symbol, name, current_price, change_percent, pe, pb, roe_percent, scores, verdict, key_support, key_resistance, analysis_points } = data;

  // Radar chart 5 vertices math (center: 100, 100, maxRadius: 65)
  const cx = 100;
  const cy = 100;
  const rMax = 65;
  const labels = [
    { name: "Định giá", score: scores.valuation, angle: -90 },
    { name: "Sức khỏe TC", score: scores.financial_health, angle: -18 },
    { name: "Tăng trưởng", score: scores.growth, angle: 54 },
    { name: "Kỹ thuật", score: scores.technical, angle: 126 },
    { name: "Dòng tiền", score: scores.cashflow, angle: 198 },
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
    <div className="w-full max-w-xl bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl my-3 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-400 flex items-center justify-center font-black text-white text-base shadow-md">
            {symbol}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold text-white m-0">{symbol}</h4>
              <span className="text-xs text-slate-400 truncate max-w-[200px]">{name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs mt-0.5">
              <span className="font-extrabold text-white text-sm">
                {current_price.toLocaleString("vi-VN")} đ
              </span>
              <span
                className={`font-semibold px-1.5 py-0.2 rounded text-[11px] ${
                  isPositive ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60" : "bg-rose-950 text-rose-400 border border-rose-800/60"
                }`}
              >
                {isPositive ? "+" : ""}
                {change_percent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">Đánh giá</span>
          <span
            className={`inline-block px-2.5 py-1 rounded-full text-xs font-black shadow-sm ${
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

      {/* Main Grid: Radar chart & Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        {/* SVG Radar Chart */}
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 200 200" className="w-48 h-48 filter drop-shadow">
            {/* Background Polygons */}
            {bgPolygons.map((poly, i) => (
              <polygon
                key={i}
                points={poly}
                fill={i === 3 ? "rgba(15, 23, 42, 0.4)" : "none"}
                stroke="rgba(51, 65, 85, 0.6)"
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
              const [vx, vy] = getPoint(l.angle, (Math.max(10, Math.min(100, l.score)) / 100) * rMax).split(",");
              return <circle key={i} cx={vx} cy={vy} r="3" fill="#38bdf8" stroke="#0f172a" strokeWidth="1" />;
            })}
            {/* Labels */}
            {labels.map((l, i) => {
              const [tx, ty] = getPoint(l.angle, rMax + 16).split(",");
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
          <span className="text-[10px] text-slate-400 text-center font-medium">Mô hình đa nhân tố InvestIQ</span>
        </div>

        {/* Fundamental Ratios & Support/Resistance */}
        <div className="flex flex-col gap-2.5 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
          <div className="grid grid-cols-3 gap-2 text-center pb-2 border-b border-slate-800/60">
            <div>
              <span className="text-[10px] text-slate-400 block">P/E</span>
              <strong className="text-xs sm:text-sm font-extrabold text-white">
                {pe ? `${pe.toFixed(1)}x` : "--"}
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">P/B</span>
              <strong className="text-xs sm:text-sm font-extrabold text-white">
                {pb ? `${pb.toFixed(1)}x` : "--"}
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">ROE</span>
              <strong className="text-xs sm:text-sm font-extrabold text-emerald-400">
                {roe_percent ? `${roe_percent.toFixed(1)}%` : "--"}
              </strong>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Hỗ trợ quan trọng:</span>
              <span className="font-bold text-sky-400">
                {key_support ? `${key_support.toLocaleString("vi-VN")} đ` : "Đang kiểm định"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Kháng cự gần:</span>
              <span className="font-bold text-amber-400">
                {key_resistance ? `${key_resistance.toLocaleString("vi-VN")} đ` : "Đang kiểm định"}
              </span>
            </div>
          </div>

          {analysis_points.length > 0 && (
            <div className="mt-1 pt-2 border-t border-slate-800/60 space-y-1">
              {analysis_points.slice(0, 2).map((pt, idx) => (
                <div key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                  <span className="text-teal-400 font-bold">•</span>
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

