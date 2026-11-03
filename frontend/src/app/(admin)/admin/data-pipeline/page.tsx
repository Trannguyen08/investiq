import {
  changeSourceStatus,
  deleteExpiredNews,
  previewRetention,
  startManualCrawl,
} from "@/app/(admin)/admin/actions";
import { NewsPipelineDashboard } from "@/components/admin/news-pipeline-dashboard";
import { MarketDataPipelinePanel } from "@/components/admin/market-data-pipeline-panel";
import { getAdminCrawlRuns, getAdminNewsSources } from "@/lib/server/admin-news-api";
import { getAdminMarketDataPipeline } from "@/lib/server/admin-ops-api";

type SearchParams = Promise<{ notice?: string; error?: string }>;

export default async function DataPipelinePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  let result: Awaited<ReturnType<typeof loadPipeline>> | null = null;
  let loadError: string | null = null;
  try {
    result = await loadPipeline();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Không thể tải News pipeline";
  }
  if (!result) {
    return (
      <main id="main-content" className="admin-pipeline">
        <p className="admin-alert error" role="alert">{loadError}</p>
      </main>
    );
  }
  return (
    <div>
      <NewsPipelineDashboard
        sources={result.sources}
        runs={result.runs}
        notice={params.notice}
        error={params.error}
        changeSourceStatus={changeSourceStatus}
        startManualCrawl={startManualCrawl}
        previewRetention={previewRetention}
        deleteExpiredNews={deleteExpiredNews}
      />
      {result.marketPipeline && (
        <MarketDataPipelinePanel pipeline={result.marketPipeline} />
      )}
    </div>
  );
}

async function loadPipeline() {
  const [sources, runs, marketPipeline] = await Promise.all([
    getAdminNewsSources(),
    getAdminCrawlRuns(),
    getAdminMarketDataPipeline().catch(() => null),
  ]);
  return { sources, runs, marketPipeline };
}
