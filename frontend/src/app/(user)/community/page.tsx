import type { Metadata } from "next";

import { CommunityClientHub } from "@/components/community/community-client-hub";
import { getAnalystLeaderboard, getSocialLeaderboard, getTheses } from "@/lib/api-client";
import type { AnalystReputationItem, InvestmentThesisItem, SocialLeaderboardItem } from "@/types/thesis";

export const metadata: Metadata = {
  title: "Cộng đồng | InvestIQ",
  description:
    "Đấu trường luận điểm đầu tư kiểm chứng tự động (Proof-of-Thesis Arena) và bảng xếp hạng danh mục mô phỏng minh bạch.",
};

export const revalidate = 10;

export default async function CommunityPage() {
  let initialTheses: InvestmentThesisItem[] = [];
  let initialAnalystLeaderboard: AnalystReputationItem[] = [];
  let initialSocialLeaderboard: SocialLeaderboardItem[] = [];

  try {
    const [thesesRes, analystRes, socialRes] = await Promise.allSettled([
      getTheses(),
      getAnalystLeaderboard(),
      getSocialLeaderboard(),
    ]);

    if (thesesRes.status === "fulfilled") {
      initialTheses = thesesRes.value.data || [];
    }
    if (analystRes.status === "fulfilled") {
      initialAnalystLeaderboard = analystRes.value.data || [];
    }
    if (socialRes.status === "fulfilled") {
      initialSocialLeaderboard = socialRes.value.data || [];
    }
  } catch {
    // Graceful fallback to client hydration
  }

  return (
    <main className="community-page community-page-main">
      <CommunityClientHub
        initialTheses={initialTheses}
        initialAnalystLeaderboard={initialAnalystLeaderboard}
        initialSocialLeaderboard={initialSocialLeaderboard}
      />
    </main>
  );
}
