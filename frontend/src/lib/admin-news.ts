export type AdminNewsSource = {
  slug: string;
  name: string;
  status: "active" | "paused" | "pending_review" | "blocked";
  storage_mode: "full_text" | "metadata_only" | "link_only";
  display_mode: "full_text" | "metadata_only" | "link_only";
  row_version: number;
  last_success_at: string | null;
  blocked_reason: string | null;
};

export type CrawlRun = {
  id: string;
  source_slug: string;
  trigger: "scheduled" | "manual" | "backfill";
  status: "queued" | "running" | "succeeded" | "partial" | "failed";
  started_at: string | null;
  finished_at: string | null;
  discovered_count: number;
  queued_count: number;
  succeeded_count: number;
  skipped_count: number;
  failed_count: number;
  error_code: string | null;
};

export type AdminOperation = {
  status: string;
  operation_id?: string | null;
  matched?: number | null;
  deleted?: number | null;
  retention_days?: number | null;
  dry_run?: boolean | null;
};
