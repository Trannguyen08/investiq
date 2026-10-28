import "server-only";

import { redirect } from "next/navigation";

import { resolveApiBase } from "@/lib/api-base";
import { authenticatedSession } from "@/lib/server/user-auth";

export type UserGrowthPoint = {
  date: string;
  new_users: number;
  trades_count: number;
};

export type TopTradedSymbol = {
  symbol: string;
  trades_count: number;
  total_volume_vnd: number;
};

export type SourceStat = {
  source_slug: string;
  name: string;
  article_count: number;
  status: string;
  last_success_at: string | null;
};

export type RecentAuditItem = {
  id: string;
  occurred_at: string;
  actor_email: string | null;
  event_type: string;
  target: string | null;
  outcome: string;
};

export type AdminOverviewData = {
  total_users: number;
  active_users: number;
  disabled_users: number;
  admin_users: number;
  new_users_today: number;
  new_users_7d: number;
  new_users_30d: number;

  total_portfolios: number;
  total_trades: number;
  total_starting_cash_vnd: number;
  total_cash_balance_vnd: number;
  total_realized_pnl_vnd: number;
  top_traded_symbols: TopTradedSymbol[];

  total_theses: number;
  active_theses: number;
  hit_target_theses: number;
  stopped_out_theses: number;
  theses_win_rate: number;
  bullish_theses: number;
  bearish_theses: number;
  neutral_theses: number;

  total_news_articles: number;
  active_news_sources: number;
  total_news_sources: number;
  news_sources_stats: SourceStat[];
  news_sentiment_breakdown: Record<string, number>;

  db_connected: boolean;
  redis_connected: boolean;
  uptime_seconds: number;

  activity_chart: UserGrowthPoint[];
  recent_audits: RecentAuditItem[];
};

export type AdminThesisItem = {
  id: string;
  user_id: string;
  author_name: string;
  author_email: string | null;
  symbol: string;
  stance: "bullish" | "bearish" | "neutral";
  entry_price: number;
  target_price: number;
  stop_loss_price: number;
  horizon_months: number;
  title: string;
  thesis_body: string;
  catalysts: string[];
  status: "active" | "hit_target" | "stopped_out" | "expired";
  outcome_roi: number | null;
  closed_at: string | null;
  closed_price: number | null;
  upvotes: number;
  created_at: string;
  updated_at: string;
};

export type AdminThesisPage = {
  items: AdminThesisItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type PortfolioHoldingItem = {
  symbol: string;
  quantity: number;
  total_cost_basis: number;
  avg_price: number;
  current_price?: number | null;
  unrealized_pnl?: number | null;
  updated_at: string;
};

export type PortfolioTradeItem = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  execution_price: number;
  gross_amount: number;
  fee_amount: number;
  tax_amount: number;
  realized_pnl: number | null;
  created_at: string;
};

export type AdminPortfolioItem = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  starting_cash: number;
  cash_balance: number;
  realized_pnl: number;
  is_public: boolean;
  nickname: string | null;
  holdings_count: number;
  trades_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminPortfolioPage = {
  items: AdminPortfolioItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type AdminPortfolioDetail = {
  portfolio: AdminPortfolioItem;
  holdings: PortfolioHoldingItem[];
  recent_trades: PortfolioTradeItem[];
};

export type AdminAuditLogItem = {
  id: string;
  source_type: "auth" | "news" | "user_admin" | "theses_admin";
  occurred_at: string;
  actor_id: string | null;
  actor_email: string | null;
  event_type: string;
  target: string | null;
  outcome: string;
  request_id: string | null;
  details: Record<string, unknown>;
};

export type AdminAuditLogPage = {
  items: AdminAuditLogItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

// Market Instruments types
export type AdminMarketInstrumentItem = {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  price: number;
  reference_price: number;
  ceiling_price: number;
  floor_price: number;
  volume: number;
  matched_value: number;
  pe: number | null;
  pb: number | null;
  market_cap: number | null;
  is_vn30: boolean;
  trading_status: "normal" | "warning" | "halted";
  paper_trading_enabled: boolean;
};

export type AdminMarketInstrumentPage = {
  items: AdminMarketInstrumentItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  total_market_cap_vnd: number;
  total_matched_value_vnd: number;
};

// Risk & Security Alerts types
export type AdminAlertItem = {
  id: string;
  category:
    | "whale_trade"
    | "thesis_flag"
    | "crawler_failure"
    | "security_anomaly"
    | "market_volatility";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  entity_type: string;
  entity_id: string;
  occurred_at: string;
  status: "active" | "resolved" | "dismissed";
  resolved_at: string | null;
  resolved_by: string | null;
  action_suggested: string;
};

export type AdminAlertPage = {
  items: AdminAlertItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  active_count: number;
};

// Analytics types
export type TopTraderItem = {
  rank: number;
  user_id: string;
  user_name: string;
  user_email: string;
  nickname: string | null;
  starting_cash: number;
  cash_balance: number;
  realized_pnl: number;
  roi_percent: number;
  win_rate: number;
  total_trades: number;
  holdings_count: number;
};

export type ExchangeLiquidityItem = {
  exchange: string;
  total_symbols: number;
  total_value_vnd: number;
  share_percent: number;
};

export type AssetAllocationSummary = {
  total_cash_vnd: number;
  total_equity_vnd: number;
  cash_share_percent: number;
  equity_share_percent: number;
};

export type SectorThesisItem = {
  sector: string;
  theses_count: number;
  win_rate: number;
  bullish_count: number;
  bearish_count: number;
};

export type AdminAnalyticsResponse = {
  generated_at: string;
  top_traders: TopTraderItem[];
  exchange_liquidity: ExchangeLiquidityItem[];
  asset_allocation: AssetAllocationSummary;
  sector_theses: SectorThesisItem[];
  total_capital_deployed_vnd: number;
  average_portfolio_roi: number;
};

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let session;
  try {
    session = await authenticatedSession();
  } catch {
    redirect("/login");
  }
  const base = resolveApiBase();
  const response = await fetch(`${base}/v1/admin${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-BFF-Secret": process.env.AUTH_BFF_SECRET ?? "",
      Authorization: `Bearer ${session.value.credentials.access_token}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string }; detail?: string }
      | null;
    throw new Error(
      body?.error?.message ??
        body?.detail ??
        `Yêu cầu quản trị thất bại (${response.status})`
    );
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }
  return response.json() as Promise<T>;
}

