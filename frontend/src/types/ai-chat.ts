export type StockScores = {
  valuation: number;
  financial_health: number;
  growth: number;
  technical: number;
  cashflow: number;
};

export type StockScoreCardWidgetData = {
  symbol: string;
  name: string;
  current_price: number;
  change_percent: number;
  pe?: number | null;
  pb?: number | null;
  roe_percent?: number | null;
  scores: StockScores;
  verdict: "TÍCH CỰC" | "THEO DÕI" | "THẬN TRỌNG";
  key_support?: number | null;
  key_resistance?: number | null;
  analysis_points: string[];
};

export type StockComparisonItem = {
  symbol: string;
  name: string;
  price: number | string;
  change_percent: string;
  pe?: string | null;
  pb?: string | null;
  roe?: string | null;
  pros: string[];
  cons: string[];
  health_status?: "expanding" | "stable" | "accumulating" | "cautious" | null;
  health_title?: string | null;
  health_summary?: string | null;
  market_cap_growth_1m?: string | null;
  market_cap_growth_3m?: string | null;
  market_cap_growth_6m?: string | null;
  market_cap_growth_1y?: string | null;
  revenue_growth_yoy?: string | null;
  profit_growth_yoy?: string | null;
  revenue_ttm?: string | null;
  profit_ttm?: string | null;
  volume_growth_20d?: string | null;
  growth_insights?: string[];
};

export type StockComparisonWidgetData = {
  title: string;
  mode?: "metrics" | "growth" | "both";
  items: StockComparisonItem[];
  summary_verdict: string;
};

export type RedFlagItem = {
  level: "warning" | "danger" | "info";
  title: string;
  detail: string;
};

export type ForensicWarningWidgetData = {
  symbol: string;
  altman_z_score: number;
  zone: "safe" | "grey" | "distress";
  flags: RedFlagItem[];
};

export type MarketPulseWidgetData = {
  vnindex: number;
  change_percent: number;
  advances: number;
  declines: number;
  liquidity_trillion: number;
};

export type SuggestedAction = {
  label: string;
  action_type: "NAVIGATE" | "OPEN_MODAL" | "TRADE_ORDER" | "SEND_PROMPT";
  url?: string | null;
  modal_type?: string | null;
  symbol?: string | null;
  prompt?: string | null;
  quantity?: number | null;
};

export type AiWidget =
  | { type: "stock_score_card"; data: StockScoreCardWidgetData }
  | { type: "stock_comparison"; data: StockComparisonWidgetData }
  | { type: "forensic_warning"; data: ForensicWarningWidgetData }
  | { type: "market_pulse"; data: MarketPulseWidgetData };

export type AiSource = {
  kind: "internal" | "external";
  title: string;
  url: string;
};

export type AiEvaluation = {
  score: number;
  checks: Record<string, boolean>;
};

export type AiMessage = {
  id: string;
  conversation_id?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  widgets?: AiWidget[];
  suggested_actions?: SuggestedAction[];
  sources?: AiSource[];
  evaluation?: AiEvaluation;
  is_cached?: boolean;
  created_at: string;
};

export type AiConversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

export type AiChatResponse = {
  conversation_id: string;
  message: AiMessage;
};
