import type { LearningProgress } from "@/types/learning";

export const LEARNING_PROGRESS_KEY = "investiq.stock-basics.progress.v1";

export const emptyLearningProgress = (): LearningProgress => ({
  version: 1,
  completedLessons: [],
});

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export function loadLearningProgress(storage: ReadableStorage): {
  progress: LearningProgress;
  persistent: boolean;
} {
  try {
    const raw = storage.getItem(LEARNING_PROGRESS_KEY);
    if (!raw) return { progress: emptyLearningProgress(), persistent: true };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { progress: emptyLearningProgress(), persistent: true };
    }
    const candidate = parsed as Record<string, unknown>;
    if (candidate.version !== 1 || !Array.isArray(candidate.completedLessons)) {
      return { progress: emptyLearningProgress(), persistent: true };
    }
    const completedLessons = [...new Set(
      candidate.completedLessons.filter((value): value is string => typeof value === "string"),
    )];
    return { progress: { version: 1, completedLessons }, persistent: true };
  } catch {
    return { progress: emptyLearningProgress(), persistent: false };
  }
}

export function saveLearningProgress(storage: WritableStorage, progress: LearningProgress): boolean {
  try {
    storage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