export function getAdminOverview(refresh = false) {
  return adminFetch<AdminOverviewData>(`/overview?refresh=${refresh}`);
}

export function invalidateAdminCache() {
  return adminFetch<{ status: string; message: string }>("/cache/invalidate", {
    method: "POST",
  });
}

export function getAdminTheses(params: {
  symbol?: string;
  status?: string;
  stance?: string;
  q?: string;
  limit?: number;
  page?: number;
}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== "") {
      query.set(key, String(val));
    }
  }
  return adminFetch<AdminThesisPage>(`/theses?${query.toString()}`);
}

export function getAdminThesisDetail(id: string) {
  return adminFetch<AdminThesisItem>(`/theses/${encodeURIComponent(id)}`);
}

export function updateAdminThesis(
  id: string,
  payload: { status?: string; note?: string }
) {
  return adminFetch<AdminThesisItem>(`/theses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminThesis(id: string) {
  return adminFetch<void>(`/theses/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function getAdminPortfolios(params: {
  q?: string;
  limit?: number;
  page?: number;
}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== "") {
      query.set(key, String(val));
    }
  }
  return adminFetch<AdminPortfolioPage>(`/portfolios?${query.toString()}`);
}

export function getAdminPortfolioDetail(id: string) {
  return adminFetch<AdminPortfolioDetail>(`/portfolios/${encodeURIComponent(id)}`);
}

export function getAdminAuditLogs(params: {
  category?: string;
  outcome?: string;
  limit?: number;
  page?: number;
}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== "") {
      query.set(key, String(val));
    }
  }
  return adminFetch<AdminAuditLogPage>(`/audit-logs?${query.toString()}`);
}

export function getAdminAuditLogDetail(id: string) {
  return adminFetch<AdminAuditLogItem>(`/audit-logs/${encodeURIComponent(id)}`);
}

// Market Instruments
export function getAdminMarketInstruments(params: {
  symbol?: string;
  exchange?: string;
  sector?: string;
  status?: string;
  limit?: number;
  page?: number;
}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== "") {
      query.set(key, String(val));
    }
  }
  return adminFetch<AdminMarketInstrumentPage>(`/market/instruments?${query.toString()}`);
}

export function updateAdminMarketInstrument(
  symbol: string,
  payload: { trading_status?: string; paper_trading_enabled?: boolean }
) {
  return adminFetch<AdminMarketInstrumentItem>(
    `/market/instruments/${encodeURIComponent(symbol)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

// Risk & Security Alerts
export function getAdminAlerts(params: {
  severity?: string;
  status?: string;
  category?: string;
  limit?: number;
  page?: number;
}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== "") {
      query.set(key, String(val));
    }
  }
  return adminFetch<AdminAlertPage>(`/alerts?${query.toString()}`);
}

export function updateAdminAlert(
  alertId: string,
  payload: { status: "resolved" | "dismissed"; note?: string }
) {
  return adminFetch<{ status: string; alert_id: string; new_status: string }>(
    `/alerts/${encodeURIComponent(alertId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

// Analytics
export function getAdminAnalytics() {
  return adminFetch<AdminAnalyticsResponse>("/analytics");
}
