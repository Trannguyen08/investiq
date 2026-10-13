export type PaperAccount = {
  id: string;
  currency: "VND";
  starting_cash: string;
  cash_balance: string;
  available_cash: string;
  reserved_cash: string;
  invested_cost: string;
  market_value: string | null;
  total_value: string | null;
  realized_pnl: string;
  unrealized_pnl: string | null;
  total_pnl: string | null;
  total_return_percent: string | null;
  valuation_partial: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};

export type PaperPricePoint = { timestamp: string; close: string };

export type PaperHolding = {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  quantity: number;
  available_quantity: number;
  average_cost: string;
  total_cost_basis: string;
  current_price: string | null;
  market_value: string | null;
  unrealized_pnl: string | null;
  unrealized_pnl_percent: string | null;
  daily_change_percent: string | null;
  portfolio_weight_percent: string | null;
  price_history: PaperPricePoint[];
};

export type PaperTrade = {
  id: string;
  side: "buy" | "sell";
  symbol: string;
  name: string;
  exchange: string;
  quantity: number;
  execution_price: string;
  gross_amount: string;
  fee_amount: string;
  tax_amount: string;
  cash_effect: string;
  realized_pnl: string | null;
  provider: string;
  price_at: string;
  received_at: string;
  delay_class: string;
  created_at: string;
};

export type PaperOrderStatus = "pending" | "open" | "filled" | "cancelled" | "rejected" | "expired";

export type PaperOrder = {
  id: string;
  side: "buy" | "sell";
  order_type: "LO";
  status: PaperOrderStatus;
  symbol: string;
  name: string;
  exchange: string;
  quantity: number;
  filled_quantity: number;
  limit_price: string;
  reserved_cash: string;
  reserved_quantity: number;
  provider: string;
  price_at: string;
  received_at: string;
  delay_class: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  cancelled_at: string | null;
};

export type PaperNotice = {
  level: "info" | "warning";
  symbol: string;
  title: string;
  message: string;
};

export type PaperOpportunity = {
  symbol: string;
  name: string;
  price: string;
  change_percent: string;
  volume: string;
  matched_value: string;
  interest_reasons: string[];
};

export type PaperDashboard = {
  account: PaperAccount;
  holdings: PaperHolding[];
  orders: PaperOrder[];
  trades: PaperTrade[];
  equity_curve: { timestamp: string; value: string }[];
  equity_curve_method: "current_holdings_replay";
  notices: PaperNotice[];
  opportunities: PaperOpportunity[];
  assumptions: {
    starting_cash: string;
    broker_fee_rate: string;
    sell_tax_rate: string;
    fill_model: "automatic_latest_observed_price";
    max_holdings: number;
    disclaimer: string;
  };
  market: {
    provider: string;
    provider_name: string;
    market_time: string;
    received_at: string;
    delay_class: string;
    freshness: string;
    session: string;
    partial: boolean;
  };
};

export type PositivePaperNews = {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string | null;
  symbols: string[];
};
