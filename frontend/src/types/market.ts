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
