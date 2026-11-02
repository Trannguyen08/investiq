export type MarketMeta = {
  schema_version: string;
  provider: string;
  provider_name: string;
  market_time: string;
  received_at: string;
  delay_class: string;
  freshness: "fresh" | "stale" | "fixture";
  session: string;
  partial: boolean;
  market_timezone: string;
};

export type MarketCandle = {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
};

export type MarketIntradayTrade = {
  timestamp: string;
  price: string;
  volume: string;
  match_side: "buy" | "sell" | "ato" | "atc" | "unknown";
  change: string | null;
  change_percent: string | null;
};

export type MarketDepthLevel = {
  price: string;
  volume: string;
};

export type MarketInstrument = {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  price: string;
  reference_price: string;
  ceiling_price: string;
  floor_price: string;
  open_price: string;
  high_price: string;
  low_price: string;
  change: string;
  change_percent: string;
  volume: string;
  matched_value: string;
  foreign_net_value: string;
  market_cap: string;
  pe: string | null;
  pb: string | null;
  eps: string | null;
  roe_percent: string | null;
  volume_vs_20d: string;
  interest_score: string;
  interest_reasons: string[];
  is_vn30: boolean;
  candles: MarketCandle[];
  bid_levels?: MarketDepthLevel[];
  ask_levels?: MarketDepthLevel[];
};

export type MarketIndex = {
  symbol: string;
  name: string;
  value: string;
  reference_value: string;
  open_value: string;
  high_value: string;
  low_value: string;
  change: string;
  change_percent: string;
  volume: string;
  matched_value: string;
  advances: number;
  declines: number;
  unchanged: number;
  ceiling_count: number;
  floor_count: number;
  candles: MarketCandle[];
};

export type MarketEvent = {
  id: string;
  symbol: string;
  event_type: string;
  title: string;
  summary: string;
  date_type: string;
  event_at: string;
  status: "official" | "expected" | "cancelled";
  source_name: string;
  source_url: string | null;
};

export type MarketPerson = {
  id: string;
  rank: number;
  full_name: string;
  initials: string;
  role: string;
  company: string;
  symbols: string[];
  sector: string;
  disclosed_shares: string;
  ownership_percent: string;
  estimated_listed_equity_value: string;
  daily_change_percent: string;
  holding_public_date: string;
  net_worth_total?: string | null;
  net_worth_external?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
};

export type MarketOverview = {
  data: {
    indices: MarketIndex[];
    trending: MarketInstrument[];
    breadth: {
      advances: number;
      declines: number;
      unchanged: number;
      ceiling_count: number;
      floor_count: number;
      matched_value: string;
    };
    upcoming_events: MarketEvent[];
  };
  meta: MarketMeta;
};

export type InstrumentCollection = {
  data: MarketInstrument[];
  pagination: {
    next_cursor: string | null;
    previous_cursor: string | null;
    has_more: boolean;
    limit: number;
    total_items: number;
    page: number;
    total_pages: number;
  };
  meta: MarketMeta;
};

export type MarketSector = {
  name: string;
  change_percent: string;
  member_count: number;
  advances: number;
  declines: number;
  unchanged: number;
  matched_value: string;
  foreign_net_value: string;
  market_cap: string;
};

export type SectorCollection = { data: MarketSector[]; meta: MarketMeta };

export type MarketCandles = {
  data: MarketCandle[];
  instrument: string;
  interval: string;
  adjusted: boolean;
  meta: MarketMeta;
};

export type MarketIntradayTrades = {
  data: MarketIntradayTrade[];
  instrument: string;
  meta: MarketMeta;
};

export type InstrumentEnvelope = { data: MarketInstrument; meta: MarketMeta };

export type IndexCollection = { data: MarketIndex[]; meta: MarketMeta };
export type EventCollection = { data: MarketEvent[]; meta: MarketMeta };
export type PeopleCollection = {
  data: MarketPerson[];
  meta: MarketMeta;
  methodology: { label: string; description: string; excludes: string[] };
};

export type WatchlistItem = {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  position: number;
  added_at: string;
};

export type Watchlist = {
  id: string;
  name: string;
  position: number;
  version: number;
  created_at: string;
  updated_at: string;
  items: WatchlistItem[];
};

export type QuarterlyGrowthPoint = {
  period: string;
  revenue_growth_yoy: string | null;
  profit_growth_yoy: string | null;
  roe: string | null;
  net_margin: string | null;
  gross_margin?: string | null;
  revenue_display?: string | null;
  profit_display?: string | null;
};

export type FinancialReportAnalysisItem = {
  title: string;
  summary: string;
  image_url?: string | null;
  source: string;
  published_at?: string | null;
  article_url?: string | null;
  category?: string | null;
  tag?: string | null;
};

export type StockGrowthData = {
  symbol: string;
  company_name: string;
  sector: string;
  health_status: "expanding" | "stable" | "accumulating" | "cautious";
  health_title: string;
  health_summary: string;
  market_cap: string;
  market_cap_growth_1m: string | null;
  market_cap_growth_3m: string | null;
  market_cap_growth_6m: string | null;
  market_cap_growth_1y: string | null;
  price_change_1m?: string | null;
  price_change_3m?: string | null;
  price_change_6m?: string | null;
  price_change_1y?: string | null;
  volume_growth_20d: string;
  volume_20d_avg?: string | null;
  latest_volume?: string | null;
  pe: string | null;
  pb: string | null;
  eps: string | null;
  bvps?: string | null;
  roe_percent: string | null;
  roa_percent?: string | null;
  gross_margin_percent?: string | null;
  net_margin_percent?: string | null;
  current_ratio?: string | null;
  debt_to_equity?: string | null;
  revenue_ttm?: string | null;
  profit_ttm?: string | null;
  ebitda?: string | null;
  quarters: QuarterlyGrowthPoint[];
  financial_reports?: FinancialReportAnalysisItem[];
  insights: string[];
};


