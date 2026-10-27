"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import type { AnalystReputationItem, InvestmentThesisItem } from "@/types/thesis";

const moneyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function formatVnd(value: string | number) {
  return moneyFormat.format(Number(value));
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
  const { status: authStatus } = useAuth();
  const [theses, setTheses] = useState<InvestmentThesisItem[]>(initialTheses);
  const [leaderboard, setLeaderboard] = useState<AnalystReputationItem[]>(initialLeaderboard);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stanceFilter, setStanceFilter] = useState<string>("all");
  const [searchSymbol, setSearchSymbol] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [upvotingId, setUpvotingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form state
  const [formSymbol, setFormSymbol] = useState("");
  const [formStance, setFormStance] = useState<"bullish" | "bearish">("bullish");
  const [formTargetPrice, setFormTargetPrice] = useState("");
  const [formStopLossPrice, setFormStopLossPrice] = useState("");
  const [formHorizon, setFormHorizon] = useState("3");
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCatalysts, setFormCatalysts] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
  }, [statusFilter, searchSymbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTheses = useMemo(() => {
    return theses.filter((item) => {
      if (stanceFilter !== "all" && item.stance !== stanceFilter) return false;
      return true;
    });
  }, [theses, stanceFilter]);

  async function handleUpvote(thesisId: string) {
    if (authStatus !== "authenticated") {
      setMessage({ text: "Vui lòng đăng nhập để bình chọn (upvote) luận điểm.", type: "error" });
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
      setMessage({ text: "Đã upvote luận điểm thành công!", type: "success" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Chưa thể upvote luận điểm.",
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

    const targetPrice = Number(formTargetPrice);
    const stopLossPrice = Number(formStopLossPrice);

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
        text: "🎉 Xuất bản luận điểm thành công! Giá vào đã được khóa tự động theo thời gian thực.",
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
          <h2 className="thesis-arena-title">
            Đấu trường Luận điểm Đầu tư <span className="thesis-badge-highlight">Proof-of-Thesis Arena</span>
          </h2>
          <p className="thesis-arena-desc">
            Không nhận định suông. Mỗi luận điểm đều được hệ thống khóa giá thực tế tự động (anti-cheat), theo dõi minh bạch kết quả chạm Target hoặc Cắt lỗ và xếp hạng uy tín chuyên gia.
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
          ✍️ Đăng luận điểm mới
        </button>
      </div>

      {/* Top Analyst Reputation Bar */}
      {leaderboard.length > 0 && (
        <div className="analyst-leaderboard-banner">
          <div className="analyst-banner-header">
            <span className="analyst-banner-tag">🏆 BẢNG VINH DANH CHUYÊN GIA (TOP ANALYSTS)</span>
            <span className="analyst-banner-sub">Dựa trên tỷ lệ thắng (Win Rate) và lợi nhuận thực tế kiểm chứng</span>
          </div>
          <div className="analyst-cards-scroll">
            {leaderboard.slice(0, 6).map((analyst, idx) => (
              <div key={analyst.user_id} className="analyst-rep-card">
                <div className="analyst-rank-number">#{idx + 1}</div>
                <div className="analyst-info">
                  <div className="analyst-name">{analyst.author_name}</div>
                  <div className="analyst-tier-tag">{analyst.rank_tier}</div>
                </div>
                <div className="analyst-stats">
                  <div className="analyst-stat-row">
                    <span>Thắng:</span>
                    <strong className="text-emerald">{analyst.win_rate_percent}</strong>
                  </div>
                  <div className="analyst-stat-row">
                    <span>ROI TB:</span>
                    <strong className={Number(analyst.avg_roi_percent) >= 0 ? "text-emerald" : "text-rose"}>
                      {Number(analyst.avg_roi_percent) > 0 ? `+${analyst.avg_roi_percent}%` : `${analyst.avg_roi_percent}%`}
                    </strong>
                  </div>
                  <div className="analyst-stat-row-sub">
                    {analyst.successful_theses}/{analyst.total_theses} luận điểm chuẩn
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="thesis-filter-bar">
        <div className="thesis-filter-group">
          <span className="filter-label">Trạng thái:</span>
          {[
            { id: "all", label: "Tất cả" },
            { id: "active", label: "Đang diễn ra" },
            { id: "hit_target", label: "🎯 Đã chạm Target" },
            { id: "stopped_out", label: "🛑 Đã cắt lỗ" },
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

        <div className="thesis-filter-group">
          <span className="filter-label">Xu hướng:</span>
          {[
            { id: "all", label: "Tất cả" },
            { id: "bullish", label: "📈 Tăng giá (Bullish)" },
            { id: "bearish", label: "📉 Giảm giá (Bearish)" },
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

      {/* Theses Grid */}
      {loading ? (
        <div className="thesis-loading-placeholder">Đang tải danh sách luận điểm kiểm chứng...</div>
      ) : filteredTheses.length === 0 ? (
        <div className="thesis-empty-box">
          <p className="empty-title">Chưa có luận điểm nào phù hợp tiêu chí lọc.</p>
          <p className="empty-sub">Hãy là người đầu tiên đưa ra luận điểm đầu tư sắc bén trên sàn!</p>
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
                      {isBullish ? "📈 Bullish" : "📉 Bearish"}
                    </span>
                    <span className="thesis-horizon-badge">Kỳ hạn {thesis.horizon_months}T</span>
                  </div>
                  <div className="thesis-status-wrap">
                    {isHitTarget ? (
                      <span className="status-badge status-hit-target">
                        🎯 Đạt Target {thesis.outcome_roi ? `(+${thesis.outcome_roi}%)` : ""}
                      </span>
                    ) : isStopped ? (
                      <span className="status-badge status-stopped">
                        🛑 Cắt lỗ {thesis.outcome_roi ? `(${thesis.outcome_roi}%)` : ""}
                      </span>
                    ) : (
                      <span className="status-badge status-active">⚡ Đang mở</span>
                    )}
                  </div>
                </div>

                <h3 className="thesis-card-title">{thesis.title}</h3>

                <div className="thesis-author-row">
                  <span className="thesis-author-name">👤 {thesis.author_name}</span>
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
                    <span className="metric-lbl">Giá vào (Locked):</span>
                    <span className="metric-val text-neutral">{formatVnd(thesis.entry_price)}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-lbl">Giá hiện tại:</span>
                    <span className="metric-val text-cyan">{formatVnd(thesis.current_price)}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-lbl">Mục tiêu:</span>
                    <span className="metric-val text-emerald">{formatVnd(thesis.target_price)}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-lbl">Cắt lỗ:</span>
                    <span className="metric-val text-rose">{formatVnd(thesis.stop_loss_price)}</span>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="thesis-progress-container">
                  <div className="progress-labels">
                    <span>Tiến độ mục tiêu</span>
                    <span className={Number(thesis.progress_percent) >= 50 ? "text-emerald" : "text-neutral"}>
                      {thesis.progress_percent}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${isBullish ? "progress-bullish" : "progress-bearish"}`}
                      style={{
                        width: `${Math.min(100, Math.max(0, Number(thesis.progress_percent)))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Catalysts Chips */}
                {thesis.catalysts && thesis.catalysts.length > 0 && (
                  <div className="thesis-catalysts-row">
                    {thesis.catalysts.map((cat, i) => (
                      <span key={i} className="catalyst-chip">
                        ⚡ {cat}
                      </span>
                    ))}
                  </div>
                )}

                {/* Thesis Body */}
                <p className="thesis-body-text">{thesis.thesis_body}</p>

                {/* Footer and Upvote */}
                <div className="thesis-card-footer">
                  <span className="anti-cheat-note">🔒 Giá vào tự động khớp theo thị trường lúc đăng</span>
                  <button
                    type="button"
                    onClick={() => handleUpvote(thesis.id)}
                    disabled={upvotingId === thesis.id}
                    className="thesis-upvote-btn"
                  >
                    👍 Hữu ích ({thesis.upvotes})
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
                  Cam kết minh bạch: Giá vào (Entry Price) sẽ được hệ thống đối chiếu và khóa tự động theo giá thị trường thực tế ngay khi bấm Đăng.
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
                <div className="form-field">
                  <label htmlFor="formSymbol">Mã cổ phiếu niêm yết *</label>
                  <input
                    id="formSymbol"
                    type="text"
                    required
                    placeholder="VD: HPG, FPT, VNM..."
                    value={formSymbol}
                    onChange={(e) => setFormSymbol(e.target.value.toUpperCase())}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="formStance">Xu hướng phân tích *</label>
                  <select
                    id="formStance"
                    value={formStance}
                    onChange={(e) => setFormStance(e.target.value as "bullish" | "bearish")}
                    className="form-select"
                  >
                    <option value="bullish">📈 Tăng giá (Bullish) - Kỳ vọng giá lên</option>
                    <option value="bearish">📉 Giảm giá (Bearish) - Cảnh báo giá xuống</option>
                  </select>
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-field">
                  <label htmlFor="formTargetPrice">Giá mục tiêu (VND) *</label>
                  <input
                    id="formTargetPrice"
                    type="number"
                    required
                    min="100"
                    step="100"
                    placeholder="VD: 32000"
                    value={formTargetPrice}
                    onChange={(e) => setFormTargetPrice(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="formStopLossPrice">Giá cắt lỗ an toàn (VND) *</label>
                  <input
                    id="formStopLossPrice"
                    type="number"
                    required
                    min="100"
                    step="100"
                    placeholder="VD: 26000"
                    value={formStopLossPrice}
                    onChange={(e) => setFormStopLossPrice(e.target.value)}
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
                    <option value="1">1 Tháng (Ngắn hạn)</option>
                    <option value="3">3 Tháng (Trung hạn)</option>
                    <option value="6">6 Tháng (Trung & Dài hạn)</option>
                    <option value="12">12 Tháng (Dài hạn)</option>
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
                <label htmlFor="formCatalysts">Các động lực chính (Catalysts - phân tách bằng dấu phẩy)</label>
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
                🛡️ <strong>Chống gian lận (Anti-cheat):</strong> Bạn không thể tự nhập giá vào. Giá vào (Entry Price) sẽ được chốt tự động bằng giá khớp lệnh thực tế hiện tại của mã trên HOSE/HNX. Với thế Bullish, giá mục tiêu phải lớn hơn giá hiện tại và giá cắt lỗ phải thấp hơn giá hiện tại.
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
                  {submitting ? "Đang xác thực & Khóa giá..." : "🚀 Xuất bản Luận điểm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
