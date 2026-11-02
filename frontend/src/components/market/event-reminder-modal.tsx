"use client";

import React, { useState, useEffect } from "react";
import { createEventReminder, type CreateEventReminderPayload } from "@/lib/api-client";

export interface ReminderTargetEvent {
  id: string;
  symbol: string;
  title: string;
  date: string;
  type?: string;
  extraInfo?: Record<string, unknown>;
}

export interface EventReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ReminderTargetEvent | null;
  onSuccess?: () => void;
}

export function EventReminderModal({
  isOpen,
  onClose,
  event,
  onSuccess,
}: EventReminderModalProps) {
  const [email, setEmail] = useState("");
  const [remindDaysBefore, setRemindDaysBefore] = useState<1 | 2>(1);
  const [alsoRemindBoth, setAlsoRemindBoth] = useState(true);
  const [sendTestNow, setSendTestNow] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("investiq_user_email");
      if (savedEmail) {
        setEmail(savedEmail);
      }
    }
  }, [isOpen]);

  if (!isOpen || !event) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatusMessage({
        type: "error",
        text: "Vui lòng nhập địa chỉ email hợp lệ.",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage(null);

      if (typeof window !== "undefined") {
        localStorage.setItem("investiq_user_email", email);
      }

      // 1. Tạo reminder chính
      const payload: CreateEventReminderPayload = {
        email: email.trim(),
        event_id: event.id,
        symbol: event.symbol,
        event_title: event.title,
        event_date: event.date,
        event_type: event.type || "corporate_action",
        remind_days_before: remindDaysBefore,
        extra_info: event.extraInfo || {},
      };

      const res = await createEventReminder(payload);

      // Nếu người dùng chọn nhắc cả 1 và 2 ngày
      if (alsoRemindBoth && remindDaysBefore === 1) {
        try {
          await createEventReminder({
            ...payload,
            event_id: `${event.id}_2d`,
            remind_days_before: 2,
          });
        } catch {
          // Bỏ qua lỗi trùng lặp nếu có
        }
      }

      // Nếu người dùng muốn gửi thử email preview ngay
      if (sendTestNow && res?.data?.id) {
        try {
          const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          await fetch(`${base}/api/v1/market/events/reminders/${res.data.id}/test-send`, {
            method: "POST",
          });
        } catch {
          // Bỏ qua lỗi test-send phụ trợ
        }
      }

      setStatusMessage({
        type: "success",
        text: `Đã thiết lập nhắc nhở thành công cho sự kiện ${event.symbol}! Hệ thống sẽ gửi email thông báo trước ${alsoRemindBoth ? "1 và 2 ngày" : `${remindDaysBefore} ngày`}.`,
      });

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
        setStatusMessage(null);
      }, 2200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Có lỗi xảy ra khi tạo nhắc nhở.";
      setStatusMessage({
        type: "error",
        text: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-modal-title"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h2 id="reminder-modal-title" className="text-base font-bold text-white tracking-tight">
            Đặt nhắc nhở sự kiện qua Email
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Đóng cửa sổ"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Thông tin sự kiện tóm tắt */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 mb-4 text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-sky-600 text-white font-extrabold px-2 py-0.5 rounded text-[11px]">
              {event.symbol}
            </span>
            <span className="text-slate-400">
              Ngày diễn ra: <strong className="text-slate-200">{event.date}</strong>
            </span>
          </div>
          <div className="text-slate-200 font-semibold line-clamp-2">
            {event.title}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="reminder-email-input">
              Email nhận thông báo nhắc nhở
            </label>
            <input
              id="reminder-email-input"
              type="email"
              required
              placeholder="nhap-email-cua-ban@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              InvestIQ sẽ gửi thư thông báo nhắc trước khi sự kiện bắt đầu giao dịch hoặc chốt quyền.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Thời gian thông báo trước
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRemindDaysBefore(1)}
                className={`px-3 py-2 rounded-xl border text-center font-medium transition ${
                  remindDaysBefore === 1
                    ? "bg-sky-950 border-sky-600 text-sky-200"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Trước 1 ngày
              </button>
              <button
                type="button"
                onClick={() => setRemindDaysBefore(2)}
                className={`px-3 py-2 rounded-xl border text-center font-medium transition ${
                  remindDaysBefore === 2
                    ? "bg-sky-950 border-sky-600 text-sky-200"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Trước 2 ngày
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-1 text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={alsoRemindBoth}
                onChange={(e) => setAlsoRemindBoth(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-sky-600 focus:ring-0"
              />
              <span>Nhắc cả 2 mốc (trước 2 ngày và trước 1 ngày)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendTestNow}
                onChange={(e) => setSendTestNow(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-sky-600 focus:ring-0"
              />
              <span>Gửi 1 email mẫu xác nhận ngay lập tức</span>
            </label>
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                statusMessage.type === "success"
                  ? "bg-emerald-950/80 border border-emerald-800/80 text-emerald-300"
                  : "bg-rose-950/80 border border-rose-800/80 text-rose-300"
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? "Đang lưu..." : "Xác nhận nhắc nhở"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

