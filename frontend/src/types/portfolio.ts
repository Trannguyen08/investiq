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
  is_public?: boolean;
  nickname?: string | null;
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
export type PaperOrderTypeCode = "LO" | "MP" | "ATO" | "ATC";
export type PaperExecutionMode = "instant" | "exchange_hours";

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

export type PaperPendingBuySettlement = {
  trade_id: string;
  symbol: string;
  quantity: number;
  execution_price: string;
  trade_at: string;
  settles_at: string;
  cycle: string;
};

export type PaperPendingSellSettlement = {
  trade_id: string;
  symbol: string;
  quantity: number;
  net_proceeds: string;
  trade_at: string;
  settles_at: string;
  days_remaining: number;
};

export type PaperT2SettlementSummary = {
  cycle_rule: string;
  advance_fee_rate_per_day: string;
  pending_buy_shares_by_symbol: Record<string, number>;
  pending_buy_settlements: PaperPendingBuySettlement[];
  pending_sell_settlements: PaperPendingSellSettlement[];
  receivable_cash_t2: string;
  gross_receivable_cash_t2?: string;
  already_advanced_cash: string;
  advanceable_cash: string;
  estimated_advance_fee: string;
  net_advance_available: string;
  recent_advances: {
    id: string;
    gross_amount: string;
    fee_amount: string;
    net_received: string;
    days_advanced: number;
    created_at: string;
  }[];
};

export type PaperConditionalTrigger = {
  id: string;
  symbol: string;
  stop_loss_price: string | null;
  take_profit_price: string | null;
  quantity: number | null;
  status: "active" | "triggered" | "cancelled";
  trigger_reason: string | null;
  triggered_trade_id: string | null;
  created_at: string;
  triggered_at: string | null;
};

export type PaperOrderExtendedMeta = {
  display_order_type: PaperOrderTypeCode;
  lot_type: "even" | "odd" | "mixed";
  slippage_vnd: string;
  slippage_bps: string;
  quarantine_until: string | null;
  pending_reason: string | null;
  stop_loss_price: string | null;
  take_profit_price: string | null;
};

export type PaperExchangeSimulation = {
  execution_mode: PaperExecutionMode;
  session_active: boolean;
  session_message: string;
  supported_order_types: PaperOrderTypeCode[];
  price_bands: Record<string, string>;
  t2_settlement: PaperT2SettlementSummary;
  conditional_triggers: PaperConditionalTrigger[];
  order_meta: Record<string, PaperOrderExtendedMeta>;
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
  exchange_simulation?: PaperExchangeSimulation;
};

export type PositivePaperNews = {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string | null;
  symbols: string[];
};
