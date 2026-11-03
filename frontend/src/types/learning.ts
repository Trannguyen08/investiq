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

export type LearningLevel = "beginner" | "intermediate" | "advanced";

export type PracticalExample = {
  title: string;
  ticker?: string | null;
  scenario: string;
  analysis: string;
  key_takeaway: string;
};

export type LearningTopicSummary = {
  id: string;
  slug: string;
  level: LearningLevel;
  stage: number;
  sort_order: number;
  title: string;
  eyebrow: string;
  summary: string;
  estimated_minutes: number;
  quiz_count: number;
  status: string;
  updated_at: string;
};

export type LearningTopicDetail = {
  id: string;
  slug: string;
  level: LearningLevel;
  stage: number;
  sort_order: number;
  title: string;
  eyebrow: string;
  summary: string;
  estimated_minutes: number;
  theory_content: string;
  practical_example: PracticalExample;
  quizzes: LessonQuizQuestion[];
  glossary: LessonGlossaryTerm[];
  practice_action: LearningPracticeAction;
  status: string;
  created_at: string;
  updated_at: string;
};

export type StockBasicsLesson = {
  slug: string;
  stage: number;
  level?: LearningLevel;
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
  practicalExample?: PracticalExample;
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

export type QuizSubmissionResult = {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  details: {
    question_id: string;
    selected_option_id: string;
    correct: boolean;
    feedback: string;
  }[];
};