export type StockGrowthEnvelope = {
  data: StockGrowthData;
  meta: MarketMeta;
};

export type ForensicRedFlag = {
  flag_id: string;
  name: string;
  severity: "high" | "medium" | "low" | "clean";
  title: string;
  description: string;
  indicator_value: string;
  threshold: string;
  implication: string;
};

export type FinancialForensicsData = {
  symbol: string;
  z_score: string;
  z_zone: "safe" | "grey" | "distress";
  z_label: string;
  health_score: number;
  red_flags: ForensicRedFlag[];
  risk_summary: string;
  recommendation: string;
  is_finance?: boolean;
};

export type FinancialForensicsEnvelope = {
  data: FinancialForensicsData;
  meta: MarketMeta;
};

export type EcosystemTicker = {
  symbol: string;
  price: string;
  change_percent: string;
  market_cap: string;
};

export type EcosystemSummary = {
  id: string;
  name: string;
  founder_id: string;
  founder_name: string;
  sector: string;
  overview: string;
  core_tickers: EcosystemTicker[];
  total_market_cap: string;
  node_count: number;
  link_count: number;
};

export type EcosystemNode = {
  id: string;
  name: string;
  ticker: string | null;
  node_type: "parent" | "listed_subsidiary" | "unlisted_subsidiary" | "strategic_partner";
  role: string;
  ownership_percent: string;
  exchange: string;
  description: string;
  price?: string | null;
  change_percent?: string | null;
  market_cap?: string | null;
};

export type EcosystemLink = {
  source: string;
  target: string;
  relation_type: string;
  percentage: string;
  label: string;
};

export type EcosystemDetailData = {
  id: string;
  name: string;
  founder_id: string;
  founder_name: string;
  sector: string;
  overview: string;
  nodes: EcosystemNode[];
  links: EcosystemLink[];
};

export type EcosystemDetailEnvelope = {
  data: EcosystemDetailData;
  meta: MarketMeta;
};

export type DCATimelinePoint = {
  month: number;
  label: string;
  price: string;
  shares_bought: number;
  total_shares: number;
  invested: string;
  portfolio_value: string;
  savings_value: string;
};

export type DCASimulatorData = {
  symbol: string;
  duration_years: number;
  duration_months: number;
  monthly_amount: string;
  total_invested: string;
  total_shares: number;
  average_buy_price: string;
  current_price: string;
  portfolio_value: string;
  stock_profit: string;
  stock_roi_percent: string;
  savings_rate_percent: string;
  savings_value: string;
  savings_profit: string;
  savings_roi_percent: string;
  alpha_amount: string;
  alpha_percent: string;
  outperformed: boolean;
  timeline: DCATimelinePoint[];
};

export type DCASimulatorEnvelope = {
  data: DCASimulatorData;
  meta: MarketMeta;
};

export type DailyDigestData = {
  date: string;
  headline: string;
  tone: "positive" | "cautious";
  session_summary: {
    vnindex_value: string;
    vnindex_change: string;
    is_positive: boolean;
    liquidity: string;
    breadth: {
      advances: number;
      declines: number;
      unchanged: number;
    };
  };
  key_drivers: string[];
  gainers: Array<{
    symbol: string;
    price: string;
    change_pct: string;
    sector: string;
  }>;
  volume_breakouts: Array<{
    symbol: string;
    surge_label: string;
    price: string;
    change_pct: string;
    sector: string;
  }>;
  upcoming_events: Array<{
    symbol: string;
    title: string;
    event_type: string;
    date: string;
  }>;
  meta: {
    generated_at: string;
    source: string;
  };
};

export type DailyDigestEnvelope = {
  data: DailyDigestData;
  meta: MarketMeta;
};


export type DividendItem = {
  id: string;
  symbol: string;
  event_date: string;
  ex_date: string | null;
  record_date: string | null;
  payout_date: string | null;
  type: "cash" | "stock" | "bonus" | "issuance" | "other" | string;
  ratio: string | null;
  cash_value: number | null;
  title: string;
  source: string;
};

export type DividendSummary = {
  symbol: string;
  dividend_yield_percent: number | null;
  frequency: string;
  latest_event_date: string | null;
  latest_payout_ratio: string | null;
  primary_type: string;
  total_events: number;
};

export type SymbolDividendsData = {
  symbol: string;
  summary: DividendSummary;
  events: DividendItem[];
};

export type SymbolDividendsEnvelope = {
  data: SymbolDividendsData;
  meta: MarketMeta;
};

export type DividendCalendarData = {
  total: number;
  events: DividendItem[];
};

export type DividendCalendarEnvelope = {
  data: DividendCalendarData;
  meta: MarketMeta;
};

export type FinancialChartItem = {
  period: string;
  revenue_billion: number | null;
  gross_profit_billion: number | null;
  net_profit_billion: number | null;
  gross_margin_percent: number | null;
  net_margin_percent: number | null;
  total_assets_billion: number | null;
  total_debt_billion: number | null;
  equity_billion: number | null;
};

export type FinancialMetricItem = {
  code: string;
  name: string;
  values: Array<number | null>;
};

export type FinancialStatementsData = {
  symbol: string;
  period_type: "quarter" | "year" | string;
  periods: string[];
  charts: FinancialChartItem[];
  income_statement: FinancialMetricItem[];
  balance_sheet: FinancialMetricItem[];
  cash_flow: FinancialMetricItem[];
  source: string;
};

export type FinancialStatementsEnvelope = {
  data: FinancialStatementsData;
  meta: MarketMeta;
};
