"use client";

import { useState } from "react";
import type { AdminNewsSource, CrawlRun } from "@/lib/admin-news";
import { AdminDetailModal } from "@/components/admin/admin-detail-modal";
import { IconView, IconLock, IconUnlock, IconPlay } from "@/components/admin/admin-icons";

type Action = (formData: FormData) => Promise<void>;

type Props = {
  sources: AdminNewsSource[];
  runs: CrawlRun[];
  notice?: string;
  error?: string;
  changeSourceStatus: Action;
  startManualCrawl: Action;
  previewRetention: Action;
  deleteExpiredNews: Action;
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "Chưa có";
}

export function NewsPipelineDashboard({
  sources,
  runs,
  notice,
  error,
  changeSourceStatus,
  startManualCrawl,
  previewRetention,
  deleteExpiredNews,
}: Props) {
  const [selectedRun, setSelectedRun] = useState<CrawlRun | null>(null);
  const activeCount = sources.filter((s) => s.status === "active").length;

  return (
    <div>
      <div className="admin-view-header">
        <div>
          <h1>Dữ liệu & Thu thập tin tức (News Pipeline)</h1>
          <p>
            Quản trị {sources.length} nguồn thu thập tin chứng khoán, kích hoạt crawl thủ công và quản lý vòng đời dữ liệu.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <span className="admin-badge active" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
            {activeCount}/{sources.length} nguồn hoạt động
          </span>
        </div>
      </div>

      {notice && (
        <p className="admin-alert success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="admin-alert error" role="alert">
          {error}
        </p>
      )}

      {/* SOURCES GRID */}
      <div className="admin-card" style={{ marginBottom: "2rem" }}>
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">Trạng thái các nguồn tin chứng khoán ({sources.length})</h2>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Tự động kích hoạt chu kỳ crawl định kỳ mỗi 15 phút
            </span>
          </div>
        </div>

        <div style={{ padding: "1.5rem" }}>
          <div className="source-admin-grid">
            {sources.map((source) => {
              const operational = source.status === "active" || source.status === "paused";
              return (
                <article className="source-admin-card" key={source.slug}>
                  <div className="source-admin-title">
                    <span className={`status-dot ${source.status}`} />
                    <div>
                      <h3>{source.name}</h3>
                      <code>{source.slug}</code>
                    </div>
                    <span className={`admin-badge ${source.status === "active" ? "active" : "neutral"}`}>
                      {source.status === "active" ? "Đang bật" : source.status}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Chế độ lưu trữ</dt>
                      <dd>{source.storage_mode}</dd>
                    </div>
                    <div>
                      <dt>Thành công cuối</dt>
                      <dd>{formatDate(source.last_success_at)}</dd>
                    </div>
                  </dl>
                  {source.blocked_reason && (
                    <p className="source-warning">{source.blocked_reason}</p>
                  )}
                  <div className="source-actions" style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                    {operational && (
                      <form action={changeSourceStatus}>
                        <input type="hidden" name="slug" value={source.slug} />
                        <input type="hidden" name="row_version" value={source.row_version} />
                        <input
                          type="hidden"
                          name="status"
                          value={source.status === "active" ? "paused" : "active"}
                        />
                        <button
                          className={`admin-icon-btn ${source.status === "active" ? "danger" : "success"}`}
                          type="submit"
                          title={source.status === "active" ? "Tạm dừng nguồn tin này" : "Kích hoạt nguồn tin này"}
                          aria-label={source.status === "active" ? "Tạm dừng" : "Kích hoạt"}
                        >
                          {source.status === "active" ? (
                            <IconLock width={15} height={15} />
                          ) : (
                            <IconUnlock width={15} height={15} />
                          )}
                        </button>
                      </form>
                    )}
                    {source.status === "active" && (
                      <form action={startManualCrawl}>
                        <input type="hidden" name="slug" value={source.slug} />
                        <input type="hidden" name="limit" value="100" />
                        <button
                          className="admin-icon-btn primary"
                          type="submit"
                          title="Kích hoạt quét 100 bài báo ngay bây giờ"
                          aria-label="Crawl thủ công"
                        >
                          <IconPlay width={15} height={15} />
                        </button>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* CRAWL RUNS TABLE (UNIFIED TABLE FORMAT) */}
      <div className="admin-card" style={{ marginBottom: "2rem" }}>
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">Lịch sử các đợt crawl gần nhất</h2>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Hiển thị tối đa 100 lần chạy crawl tự động và thủ công
            </span>
          </div>
        </div>

        <div className="admin-table-container">
          <table className="admin-table-unified">
            <thead>
              <tr>
                <th>Nguồn tin</th>
                <th>Kích hoạt</th>
                <th>Trạng thái</th>
                <th>Bắt đầu</th>
                <th>Phát hiện</th>
                <th>Thành công</th>
                <th>Bỏ qua</th>
                <th>Lỗi</th>
                <th style={{ textAlign: "right", width: "80px" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {runs.length ? (
                runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <strong style={{ color: "#0f172a" }}>{run.source_slug}</strong>
                    </td>
                    <td>
                      <span className="admin-badge user">
                        {run.trigger === "manual" ? "Thủ công" : "Tự động"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`admin-badge ${
                          run.status === "succeeded"
                            ? "active"
                            : run.status === "running"
                            ? "bullish"
                            : "disabled"
                        }`}
                      >
                        {run.status === "succeeded"
                          ? "Thành công"
                          : run.status === "running"
                          ? "Đang chạy"
                          : run.status}
                      </span>
                    </td>
                    <td>{formatDate(run.started_at)}</td>
                    <td>{run.discovered_count}</td>
                    <td>
                      <span style={{ color: "#16a34a", fontWeight: 700 }}>
                        {run.succeeded_count}
                      </span>
                    </td>
                    <td>{run.skipped_count}</td>
                    <td>
                      <span style={{ color: run.failed_count > 0 ? "#dc2626" : "#64748b", fontWeight: run.failed_count > 0 ? 700 : 400 }}>
                        {run.failed_count}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="admin-icon-btn primary"
                        title="Xem chi tiết lượt crawl"
                        aria-label="Xem chi tiết"
                        onClick={() => setSelectedRun(run)}
                      >
                        <IconView width={15} height={15} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    style={{ textAlign: "center", color: "#64748b", padding: "2.5rem" }}
                  >
                    Chưa có lượt crawl nào được ghi nhận.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RETENTION CLEANUP */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">Vòng đời dữ liệu & Dọn dẹp tin quá hạn (Retention)</h2>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Luôn kiểm tra Dry-run trước khi xác nhận xóa dữ liệu
            </span>
          </div>
        </div>

        <div style={{ padding: "1.5rem" }}>
          <div className="retention-grid">
            <form action={previewRetention} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <label style={{ fontSize: "0.84rem", fontWeight: 600, color: "#334155" }}>
                Số ngày giữ lại:
                <input
                  name="retention_days"
                  type="number"
                  min="7"
                  max="3650"
                  defaultValue="90"
                  className="admin-filter-input"
                  style={{ width: "100%", marginTop: "0.35rem" }}
                />
              </label>
              <button className="admin-btn-secondary" type="submit">
                Kiểm tra tin quá hạn (Dry-run)
              </button>
            </form>

            <form
              action={deleteExpiredNews}
              onSubmit={(e) => {
                if (!window.confirm("CẢNH BÁO: Dữ liệu bài viết quá hạn sẽ bị xóa vĩnh viễn khỏi database. Xác nhận tiếp tục?")) {
                  e.preventDefault();
                }
              }}
              style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
            >
              <label style={{ fontSize: "0.84rem", fontWeight: 600, color: "#334155" }}>
                Số ngày giữ lại:
                <input
                  name="retention_days"
                  type="number"
                  min="7"
                  max="3650"
                  defaultValue="90"
                  className="admin-filter-input"
                  style={{ width: "100%", marginTop: "0.35rem" }}
                />
              </label>
              <button className="admin-btn-danger" type="submit">
                Xóa vĩnh viễn tin quá hạn
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL FOR CRAWL RUN */}
      {selectedRun && (
        <AdminDetailModal
          isOpen={Boolean(selectedRun)}
          onClose={() => setSelectedRun(null)}
          title={`Chi tiết lượt crawl: ${selectedRun.source_slug}`}
        >
          <div className="admin-detail-grid">
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mã lượt crawl</span>
              <span className="admin-detail-val"><code>{selectedRun.id}</code></span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Nguồn thu thập</span>
              <span className="admin-detail-val"><strong>{selectedRun.source_slug}</strong></span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Thời điểm bắt đầu</span>
              <span className="admin-detail-val">{formatDate(selectedRun.started_at)}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Thời điểm kết thúc</span>
              <span className="admin-detail-val">{formatDate(selectedRun.finished_at)}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Trạng thái</span>
              <span className="admin-detail-val">
                <span className={`admin-badge ${selectedRun.status === "succeeded" ? "active" : "disabled"}`}>
                  {selectedRun.status}
                </span>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Hình thức kích hoạt</span>
              <span className="admin-detail-val">{selectedRun.trigger}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Số bài phát hiện</span>
              <span className="admin-detail-val">{selectedRun.discovered_count}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Số bài thành công</span>
              <span className="admin-detail-val" style={{ color: "#16a34a", fontWeight: 700 }}>
                {selectedRun.succeeded_count}
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Số bài bỏ qua</span>
              <span className="admin-detail-val">{selectedRun.skipped_count}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Số bài gặp lỗi</span>
              <span className="admin-detail-val" style={{ color: selectedRun.failed_count > 0 ? "#dc2626" : "#64748b", fontWeight: 700 }}>
                {selectedRun.failed_count}
              </span>
            </div>
            {selectedRun.error_code && (
              <div className="admin-detail-item col-span-2">
                <span className="admin-detail-label">Mã lỗi (Error Code)</span>
                <span className="admin-detail-val" style={{ color: "#dc2626" }}>
                  <code>{selectedRun.error_code}</code>
                </span>
              </div>
            )}
          </div>
        </AdminDetailModal>
      )}
    </div>
  );
}
