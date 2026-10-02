import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NewsPipelineDashboard } from "@/components/admin/news-pipeline-dashboard";
import type { AdminNewsSource, CrawlRun } from "@/lib/admin-news";

const action = vi.fn(async (_: FormData) => undefined);
const source: AdminNewsSource = {
  slug: "vietstock",
  name: "Vietstock",
  status: "active",
  storage_mode: "full_text",
  display_mode: "full_text",
  row_version: 2,
  last_success_at: "2026-09-30T12:00:00Z",
  blocked_reason: null,
};
const run: CrawlRun = {
  id: "run-1",
  source_slug: "vietstock",
  trigger: "manual",
  status: "partial",
  started_at: "2026-09-30T12:00:00Z",
  finished_at: "2026-09-30T12:05:00Z",
  discovered_count: 100,
  queued_count: 80,
  succeeded_count: 60,
  skipped_count: 15,
  failed_count: 5,
  error_code: null,
};

describe("NewsPipelineDashboard", () => {
  it("renders source controls, crawl telemetry, and guarded retention controls", () => {
    render(
      <NewsPipelineDashboard
        sources={[source]}
        runs={[run]}
        notice="Đã tải dữ liệu"
        changeSourceStatus={action}
        startManualCrawl={action}
        previewRetention={action}
        deleteExpiredNews={action}
      />,
    );

    expect(screen.getByRole("heading", { name: "Quản lý News pipeline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạm dừng" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crawl 100 tin" })).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByLabelText("Nhập DELETE để xác nhận")).toBeRequired();
  });

  it("shows an explicit empty crawl-run state", () => {
    render(
      <NewsPipelineDashboard
        sources={[]}
        runs={[]}
        changeSourceStatus={action}
        startManualCrawl={action}
        previewRetention={action}
        deleteExpiredNews={action}
      />,
    );

    expect(screen.getByText("Chưa có lượt crawl nào.")).toBeInTheDocument();
  });
});
