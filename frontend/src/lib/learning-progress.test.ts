import { describe, expect, it, vi } from "vitest";

import {
  LEARNING_PROGRESS_KEY,
  loadLearningProgress,
  saveLearningProgress,
} from "@/lib/learning-progress";

describe("learning progress storage", () => {
  it("loads only a versioned list of completed lesson slugs", () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({
        version: 1,
        completedLessons: ["saving-or-investing", "saving-or-investing", 42],
      })),
    };

    expect(loadLearningProgress(storage)).toEqual({
      progress: { version: 1, completedLessons: ["saving-or-investing"] },
      persistent: true,
    });
    expect(storage.getItem).toHaveBeenCalledWith(LEARNING_PROGRESS_KEY);
  });

  it("falls back safely for corrupt or obsolete content", () => {
    expect(loadLearningProgress({ getItem: () => "not-json" })).toEqual({
      progress: { version: 1, completedLessons: [] },
      persistent: false,
    });
    expect(loadLearningProgress({ getItem: () => JSON.stringify({ version: 0 }) })).toEqual({
      progress: { version: 1, completedLessons: [] },
      persistent: true,
    });
  });

  it("keeps the lesson usable when browser storage is blocked", () => {
    expect(loadLearningProgress({ getItem: () => { throw new Error("blocked"); } })).toEqual({
      progress: { version: 1, completedLessons: [] },
      persistent: false,
    });
    expect(saveLearningProgress({ setItem: () => { throw new Error("blocked"); } }, {
      version: 1,
      completedLessons: ["read-a-candle"],
    })).toBe(false);
  });
});
