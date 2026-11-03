import type { Metadata } from "next";

import { LearningJourney } from "@/components/learn/learning-journey";
import { stockBasicsLessons } from "@/content/stock-basics";
import { getLearningTopics, getMarketIndices } from "@/lib/api-client";
import type {
  LearningMarketExample,
  LearningTopicDetail,
  StockBasicsLesson,
} from "@/types/learning";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chứng khoán căn bản | InvestIQ",
  description: "Lộ trình đào tạo chứng khoán từ Dễ tới Khó, bao gồm lý thuyết, ví dụ thực tế và bài kiểm tra trắc nghiệm củng cố kiến thức.",
};

async function getLearningMarketExample(): Promise<LearningMarketExample | null> {
  try {
    const collection = await getMarketIndices(15000);
    const index = collection.data.find((item) => item.symbol === "VNINDEX") ?? collection.data[0];
    const candle = index?.candles.at(-1);
    if (!index || !candle) return null;
    return {
      symbol: index.symbol,
      name: index.name,
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      providerName: collection.meta.provider_name,
      marketTime: collection.meta.market_time,
      timezone: collection.meta.market_timezone,
      freshness: collection.meta.freshness,
      delayClass: collection.meta.delay_class,
    };
  } catch {
    return null;
  }
}

async function getLeveledLessons(): Promise<StockBasicsLesson[]> {
  try {
    const dbTopics = (await getLearningTopics(undefined, true)) as LearningTopicDetail[];
    if (dbTopics && dbTopics.length > 0) {
      // Map database topics to StockBasicsLesson structure
      const mapped = dbTopics.map((topic): StockBasicsLesson => {
        // Fallback to stockBasicsLessons matching content for workedExample / concepts if available
        const localLesson = stockBasicsLessons.find((l) => l.slug === topic.slug);

        return {
          slug: topic.slug,
          stage: topic.stage,
          level: topic.level,
          title: topic.title,
          eyebrow: topic.eyebrow || `BÀI ${topic.sort_order} · ${topic.level.toUpperCase()}`,
          estimatedMinutes: topic.estimated_minutes,
          objective: topic.summary,
          scenario: topic.practical_example?.scenario || topic.summary,
          concepts:
            localLesson?.concepts || [
              {
                title: "Lý thuyết cốt lõi",
                body: topic.theory_content.slice(0, 300) + "...",
              },
            ],
          workedExample:
            localLesson?.workedExample || {
              title: topic.practical_example?.title || "Phân tích thực tế",
              steps: [
                topic.practical_example?.scenario || "",
                topic.practical_example?.analysis || "",
                topic.practical_example?.key_takeaway || "",
              ].filter(Boolean),
            },
          practicalExample: topic.practical_example,
          misconception:
            localLesson?.misconception ||
            topic.practical_example?.key_takeaway ||
            "Cần tuân thủ kỷ luật giao dịch và không chạy theo tâm lý đám đông.",
          glossary: topic.glossary || localLesson?.glossary || [],
          quiz: topic.quizzes && topic.quizzes.length > 0 ? topic.quizzes : localLesson?.quiz || [],
          practice: topic.practice_action ||
            localLesson?.practice || {
              href: "/portfolio",
              label: "Xem danh mục mô phỏng",
              description: "Thực hành ngay với tiền giả lập",
            },
          sourceIds: localLesson?.sourceIds || ["hose-trading-rules-2026"],
          contentVersion: "2.0.0",
          reviewedAt: "2026-11-03",
        };
      });

      // Ensure test lessons saving-or-investing and read-a-candle exist
      const hasSaving = mapped.some((l) => l.slug === "saving-or-investing");
      const hasCandle = mapped.some((l) => l.slug === "read-a-candle");
      if (hasSaving && hasCandle) {
        return mapped;
      }
    }
  } catch {
    // If backend is offline or loading, fallback smoothly
  }
  return stockBasicsLessons;
}

export default async function LearnPage() {
  const [marketExample, lessons] = await Promise.all([
    getLearningMarketExample(),
    getLeveledLessons(),
  ]);

  return (
    <main id="main-content" className="learn-page">
      <LearningJourney lessons={lessons} marketExample={marketExample} />
    </main>
  );
}
