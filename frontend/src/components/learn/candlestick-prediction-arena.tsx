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
  const [activeTheoryTab, setActiveTheoryTab] = useState<"anatomy" | "orderbook" | "length">("anatomy");

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
          <div className="candle-theory-visual-wrapper">
            {/* Visual Tabs */}
            <div className="candle-theory-tabs-nav" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTheoryTab === "anatomy"}
                className={`theory-nav-btn ${activeTheoryTab === "anatomy" ? "active" : ""}`}
                onClick={() => setActiveTheoryTab("anatomy")}
              >
                📐 1. Giải Phẫu Cấu Tạo Nến
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTheoryTab === "orderbook"}
                className={`theory-nav-btn ${activeTheoryTab === "orderbook" ? "active" : ""}`}
                onClick={() => setActiveTheoryTab("orderbook")}
              >
                ⚖️ 2. Cơ Chế Sổ Lệnh: Nến Tăng/Giảm
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTheoryTab === "length"}
                className={`theory-nav-btn ${activeTheoryTab === "length" ? "active" : ""}`}
                onClick={() => setActiveTheoryTab("length")}
              >
                📏 3. Thân Nến Dài vs Ngắn Do Đâu?
              </button>
            </div>

            {/* TAB 1: ANATOMY INFOGRAPHIC */}
            {activeTheoryTab === "anatomy" && (
              <div className="theory-tab-content">
                <div className="theory-infographic-grid">
                  <div className="theory-svg-box">
                    <svg viewBox="0 0 520 280" className="theory-svg-canvas">
                      <line x1="20" y1="50" x2="500" y2="50" stroke="#1e293b" strokeDasharray="3 3" />
                      <line x1="20" y1="110" x2="500" y2="110" stroke="#1e293b" strokeDasharray="3 3" />
                      <line x1="20" y1="170" x2="500" y2="170" stroke="#1e293b" strokeDasharray="3 3" />
                      <line x1="20" y1="230" x2="500" y2="230" stroke="#1e293b" strokeDasharray="3 3" />

                      {/* BULLISH CANDLE (LEFT) */}
                      <g transform="translate(100, 0)">
                        <line x1="40" y1="35" x2="40" y2="80" stroke="#10b981" strokeWidth="3" />
                        <rect x="15" y="80" width="50" height="110" rx="3" fill="#10b981" />
                        <line x1="40" y1="190" x2="40" y2="245" stroke="#10b981" strokeWidth="3" />
                        
                        <circle cx="40" cy="35" r="4" fill="#38bdf8" />
                        <text x="-5" y="39" fill="#38bdf8" fontSize="12" fontWeight="700" textAnchor="end">Đỉnh (High)</text>
                        
                        <text x="-5" y="85" fill="#34d399" fontSize="12" fontWeight="700" textAnchor="end">Đóng (Close)</text>
                        
                        <text x="40" y="140" fill="#ffffff" fontSize="12" fontWeight="800" textAnchor="middle">NẾN XANH</text>
                        
                        <text x="-5" y="195" fill="#34d399" fontSize="12" fontWeight="700" textAnchor="end">Mở (Open)</text>
                        
                        <circle cx="40" cy="245" r="4" fill="#38bdf8" />
                        <text x="-5" y="249" fill="#38bdf8" fontSize="12" fontWeight="700" textAnchor="end">Đáy (Low)</text>
                      </g>

                      {/* BEARISH CANDLE (RIGHT) */}
                      <g transform="translate(340, 0)">
                        <line x1="40" y1="35" x2="40" y2="80" stroke="#ef4444" strokeWidth="3" />
                        <rect x="15" y="80" width="50" height="110" rx="3" fill="#ef4444" />
                        <line x1="40" y1="190" x2="40" y2="245" stroke="#ef4444" strokeWidth="3" />
                        
                        <circle cx="40" cy="35" r="4" fill="#38bdf8" />
                        <text x="85" y="39" fill="#38bdf8" fontSize="12" fontWeight="700">Đỉnh (High)</text>
                        
                        <text x="85" y="85" fill="#f87171" fontSize="12" fontWeight="700">Mở (Open)</text>
                        
                        <text x="40" y="140" fill="#ffffff" fontSize="12" fontWeight="800" textAnchor="middle">NẾN ĐỎ</text>
                        
                        <text x="85" y="195" fill="#f87171" fontSize="12" fontWeight="700">Đóng (Close)</text>
                        
                        <circle cx="40" cy="245" r="4" fill="#38bdf8" />
                        <text x="85" y="249" fill="#38bdf8" fontSize="12" fontWeight="700">Đáy (Low)</text>
                      </g>
                    </svg>
                  </div>

                  <div className="theory-cards-column">
                    <div className="theory-visual-pill green-pill">
                      <strong>🟢 Nến Xanh: Giá Đóng &gt; Giá Mở (Bulls thắng thế)</strong>
                      <p>Phe Mua càn quét qua mọi mức giá bán trong phiên, đóng cửa tại vùng giá cao.</p>
                    </div>
                    <div className="theory-visual-pill red-pill">
                      <strong>🔴 Nến Đỏ: Giá Đóng &lt; Giá Mở (Bears áp đảo)</strong>
                      <p>Phe Bán xả hàng quyết liệt đè bẹp lực đỡ, đẩy giá tụt dốc về cuối phiên.</p>
                    </div>
                    <div className="theory-visual-pill cyan-pill">
                      <strong>⚡ Bóng Nến (Râu): Vùng giá bị một bên từ chối (Rejection)</strong>
                      <p>Râu dưới = phe mua rút chân bắt đáy; Râu trên = phe bán chặn đứng nỗ lực vượt đỉnh.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ORDER BOOK SUPPLY & DEMAND INFOGRAPHIC */}
            {activeTheoryTab === "orderbook" && (
              <div className="theory-tab-content">
                <div className="theory-infographic-grid">
                  <div className="theory-svg-box">
                    <svg viewBox="0 0 520 280" className="theory-svg-canvas">
                      <g transform="translate(30, 35)">
                        <rect x="0" y="0" width="210" height="200" rx="8" fill="rgba(16, 185, 129, 0.12)" stroke="#10b981" strokeWidth="1.5" />
                        <text x="105" y="32" fill="#10b981" fontSize="14" fontWeight="800" textAnchor="middle">🟢 LỰC CẦU (PHE MUA)</text>
                        <text x="105" y="65" fill="#f8fafc" fontSize="11" fontWeight="600" textAnchor="middle">Lệnh Mua Chủ Động (Market Buy)</text>
                        <line x1="105" y1="85" x2="105" y2="135" stroke="#10b981" strokeWidth="4" />
                        <polygon points="105,75 95,90 115,90" fill="#10b981" />
                        <text x="105" y="160" fill="#94a3b8" fontSize="11" textAnchor="middle">Nuốt cạn lệnh bán chờ (Ask)</text>
                        <text x="105" y="185" fill="#34d399" fontSize="12" fontWeight="800" textAnchor="middle">➔ ĐẨY NẾN TĂNG XANH</text>
                      </g>

                      <g transform="translate(280, 35)">
                        <rect x="0" y="0" width="210" height="200" rx="8" fill="rgba(239, 68, 68, 0.12)" stroke="#ef4444" strokeWidth="1.5" />
                        <text x="105" y="32" fill="#ef4444" fontSize="14" fontWeight="800" textAnchor="middle">🔴 LỰC CUNG (PHE BÁN)</text>
                        <text x="105" y="65" fill="#f8fafc" fontSize="11" fontWeight="600" textAnchor="middle">Lệnh Bán Chủ Động (Market Sell)</text>
                        <line x1="105" y1="85" x2="105" y2="135" stroke="#ef4444" strokeWidth="4" />
                        <polygon points="105,145 95,130 115,130" fill="#ef4444" />
                        <text x="105" y="160" fill="#94a3b8" fontSize="11" textAnchor="middle">Đập gãy lệnh mua kê (Bid)</text>
                        <text x="105" y="185" fill="#f87171" fontSize="12" fontWeight="800" textAnchor="middle">➔ DÌM NẾN RƠI ĐỎ</text>
                      </g>
                    </svg>
                  </div>

                  <div className="theory-cards-column">
                    <div className="theory-visual-pill green-pill">
                      <strong>🚀 Cầu &gt; Cung: Bên Mua chấp nhận mua đuổi</strong>
                      <p>Khối lượng bán chờ không đủ đáp ứng, giá phải nhảy vọt lên nấc giá cao hơn để khớp.</p>
                    </div>
                    <div className="theory-visual-pill red-pill">
                      <strong>📉 Cung &gt; Cầu: Bên Bán chấp nhận hạ giá thoát hàng</strong>
                      <p>Lệnh bán xả trực tiếp vào các tầng kê mua bên dưới, khiến giá trượt dốc không phanh.</p>
                    </div>
                    <div className="theory-visual-pill amber-pill">
                      <strong>⚖️ Cung ≈ Cầu: Cân bằng giằng co</strong>
                      <p>Hai bên triệt tiêu lực đẩy của nhau, tạo thân nến nhỏ li ti (Doji) tích lũy.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: BODY LENGTH & VOLUME MATRIX */}
            {activeTheoryTab === "length" && (
              <div className="theory-tab-content">
                <div className="theory-length-cards-grid">
                  <div className="length-card">
                    <div className="length-card-chart">
                      <svg viewBox="0 0 100 150" width="70" height="120">
                        <rect x="25" y="10" width="50" height="130" rx="3" fill="#10b981" />
                      </svg>
                    </div>
                    <h4>1. Thân Nến Dài (Marubozu)</h4>
                    <span className="length-tag blue">Mất cân bằng cực độ</span>
                    <p>Một phe độc chiếm trận địa. Sổ lệnh mỏng + Volume lớn xác nhận dòng tiền cá mập (Smart Money) vào cuộc.</p>
                  </div>

                  <div className="length-card">
                    <div className="length-card-chart">
                      <svg viewBox="0 0 100 150" width="70" height="120">
                        <line x1="50" y1="15" x2="50" y2="65" stroke="#94a3b8" strokeWidth="2" />
                        <rect x="30" y="65" width="40" height="18" rx="2" fill="#38bdf8" />
                        <line x1="50" y1="83" x2="50" y2="135" stroke="#94a3b8" strokeWidth="2" />
                      </svg>
                    </div>
                    <h4>2. Thân Nến Ngắn (Doji / Con quay)</h4>
                    <span className="length-tag gray">Cung - Cầu giằng co</span>
                    <p>Hai phe ghìm chân nhau bất phân thắng bại. Thị trường lưỡng lự hoặc tích lũy nén biên độ trước khi bùng nổ.</p>
                  </div>

                  <div className="length-card">
                    <div className="length-card-chart">
                      <svg viewBox="0 0 100 150" width="70" height="120">
                        <line x1="50" y1="15" x2="50" y2="30" stroke="#10b981" strokeWidth="2" />
                        <rect x="25" y="30" width="50" height="32" rx="3" fill="#10b981" />
                        <line x1="50" y1="62" x2="50" y2="140" stroke="#10b981" strokeWidth="3" />
                      </svg>
                    </div>
                    <h4>3. Râu Nến Dài (Pin Bar / Hammer)</h4>
                    <span className="length-tag amber">Từ chối giá cực mạnh</span>
                    <p>Một bên dìm/kéo giá rất xa nhưng bị phe đối lập phản công quyết liệt. Tín hiệu đảo chiều xu hướng tin cậy nhất.</p>
                  </div>
                </div>
              </div>
            )}
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

