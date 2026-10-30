"use client";

import { useMemo, useState } from "react";

import {
  CANDLESTICK_CHALLENGES,
  type CandlestickChallenge,
} from "@/content/candlestick-challenges-data";

export function CandlestickPredictionArena() {
  const [selectedLevel, setSelectedLevel] = useState<"all" | "basic" | "intermediate" | "advanced">("all");
  const [currentChallengeId, setCurrentChallengeId] = useState<number>(1);
  const [userChoice, setUserChoice] = useState<"bullish" | "bearish" | "neutral" | null>(null);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [showTheory, setShowTheory] = useState<boolean>(true);
  const [activeTheoryTab, setActiveTheoryTab] = useState<"anatomy" | "orderbook" | "length">("anatomy");

  // Filter challenges according to tab
  const filteredChallenges = useMemo(() => {
    if (selectedLevel === "all") return CANDLESTICK_CHALLENGES;
    return CANDLESTICK_CHALLENGES.filter((c) => c.level === selectedLevel);
  }, [selectedLevel]);

  // Current active challenge
  const currentChallenge: CandlestickChallenge = useMemo(() => {
    return (
      CANDLESTICK_CHALLENGES.find((c) => c.id === currentChallengeId) ||
      CANDLESTICK_CHALLENGES[0]
    );
  }, [currentChallengeId]);

  // Handle choice submission
  const handleSelectOption = (choice: "bullish" | "bearish" | "neutral") => {
    if (userChoice !== null) return;
    setUserChoice(choice);

    const isCorrect = choice === currentChallenge.correctOption;
    if (isCorrect) {
      setScore((prev) => prev + 100);
      setStreak((prev) => prev + 1);
      if (!completedIds.includes(currentChallenge.id)) {
        setCompletedIds((prev) => [...prev, currentChallenge.id]);
      }
    } else {
      setStreak(0);
    }
  };

  // Navigation handlers
  const handleNextChallenge = () => {
    setUserChoice(null);
    const currentIndex = filteredChallenges.findIndex((c) => c.id === currentChallenge.id);
    if (currentIndex >= 0 && currentIndex < filteredChallenges.length - 1) {
      setCurrentChallengeId(filteredChallenges[currentIndex + 1].id);
    } else if (filteredChallenges.length > 0) {
      setCurrentChallengeId(filteredChallenges[0].id);
    }
  };

  const handlePrevChallenge = () => {
    setUserChoice(null);
    const currentIndex = filteredChallenges.findIndex((c) => c.id === currentChallenge.id);
    if (currentIndex > 0) {
      setCurrentChallengeId(filteredChallenges[currentIndex - 1].id);
    } else if (filteredChallenges.length > 0) {
      setCurrentChallengeId(filteredChallenges[filteredChallenges.length - 1].id);
    }
  };

  const handleResetCurrent = () => {
    setUserChoice(null);
  };

  // SVG Chart Scaling Helpers
  const svgWidth = 620;
  const svgHeight = 270;
  const paddingX = 45;
  const paddingTop = 30;
  const paddingBottom = 40;
  const usableHeight = svgHeight - paddingTop - paddingBottom;

  const allVisibleCandles = userChoice
    ? [...currentChallenge.candles, currentChallenge.nextCandle]
    : currentChallenge.candles;

  const minPrice = Math.min(...allVisibleCandles.map((c: { l: number }) => c.l));
  const maxPrice = Math.max(...allVisibleCandles.map((c: { h: number }) => c.h));
  const priceRange = maxPrice - minPrice || 1;

  const scaleY = (p: number) => {
    return svgHeight - paddingBottom - ((p - minPrice) / priceRange) * usableHeight;
  };

  const candleSlotWidth = (svgWidth - paddingX * 2) / (currentChallenge.candles.length + 1);

  return (
    <div className="candle-arena-container max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8 text-slate-100 font-sans">
      {/* ARENA HEADER */}
      <header className="candle-arena-header flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 mb-8 border-b border-slate-800">
        <div>
          <span className="candle-arena-eyebrow inline-block text-xs font-bold text-sky-400 uppercase tracking-widest mb-1.5 px-2.5 py-0.5 rounded-full bg-sky-950/80 border border-sky-800/60">
            HỌC VIỆN ĐỌC NẾN NHẬT &amp; PRICE ACTION
          </span>
          <h1 className="candle-arena-title text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight my-1">
            Đấu Trường Dự Đoán Nến &amp; AI Nhận Xét
          </h1>
          <p className="candle-arena-subtitle text-sm text-slate-400 max-w-2xl leading-relaxed mt-1">
            Học nguyên tắc cấu tạo nến, giải mã lực Cung - Cầu đằng sau thân nến và thử thách khả năng dự đoán xu hướng qua 50 bài tập thực chiến.
          </p>
        </div>

        {/* GAMIFICATION STATS */}
        <div className="candle-stats-cluster flex items-center gap-3 self-stretch md:self-auto">
          <div className="candle-stat-box flex-1 md:flex-none bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-col shadow-lg backdrop-blur-sm">
            <span className="candle-stat-label text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Điểm số</span>
            <strong className="candle-stat-val text-blue text-xl font-black text-sky-400 mt-0.5">{score.toLocaleString("vi-VN")}</strong>
          </div>
          <div className="candle-stat-box flex-1 md:flex-none bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-col shadow-lg backdrop-blur-sm">
            <span className="candle-stat-label text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Chuỗi đúng 🔥</span>
            <strong className="candle-stat-val text-amber text-xl font-black text-amber-400 mt-0.5">{streak}</strong>
          </div>
          <div className="candle-stat-box flex-1 md:flex-none bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-col shadow-lg backdrop-blur-sm">
            <span className="candle-stat-label text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Đã vượt qua</span>
            <strong className="candle-stat-val text-green text-xl font-black text-emerald-400 mt-0.5">
              {completedIds.length} / {CANDLESTICK_CHALLENGES.length}
            </strong>
          </div>
        </div>
      </header>

      {/* SECTION 1: CẨM NANG NGUYÊN TẮC NẾN NHẬT */}
      <section className="candle-theory-panel bg-slate-900/80 border border-slate-800 rounded-2xl mb-8 overflow-hidden shadow-xl backdrop-blur-sm">
        <div
          className="candle-theory-header flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-850 border-b border-slate-800 cursor-pointer select-none hover:bg-slate-800/60 transition"
          onClick={() => setShowTheory(!showTheory)}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📖</span>
            <h2 className="text-base sm:text-lg font-bold text-slate-100 m-0">
              Cẩm Nang Cốt Lõi: Nguyên Tắc Nến &amp; Điều Gì Làm Thân Nến Dài Hay Ngắn?
            </h2>
          </div>
          <button type="button" className="candle-theory-toggle text-xs sm:text-sm font-semibold text-sky-400 hover:text-sky-300 transition bg-transparent border-0 cursor-pointer">
            {showTheory ? "Thu gọn ▲" : "Xem chi tiết ▼"}
          </button>
        </div>

        {showTheory && (
          <div className="candle-theory-visual-wrapper p-5 sm:p-6">
            {/* Visual Tabs */}
            <div className="candle-theory-tabs-nav flex flex-wrap gap-2 pb-4 mb-6 border-b border-slate-800" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTheoryTab === "anatomy"}
                className={`theory-nav-btn px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition ${
                  activeTheoryTab === "anatomy"
                    ? "active bg-sky-500 text-white shadow-md shadow-sky-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/70"
                }`}
                onClick={() => setActiveTheoryTab("anatomy")}
              >
                📐 1. Giải Phẫu Cấu Tạo Nến
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTheoryTab === "orderbook"}
                className={`theory-nav-btn px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition ${
                  activeTheoryTab === "orderbook"
                    ? "active bg-sky-500 text-white shadow-md shadow-sky-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/70"
                }`}
                onClick={() => setActiveTheoryTab("orderbook")}
              >
                ⚖️ 2. Cơ Chế Sổ Lệnh: Nến Tăng/Giảm
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTheoryTab === "length"}
                className={`theory-nav-btn px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition ${
                  activeTheoryTab === "length"
                    ? "active bg-sky-500 text-white shadow-md shadow-sky-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/70"
                }`}
                onClick={() => setActiveTheoryTab("length")}
              >
                📏 3. Thân Nến Dài vs Ngắn Do Đâu?
              </button>
            </div>

            {/* TAB 1: ANATOMY INFOGRAPHIC */}
            {activeTheoryTab === "anatomy" && (
              <div className="theory-tab-content">
                <div className="theory-infographic-grid grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="theory-svg-box lg:col-span-7 bg-slate-950/80 rounded-xl p-4 border border-slate-800 shadow-inner flex justify-center">
                    <svg viewBox="0 0 520 280" className="theory-svg-canvas w-full max-w-[500px] h-auto">
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

                  <div className="theory-cards-column lg:col-span-5 flex flex-col gap-3">
                    <div className="theory-visual-pill green-pill bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3.5 shadow-sm">
                      <strong className="block text-emerald-400 text-sm font-bold mb-1">🟢 Nến Xanh: Giá Đóng &gt; Giá Mở (Bulls thắng thế)</strong>
                      <p className="text-xs text-slate-300 leading-relaxed m-0">Phe Mua càn quét qua mọi mức giá bán trong phiên, đóng cửa tại vùng giá cao.</p>
                    </div>
                    <div className="theory-visual-pill red-pill bg-rose-950/40 border border-rose-800/60 rounded-xl p-3.5 shadow-sm">
                      <strong className="block text-rose-400 text-sm font-bold mb-1">🔴 Nến Đỏ: Giá Đóng &lt; Giá Mở (Bears áp đảo)</strong>
                      <p className="text-xs text-slate-300 leading-relaxed m-0">Phe Bán xả hàng quyết liệt đè bẹp lực đỡ, đẩy giá tụt dốc về cuối phiên.</p>
                    </div>
                    <div className="theory-visual-pill cyan-pill bg-sky-950/40 border border-sky-800/60 rounded-xl p-3.5 shadow-sm">
                      <strong className="block text-sky-400 text-sm font-bold mb-1">⚡ Bóng Nến (Râu): Vùng giá bị một bên từ chối (Rejection)</strong>
                      <p className="text-xs text-slate-300 leading-relaxed m-0">Râu dưới = phe mua rút chân bắt đáy; Râu trên = phe bán chặn đứng nỗ lực vượt đỉnh.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ORDER BOOK SUPPLY & DEMAND INFOGRAPHIC */}
            {activeTheoryTab === "orderbook" && (
              <div className="theory-tab-content">
                <div className="theory-infographic-grid grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="theory-svg-box lg:col-span-7 bg-slate-950/80 rounded-xl p-4 border border-slate-800 shadow-inner flex justify-center">
                    <svg viewBox="0 0 520 280" className="theory-svg-canvas w-full max-w-[500px] h-auto">
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

                  <div className="theory-cards-column lg:col-span-5 flex flex-col gap-3">
                    <div className="theory-visual-pill green-pill bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3.5 shadow-sm">
                      <strong className="block text-emerald-400 text-sm font-bold mb-1">🚀 Cầu &gt; Cung: Bên Mua chấp nhận mua đuổi</strong>
                      <p className="text-xs text-slate-300 leading-relaxed m-0">Khối lượng bán chờ không đủ đáp ứng, giá phải nhảy vọt lên nấc giá cao hơn để khớp.</p>
                    </div>
                    <div className="theory-visual-pill red-pill bg-rose-950/40 border border-rose-800/60 rounded-xl p-3.5 shadow-sm">
                      <strong className="block text-rose-400 text-sm font-bold mb-1">📉 Cung &gt; Cầu: Bên Bán chấp nhận hạ giá thoát hàng</strong>
                      <p className="text-xs text-slate-300 leading-relaxed m-0">Lệnh bán xả trực tiếp vào các tầng kê mua bên dưới, khiến giá trượt dốc không phanh.</p>
                    </div>
                    <div className="theory-visual-pill amber-pill bg-amber-950/40 border border-amber-800/60 rounded-xl p-3.5 shadow-sm">
                      <strong className="block text-amber-400 text-sm font-bold mb-1">⚖️ Cung ≈ Cầu: Cân bằng giằng co</strong>
                      <p className="text-xs text-slate-300 leading-relaxed m-0">Hai bên triệt tiêu lực đẩy của nhau, tạo thân nến nhỏ li ti (Doji) tích lũy.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: BODY LENGTH & VOLUME MATRIX */}
            {activeTheoryTab === "length" && (
              <div className="theory-tab-content">
                <div className="theory-length-cards-grid grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="length-card bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col items-center text-center shadow-md">
                    <div className="length-card-chart py-2">
                      <svg viewBox="0 0 100 150" width="70" height="120">
                        <rect x="25" y="10" width="50" height="130" rx="3" fill="#10b981" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-bold text-slate-100 my-1">1. Thân Nến Dài (Marubozu)</h4>
                    <span className="length-tag blue text-[11px] font-semibold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60 mb-2">Mất cân bằng cực độ</span>
                    <p className="text-xs text-slate-400 leading-relaxed m-0">Một phe độc chiếm trận địa. Sổ lệnh mỏng + Volume lớn xác nhận dòng tiền cá mập (Smart Money) vào cuộc.</p>
                  </div>

                  <div className="length-card bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col items-center text-center shadow-md">
                    <div className="length-card-chart py-2">
                      <svg viewBox="0 0 100 150" width="70" height="120">
                        <line x1="50" y1="15" x2="50" y2="65" stroke="#94a3b8" strokeWidth="2" />
                        <rect x="30" y="65" width="40" height="18" rx="2" fill="#38bdf8" />
                        <line x1="50" y1="83" x2="50" y2="135" stroke="#94a3b8" strokeWidth="2" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-bold text-slate-100 my-1">2. Thân Nến Ngắn (Doji / Con quay)</h4>
                    <span className="length-tag gray text-[11px] font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 mb-2">Cung - Cầu giằng co</span>
                    <p className="text-xs text-slate-400 leading-relaxed m-0">Hai phe ghìm chân nhau bất phân thắng bại. Thị trường lưỡng lự hoặc tích lũy nén biên độ trước khi bùng nổ.</p>
                  </div>

                  <div className="length-card bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col items-center text-center shadow-md">
                    <div className="length-card-chart py-2">
                      <svg viewBox="0 0 100 150" width="70" height="120">
                        <line x1="50" y1="15" x2="50" y2="30" stroke="#10b981" strokeWidth="2" />
                        <rect x="25" y="30" width="50" height="32" rx="3" fill="#10b981" />
                        <line x1="50" y1="62" x2="50" y2="140" stroke="#10b981" strokeWidth="3" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-bold text-slate-100 my-1">3. Râu Nến Dài (Pin Bar / Hammer)</h4>
                    <span className="length-tag amber text-[11px] font-semibold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60 mb-2">Từ chối giá cực mạnh</span>
                    <p className="text-xs text-slate-400 leading-relaxed m-0">Một bên dìm/kéo giá rất xa nhưng bị phe đối lập phản công quyết liệt. Tín hiệu đảo chiều xu hướng tin cậy nhất.</p>
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
        <div className="candle-challenge-controls flex flex-wrap items-center justify-between gap-4 mb-6 bg-slate-900/90 border border-slate-800 p-3.5 sm:p-4 rounded-xl shadow-lg">
          <div className="candle-level-tabs flex flex-wrap gap-2">
            <button
              type="button"
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition ${
                selectedLevel === "all" ? "active bg-sky-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
              onClick={() => setSelectedLevel("all")}
            >
              Tất cả (50 bài)
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition ${
                selectedLevel === "basic" ? "active bg-sky-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
              onClick={() => setSelectedLevel("basic")}
            >
              Cơ bản (Bài 1 - 15)
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition ${
                selectedLevel === "intermediate" ? "active bg-sky-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
              onClick={() => setSelectedLevel("intermediate")}
            >
              Trung cấp (Bài 16 - 35)
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition ${
                selectedLevel === "advanced" ? "active bg-sky-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
              onClick={() => setSelectedLevel("advanced")}
            >
              Nâng cao &amp; VSA (Bài 36 - 50)
            </button>
          </div>

          <div className="candle-nav-stepper flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevChallenge}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition"
            >
              ← Bài trước
            </button>
            <select
              aria-label="Chọn bài tập dự đoán nến"
              value={currentChallenge.id}
              onChange={(e) => {
                setUserChoice(null);
                setCurrentChallengeId(Number(e.target.value));
              }}
              className="candle-select-stepper bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 max-w-[240px] truncate"
            >
              {filteredChallenges.map((c) => (
                <option key={c.id} value={c.id}>
                  Bài {c.id}: {c.ticker} - {c.pattern} {completedIds.includes(c.id) ? "✓" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleNextChallenge}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition"
            >
              Bài tiếp →
            </button>
          </div>
        </div>

        {/* ACTIVE CHALLENGE WORKSPACE (2-COLUMN GRID) */}
        <div className="challenge-workspace-grid grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 mb-8">
          {/* LEFT COLUMN: INFO & CONTEXT CARD */}
          <div className="challenge-info-card bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col gap-4 shadow-xl">
            <div className="challenge-meta-row flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`candle-level-badge ${currentChallenge.level} text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  currentChallenge.level === "basic"
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                    : currentChallenge.level === "intermediate"
                    ? "bg-sky-950 text-sky-400 border border-sky-800/60"
                    : "bg-purple-950 text-purple-400 border border-purple-800/60"
                }`}>
                  {currentChallenge.level === "basic"
                    ? "Cơ bản"
                    : currentChallenge.level === "intermediate"
                    ? "Trung cấp"
                    : "Nâng cao & VSA"}
                </span>
                <span className="challenge-ticker-pill px-2.5 py-0.5 rounded bg-blue-600 text-white font-extrabold text-xs">
                  {currentChallenge.ticker}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  ({currentChallenge.timeframe})
                </span>
              </div>
              <span className="challenge-pattern-badge text-xs font-bold text-sky-400 bg-sky-950/80 border border-sky-800/60 px-2 py-0.5 rounded">
                Mô hình: {currentChallenge.pattern}
              </span>
            </div>

            <h3 className="challenge-title-text text-base sm:text-lg font-bold text-white m-0 leading-snug">
              {currentChallenge.title}
            </h3>

            {/* BỐI CẢNH DOANH NGHIỆP */}
            <div className="challenge-context-box bg-slate-950/80 border-l-4 border-sky-400 rounded-r-xl p-3.5 shadow-inner">
              <span className="block font-bold text-sky-400 text-xs mb-1">
                🏢 Bối cảnh Doanh nghiệp:
              </span>
              <p className="m-0 text-xs sm:text-sm text-slate-300 leading-relaxed">
                {currentChallenge.corporateContext}
              </p>
            </div>

            {/* BỐI CẢNH THỊ TRƯỜNG & TÂM LÝ */}
            <div className="challenge-context-box bg-slate-950/80 border-l-4 border-purple-400 rounded-r-xl p-3.5 shadow-inner">
              <span className="block font-bold text-purple-400 text-xs mb-1">
                🌐 Bối cảnh Thị trường &amp; Tâm lý:
              </span>
              <p className="m-0 text-xs sm:text-sm text-slate-300 leading-relaxed">
                {currentChallenge.marketSentiment}
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: TECHNICAL CANDLESTICK CHART */}
          <div className="challenge-chart-card bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xl">
            <div className="challenge-chart-legend flex items-center justify-between flex-wrap gap-2 text-xs text-slate-400 mb-3">
              <span className="font-bold text-slate-100">
                Đồ thị kỹ thuật: {currentChallenge.ticker} ({currentChallenge.timeframe})
              </span>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> Nến tăng
                </span>
                <span className="text-rose-400 font-semibold flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 bg-rose-500 rounded-sm"></span> Nến giảm
                </span>
                {userChoice && (
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    ★ Nến kết quả
                  </span>
                )}
              </div>
            </div>

            <svg
              className="candle-svg-canvas w-full h-[260px] bg-slate-950 rounded-xl border border-slate-900"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Grid lines */}
              <line x1={paddingX} y1={paddingTop} x2={svgWidth - paddingX} y2={paddingTop} stroke="#1e293b" strokeDasharray="4 4" />
              <line x1={paddingX} y1={scaleY(minPrice + priceRange * 0.5)} x2={svgWidth - paddingX} y2={scaleY(minPrice + priceRange * 0.5)} stroke="#1e293b" strokeDasharray="4 4" />
              <line x1={paddingX} y1={svgHeight - paddingBottom} x2={svgWidth - paddingX} y2={svgHeight - paddingBottom} stroke="#1e293b" strokeDasharray="4 4" />

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
              {currentChallenge.candles.map((candle: { o: number; h: number; l: number; c: number; v?: number }, idx: number) => {
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
                        <circle cx={x} cy={scaleY(candle.h) - 12} r={4} fill="#38bdf8" />
                        <text
                          x={x}
                          y={scaleY(candle.h) - 18}
                          fontSize="9"
                          fontWeight="700"
                          fill="#38bdf8"
                          textAnchor="middle"
                        >
                          Nến tín hiệu
                        </text>
                      </g>
                    )}

                    {/* Candle index label */}
                    <text x={x} y={svgHeight - 10} fontSize="9" fill="#64748b" textAnchor="middle">
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
                        fill="rgba(56, 189, 248, 0.08)"
                        stroke="#38bdf8"
                        strokeDasharray="4 4"
                        rx={6}
                      />
                      <text
                        x={nextX}
                        y={svgHeight / 2}
                        fontSize="20"
                        fontWeight="700"
                        fill="#38bdf8"
                        textAnchor="middle"
                      >
                        ?
                      </text>
                      <text
                        x={nextX}
                        y={svgHeight / 2 + 20}
                        fontSize="10"
                        fontWeight="600"
                        fill="#38bdf8"
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
                      strokeWidth={1.8}
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
        </div>

        {/* USER DECISION BOX */}
        <div className="challenge-decision-box bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 mb-8 shadow-xl">
          <h3 className="challenge-question-heading text-base sm:text-lg font-bold text-center text-white mb-5">
            {currentChallenge.question}
          </h3>

          <div className="challenge-options-grid grid grid-cols-1 md:grid-cols-3 gap-4">
            {currentChallenge.options.map((opt: { key: "bullish" | "bearish" | "neutral"; label: string; description: string }) => {
              let btnCls = "challenge-option-btn p-4 rounded-xl border-2 text-left transition flex flex-col items-start gap-1 cursor-pointer ";
              if (userChoice) {
                if (opt.key === currentChallenge.correctOption) {
                  btnCls += "selected-bullish border-emerald-500 bg-emerald-950/40 text-emerald-300 shadow-md shadow-emerald-500/20";
                } else if (opt.key === userChoice) {
                  btnCls += "selected-bearish border-rose-500 bg-rose-950/40 text-rose-300 shadow-md shadow-rose-500/20";
                } else {
                  btnCls += "border-slate-800 bg-slate-950/60 opacity-40 text-slate-500";
                }
              } else {
                btnCls += "border-slate-800 bg-slate-950/70 hover:border-sky-500 hover:bg-slate-800/80 text-slate-200 hover:-translate-y-0.5 shadow-sm";
              }

              return (
                <button
                  key={opt.key}
                  type="button"
                  className={btnCls}
                  disabled={userChoice !== null}
                  onClick={() => handleSelectOption(opt.key)}
                >
                  <span className="challenge-opt-label text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1.5">
                    {opt.key === "bullish" ? "📈" : opt.key === "bearish" ? "📉" : "⚖️"}{" "}
                    {opt.label}
                  </span>
                  <span className="challenge-opt-desc text-xs text-slate-400 leading-relaxed">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* AI VERDICT & DEEP DIVE ANALYSIS */}
        {userChoice && (
          <div className={`ai-verdict-card bg-slate-900/95 border-2 rounded-2xl p-5 sm:p-7 shadow-2xl transition ${
            userChoice === currentChallenge.correctOption
              ? "correct-border border-emerald-500/80 shadow-emerald-500/10"
              : "wrong-border border-rose-500/80 shadow-rose-500/10"
          }`}>
            <div className="verdict-header-row flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {userChoice === currentChallenge.correctOption ? "🎉" : "💡"}
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`verdict-tag text-xs font-black px-2.5 py-0.5 rounded-full ${
                      userChoice === currentChallenge.correctOption
                        ? "correct bg-emerald-950 text-emerald-400 border border-emerald-700/60"
                        : "wrong bg-rose-950 text-rose-400 border border-rose-700/60"
                    }`}>
                      {userChoice === currentChallenge.correctOption ? "DỰ ĐOÁN CHÍNH XÁC (+100 ĐIỂM)" : "DỰ ĐOÁN CHƯA CHÍNH XÁC"}
                    </span>
                    <strong className="text-base font-bold text-white">
                      AI Price Action Engine Nhận Xét
                    </strong>
                  </div>
                  <span className="text-xs text-slate-400">
                    Giải mã quy luật Cung - Cầu và hành động giá nến thực chiến
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                <button
                  type="button"
                  onClick={handleResetCurrent}
                  className="candle-btn-outline px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                >
                  Làm lại bài này
                </button>
                <button
                  type="button"
                  onClick={handleNextChallenge}
                  className="candle-btn-primary px-4 py-2 text-xs font-bold rounded-lg bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/25 transition"
                >
                  Bài tiếp theo →
                </button>
              </div>
            </div>

            <div className="ai-details-grid grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
              <div className="ai-detail-block bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 shadow-inner">
                <strong className="block text-sky-400 font-bold text-xs mb-1.5">
                  🔍 Tại sao lại diễn biến như vậy:
                </strong>
                <p className="m-0 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {currentChallenge.aiAnalysis.why}
                </p>
              </div>

              <div className="ai-detail-block bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 shadow-inner">
                <strong className="block text-emerald-400 font-bold text-xs mb-1.5">
                  ⚖️ Động thái Cung - Cầu trên sổ lệnh:
                </strong>
                <p className="m-0 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {currentChallenge.aiAnalysis.supplyDemand}
                </p>
              </div>

              <div className="ai-detail-block bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 shadow-inner">
                <strong className="block text-purple-400 font-bold text-xs mb-1.5">
                  🏢 Tác động từ Bối cảnh Doanh nghiệp:
                </strong>
                <p className="m-0 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {currentChallenge.aiAnalysis.corporateImpact}
                </p>
              </div>
            </div>

            <div className="bg-sky-950/30 border border-sky-800/50 rounded-xl p-4 text-xs sm:text-sm text-slate-200 leading-relaxed">
              <strong className="text-sky-400 font-bold">💡 Bài học thực chiến rút ra: </strong>
              {currentChallenge.aiAnalysis.lesson}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
