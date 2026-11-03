"use client";

import { useEffect, useState } from "react";

export function PaperDailyReportSection({ defaultEmail }: { defaultEmail?: string }) {
  const [reportEmail, setReportEmail] = useState("");
  const [reportActive, setReportActive] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [sendingInstantReport, setSendingInstantReport] = useState(false);
  const [reportMessage, setReportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (defaultEmail && !reportEmail) {
      setReportEmail(defaultEmail);
    } else if (typeof window !== "undefined" && !reportEmail) {
      const saved = localStorage.getItem("investiq_paper_report_email");
      if (saved) setReportEmail(saved);
    }
  }, [defaultEmail, reportEmail]);

  async function handleToggleReport(active: boolean) {
    if (!reportEmail || !reportEmail.includes("@")) {
      setReportMessage({
        type: "error",
        text: "Vui lòng nhập địa chỉ email hợp lệ để nhận báo cáo.",
      });
      return;
    }
    setReportLoading(true);
    setReportMessage(null);
    try {
      const csrfRes = await fetch("/auth-api/csrf", { cache: "no-store" });
      const csrfBody = (await csrfRes.json()) as { csrf_token?: string };
      const res = await fetch("/portfolio-api/daily-report/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfBody.csrf_token ?? "",
        },
        body: JSON.stringify({ email: reportEmail.trim(), is_active: active }),
      });
      if (!res.ok) throw new Error("Chưa thể cập nhật cấu hình báo cáo.");
      setReportActive(active);
      setReportMessage({
        type: "success",
        text: active
          ? `Đã bật gửi báo cáo AI hàng ngày vào email ${reportEmail}.`
          : "Đã tạm dừng nhận báo cáo hàng ngày.",
      });
    } catch (err) {
      setReportMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Có lỗi xảy ra.",
      });
    } finally {
      setReportLoading(false);
    }
  }

  async function handleSendInstantReport() {
    if (!reportEmail || !reportEmail.includes("@")) {
      setReportMessage({
        type: "error",
        text: "Vui lòng nhập địa chỉ email hợp lệ trước khi gửi.",
      });
      return;
    }
    setSendingInstantReport(true);
    setReportMessage(null);
    try {
      const csrfRes = await fetch("/auth-api/csrf", { cache: "no-store" });
      const csrfBody = (await csrfRes.json()) as { csrf_token?: string };
      await fetch("/portfolio-api/daily-report/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfBody.csrf_token ?? "",
        },
        body: JSON.stringify({ email: reportEmail.trim(), is_active: reportActive }),
      });

      const res = await fetch("/portfolio-api/daily-report/send-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfBody.csrf_token ?? "",
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Không thể gửi báo cáo vào lúc này.");
      }
      setReportMessage({
        type: "success",
        text: `Đã gửi báo cáo tổng kết danh mục & nhận xét AI thành công đến ${reportEmail}! Vui lòng kiểm tra hộp thư.`,
      });
    } catch (err) {
      setReportMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Chưa thể gửi email báo cáo.",
      });
    } finally {
      setSendingInstantReport(false);
    }
  }

  return (
    <section className="paper-section ai-report-section">
      <div className="paper-section-heading">
        <div>
          <p className="eyebrow">TRỢ LÝ AI & KỶ LUẬT ĐẦU TƯ</p>
          <h2>Báo cáo kết quả và nhận xét AI hàng ngày qua Email</h2>
        </div>
        <span className="text-cyan font-semibold text-xs">
          Hỗ trợ giữ vốn, chốt lời & cắt lỗ
        </span>
      </div>

      <div className="social-visibility-card ai-report-card">
        <div className="visibility-info">
          <p className="visibility-status-text">
            Trạng thái báo cáo:{" "}
            {reportActive ? (
              <strong className="text-emerald">Đang kích hoạt nhận thư hàng ngày</strong>
            ) : (
              <strong className="text-neutral">Đang tạm dừng</strong>
            )}
          </p>
          <p className="visibility-desc">
            Khi bạn mua thử cổ phiếu với số tiền mô phỏng, hệ thống sẽ tự động tổng hợp kết quả sau mỗi phiên và gửi email kèm nhận xét khách quan từ Trợ lý AI. AI sẽ phân tích cụ thể 4 khía cạnh sống còn: quản trị tỷ lệ tiền mặt để giữ vốn, phát hiện ngưỡng vi phạm để cắt lỗ dứt khoát, xác định vùng giá mục tiêu để chốt lời, và đề xuất kế hoạch hành động cho phiên kế tiếp.
          </p>
        </div>

        <div className="visibility-controls">
          <div className="nickname-field">
            <label htmlFor="reportEmailInput">Địa chỉ Email nhận báo cáo:</label>
            <input
              id="reportEmailInput"
              type="email"
              placeholder="nhap-email-cua-ban@gmail.com"
              value={reportEmail}
              onChange={(e) => setReportEmail(e.target.value)}
              className="nickname-input"
            />
          </div>

          <div className="visibility-buttons flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              disabled={sendingInstantReport || reportLoading}
              onClick={handleSendInstantReport}
              className="btn-toggle-public"
              title="Gửi ngay 1 email báo cáo danh mục hiện tại kèm nhận xét AI để kiểm tra"
            >
              {sendingInstantReport ? "Đang gửi báo cáo..." : "Gửi báo cáo phân tích AI ngay bây giờ"}
            </button>

            {reportActive ? (
              <button
                type="button"
                disabled={reportLoading}
                onClick={() => handleToggleReport(false)}
                className="btn-toggle-private"
              >
                {reportLoading ? "Đang lưu..." : "Tạm dừng nhận hàng ngày"}
              </button>
            ) : (
              <button
                type="button"
                disabled={reportLoading}
                onClick={() => handleToggleReport(true)}
                className="btn-toggle-private"
              >
                {reportLoading ? "Đang lưu..." : "Bật nhận hàng ngày"}
              </button>
            )}
          </div>
        </div>

        {reportMessage && (
          <p className={`visibility-msg ${reportMessage.type === "success" ? "text-emerald" : "text-rose"}`}>
            {reportMessage.text}
          </p>
        )}
      </div>
    </section>
  );
}
