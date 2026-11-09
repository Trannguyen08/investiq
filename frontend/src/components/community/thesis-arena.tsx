"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { STOCK_DIRECTORY } from "@/lib/ticker-matcher";
import type { AnalystReputationItem, InvestmentThesisItem } from "@/types/thesis";

const moneyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function parsePriceNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let str = String(value).replace(/[+₫đVNDvnd\s]/gi, "").trim();
  if (str.includes(",")) {
    str = str.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
    str = str.replace(/\./g, "");
  }
  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatVnd(value: string | number | undefined | null): string {
  const num = parsePriceNumber(value);
  return moneyFormat.format(num);
}

function formatOutcomeRoi(roi: string | number | null | undefined): string {
  if (roi === null || roi === undefined || roi === "") return "";
  const cleaned = String(roi).replace(/[%+()]/g, "").trim();
  const num = Number(cleaned);
  if (isNaN(num)) return ` (${roi})`;
  return ` (${num > 0 ? "+" : ""}${num}%)`;
}

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch("/auth-api/csrf", { cache: "no-store" });
  const body = (await response.json()) as { csrf_token?: string };
  if (!response.ok || !body.csrf_token) throw new Error("Không thể lấy mã CSRF bảo mật.");
  return body.csrf_token;
}

type ThesisArenaProps = {
  initialTheses?: InvestmentThesisItem[];
  initialLeaderboard?: AnalystReputationItem[];
};

