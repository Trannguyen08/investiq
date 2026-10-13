"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatCompact, formatDecimal, formatEventDate, formatMarketTime } from "@/components/market/formatters";
import { sourcesForLesson } from "@/content/stock-basics";
import {
  emptyLearningProgress,
  loadLearningProgress,
  saveLearningProgress,
} from "@/lib/learning-progress";
import type {
  LearningMarketExample,
  LearningProgress,
  StockBasicsLesson,
} from "@/types/learning";

const journeyStages = [
  "Trước khi mua",
  "Cách thị trường chạy",
  "Đọc giá và nến",
  "Hiểu doanh nghiệp",
  "Quản trị rủi ro",
  "Tin tức và tâm lý",
  "Quy trình đầu tiên",
] as const;

type AnswerState = Record<string, Record<string, string>>;
type MasteryState = Record<string, string[]>;

function formatReviewDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDelayClass(value: string) {
  const labels: Record<string, string> = {
    realtime: "Thời gian thực",
    source_delayed: "Theo độ trễ của nguồn",
    end_of_day: "Dữ liệu cuối ngày",
    fixture: "Dữ liệu minh họa",
  };
  return labels[value] ?? value;
}

function MarketCandleExample({ example }: { example: LearningMarketExample | null }) {
  if (!example) {
    return (
      <section className="learn-market-example unavailable" aria-labelledby="live-example-title">
        <p className="eyebrow">DỮ LIỆU THỰC HÀNH</p>
        <h3 id="live-example-title">Chưa lấy được nến thị trường</h3>
        <p>Bài học vẫn dùng được. InvestIQ không tạo OHLC giả để lấp chỗ trống; hãy thử mở lại biểu đồ thị trường sau.</p>
        <Link href="/market/indices?symbol=VNINDEX">Kiểm tra biểu đồ VN-Index →</Link>
      </section>
    );
  }

  const rising = Number(example.close) >= Number(example.open);
  const freshnessLabel = example.freshness === "fresh"
    ? "Dữ liệu còn trong ngưỡng cập nhật"
    : example.freshness === "fixture"
      ? "Dữ liệu minh họa — không phải giao dịch hiện tại"
      : "Dữ liệu đang trễ";

  return (
    <section className="learn-market-example" aria-labelledby="live-example-title">
      <div className="learn-market-example-heading">
        <div>
          <p className="eyebrow">VÍ DỤ TỪ DỮ LIỆU INVESTIQ</p>
          <h3 id="live-example-title">Nến gần nhất của {example.name}</h3>
        </div>
        <span className={rising ? "candle-direction up" : "candle-direction down"}>
          {rising ? "Đóng trên mở" : "Đóng dưới mở"}
        </span>
      </div>
      <dl className="learn-ohlc-grid">
        <div><dt>Mở</dt><dd>{formatDecimal(example.open)}</dd></div>
        <div><dt>Cao</dt><dd>{formatDecimal(example.high)}</dd></div>
        <div><dt>Thấp</dt><dd>{formatDecimal(example.low)}</dd></div>
        <div><dt>Đóng</dt><dd>{formatDecimal(example.close)}</dd></div>
        <div><dt>Khối lượng</dt><dd>{formatCompact(example.volume)}</dd></div>
      </dl>
      <div className="learn-data-provenance">
        <strong>{freshnessLabel}</strong>
        <span>Nguồn: {example.providerName}</span>
        <span>Nến ngày: <time dateTime={example.timestamp}>{formatEventDate(example.timestamp)}</time></span>
        <span>Cập nhật nguồn: {formatMarketTime(example.marketTime)}</span>
        <span>Múi giờ: {example.timezone}</span>
        <span>Độ trễ: {formatDelayClass(example.delayClass)}</span>
      </div>
      <p>Màu thân nến chỉ so sánh giá mở và đóng của chính nến này; hãy dùng biểu đồ đầy đủ để đọc bối cảnh nhiều phiên.</p>
    </section>
  );
}

