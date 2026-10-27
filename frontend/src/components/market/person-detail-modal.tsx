"use client";

import { useEffect } from "react";
import Link from "next/link";
import { formatMoney, formatPercent, changeTone } from "@/components/market/formatters";
import type { MarketPerson } from "@/types/market";

const LEADER_ECOSYSTEM_MAP: Record<string, { id: string; name: string }> = {
  "Phạm Nhật Vượng": { id: "vingroup", name: "Tập đoàn Vingroup" },
  "Trần Đình Long": { id: "hoaphat", name: "Tập đoàn Hòa Phát" },
  "Nguyễn Thị Phương Thảo": { id: "sovico", name: "Tập đoàn Sovico & Vietjet" },
  "Hồ Hùng Anh": { id: "techcombank", name: "Hệ sinh thái Techcombank & One Mount" },
  "Nguyễn Đăng Quang": { id: "masan", name: "Tập đoàn Masan" },
  "Trương Gia Bình": { id: "fpt", name: "Tập đoàn FPT" },
};

export function PersonDetailModal({
  person,
  rank,
  onClose,
  onOpenEcosystem,
}: {
  person: MarketPerson | null;
  rank?: number;
  onClose: () => void;
  onOpenEcosystem?: (ecosystemId: string) => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    if (person) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [person, onClose]);

  if (!person) return null;

  const changeVal = Number(person.daily_change_percent || 0);
  const ecoLink = LEADER_ECOSYSTEM_MAP[person.full_name];

  return (
    <div
      className="person-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-leader-name"
    >
      <div
        className="person-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          className="person-modal-close"
          onClick={onClose}
          aria-label="Đóng hồ sơ chi tiết"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="person-modal-header">
          <div className="person-modal-avatar-box">
            {person.avatar_url ? (
              <img
                src={person.avatar_url}
                alt={person.full_name}
                className="person-modal-avatar-img"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
            ) : null}
            <span
              className="person-modal-avatar-fallback"
              style={{ display: person.avatar_url ? "none" : "flex" }}
              aria-hidden="true"
            >
              {person.initials}
            </span>
            {rank !== undefined && (
              <span className={`person-modal-rank-badge rank-${rank <= 3 ? rank : "other"}`}>
                #{rank}
              </span>
            )}
          </div>

          <div className="person-modal-identity">
            <div className="person-modal-title-row">
              <h2 id="modal-leader-name">{person.full_name}</h2>
              <div className="leader-tickers">
                {person.symbols.map((sym) => (
                  <Link
                    href={`/market/stocks/${sym}`}
                    key={sym}
                    className="leader-ticker-pill"
                    title={`Xem bảng giá và biểu đồ ${sym}`}
                    onClick={onClose}
                  >
                    {sym} ↗
                  </Link>
                ))}
              </div>
            </div>
            <p className="person-modal-role">
              {person.role} · <strong>{person.company}</strong>
            </p>
            <div className="person-modal-meta-chips">
              <span className="meta-chip">Ngành: {person.sector}</span>
              <span className="meta-chip">
                Sở hữu công bố:{" "}
                {new Intl.DateTimeFormat("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }).format(new Date(person.holding_public_date))}
              </span>
            </div>
          </div>
        </div>

        {/* 3 Metrics Cards */}
        <div className="person-modal-metrics-grid">
          <div className="modal-metric-card primary">
            <span className="m-label">Tài sản cổ phiếu niêm yết</span>
            <div className="m-val-row">
              <strong className="m-val">
                {formatMoney(person.estimated_listed_equity_value)}
              </strong>
              <span className={`metric-tag ${changeTone(person.daily_change_percent)}`}>
                {changeVal >= 0 ? "+" : ""}
                {formatPercent(person.daily_change_percent)}
              </span>
            </div>
            <small className="m-sub">Thị giá trực tiếp qua Vnstock thời gian thực</small>
          </div>

          <div className="modal-metric-card highlight">
            <span className="m-label">Tổng tài sản ròng (Forbes / Ước tính)</span>
            <strong className="m-val highlight">
              {person.net_worth_total ?? "Đang cập nhật"}
            </strong>
            <small className="m-sub">
              Bao gồm vốn hóa cổ phần niêm yết &amp; tài sản ngoài sàn
            </small>
          </div>

          <div className="modal-metric-card">
            <span className="m-label">Cổ phần niêm yết công bố</span>
            <div className="m-val-row">
              <strong className="m-val">
                {Number(person.disclosed_shares).toLocaleString("vi-VN")} CP
              </strong>
            </div>
            <small className="m-sub">
              Chiếm tỷ lệ sở hữu: <strong>{person.ownership_percent}%</strong> vốn điều lệ
            </small>
          </div>
        </div>

        {/* External Assets & Related Entities */}
        {person.net_worth_external && (
          <div className="person-modal-section">
            <h3 className="section-title">
              <span className="title-icon">🏛</span> Tài sản ngoài sàn &amp; Doanh nghiệp liên quan
            </h3>
            <div className="section-content-box">
              <p className="external-text">{person.net_worth_external}</p>
            </div>
          </div>
        )}

        {/* Biography & Leadership Insight */}
        {person.bio && (
          <div className="person-modal-section">
            <h3 className="section-title">
              <span className="title-icon">💼</span> Dấu ấn lãnh đạo &amp; Tiểu sử
            </h3>
            <div className="section-content-box bio">
              <p className="bio-text">{person.bio}</p>
            </div>
          </div>
        )}

        {/* Holding stocks & Fast navigation */}
        <div className="person-modal-section">
          <h3 className="section-title">
            <span className="title-icon">📈</span> Cổ phiếu trực tiếp gắn liền với hồ sơ
          </h3>
          <div className="modal-stocks-row">
            {person.symbols.length > 0 ? (
              person.symbols.map((sym) => (
                <Link
                  href={`/market/stocks/${sym}`}
                  key={sym}
                  className="modal-stock-action-card"
                  onClick={onClose}
                >
                  <div className="stk-head">
                    <strong className="stk-sym">{sym}</strong>
                    <span className="stk-arrow">Xem biểu đồ &amp; BCTC →</span>
                  </div>
                  <small className="stk-note">Tra cứu phân tích tài chính toàn diện</small>
                </Link>
              ))
            ) : (
              <p className="no-stocks-text">
                Doanh nhân giữ vai trò lãnh đạo tập đoàn kinh tế tư nhân chưa niêm yết cổ phiếu công khai trên 3 sàn HOSE, HNX, UPCoM.
              </p>
            )}
          </div>
        </div>

        {/* Ecosystem Jump button if applicable */}
        {ecoLink && onOpenEcosystem && (
          <div className="person-modal-ecosystem-banner">
            <div className="eco-banner-text">
              <h4>Bản đồ Hệ Sinh Thái {ecoLink.name}</h4>
              <p>Khám phá toàn cảnh mối liên kết giữa công ty mẹ, công ty con và cổ đông sáng lập.</p>
            </div>
            <button
              type="button"
              className="eco-banner-btn"
              onClick={() => {
                onClose();
                onOpenEcosystem(ecoLink.id);
              }}
            >
              Khám phá Bản đồ Hệ Sinh Thái →
            </button>
          </div>
        )}

        {/* Modal Footer */}
        <div className="person-modal-footer">
          <small className="footer-disclaimer">
            * Dữ liệu dựa trên báo cáo quản trị công bố định kỳ, hồ sơ niêm yết HOSE/HNX và xếp hạng tỷ phú Forbes.
          </small>
          <button type="button" className="footer-close-btn" onClick={onClose}>
            Đóng hồ sơ
          </button>
        </div>
      </div>
    </div>
  );
}