export function ThesisArena({ initialTheses = [], initialLeaderboard = [] }: ThesisArenaProps) {
  const { status: authStatus, user } = useAuth();
  const [theses, setTheses] = useState<InvestmentThesisItem[]>(initialTheses);
  const [myTheses, setMyTheses] = useState<InvestmentThesisItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<AnalystReputationItem[]>(initialLeaderboard);
  const [loading, setLoading] = useState(false);
  const [loadingMyTheses, setLoadingMyTheses] = useState(false);
  const [scope, setScope] = useState<"community" | "my">("community");
  const [sortOrder, setSortOrder] = useState<"engagement" | "recent">("engagement");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stanceFilter, setStanceFilter] = useState<string>("all");
  const [searchSymbol, setSearchSymbol] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [upvotingId, setUpvotingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form state
  const [formSymbol, setFormSymbol] = useState("");
  const [showSymbolSuggestions, setShowSymbolSuggestions] = useState(false);
  const [formStance, setFormStance] = useState<"bullish" | "bearish">("bullish");
  const [formTargetPrice, setFormTargetPrice] = useState("");
  const [formStopLossPrice, setFormStopLossPrice] = useState("");
  const [formHorizon, setFormHorizon] = useState("3");
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCatalysts, setFormCatalysts] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const symbolSuggestions = useMemo(() => {
    const q = formSymbol.trim().toUpperCase();
    if (!q) return [];
    return STOCK_DIRECTORY.filter(
      (s) => s.symbol.startsWith(q) || s.name.toUpperCase().includes(q)
    ).slice(0, 6);
  }, [formSymbol]);

  const isFirstMount = useRef(true);

  const loadData = useCallback(async () => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (initialTheses.length > 0 || initialLeaderboard.length > 0) return;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (statusFilter !== "all") query.set("status", statusFilter);
      if (searchSymbol.trim()) query.set("symbol", searchSymbol.trim().toUpperCase());
      query.set("sort", sortOrder);

      const [thesesRes, leaderboardRes] = await Promise.all([
        fetch(`/theses-api${query.size ? `?${query.toString()}` : ""}`, { cache: "no-store" }),
        fetch("/theses-api/leaderboard", { cache: "no-store" }),
      ]);

      if (thesesRes.ok) {
        const data = (await thesesRes.json()) as { data: InvestmentThesisItem[] };
        setTheses(data.data || []);
      }
      if (leaderboardRes.ok) {
        const data = (await leaderboardRes.json()) as { data: AnalystReputationItem[] };
        setLeaderboard(data.data || []);
      }
    } catch {
      // Keep initial
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchSymbol, sortOrder, initialTheses.length, initialLeaderboard.length]);

  const loadMyTheses = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    setLoadingMyTheses(true);
    try {
      const res = await fetch("/theses-api/my", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { data: InvestmentThesisItem[] };
        setMyTheses(data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMyTheses(false);
    }
  }, [authStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (scope === "my" && authStatus === "authenticated") {
      loadMyTheses();
    }
  }, [scope, authStatus, loadMyTheses]);

  const displayedList = scope === "my" ? myTheses : theses;

  const filteredTheses = useMemo(() => {
    return displayedList
      .filter((item) => {
        if (stanceFilter !== "all" && item.stance !== stanceFilter) return false;
        if (scope === "my") {
          if (statusFilter !== "all" && item.status !== statusFilter) return false;
          if (searchSymbol.trim() && !item.symbol.includes(searchSymbol.trim().toUpperCase())) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === "engagement") {
          const diffVotes = (b.upvotes || 0) - (a.upvotes || 0);
          if (diffVotes !== 0) return diffVotes;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [displayedList, stanceFilter, scope, statusFilter, searchSymbol, sortOrder]);

  async function handleUpvote(thesisId: string) {
    if (authStatus !== "authenticated") {
      setMessage({ text: "Vui lòng đăng nhập để bình chọn luận điểm.", type: "error" });
      return;
    }
    setUpvotingId(thesisId);
    try {
      const csrf = await fetchCsrfToken();
      const res = await fetch(`/theses-api/${thesisId}/upvote`, {
        method: "POST",
        headers: { "x-csrf-token": csrf },
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(err?.detail || "Không thể bình chọn.");
      }
      const updated = (await res.json()) as InvestmentThesisItem;
      setTheses((prev) => prev.map((t) => (t.id === thesisId ? updated : t)));
      setMyTheses((prev) => prev.map((t) => (t.id === thesisId ? updated : t)));
      setMessage({ text: "Đã ghi nhận bình chọn thành công!", type: "success" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Chưa thể bình chọn luận điểm.",
        type: "error",
      });
    } finally {
      setUpvotingId(null);
    }
  }

  async function handlePublishThesis(e: React.FormEvent) {
    e.preventDefault();
    if (authStatus !== "authenticated") {
      setMessage({ text: "Bạn cần đăng nhập để đăng luận điểm đầu tư.", type: "error" });
      return;
    }

    const cleanTarget = formTargetPrice.replace(/[^\d]/g, "");
    const cleanStopLoss = formStopLossPrice.replace(/[^\d]/g, "");
    const targetPrice = Number(cleanTarget);
    const stopLossPrice = Number(cleanStopLoss);

    if (!formSymbol.trim()) {
      setMessage({ text: "Vui lòng nhập mã cổ phiếu.", type: "error" });
      return;
    }
    if (Number.isNaN(targetPrice) || targetPrice <= 0) {
      setMessage({ text: "Giá mục tiêu phải là số dương lớn hơn 0.", type: "error" });
      return;
    }
    if (Number.isNaN(stopLossPrice) || stopLossPrice <= 0) {
      setMessage({ text: "Giá cắt lỗ phải là số dương lớn hơn 0.", type: "error" });
      return;
    }
    if (formStance === "bullish" && stopLossPrice >= targetPrice) {
      setMessage({ text: "Giá cắt lỗ an toàn phải nhỏ hơn giá mục tiêu kỳ vọng.", type: "error" });
      return;
    }
    if (formStance === "bearish" && stopLossPrice <= targetPrice) {
      setMessage({ text: "Với xu hướng giảm giá, giá cắt lỗ phải lớn hơn giá mục tiêu.", type: "error" });
      return;
    }
    if (formTitle.trim().length < 5) {
      setMessage({ text: "Tiêu đề phải từ 5 ký tự trở lên.", type: "error" });
      return;
    }
    if (formBody.trim().length < 20) {
      setMessage({ text: "Nội dung phân tích cần chi tiết ít nhất 20 ký tự.", type: "error" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const csrf = await fetchCsrfToken();
      const catalysts = formCatalysts
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/theses-api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({
          symbol: formSymbol.trim().toUpperCase(),
          stance: formStance,
          target_price: targetPrice,
          stop_loss_price: stopLossPrice,
          horizon_months: Number(formHorizon),
          title: formTitle.trim(),
          thesis_body: formBody.trim(),
          catalysts,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(err?.detail || "Không thể đăng luận điểm.");
      }

      setMessage({
        text: "Xuất bản luận điểm thành công! Giá vào đã được khóa tự động theo giá thị trường.",
        type: "success",
      });
      setShowCreateModal(false);
      // Reset form
      setFormSymbol("");
      setFormTargetPrice("");
      setFormStopLossPrice("");
      setFormTitle("");
      setFormBody("");
      setFormCatalysts("");
      loadData();
      if (scope === "my") {
        loadMyTheses();
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Đăng luận điểm thất bại.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="thesis-arena-container">
      {/* Notifications */}
      {message && (
        <div className={`thesis-alert ${message.type === "success" ? "thesis-alert-success" : "thesis-alert-error"}`}>
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="thesis-alert-close">
            ✕
          </button>
        </div>
      )}

      {/* Header and Action */}
      <div className="thesis-header-row">
        <div>
          <h2 className="thesis-arena-title">Góc nhìn & Luận điểm Đầu tư</h2>
          <p className="thesis-arena-desc">
            Mỗi luận điểm đều được hệ thống khóa giá thực tế tự động, theo dõi minh bạch kết quả đạt giá mục tiêu hoặc cắt lỗ và ghi nhận hiệu suất nhà phân tích.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (authStatus !== "authenticated") {
              setMessage({ text: "Vui lòng đăng nhập trước khi xuất bản luận điểm.", type: "error" });
              return;
            }
            setShowCreateModal(true);
          }}
          className="btn-primary thesis-publish-btn"
        >
          Đăng luận điểm mới
        </button>
      </div>

      {/* Scope Subtabs: Tất cả luận điểm vs Bài viết của tôi */}
      <div className="thesis-scope-bar">
        <button
          type="button"
          className={`thesis-scope-btn ${scope === "community" ? "active" : ""}`}
          onClick={() => setScope("community")}
        >
          Tất cả luận điểm
        </button>
        <button
          type="button"
          className={`thesis-scope-btn ${scope === "my" ? "active" : ""}`}
          onClick={() => setScope("my")}
        >
          Bài viết của tôi
        </button>
      </div>

      {/* Top Analyst Reputation Bar (Only in community scope) */}
      {scope === "community" && leaderboard.length > 0 && (
        <div className="analyst-leaderboard-banner">
          <div className="analyst-banner-header">
            <span className="analyst-banner-tag">BẢNG VINH DANH NHÀ PHÂN TÍCH</span>
            <span className="analyst-banner-sub">Dựa trên tỷ lệ dự báo chính xác và hiệu suất sinh lời kiểm chứng</span>
          </div>
          <div className="analyst-cards-scroll">
            {leaderboard.slice(0, 6).map((analyst, idx) => {
              const cleanName = analyst.author_name.replace(/\s*\(Tôi\)/gi, "").trim();
              const isMe = authStatus === "authenticated" && user && (
                user.id === analyst.user_id ||
                user.display_name?.trim() === cleanName
              );
              return (
              <div key={analyst.user_id} className="analyst-rep-card">
                <div className="analyst-rank-number">#{idx + 1}</div>
                <div className="analyst-info">
                  <div className="analyst-name">{cleanName}{isMe ? " (Tôi)" : ""}</div>
                  <div className="analyst-tier-tag">{analyst.rank_tier.replace(/^[^\w\s\u00C0-\u1EF9]+/, "").trim()}</div>
                </div>
                <div className="analyst-stats">
                  <div className="analyst-stat-row">
                    <span>Thắng:</span>
                    <strong className="text-emerald">{analyst.win_rate_percent}</strong>
                  </div>
                  <div className="analyst-stat-row">
                    <span>Lợi nhuận TB:</span>
                    <strong className={Number(analyst.avg_roi_percent) >= 0 ? "text-emerald" : "text-rose"}>
                      {Number(analyst.avg_roi_percent) > 0 ? `+${analyst.avg_roi_percent}%` : `${analyst.avg_roi_percent}%`}
                    </strong>
                  </div>
                  <div className="analyst-stat-row-sub">
                    {analyst.successful_theses}/{analyst.total_theses} luận điểm chuẩn
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="thesis-filter-bar">
        {/* Sort Selector */}
        <div className="thesis-filter-group">
          <span className="filter-label">Sắp xếp:</span>
          <button
            type="button"
            className={`filter-chip ${sortOrder === "engagement" ? "filter-chip-active" : ""}`}
            onClick={() => setSortOrder("engagement")}
          >
            Nhiều tương tác nhất
          </button>
          <button
            type="button"
            className={`filter-chip ${sortOrder === "recent" ? "filter-chip-active" : ""}`}
            onClick={() => setSortOrder("recent")}
          >
            Mới nhất
          </button>
        </div>

        {/* Status Filter */}
        <div className="thesis-filter-group">
          <span className="filter-label">Trạng thái:</span>
          {[
            { id: "all", label: "Tất cả" },
            { id: "active", label: "Đang diễn ra" },
            { id: "hit_target", label: "Đã chạm mục tiêu" },
            { id: "stopped_out", label: "Đã cắt lỗ" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`filter-chip ${statusFilter === item.id ? "filter-chip-active" : ""}`}
              onClick={() => setStatusFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Stance Filter */}
        <div className="thesis-filter-group">
          <span className="filter-label">Xu hướng:</span>
          {[
            { id: "all", label: "Tất cả" },
            { id: "bullish", label: "Kỳ vọng tăng giá" },
            { id: "bearish", label: "Cảnh báo giảm giá" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`filter-chip ${stanceFilter === item.id ? "filter-chip-active" : ""}`}
              onClick={() => setStanceFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="thesis-search-box">
          <input
            type="text"
            placeholder="Tìm theo mã CP (vd: HPG, FPT)..."
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
            className="thesis-search-input"
          />
        </div>
      </div>

      {/* Theses Content Area */}
      {scope === "my" && authStatus !== "authenticated" ? (
        <div className="thesis-auth-gate-box">
          <p className="auth-gate-title">Vui lòng đăng nhập để xem danh sách luận điểm của bạn</p>
          <p className="auth-gate-sub">
            Theo dõi trạng thái, tỷ suất sinh lời thực tế và phản hồi từ cộng đồng nhà đầu tư trên sàn InvestIQ.
          </p>
          <Link href="/login" className="btn-primary auth-gate-btn">
            Đăng nhập ngay
          </Link>
        </div>
      ) : loading || (scope === "my" && loadingMyTheses) ? (
        <div className="thesis-loading-placeholder">Đang tải danh sách luận điểm đầu tư...</div>
      ) : filteredTheses.length === 0 ? (
        <div className="thesis-empty-box">
          {scope === "my" ? (
            <>
              <p className="empty-title">Bạn chưa đăng tải luận điểm đầu tư nào.</p>
              <p className="empty-sub">Hãy chia sẻ góc nhìn sắc bén của bạn để cùng cộng đồng kiểm chứng và ghi nhận uy tín chuyên môn.</p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="btn-primary thesis-create-first-btn"
              >
                Đăng luận điểm đầu tiên
              </button>
            </>
          ) : (
            <>
              <p className="empty-title">Chưa có luận điểm nào phù hợp tiêu chí lọc.</p>
              <p className="empty-sub">Hãy là người đầu tiên đưa ra luận điểm đầu tư sắc bén trên sàn!</p>
            </>
          )}
        </div>
      ) : (
        <div className="theses-grid">
          {filteredTheses.map((thesis) => {
            const isBullish = thesis.stance === "bullish";
            const isHitTarget = thesis.status === "hit_target";
            const isStopped = thesis.status === "stopped_out";

            return (
              <div key={thesis.id} className={`thesis-card ${isBullish ? "thesis-card-bullish" : "thesis-card-bearish"}`}>
                <div className="thesis-card-top">
                  <div className="thesis-symbol-row">
                    <Link href={`/market/stocks/${thesis.symbol}`} className="thesis-symbol-link">
                      {thesis.symbol}
                    </Link>
                    <span className={`thesis-stance-badge ${isBullish ? "stance-bullish" : "stance-bearish"}`}>
                      {isBullish ? "Tăng giá" : "Giảm giá"}
                    </span>
                    <span className="thesis-horizon-badge">Kỳ hạn {thesis.horizon_months}T</span>
                  </div>
                  <div className="thesis-status-wrap">
                    {isHitTarget ? (
                      <span className="status-badge status-hit-target">
                        Đạt mục tiêu{formatOutcomeRoi(thesis.outcome_roi)}
                      </span>
                    ) : isStopped ? (
                      <span className="status-badge status-stopped">
                        Cắt lỗ{formatOutcomeRoi(thesis.outcome_roi)}
                      </span>
                    ) : (
                      <span className="status-badge status-active">Đang theo dõi</span>
                    )}
                  </div>
                </div>

                <h3 className="thesis-card-title">{thesis.title}</h3>

                <div className="thesis-author-row">
                  {(() => {
                    const cleanAuthor = thesis.author_name.replace(/\s*\(Tôi\)/gi, "").trim();
                    const isAuthorMe = authStatus === "authenticated" && user && (
                      user.id === thesis.user_id ||
                      user.display_name?.trim() === cleanAuthor ||
                      Boolean(user.email && cleanAuthor.toLowerCase().includes(user.email.split("@")[0].toLowerCase()))
                    );
                    return (
                      <span className="thesis-author-name">
                        {cleanAuthor}{isAuthorMe ? " (Tôi)" : ""}
                      </span>
                    );
                  })()}
                  <span className="thesis-timestamp">
                    {new Date(thesis.created_at).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                </div>

                {/* Price Metrics Bar */}
                <div className="thesis-metrics-grid">
                  <div className="metric-box">
                    <span className="metric-lbl">Giá vào</span>
                    <span className="metric-val val-entry">{formatVnd(thesis.entry_price)}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-lbl">Giá hiện tại</span>
                    <span className="metric-val val-current">{formatVnd(thesis.current_price)}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-lbl">Mục tiêu</span>
                    <span className="metric-val val-target">{formatVnd(thesis.target_price)}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-lbl">Cắt lỗ</span>
                    <span className="metric-val val-stoploss">{formatVnd(thesis.stop_loss_price)}</span>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="thesis-progress-container">
                  <div className="progress-labels">
                    <span>Tiến độ mục tiêu</span>
                    <span className={parsePriceNumber(thesis.progress_percent) >= 50 ? "text-emerald" : "text-neutral"}>
                      {parsePriceNumber(thesis.progress_percent).toFixed(1)}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${isBullish ? "progress-bullish" : "progress-bearish"}`}
                      style={{
                        width: `${Math.min(100, Math.max(0, parsePriceNumber(thesis.progress_percent)))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Catalysts Chips */}
                {thesis.catalysts && thesis.catalysts.length > 0 && (
                  <div className="thesis-catalysts-row">
                    {thesis.catalysts.map((cat, i) => (
                      <span key={i} className="catalyst-chip">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}

                {/* Thesis Body */}
                <p className="thesis-body-text">{thesis.thesis_body}</p>

                {/* Footer and Upvote */}
                <div className="thesis-card-footer">
                  <span className="anti-cheat-note">Giá vào được khóa tự động theo thị trường lúc xuất bản</span>
                  <button
                    type="button"
                    onClick={() => handleUpvote(thesis.id)}
                    disabled={upvotingId === thesis.id}
                    className="thesis-upvote-btn"
                  >
                    Hữu ích ({thesis.upvotes})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Đăng luận điểm mới */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="thesis-modal-card">
            <div className="thesis-modal-header">
              <div>
                <h3 className="modal-title">Xuất bản Luận điểm Đầu tư</h3>
                <p className="modal-sub">
                  Cam kết minh bạch: Giá vào sẽ được hệ thống đối chiếu và khóa tự động theo giá thị trường thực tế ngay khi xuất bản.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="modal-close-btn"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishThesis} className="thesis-form">
              <div className="form-row-2">
                <div className="form-field" style={{ position: "relative" }}>
                  <label htmlFor="formSymbol">Mã cổ phiếu niêm yết *</label>
                  <input
                    id="formSymbol"
                    type="text"
                    required
                    autoComplete="off"
                    placeholder="VD: HPG, FPT, VNM..."
                    value={formSymbol}
                    onFocus={() => setShowSymbolSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSymbolSuggestions(false), 200)}
                    onChange={(e) => {
                      setFormSymbol(e.target.value.toUpperCase());
                      setShowSymbolSuggestions(true);
                    }}
                    className="form-input"
                  />
                  {showSymbolSuggestions && symbolSuggestions.length > 0 && formSymbol.trim() && (
                    <div
                      className="symbol-suggestions-dropdown"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 60,
                        marginTop: "0.25rem",
                        maxHeight: "14rem",
                        overflowY: "auto",
                        background: "#0a1e32",
                        border: "1px solid #1e3a5a",
                        borderRadius: "0.55rem",
                        padding: "0.35rem",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                      }}
                    >
                      {symbolSuggestions.map((item) => (
                        <button
                          key={item.symbol}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFormSymbol(item.symbol);
                            setShowSymbolSuggestions(false);
                          }}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.45rem 0.65rem",
                            border: "none",
                            borderRadius: "0.4rem",
                            background: "transparent",
                            color: "#cbd5e1",
                            cursor: "pointer",
                            fontSize: "0.78rem",
                            textAlign: "left",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#132d4a")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <strong style={{ color: "#38bdf8", fontWeight: 800 }}>{item.symbol}</strong>
                            <span style={{ color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                              {item.name}
                            </span>
                          </div>
                          <span style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem", borderRadius: "0.25rem", background: "#0f2742", border: "1px solid #23456b", color: "#64748b" }}>
                            {item.exchange}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="formStance">Xu hướng phân tích *</label>
                  <select
                    id="formStance"
                    value={formStance}
                    onChange={(e) => setFormStance(e.target.value as "bullish" | "bearish")}
                    className="form-select"
                  >
                    <option value="bullish">Tăng giá - Kỳ vọng xu hướng đi lên</option>
                    <option value="bearish">Giảm giá - Cảnh báo rủi ro điều chỉnh</option>
                  </select>
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-field">
                  <label htmlFor="formTargetPrice">Giá mục tiêu (VND) *</label>
                  <input
                    id="formTargetPrice"
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="VD: 32.000"
                    value={formTargetPrice ? Number(formTargetPrice.replace(/[^\d]/g, "")).toLocaleString("vi-VN") : ""}
                    onKeyDown={(event) => {
                      if (
                        ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End", "Enter"].includes(event.key) ||
                        event.ctrlKey ||
                        event.metaKey
                      ) {
                        return;
                      }
                      if (!/[\d]/.test(event.key)) {
                        event.preventDefault();
                      }
                    }}
                    onChange={(e) => setFormTargetPrice(e.target.value.replace(/[^\d]/g, ""))}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="formStopLossPrice">Giá cắt lỗ an toàn (VND) *</label>
                  <input
                    id="formStopLossPrice"
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="VD: 26.000"
                    value={formStopLossPrice ? Number(formStopLossPrice.replace(/[^\d]/g, "")).toLocaleString("vi-VN") : ""}
                    onKeyDown={(event) => {
                      if (
                        ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End", "Enter"].includes(event.key) ||
                        event.ctrlKey ||
                        event.metaKey
                      ) {
                        return;
                      }
                      if (!/[\d]/.test(event.key)) {
                        event.preventDefault();
                      }
                    }}
                    onChange={(e) => setFormStopLossPrice(e.target.value.replace(/[^\d]/g, ""))}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="formHorizon">Khung thời gian *</label>
                  <select
                    id="formHorizon"
                    value={formHorizon}
                    onChange={(e) => setFormHorizon(e.target.value)}
                    className="form-select"
                  >
                    <option value="1">1 Tháng - Ngắn hạn</option>
                    <option value="3">3 Tháng - Trung hạn</option>
                    <option value="6">6 Tháng - Trung và dài hạn</option>
                    <option value="12">12 Tháng - Dài hạn</option>
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="formTitle">Tiêu đề luận điểm *</label>
                <input
                  id="formTitle"
                  type="text"
                  required
                  placeholder="VD: HPG - Động lực từ Dung Quất 2 và chu kỳ thép phục hồi"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label htmlFor="formCatalysts">Các động lực tăng trưởng chính, phân tách bằng dấu phẩy</label>
                <input
                  id="formCatalysts"
                  type="text"
                  placeholder="VD: Lò cao số 2 vận hành, Biên lợi nhuận gộp tăng 3.5%, Lãi suất hạ nhiệt"
                  value={formCatalysts}
                  onChange={(e) => setFormCatalysts(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label htmlFor="formBody">Nội dung phân tích & Luận cứ chi tiết *</label>
                <textarea
                  id="formBody"
                  required
                  rows={5}
                  placeholder="Nêu rõ cơ sở định giá P/E, P/B, tăng trưởng doanh thu lợi nhuận, kế hoạch kinh doanh hoặc tín hiệu kỹ thuật dòng tiền..."
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  className="form-textarea"
                />
              </div>

              <div className="anti-cheat-alert">
                <strong>Cơ chế khóa giá tự động:</strong> Bạn không thể tự nhập giá vào. Giá vào sẽ được hệ thống chốt tự động bằng giá khớp lệnh thực tế hiện tại của cổ phiếu trên sàn giao dịch. Với xu hướng tăng, giá mục tiêu cần cao hơn giá hiện tại và giá cắt lỗ thấp hơn giá hiện tại.
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-cancel"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? "Đang xác thực & Khóa giá..." : "Xuất bản Luận điểm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
