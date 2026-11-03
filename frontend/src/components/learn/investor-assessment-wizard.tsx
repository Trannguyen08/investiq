"use client";

import { useState } from "react";
import type { AssessmentQuestion, ReadinessEvaluation } from "@/types/assessment";
import { submitAssessment } from "@/lib/api-client";
import { ReadinessReportCard } from "@/components/learn/readiness-report-card";

interface Props {
  questions: AssessmentQuestion[];
  initialEvaluation?: ReadinessEvaluation | null;
}

export function InvestorAssessmentWizard({ questions, initialEvaluation = null }: Props) {
  const [evaluation, setEvaluation] = useState<ReadinessEvaluation | null>(initialEvaluation);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (evaluation) {
    return (
      <ReadinessReportCard
        evaluation={evaluation}
        onRetake={() => {
          setEvaluation(null);
          setCurrentIndex(0);
          setAnswers({});
          setErrorMsg(null);
        }}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <div style={{ background: "#0b1f33", padding: "2rem", borderRadius: "1rem", color: "#94a3b8", textAlign: "center", border: "1px solid #1e3f5d" }}>
        Đang tải câu hỏi khảo sát hoặc chưa có câu hỏi nào được xuất bản.
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);
  const selectedOptionId = answers[currentQ.id] || answers[String(currentQ.sort_order)];

  const handleSelectOption = (optId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optId,
      [String(currentQ.sort_order)]: optId,
    }));
  };

  const handleNext = async () => {
    if (!selectedOptionId) {
      setErrorMsg("Vui lòng chọn một phương án phù hợp nhất với bạn.");
      return;
    }
    setErrorMsg(null);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Submit assessment
      setIsSubmitting(true);
      try {
        const result = await submitAssessment({ answers });
        setEvaluation(result);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Đã có lỗi xảy ra khi nộp bài khảo sát.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  return (
    <div
      className="assessment-wizard-card"
      style={{
        background: "#0b1f33",
        border: "1px solid #1e3f5d",
        borderRadius: "1rem",
        padding: "1.75rem",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      {/* Header & Step progress */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Khảo sát Định hướng &amp; Khẩu vị Rủi ro
          </span>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8" }}>
            Câu hỏi {currentIndex + 1} / {questions.length} ({progressPercent}%)
          </span>
        </div>

        {/* Progress track */}
        <div style={{ width: "100%", height: "6px", background: "#142a42", borderRadius: "3px", overflow: "hidden" }}>
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: "#38bdf8",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Question Prompt */}
      <div>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", lineHeight: 1.4 }}>
          {currentQ.sort_order}. {currentQ.prompt}
        </h3>
        {currentQ.subtext && (
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.35rem" }}>
            {currentQ.subtext}
          </p>
        )}
      </div>

      {/* Options List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {currentQ.options.map((opt, idx) => {
          const isSelected = selectedOptionId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelectOption(opt.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "1rem 1.25rem",
                borderRadius: "0.75rem",
                border: isSelected ? "2px solid #38bdf8" : "1px solid #1e3f5d",
                background: isSelected ? "rgba(56, 189, 248, 0.12)" : "#06101d",
                color: "#ffffff",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
              }}
            >
              {/* Radio Circle */}
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  border: isSelected ? "6px solid #38bdf8" : "2px solid #475569",
                  background: isSelected ? "#ffffff" : "transparent",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
              />
              <div style={{ flex: 1, fontSize: "0.92rem", fontWeight: isSelected ? 700 : 500, lineHeight: 1.4 }}>
                <span style={{ color: "#38bdf8", marginRight: "0.4rem", fontWeight: 700 }}>
                  {String.fromCharCode(65 + idx)}.
                </span>
                {opt.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            background: "rgba(244, 63, 94, 0.15)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            color: "#f43f5e",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Navigation Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #1e3f5d", paddingTop: "1.25rem" }}>
        <button
          type="button"
          onClick={handleBack}
          disabled={currentIndex === 0 || isSubmitting}
          style={{
            padding: "0.6rem 1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid #1e3f5d",
            background: "#06101d",
            color: currentIndex === 0 ? "#475569" : "#cbd5e1",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: currentIndex === 0 ? "not-allowed" : "pointer",
          }}
        >
          Quay lại
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={isSubmitting}
          style={{
            padding: "0.6rem 1.5rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#38bdf8",
            color: "#06101d",
            fontWeight: 700,
            fontSize: "0.875rem",
            cursor: isSubmitting ? "wait" : "pointer",
          }}
        >
          {isSubmitting
            ? "Đang chẩn đoán..."
            : currentIndex < questions.length - 1
            ? "Tiếp tục"
            : "Nộp bài & Xem kết quả"}
        </button>
      </div>
    </div>
  );
}
