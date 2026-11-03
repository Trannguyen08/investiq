"use client";

import { useState } from "react";

import { SocialPaperTrading } from "@/components/community/social-paper-trading";
import { ThesisArena } from "@/components/community/thesis-arena";
import type { AnalystReputationItem, InvestmentThesisItem, SocialLeaderboardItem } from "@/types/thesis";

type CommunityClientHubProps = {
  initialTheses: InvestmentThesisItem[];
  initialAnalystLeaderboard: AnalystReputationItem[];
  initialSocialLeaderboard: SocialLeaderboardItem[];
};

export function CommunityClientHub({
  initialTheses,
  initialAnalystLeaderboard,
  initialSocialLeaderboard,
}: CommunityClientHubProps) {
  const [activeTab, setActiveTab] = useState<"theses" | "leaderboard">("theses");

  return (
    <div className="community-hub">
      <div className="community-hero-banner">
        <div className="community-hero-content">
          <span className="community-kicker">MẠNG LƯỚI ĐẦU TƯ MINH BẠCH & KIỂM CHỨNG</span>
          <h1 className="community-hero-title">Cộng đồng & Luận điểm Đầu tư</h1>
          <p className="community-hero-sub">
            Xóa bỏ nhận định suông và lệnh ảo không kiểm chứng. Nơi các nhà đầu tư chứng minh năng lực phân tích qua dữ liệu thực tế và hiệu suất minh bạch.
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="community-nav-tabs">
        <button
          type="button"
          className={`community-nav-tab ${activeTab === "theses" ? "active" : ""}`}
          onClick={() => setActiveTab("theses")}
        >
          Luận điểm Đầu tư
        </button>
        <button
          type="button"
          className={`community-nav-tab ${activeTab === "leaderboard" ? "active" : ""}`}
          onClick={() => setActiveTab("leaderboard")}
        >
          Bảng xếp hạng Nhà đầu tư
        </button>
      </div>

      {/* Tab Panels */}
      <div className="community-tab-panel">
        {activeTab === "theses" ? (
          <ThesisArena
            initialTheses={initialTheses}
            initialLeaderboard={initialAnalystLeaderboard}
          />
        ) : (
          <SocialPaperTrading
            initialLeaderboard={initialSocialLeaderboard}
          />
        )}
      </div>
    </div>
  );
}