function LessonCard({
  lesson,
  completed,
  answers,
  masteredQuestions,
  onAnswer,
  marketExample,
}: {
  lesson: StockBasicsLesson;
  completed: boolean;
  answers: Record<string, string>;
  masteredQuestions: string[];
  onAnswer: (lesson: StockBasicsLesson, questionId: string, optionId: string, correct: boolean) => void;
  marketExample: LearningMarketExample | null;
}) {
  const sources = sourcesForLesson(lesson);

  return (
    <article className={completed ? "learn-lesson completed" : "learn-lesson"} id={`lesson-${lesson.slug}`}>
      <header className="learn-lesson-header">
        <div>
          <p className="eyebrow">{lesson.eyebrow}</p>
          <h2>{lesson.title}</h2>
          <p>{lesson.objective}</p>
        </div>
        <div className="learn-lesson-meta">
          <span>{lesson.estimatedMinutes} phút</span>
          <span>{completed ? "✓ Đã nắm bài" : "Chưa hoàn thành"}</span>
        </div>
      </header>

      <section className="learn-scenario" aria-labelledby={`${lesson.slug}-scenario`}>
        <span aria-hidden="true">?</span>
        <div>
          <p className="eyebrow">TÌNH HUỐNG</p>
          <h3 id={`${lesson.slug}-scenario`}>{lesson.scenario}</h3>
        </div>
      </section>

      <div className="learn-concept-grid">
        {lesson.concepts.map((concept, index) => (
          <section key={concept.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{concept.title}</h3>
            <p>{concept.body}</p>
          </section>
        ))}
      </div>

      <section className="learn-worked-example">
        <div>
          <p className="eyebrow">VÍ DỤ ĐÃ LÀM</p>
          <h3>{lesson.workedExample.title}</h3>
        </div>
        <ol>
          {lesson.workedExample.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>

      {lesson.slug === "read-a-candle" && <MarketCandleExample example={marketExample} />}

      <aside className="learn-misconception">
        <strong>Hiểu lầm cần tránh</strong>
        <p>{lesson.misconception}</p>
      </aside>

      <details className="learn-glossary">
        <summary>Thuật ngữ trong bài</summary>
        <dl>
          {lesson.glossary.map((item) => (
            <div key={item.term}><dt>{item.term}</dt><dd>{item.definition}</dd></div>
          ))}
        </dl>
      </details>

      <section className="learn-quiz" aria-labelledby={`${lesson.slug}-quiz`}>
        <div className="learn-section-heading">
          <div><p className="eyebrow">NHỚ LẠI</p><h3 id={`${lesson.slug}-quiz`}>Tự giải thích trước khi xem đáp án</h3></div>
          <span>{completed ? lesson.quiz.length : masteredQuestions.length}/{lesson.quiz.length} câu đã hiểu</span>
        </div>
        {lesson.quiz.map((question, questionIndex) => {
          const selectedId = answers[question.id];
          const selectedOption = question.options.find((option) => option.id === selectedId);
          const mastered = masteredQuestions.includes(question.id);
          return (
            <fieldset className="learn-question" key={question.id}>
              <legend>{questionIndex + 1}. {question.prompt}</legend>
              <div className="learn-options">
                {question.options.map((option) => (
                  <button
                    type="button"
                    className={selectedId === option.id ? (option.correct ? "selected correct" : "selected incorrect") : ""}
                    aria-pressed={selectedId === option.id}
                    disabled={mastered}
                    onClick={() => onAnswer(lesson, question.id, option.id, option.correct)}
                    key={option.id}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {selectedOption && (
                <p className={selectedOption.correct ? "quiz-feedback correct" : "quiz-feedback incorrect"} role="status">
                  <strong>{selectedOption.correct ? "Đúng." : "Chưa đúng."}</strong> {selectedOption.feedback}
                </p>
              )}
            </fieldset>
          );
        })}
      </section>

      <footer className="learn-lesson-footer">
        <div>
          <p className="eyebrow">LÀM NGAY TRÊN INVESTIQ</p>
          <strong>{lesson.practice.description}</strong>
        </div>
        <Link href={lesson.practice.href} prefetch={false}>{lesson.practice.label} →</Link>
      </footer>

      <div className="learn-sources">
        <span>Nội dung {lesson.contentVersion} · rà soát {formatReviewDate(lesson.reviewedAt)}</span>
        <ul aria-label="Nguồn tham khảo của bài">
          {sources.map((source) => (
            <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.publisher}: {source.title}</a></li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function LearningJourney({
  lessons,
  marketExample,
}: {
  lessons: StockBasicsLesson[];
  marketExample: LearningMarketExample | null;
}) {
  const [availableMinutes, setAvailableMinutes] = useState<5 | 15 | 30>(5);
  const [progress, setProgress] = useState<LearningProgress>(emptyLearningProgress);
  const [persistent, setPersistent] = useState(true);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [mastery, setMastery] = useState<MasteryState>({});

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const loaded = loadLearningProgress(window.localStorage);
      setProgress(loaded.progress);
      setPersistent(loaded.persistent);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  const recommendedLesson = useMemo(() => (
    lessons.find((lesson) => !progress.completedLessons.includes(lesson.slug)) ?? lessons[0]
  ), [lessons, progress.completedLessons]);

  const completionPercent = lessons.length
    ? Math.round((progress.completedLessons.filter((slug) => lessons.some((lesson) => lesson.slug === slug)).length / lessons.length) * 100)
    : 0;
  const allLessonsCompleted = lessons.length > 0 && completionPercent === 100;

  function answerQuestion(lesson: StockBasicsLesson, questionId: string, optionId: string, correct: boolean) {
    setAnswers((current) => ({
      ...current,
      [lesson.slug]: { ...current[lesson.slug], [questionId]: optionId },
    }));
    if (!correct) return;

    const mastered = [...new Set([...(mastery[lesson.slug] ?? []), questionId])];
    setMastery((current) => ({ ...current, [lesson.slug]: mastered }));
    if (mastered.length !== lesson.quiz.length || progress.completedLessons.includes(lesson.slug)) return;

    const nextProgress: LearningProgress = {
      version: 1,
      completedLessons: [...progress.completedLessons, lesson.slug],
    };
    setProgress(nextProgress);
    if (!saveLearningProgress(window.localStorage, nextProgress)) setPersistent(false);
  }

  return (
    <>
      <section className="learn-hero" aria-labelledby="learn-title">
        <div className="learn-hero-copy">
          <p className="eyebrow">LỘ TRÌNH HỌC INVESTIQ</p>
          <h1 id="learn-title">Từ con số 0 đến một quyết định có hiểu biết.</h1>
          <p>Không phím hàng, không hứa lợi nhuận. Học từng khái niệm ngắn, kiểm tra lại bằng tình huống và thực hành trên dữ liệu có nguồn.</p>
          <div className="learn-time-choice" aria-label="Thời gian học hôm nay">
            <span>Hôm nay bạn có:</span>
            {[5, 15, 30].map((minutes) => (
              <button
                type="button"
                aria-pressed={availableMinutes === minutes}
                className={availableMinutes === minutes ? "active" : ""}
                onClick={() => setAvailableMinutes(minutes as 5 | 15 | 30)}
                key={minutes}
              >
                {minutes} phút
              </button>
            ))}
          </div>
          {recommendedLesson && (
            <a className="learn-primary-action" href={`#lesson-${recommendedLesson.slug}`}>
              {allLessonsCompleted ? "Ôn lại" : completionPercent ? "Học tiếp" : "Bắt đầu bài đầu tiên"}: {recommendedLesson.title}
            </a>
          )}
          <small>{availableMinutes === 5 ? "Một bài ngắn, không cần đăng nhập." : `Trong ${availableMinutes} phút, hãy học một bài rồi dành phần còn lại để thực hành.`}</small>
        </div>
        <aside className="learn-hero-status" aria-label="Tiến độ học">
          <span className="learn-progress-value">{completionPercent}%</span>
          <strong>Tiến độ nền tảng</strong>
          <div className="learn-progress-track" aria-hidden="true"><i style={{ width: `${completionPercent}%` }} /></div>
          <p>{progress.completedLessons.length}/{lessons.length} bài trong lát cắt đầu đã hoàn thành.</p>
          {!persistent && <p className="learn-storage-warning" role="status">Trình duyệt đang chặn lưu trữ. Tiến độ vẫn dùng được trong phiên này nhưng sẽ không được giữ sau khi đóng trang.</p>}
        </aside>
      </section>

      <section className="learn-roadmap" aria-labelledby="roadmap-title">
        <div className="learn-section-heading">
          <div><p className="eyebrow">LỘ TRÌNH 0 → 6</p><h2 id="roadmap-title">Biết mình đang học để làm gì</h2></div>
          <span>2 bài đầu đã mở · các chặng sau triển khai theo từng lát cắt</span>
        </div>
        <ol>
          {journeyStages.map((stage, index) => {
            const available = index === 0 || index === 2;
            return (
              <li className={available ? "available" : "planned"} key={stage}>
                <span>{index}</span><strong>{stage}</strong><small>{available ? "Có bài học" : "Sắp mở"}</small>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="learn-safety-note" aria-label="Nguyên tắc học an toàn">
        <strong>Học để tự kiểm tra quyết định, không học để chạy theo một mã.</strong>
        <p>Lợi nhuận mô phỏng không tạo điểm số. Việc nhận ra mình chưa hiểu hoặc chưa sẵn sàng đầu tư vẫn là một kết quả tốt.</p>
      </section>

      <div className="learn-lessons">
        {lessons.map((lesson) => (
          <LessonCard
            lesson={lesson}
            completed={progress.completedLessons.includes(lesson.slug)}
            answers={answers[lesson.slug] ?? {}}
            masteredQuestions={mastery[lesson.slug] ?? []}
            onAnswer={answerQuestion}
            marketExample={marketExample}
            key={lesson.slug}
          />
        ))}
      </div>
    </>
  );
}
