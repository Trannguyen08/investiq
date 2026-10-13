export type LearningSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
};

export type LessonConcept = {
  title: string;
  body: string;
};

export type LessonGlossaryTerm = {
  term: string;
  definition: string;
};

export type LessonQuizOption = {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
};

export type LessonQuizQuestion = {
  id: string;
  prompt: string;
  options: LessonQuizOption[];
};

export type LearningPracticeAction = {
  href: string;
  label: string;
  description: string;
};

export type StockBasicsLesson = {
  slug: string;
  stage: number;
  title: string;
  eyebrow: string;
  estimatedMinutes: number;
  objective: string;
  scenario: string;
  concepts: LessonConcept[];
  workedExample: {
    title: string;
    steps: string[];
  };
  misconception: string;
  glossary: LessonGlossaryTerm[];
  quiz: LessonQuizQuestion[];
  practice: LearningPracticeAction;
  sourceIds: string[];
  contentVersion: string;
  reviewedAt: string;
};

export type LearningProgress = {
  version: 1;
  completedLessons: string[];
};

export type LearningMarketExample = {
  symbol: string;
  name: string;
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  providerName: string;
  marketTime: string;
  timezone: string;
  freshness: "fresh" | "stale" | "fixture";
  delayClass: string;
};
