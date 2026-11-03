"use client";

import Link from "next/link";
import { useState } from "react";
import type { PaperDashboard } from "@/types/portfolio";

export function PaperSocialVisibilitySection({
  dashboard,
  initialPublic,
  initialNickname,
  onAccountUpdate,
}: {
  dashboard: PaperDashboard;
  initialPublic: boolean;
  initialNickname: string;
  onAccountUpdate: (isPublic: boolean, nickname: string | null) => void;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [nickname, setNickname] = useState(initialNickname);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [visibilityMessage, setVisibilityMessage] = useState("");

  async function handleSaveVisibility(nextPublic: boolean) {
    if (!nickname.trim() && nextPublic) {
      setVisibilityMessage("Vui lòng nhập biệt danh của bạn khi công khai danh mục.");
      return;
    }
    setSavingVisibility(true);
    setVisibilityMessage("");
    try {
      const csrfRes = await fetch("/auth-api/csrf", { cache: "no-store" });
      const csrfBody = (await csrfRes.json()) as { csrf_token?: string };
      if (!csrfRes.ok || !csrfBody.csrf_token) throw new Error("Không thể xác thực thao tác.");

      const res = await fetch("/portfolio-api/visibility", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfBody.csrf_token,
        },
        body: JSON.stringify({
          is_public: nextPublic,
          nickname: nickname.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(err?.detail || "Không thể cập nhật quyền hiển thị.");
      }
      setIsPublic(nextPublic);
      onAccountUpdate(nextPublic, nickname.trim() || null);
      setVisibilityMessage(
        nextPublic
          ? "Đã công khai danh mục lên Bảng Xếp Hạng Cộng Đồng thành công!"
          : "Đã chuyển danh mục về chế độ riêng tư an toàn."
      );
    } catch (err) {
      setVisibilityMessage(err instanceof Error ? err.message : "Chưa thể lưu cấu hình.");
    } finally {
      setSavingVisibility(false);
    }
  }

  return (
    <section className="paper-section social-visibility-section">
      <div className="paper-section-heading">
        <div>
          <p className="eyebrow">CỘNG ĐỒNG & BẢNG XẾP HẠNG</p>
          <h2>Chia sẻ danh mục mô phỏng</h2>
        </div>
        <Link href="/community" className="text-cyan font-semibold">
          Xem Bảng Xếp Hạng Cộng Đồng →
        </Link>
      </div>
      <div className="social-visibility-card">
        <div className="visibility-info">
          <p className="visibility-status-text">
            Trạng thái hiện tại:{" "}
            {isPublic ? (
              <strong className="text-emerald">Đang công khai trên Bảng Xếp Hạng</strong>
            ) : (
              <strong className="text-neutral">Riêng tư (Chỉ mình bạn xem)</strong>
            )}
          </p>
          <p className="visibility-desc">
            Khi bật công khai, danh mục của bạn (tỷ suất sinh lời, cơ cấu danh mục, lịch sử lệnh) sẽ hiển thị minh bạch trên Bảng Xếp Hạng Nhà Đầu Tư tại mục Cộng Đồng. Email cá nhân và thông tin riêng tư được bảo mật 100%.
          </p>
        </div>

        <div className="visibility-controls">
          <div className="nickname-field">
            <label htmlFor="portfolioNickname">Biệt danh hiển thị trên BXH:</label>
            <input
              id="portfolioNickname"
              type="text"
              placeholder="VD: Alpha Trader, Dragon Capital Fan..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={60}
              className="nickname-input"
            />
          </div>

          <div className="visibility-buttons">
            {isPublic ? (
              <button
                type="button"
                disabled={savingVisibility}
                onClick={() => handleSaveVisibility(false)}
                className="btn-toggle-private"
              >
                {savingVisibility ? "Đang lưu..." : "Đặt về Riêng tư"}
              </button>
            ) : (
              <button
                type="button"
                disabled={savingVisibility}
                onClick={() => handleSaveVisibility(true)}
                className="btn-toggle-public"
              >
                {savingVisibility ? "Đang lưu..." : "Công khai Danh mục lên BXH"}
              </button>
            )}
          </div>
        </div>

        {visibilityMessage && (
          <p className="visibility-msg">{visibilityMessage}</p>
        )}
      </div>
    </section>
  );
}
