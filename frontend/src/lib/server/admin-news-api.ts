import type { AdminNewsSource, AdminOperation, CrawlRun } from "@/lib/admin-news";

const serverBase = process.env.API_INTERNAL_BASE_URL ?? "http://localhost:8000/api";

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.NEWS_ADMIN_TOKEN;
  if (!token) throw new Error("NEWS_ADMIN_TOKEN is not configured for the Admin UI");
  const response = await fetch(`${serverBase}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(problem?.error?.message ?? `News Admin API returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getAdminNewsSources() {
  return adminRequest<AdminNewsSource[]>("/v1/admin/news/sources");
}

export function getAdminCrawlRuns() {
  return adminRequest<CrawlRun[]>("/v1/admin/news/crawl-runs");
}

export function updateAdminSource(slug: string, status: "active" | "paused", rowVersion: number) {
  return adminRequest<AdminNewsSource>(`/v1/admin/news/sources/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, expected_row_version: rowVersion }),
  });
}

export function triggerAdminCrawl(sourceSlug: string, limit: number) {
  return adminRequest<AdminOperation>("/v1/admin/news/crawl-runs", {
    method: "POST",
    body: JSON.stringify({ source_slug: sourceSlug, limit }),
  });
}

export function runAdminRetention(retentionDays: number, dryRun: boolean, confirm: boolean) {
  return adminRequest<AdminOperation>("/v1/admin/news/retention", {
    method: "POST",
    body: JSON.stringify({ retention_days: retentionDays, dry_run: dryRun, confirm }),
  });
}
