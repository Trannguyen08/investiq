import type { AdminNewsSource, CrawlRun } from "@/lib/admin-news";

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

function date(value: string | null) {
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
  const activeCount = sources.filter((source) => source.status === "active").length;
  const latestRun = runs[0];
  return (
    <main id="main-content" className="admin-pipeline">
      <header className="admin-hero">
        <div>
          <p className="eyebrow">News operations</p>
          <h1>Quản lý News pipeline</h1>
          <p>Theo dõi nguồn, chạy crawl thủ công và quản lý vòng đời dữ liệu tin tức.</p>
        </div>
        <div className="admin-metrics" aria-label="Tổng quan pipeline">
          <span><strong>{activeCount}</strong> nguồn hoạt động</span>
          <span><strong>{runs.length}</strong> lượt crawl gần nhất</span>
          <span><strong>{latestRun?.status ?? "—"}</strong> trạng thái mới nhất</span>
        </div>
      </header>

      {notice && <p className="admin-alert success" role="status">{notice}</p>}
      {error && <p className="admin-alert error" role="alert">{error}</p>}

      <section className="admin-section" aria-labelledby="source-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Sources</p><h2 id="source-heading">Nguồn thu thập</h2></div>
          <p>{activeCount}/{sources.length} nguồn đang bật</p>
        </div>
        <div className="source-admin-grid">
          {sources.map((source) => {
            const operational = source.status === "active" || source.status === "paused";
            return (
              <article className="source-admin-card" key={source.slug}>
                <div className="source-admin-title">
                  <span className={`status-dot ${source.status}`} />
                  <div><h3>{source.name}</h3><code>{source.slug}</code></div>
                  <span className={`admin-status ${source.status}`}>{source.status}</span>
                </div>
                <dl>
                  <div><dt>Lưu trữ</dt><dd>{source.storage_mode}</dd></div>
                  <div><dt>Thành công cuối</dt><dd>{date(source.last_success_at)}</dd></div>
                </dl>
                {source.blocked_reason && <p className="source-warning">{source.blocked_reason}</p>}
                <div className="source-actions">
                  {operational && (
                    <form action={changeSourceStatus}>
                      <input type="hidden" name="slug" value={source.slug} />
                      <input type="hidden" name="row_version" value={source.row_version} />
                      <input type="hidden" name="status" value={source.status === "active" ? "paused" : "active"} />
                      <button className="secondary-button" type="submit">{source.status === "active" ? "Tạm dừng" : "Kích hoạt"}</button>
                    </form>
                  )}
                  {source.status === "active" && (
                    <form action={startManualCrawl}>
                      <input type="hidden" name="slug" value={source.slug} />
                      <input type="hidden" name="limit" value="100" />
                      <button className="primary-button" type="submit">Crawl 100 tin</button>
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="admin-section" aria-labelledby="runs-heading">
        <div className="section-heading"><div><p className="eyebrow">Runs</p><h2 id="runs-heading">Lịch sử crawl</h2></div><p>Tối đa 100 lượt gần nhất</p></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Nguồn</th><th>Trigger</th><th>Trạng thái</th><th>Bắt đầu</th><th>Phát hiện</th><th>Thành công</th><th>Bỏ qua</th><th>Lỗi</th></tr></thead>
            <tbody>
              {runs.length ? runs.map((run) => (
                <tr key={run.id}>
                  <td><strong>{run.source_slug}</strong></td><td>{run.trigger}</td><td><span className={`admin-status ${run.status}`}>{run.status}</span></td>
                  <td>{date(run.started_at)}</td><td>{run.discovered_count}</td><td>{run.succeeded_count}</td><td>{run.skipped_count}</td><td>{run.failed_count}</td>
                </tr>
              )) : <tr><td colSpan={8} className="table-empty">Chưa có lượt crawl nào.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section danger-zone" aria-labelledby="retention-heading">
        <div className="section-heading"><div><p className="eyebrow">Retention</p><h2 id="retention-heading">Dọn tin quá hạn</h2></div><p>Luôn dry-run trước khi xóa</p></div>
        <div className="retention-grid">
          <form action={previewRetention}>
            <label>Số ngày giữ lại<input name="retention_days" type="number" min="7" max="3650" defaultValue="90" required /></label>
            <button className="secondary-button" type="submit">Kiểm tra dry-run</button>
          </form>
          <form action={deleteExpiredNews}>
            <label>Số ngày giữ lại<input name="retention_days" type="number" min="7" max="3650" defaultValue="90" required /></label>
            <label>Nhập DELETE để xác nhận<input name="confirmation" autoComplete="off" required /></label>
            <button className="danger-button" type="submit">Xóa tin quá hạn</button>
          </form>
        </div>
      </section>
    </main>
  );
}
