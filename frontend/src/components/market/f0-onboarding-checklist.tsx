"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Compass, X } from "lucide-react";

import { loadPriceAlerts } from "@/lib/price-alerts";
import { loadTradeJournalEntries } from "@/lib/trading-journal";

type StepId = "readiness" | "learn" | "market" | "portfolio";

type OnboardingStep = {
  id: StepId;
  title: string;
  description: string;
  href: string;
  cta: string;
};

const STEPS: OnboardingStep[] = [
  {
    id: "readiness",
    title: "1. Đánh giá khẩu vị rủi ro",
    description: "Trả lời 10 câu hỏi tình huống để biết phong cách đầu tư phù hợp.",
    href: "/learn/readiness",
    cta: "Làm khảo sát",
  },
  {
    id: "learn",
    title: "2. Học bài chứng khoán căn bản",
    description: "Nắm nhanh cách đọc bảng giá, biên độ trần/sàn, P/E và P/B.",
    href: "/learn",
    cta: "Vào khóa học",
  },
  {
    id: "market",
    title: "3. Xem bảng giá & đặt cảnh báo giá",
    description: "Chọn cổ phiếu VN30 bạn quan tâm và đặt mốc giá canh mua/chốt lời.",
    href: "/market/stocks",
    cta: "Mở bảng giá",
  },
  {
    id: "portfolio",
    title: "4. Đặt lệnh mua mô phỏng đầu tiên",
    description: "Thực hành với 100 triệu ảo, ghi nhật ký lý do vào lệnh & cắt lỗ.",
    href: "/portfolio",
    cta: "Thực hành ngay",
  },
];

const STORAGE_KEY = "investiq.f0.onboarding.v1";

type StoredState = {
  completed: StepId[];
  dismissed: boolean;
};

function readInitialState(): StoredState {
  if (typeof window === "undefined") {
    return { completed: [], dismissed: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredState>) : {};
    const completed = new Set<StepId>(Array.isArray(parsed.completed) ? parsed.completed : []);

    // Auto-detect real progress from local features
    if (loadPriceAlerts().length > 0) completed.add("market");
    if (loadTradeJournalEntries().length > 0) completed.add("portfolio");
    try {
      const learnRaw = window.localStorage.getItem("investiq.stock_basics.progress.v1");
      if (learnRaw && learnRaw.length > 10) completed.add("learn");
    } catch {
      // Ignore storage error
    }

    return {
      completed: Array.from(completed),
      dismissed: Boolean(parsed.dismissed),
    };
  } catch {
    return { completed: [], dismissed: false };
  }
}

export function F0OnboardingChecklist() {
  const [state, setState] = useState<StoredState>({ completed: [], dismissed: false });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readInitialState());
    setHydrated(true);
  }, []);

  function persist(next: StoredState) {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }

  function toggleStep(id: StepId) {
    const exists = state.completed.includes(id);
    const completed = exists
      ? state.completed.filter((item) => item !== id)
      : [...state.completed, id];
    persist({ ...state, completed });
  }

  function markVisited(id: StepId) {
    if (state.completed.includes(id)) return;
    persist({ ...state, completed: [...state.completed, id] });
  }

  if (!hydrated) return null;

  const doneCount = state.completed.length;
  const pct = Math.round((doneCount / STEPS.length) * 100);

  if (state.dismissed) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => persist({ ...state, dismissed: false })}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200 bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 px-3 py-1.5 rounded-full transition"
        >
          <Compass className="w-3.5 h-3.5" />
          Hiện lộ trình cho người mới ({doneCount}/{STEPS.length})
        </button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="f0-onboarding-title"
      className="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-sky-950/35 p-4 sm:p-5 shadow-lg"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400 m-0 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            LỘ TRÌNH 4 BƯỚC CHO NGƯỜI MỚI (F0)
          </p>
          <h2 id="f0-onboarding-title" className="text-base sm:text-lg font-extrabold text-white m-0">
            Bắt đầu đầu tư bài bản trước khi bỏ tiền thật
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs font-bold text-emerald-300">
              Hoàn thành {doneCount}/{STEPS.length} ({pct}%)
            </span>
            <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => persist({ ...state, dismissed: true })}
            aria-label="Ẩn lộ trình người mới"
            title="Ẩn lộ trình người mới"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STEPS.map((step) => {
          const isDone = state.completed.includes(step.id);
          return (
            <div
              key={step.id}
              className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition ${
                isDone
                  ? "border-emerald-500/35 bg-emerald-950/20"
                  : "border-slate-800 bg-slate-950/60 hover:border-sky-500/40"
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-sm font-bold leading-snug ${isDone ? "text-emerald-200" : "text-slate-100"}`}>
                    {step.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleStep(step.id)}
                    aria-label={isDone ? `Bỏ đánh dấu ${step.title}` : `Đánh dấu hoàn thành ${step.title}`}
                    className="shrink-0 text-slate-400 hover:text-emerald-300 transition"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed m-0">{step.description}</p>
              </div>
              <Link
                href={step.href}
                onClick={() => markVisited(step.id)}
                className={`inline-flex items-center justify-center text-xs font-bold py-1.5 px-3 rounded-lg transition ${
                  isDone
                    ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                    : "bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"
                }`}
              >
                {isDone ? "Xem lại →" : `${step.cta} →`}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
