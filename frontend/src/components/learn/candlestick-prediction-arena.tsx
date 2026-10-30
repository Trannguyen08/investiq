"use client";

import { useMemo, useState } from "react";
import {
  CANDLESTICK_THEORY,
  type CandlestickChallenge,
  type CandlestickLevel,
} from "@/content/candlestick-challenges";
import { CANDLESTICK_CHALLENGES } from "@/content/candlestick-challenges-data";

export function CandlestickPredictionArena() {
  const [selectedLevel, setSelectedLevel] = useState<CandlestickLevel | "all">("all");
  const [currentChallengeId, setCurrentChallengeId] = useState<number>(1);
  const [userChoice, setUserChoice] = useState<"bullish" | "bearish" | "neutral" | null>(null);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [showTheory, setShowTheory] = useState<boolean>(true);

  // Filter challenges by level
  const filteredChallenges = useMemo(() => {
    if (selectedLevel === "all") return CANDLESTICK_CHALLENGES;
    return CANDLESTICK_CHALLENGES.filter((c) => c.level === selectedLevel);
  }, [selectedLevel]);

  const currentChallenge = useMemo(() => {
    return (
      CANDLESTICK_CHALLENGES.find((c) => c.id === currentChallengeId) ??
      CANDLESTICK_CHALLENGES[0]
    );
  }, [currentChallengeId]);

  function handleSelectOption(choice: "bullish" | "bearish" | "neutral") {
    if (userChoice) return; // Already answered
    setUserChoice(choice);

    const isCorrect = choice === currentChallenge.correctOption;
    if (isCorrect) {
      setScore((prev) => prev + 100);
      setStreak((prev) => prev + 1);
    } else {
      setStreak(0);
    }

    if (!completedIds.includes(currentChallenge.id)) {
      setCompletedIds((prev) => [...prev, currentChallenge.id]);
    }
  }

  function handleNextChallenge() {
    setUserChoice(null);
    const currentIndex = filteredChallenges.findIndex((c) => c.id === currentChallenge.id);
    if (currentIndex < filteredChallenges.length - 1) {
      setCurrentChallengeId(filteredChallenges[currentIndex + 1].id);
    } else {
      // Loop back or stay
      setCurrentChallengeId(filteredChallenges[0].id);
    }
  }

  function handlePrevChallenge() {
    setUserChoice(null);
    const currentIndex = filteredChallenges.findIndex((c) => c.id === currentChallenge.id);
    if (currentIndex > 0) {
      setCurrentChallengeId(filteredChallenges[currentIndex - 1].id);
    }
  }

  function handleResetCurrent() {
    setUserChoice(null);
  }

  // Calculate SVG dimensions for candlestick chart
  const allCandlesToRender = userChoice
    ? [...currentChallenge.candles, currentChallenge.nextCandle]
    : currentChallenge.candles;

  const minPrice = Math.min(
    ...allCandlesToRender.map((c) => c.l),
    currentChallenge.nextCandle.l
  );
  const maxPrice = Math.max(
    ...allCandlesToRender.map((c) => c.h),
    currentChallenge.nextCandle.h
  );
  const priceRange = maxPrice - minPrice || 1;

  const svgWidth = 600;
  const svgHeight = 260;
  const paddingX = 40;
  const paddingTop = 25;
  const paddingBottom = 40;
  const usableHeight = svgHeight - paddingTop - paddingBottom;

  const scaleY = (p: number) => {
    return paddingTop + usableHeight - ((p - minPrice) / priceRange) * usableHeight;
  };

  const candleSlotWidth = (svgWidth - paddingX * 2) / (currentChallenge.candles.length + 1);

  return (
    <div className="candle-arena-container">
      {/* ARENA HEADER */}
      <header className="candle-arena-header">
        <div>
          <span className="candle-arena-eyebrow">HỌC VIỆN ĐỌC NẾN NHẬT & PRICE ACTION</span>
          <h1 className="candle-arena-title">Đấu Trường Dự Đoán Nến & AI Nhận Xét</h1>
          <p className="candle-arena-subtitle">
            Học nguyên tắc cấu tạo nến, giải mã lực Cung - Cầu đằng sau thân nến và thử thách khả năng dự đoán xu hướng qua 50 bài tập thực chiến.
          </p>
        </div>

        {/* GAMIFICATION STATS */}
        <div className="candle-stats-cluster">
          <div className="candle-stat-box">
            <span className="candle-stat-label">Điểm số</span>
            <strong className="candle-stat-val text-blue">{score.toLocaleString("vi-VN")}</strong>
          </div>
          <div className="candle-stat-box">
            <span className="candle-stat-label">Chuỗi đúng 🔥</span>
            <strong className="candle-stat-val text-amber">{streak}</strong>
          </div>
          <div className="candle-stat-box">
            <span className="candle-stat-label">Đã vượt qua</span>
            <strong className="candle-stat-val text-green">
              {completedIds.length} / {CANDLESTICK_CHALLENGES.length}
            </strong>
          </div>
        </div>
      </header>

      {/* SECTION 1: CẨM NANG NGUYÊN TẮC NẾN NHẬT */}
      <section className="candle-theory-panel">
        <div
          className="candle-theory-header"
          onClick={() => setShowTheory(!showTheory)}
          role="button"
          tabIndex={0}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.2rem" }}>📖</span>
            <h2 style={{ fontSize: "1.05rem", margin: 0, fontWeight: 700 }}>
              Cẩm Nang Cốt Lõi: Nguyên Tắc Nến & Điều Gì Làm Thân Nến Dài Hay Ngắn?
            </h2>
          </div>
          <button type="button" className="candle-theory-toggle">
            {showTheory ? "Thu gọn ▲" : "Xem chi tiết ▼"}
          </button>
        </div>

        {showTheory && (
          <div className="candle-theory-body">
            <div className="candle-theory-card">
              <h3>{CANDLESTICK_THEORY.anatomy.title}</h3>
              <p>{CANDLESTICK_THEORY.anatomy.content}</p>
              <ul>
                {CANDLESTICK_THEORY.anatomy.rules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="candle-theory-card">
              <h3>{CANDLESTICK_THEORY.movement.title}</h3>
              <p>{CANDLESTICK_THEORY.movement.content}</p>
              <ul>
                {CANDLESTICK_THEORY.movement.rules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="candle-theory-card highlight">
              <h3>{CANDLESTICK_THEORY.bodyLength.title}</h3>
              <p>{CANDLESTICK_THEORY.bodyLength.content}</p>
              <ul>
                {CANDLESTICK_THEORY.bodyLength.rules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: BÀI TẬP DỰ ĐOÁN NẾN TƯƠNG TÁC */}
      <section className="candle-challenge-section">
        {/* FILTER BAR & NAV */}
        <div className="candle-challenge-controls">
          <div className="candle-level-tabs">
            <button
              type="button"
              className={selectedLevel === "all" ? "active" : ""}
              onClick={() => setSelectedLevel("all")}
            >
              Tất cả (50 bài)
            </button>
            <button
              type="button"
              className={selectedLevel === "basic" ? "active" : ""}
              onClick={() => setSelectedLevel("basic")}
            >
              Cơ bản (Bài 1 - 15)
            </button>
            <button
              type="button"
              className={selectedLevel === "intermediate" ? "active" : ""}
              onClick={() => setSelectedLevel("intermediate")}
            >
              Trung cấp (Bài 16 - 35)
            </button>
            <button
              type="button"
              className={selectedLevel === "advanced" ? "active" : ""}
              onClick={() => setSelectedLevel("advanced")}
            >
              Nâng cao & VSA (Bài 36 - 50)
            </button>
          </div>

          <div className="candle-nav-stepper">
            <button type="button" onClick={handlePrevChallenge}>
              ← Bài trước
            </button>
            <select
              aria-label="Chọn bài tập dự đoán nến"
              value={currentChallenge.id}
              onChange={(e) => {
                setUserChoice(null);
                setCurrentChallengeId(Number(e.target.value));
              }}
              className="candle-select-stepper"
            >
              {filteredChallenges.map((c) => (
                <option key={c.id} value={c.id}>
                  Bài {c.id}: {c.ticker} - {c.pattern} {completedIds.includes(c.id) ? "✓" : ""}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleNextChallenge}>
              Bài tiếp →
            </button>
          </div>
        </div>

        {/* ACTIVE CHALLENGE CARD */}
        <div className="candle-card-workspace">
          {/* TOP INFO ROW */}
          <div className="candle-challenge-meta">
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <span className={`candle-level-badge ${currentChallenge.level}`}>
                {currentChallenge.level === "basic"
                  ? "Cơ bản"
                  : currentChallenge.level === "intermediate"
                  ? "Trung cấp"
                  : "Nâng cao & VSA"}
              </span>
              <strong style={{ fontSize: "1.15rem", color: "#0f172a" }}>
                {currentChallenge.title}
              </strong>
              <span className="candle-ticker-pill">{currentChallenge.ticker}</span>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                ({currentChallenge.timeframe})
              </span>
            </div>

            <span className="candle-pattern-name">Mô hình: {currentChallenge.pattern}</span>
          </div>

          {/* CORPORATE & MARKET CONTEXT BOX */}
          <div className="candle-context-banner">
            <div className="candle-context-item">
              <span className="context-label">🏢 Bối cảnh Doanh nghiệp:</span>
              <p className="context-text">{currentChallenge.corporateContext}</p>
            </div>
            <div className="candle-context-item">
              <span className="context-label">🌐 Bối cảnh Thị trường & Tâm lý:</span>
              <p className="context-text">{currentChallenge.marketSentiment}</p>
            </div>
          </div>

          {/* SVG CANDLESTICK CHART */}
          <div className="candle-chart-container">
            <div className="candle-chart-legend">
              <span>Đồ thị kỹ thuật: {currentChallenge.ticker}</span>
              <div style={{ display: "flex", gap: "1rem" }}>
                <span style={{ color: "#10b981" }}>■ Nến tăng</span>
                <span style={{ color: "#ef4444" }}>■ Nến giảm</span>
                {userChoice && <span style={{ color: "#f59e0b" }}>★ Nến kết quả</span>}
              </div>
            </div>

            <svg
              className="candle-svg-canvas"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Grid lines */}
              <line x1={paddingX} y1={paddingTop} x2={svgWidth - paddingX} y2={paddingTop} stroke="#e2e8f0" strokeDasharray="4 4" />
              <line x1={paddingX} y1={scaleY(minPrice + priceRange * 0.5)} x2={svgWidth - paddingX} y2={scaleY(minPrice + priceRange * 0.5)} stroke="#e2e8f0" strokeDasharray="4 4" />
              <line x1={paddingX} y1={svgHeight - paddingBottom} x2={svgWidth - paddingX} y2={svgHeight - paddingBottom} stroke="#e2e8f0" strokeDasharray="4 4" />

              {/* Price labels on Y-axis */}
              <text x={svgWidth - paddingX + 6} y={paddingTop + 4} fontSize="10" fill="#94a3b8">
                {maxPrice.toFixed(1)}
              </text>
              <text x={svgWidth - paddingX + 6} y={scaleY(minPrice + priceRange * 0.5) + 3} fontSize="10" fill="#94a3b8">
                {((maxPrice + minPrice) / 2).toFixed(1)}
              </text>
              <text x={svgWidth - paddingX + 6} y={svgHeight - paddingBottom + 3} fontSize="10" fill="#94a3b8">
                {minPrice.toFixed(1)}
              </text>

              {/* Render Historical Candles */}
              {currentChallenge.candles.map((candle, idx) => {
                const x = paddingX + idx * candleSlotWidth + candleSlotWidth / 2;
                const isGreen = candle.c >= candle.o;
                const candleColor = isGreen ? "#10b981" : "#ef4444";
                const bodyTop = scaleY(Math.max(candle.o, candle.c));
                const bodyBottom = scaleY(Math.min(candle.o, candle.c));
                const bodyHeight = Math.max(bodyBottom - bodyTop, 3);
                const isSignalCandle = idx === currentChallenge.candles.length - 1;

                return (
                  <g key={idx}>
                    {/* Wick */}
                    <line
                      x1={x}
                      y1={scaleY(candle.h)}
                      x2={x}
                      y2={scaleY(candle.l)}
                      stroke={candleColor}
                      strokeWidth={1.5}
                    />
                    {/* Body */}
                    <rect
                      x={x - candleSlotWidth * 0.35}
                      y={bodyTop}
                      width={candleSlotWidth * 0.7}
                      height={bodyHeight}
                      fill={candleColor}
                      rx={2}
                    />

                    {/* Signal Candle Highlight Marker */}
                    {isSignalCandle && (
                      <g>
                        <circle cx={x} cy={scaleY(candle.h) - 12} r={4} fill="#2563eb" />
                        <text
                          x={x}
                          y={scaleY(candle.h) - 18}
                          fontSize="9"
                          fontWeight="700"
                          fill="#2563eb"
                          textAnchor="middle"
                        >
                          Nến tín hiệu
                        </text>
                      </g>
                    )}

                    {/* Candle index label */}
                    <text x={x} y={svgHeight - 12} fontSize="9" fill="#94a3b8" textAnchor="middle">
                      {idx + 1}
                    </text>
                  </g>
                );
              })}

              {/* Render Question Mark or Revealed Next Candle */}
              {(() => {
                const nextX =
                  paddingX +
                  currentChallenge.candles.length * candleSlotWidth +
                  candleSlotWidth / 2;

                if (!userChoice) {
                  // Unanswered: render mysterious question box
                  return (
                    <g>
                      <rect
                        x={nextX - candleSlotWidth * 0.4}
                        y={paddingTop + 10}
                        width={candleSlotWidth * 0.8}
                        height={usableHeight - 20}
                        fill="rgba(37, 99, 235, 0.05)"
                        stroke="#2563eb"
                        strokeDasharray="4 4"
                        rx={6}
                      />
                      <text
                        x={nextX}
                        y={svgHeight / 2}
                        fontSize="20"
                        fontWeight="700"
                        fill="#2563eb"
                        textAnchor="middle"
                      >
                        ?
                      </text>
                      <text
                        x={nextX}
                        y={svgHeight / 2 + 20}
                        fontSize="10"
                        fontWeight="600"
                        fill="#2563eb"
                        textAnchor="middle"
                      >
                        Nến tiếp theo
                      </text>
                    </g>
                  );
                }

                // Answered: reveal real next candle
                const nextC = currentChallenge.nextCandle;
                const isGreen = nextC.c >= nextC.o;
                const candleColor = isGreen ? "#10b981" : "#ef4444";
                const bodyTop = scaleY(Math.max(nextC.o, nextC.c));
                const bodyBottom = scaleY(Math.min(nextC.o, nextC.c));
                const bodyHeight = Math.max(bodyBottom - bodyTop, 3);

                return (
                  <g className="revealed-candle-animation">
                    {/* Glowing aura */}
                    <circle cx={nextX} cy={(bodyTop + bodyBottom) / 2} r={35} fill="rgba(245, 158, 11, 0.15)" />

                    {/* Wick */}
                    <line
                      x1={nextX}
                      y1={scaleY(nextC.h)}
                      x2={nextX}
                      y2={scaleY(nextC.l)}
                      stroke={candleColor}
                      strokeWidth={2}
                    />
                    {/* Body */}
                    <rect
                      x={nextX - candleSlotWidth * 0.35}
                      y={bodyTop}
                      width={candleSlotWidth * 0.7}
                      height={bodyHeight}
                      fill={candleColor}
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      rx={2}
                    />
                    <text
                      x={nextX}
                      y={scaleY(nextC.h) - 12}
                      fontSize="9"
                      fontWeight="700"
                      fill="#f59e0b"
                      textAnchor="middle"
                    >
                      Kết quả thực tế
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* USER PREDICTION BUTTONS */}
          <div className="candle-interaction-box">
            <h3 className="candle-prompt-text">{currentChallenge.question}</h3>

            <div className="candle-options-grid">
              {currentChallenge.options.map((opt) => {
                let btnCls = "candle-option-btn";
                if (userChoice) {
                  if (opt.key === currentChallenge.correctOption) {
                    btnCls += " correct-choice";
                  } else if (opt.key === userChoice) {
                    btnCls += " wrong-choice";
                  } else {
                    btnCls += " disabled";
                  }
                }

                return (
                  <button
                    key={opt.key}
                    type="button"
                    className={btnCls}
                    disabled={userChoice !== null}
                    onClick={() => handleSelectOption(opt.key)}
                  >
                    <span className="option-title">
                      {opt.key === "bullish" ? "📈" : opt.key === "bearish" ? "📉" : "⚖️"}{" "}
                      {opt.label}
                    </span>
                    <span className="option-desc">{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI FEEDBACK & DEEP DIVE ANALYSIS */}
          {userChoice && (
            <div className={`candle-ai-result-panel ${userChoice === currentChallenge.correctOption ? "success" : "failed"}`}>
              <div className="ai-result-header">
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: "1.5rem" }}>
                    {userChoice === currentChallenge.correctOption ? "🎉" : "💡"}
                  </span>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                      {userChoice === currentChallenge.correctOption
                        ? "Dự đoán CHÍNH XÁC (+100 Điểm)!"
                        : "Dự đoán CHƯA CHÍNH XÁC!"}
                    </h4>
                    <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                      AI Price Action Engine nhận xét chi tiết tình huống này
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" onClick={handleResetCurrent} className="candle-btn-outline">
                    Làm lại bài này
                  </button>
                  <button type="button" onClick={handleNextChallenge} className="candle-btn-primary">
                    Thử thách bài tiếp theo →
                  </button>
                </div>
              </div>

              <div className="ai-result-body">
                <div className="ai-point">
                  <strong>🔍 Tại sao lại diễn biến như vậy:</strong>
                  <p>{currentChallenge.aiAnalysis.why}</p>
                </div>

                <div className="ai-point">
                  <strong>⚖️ Động thái Cung - Cầu trên sổ lệnh:</strong>
                  <p>{currentChallenge.aiAnalysis.supplyDemand}</p>
                </div>

                <div className="ai-point">
                  <strong>🏢 Tác động từ Bối cảnh Doanh nghiệp:</strong>
                  <p>{currentChallenge.aiAnalysis.corporateImpact}</p>
                </div>

                <div className="ai-lesson-chip">
                  <strong>💡 Bài học thực chiến rút ra:</strong> {currentChallenge.aiAnalysis.lesson}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

