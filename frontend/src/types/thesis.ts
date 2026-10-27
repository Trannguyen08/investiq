export type InvestmentThesisItem = {
  id: string;
  user_id: string;
  author_name: string;
  symbol: string;
  stance: "bullish" | "bearish" | "neutral";
  entry_price: string;
  target_price: string;
  stop_loss_price: string;
  current_price: string;
  progress_percent: string;
  horizon_months: number;
  title: string;
  thesis_body: string;
  catalysts: string[];
  status: "active" | "hit_target" | "stopped_out" | "expired";
  outcome_roi: string | null;
  closed_at: string | null;
  closed_price: string | null;
  upvotes: number;
  created_at: string;
  updated_at: string;
};

export type AnalystReputationItem = {
  user_id: string;
  author_name: string;
  total_theses: number;
  active_theses: number;
  successful_theses: number;
  stopped_theses: number;
  win_rate_percent: string;
  avg_roi_percent: string;
  rank_tier: string;
};

export type SocialLeaderboardItem = {
  portfolio_id: string;
  nickname: string;
  starting_cash: string;
  cash_balance: string;
  realized_pnl: string;
  roi_percent: string;
  roi_number: number;
  holding_count: number;
  total_trades: number;
  win_trades: number;
};

export type PublicHoldingItem = {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  quantity: number;
  current_price: string;
  cost_basis: string;
  market_value: string;
  unrealized_pnl: string;
  roi_percent: string;
};

export type PublicPortfolioDetailData = {
  id: string;
  nickname: string;
  starting_cash: string;
  cash_balance: string;
  total_assets: string;
  realized_pnl: string;
  roi_percent: string;
  holdings: PublicHoldingItem[];
  trades: Array<{
    id: string;
    side: string;
    symbol: string;
    name: string;
    exchange: string;
    quantity: number;
    execution_price: string;
    gross_amount: string;
    cash_effect: string;
    realized_pnl: string | null;
    created_at: string;
  }>;
};

export type CreateThesisPayload = {
  symbol: string;
  stance: "bullish" | "bearish" | "neutral";
  target_price: number;
  stop_loss_price: number;
  horizon_months: number;
  title: string;
  thesis_body: string;
  catalysts: string[];
};
