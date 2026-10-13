import { describe, expect, it } from "vitest";

import { sourcesForLesson, stockBasicsLessons } from "@/content/stock-basics";

describe("stock basics content contract", () => {
  it("ships two uniquely addressable, source-backed lessons", () => {
    expect(stockBasicsLessons).toHaveLength(2);
    expect(new Set(stockBasicsLessons.map((lesson) => lesson.slug)).size).toBe(2);

    for (const lesson of stockBasicsLessons) {
      expect(lesson.estimatedMinutes).toBeGreaterThanOrEqual(5);
      expect(lesson.estimatedMinutes).toBeLessThanOrEqual(8);
      expect(lesson.contentVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(lesson.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(sourcesForLesson(lesson)).toHaveLength(lesson.sourceIds.length);
      expect(sourcesForLesson(lesson).every((source) => source.url.startsWith("https://"))).toBe(true);
    }
  });

  it("gives every retrieval question one unambiguous correct answer and feedback", () => {
    for (const lesson of stockBasicsLessons) {
      expect(lesson.quiz.length).toBeGreaterThan(0);
      for (const question of lesson.quiz) {
        expect(question.options.filter((option) => option.correct)).toHaveLength(1);
        expect(question.options.every((option) => option.feedback.length > 0)).toBe(true);
      }
    }
  });
});
