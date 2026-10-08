CREATE TABLE market_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(80) NOT NULL UNIQUE,
    display_name varchar(160) NOT NULL,
    delay_class varchar(40) NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'disabled'
        CHECK (status IN ('active', 'degraded', 'disabled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market_instruments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol varchar(24) NOT NULL,
    exchange varchar(20) NOT NULL,
    name varchar(240) NOT NULL,
    instrument_type varchar(30) NOT NULL DEFAULT 'stock'
        CHECK (instrument_type IN ('stock', 'index')),
    sector varchar(120),
    currency char(3) NOT NULL DEFAULT 'VND',
    status varchar(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'delisted')),
    listed_at date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (exchange, symbol)
);
CREATE INDEX market_instruments_symbol_idx ON market_instruments (symbol, exchange);

CREATE TABLE market_price_candles (
    id bigserial PRIMARY KEY,
    provider_id uuid NOT NULL REFERENCES market_providers(id) ON DELETE RESTRICT,
    instrument_id uuid NOT NULL REFERENCES market_instruments(id) ON DELETE CASCADE,
    interval varchar(12) NOT NULL,
    open_time timestamptz NOT NULL,
    open_price numeric(24, 8) NOT NULL CHECK (open_price >= 0),
    high_price numeric(24, 8) NOT NULL CHECK (high_price >= 0),
    low_price numeric(24, 8) NOT NULL CHECK (low_price >= 0),
    close_price numeric(24, 8) NOT NULL CHECK (close_price >= 0),
    volume numeric(30, 4) NOT NULL DEFAULT 0 CHECK (volume >= 0),
    matched_value numeric(30, 2),
    adjusted boolean NOT NULL DEFAULT false,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    received_at timestamptz NOT NULL DEFAULT now(),
    CHECK (low_price <= open_price AND low_price <= close_price),
    CHECK (high_price >= open_price AND high_price >= close_price),
    UNIQUE (provider_id, instrument_id, interval, open_time, adjusted)
);
CREATE INDEX market_price_candles_read_idx
    ON market_price_candles (instrument_id, interval, adjusted, open_time DESC);

CREATE TABLE market_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id uuid REFERENCES market_instruments(id) ON DELETE SET NULL,
    provider_id uuid REFERENCES market_providers(id) ON DELETE RESTRICT,
    provider_event_id varchar(160),
    event_type varchar(60) NOT NULL,
    title varchar(300) NOT NULL,
    summary text,
    status varchar(30) NOT NULL CHECK (status IN ('official', 'expected', 'cancelled')),
    source_url text,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    source_updated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_id, provider_event_id)
);

CREATE TABLE market_event_dates (
    id bigserial PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES market_events(id) ON DELETE CASCADE,
    date_type varchar(60) NOT NULL,
    event_at timestamptz NOT NULL,
    market_date date NOT NULL,
    timezone varchar(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    UNIQUE (event_id, date_type, event_at)
);
CREATE INDEX market_event_dates_upcoming_idx ON market_event_dates (market_date, date_type);

CREATE TABLE market_people (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id uuid REFERENCES market_providers(id) ON DELETE RESTRICT,
    provider_person_id varchar(160),
    full_name varchar(200) NOT NULL,
    avatar_url text,
    source_updated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_id, provider_person_id)
);

CREATE TABLE market_person_roles (
    id bigserial PRIMARY KEY,
    person_id uuid NOT NULL REFERENCES market_people(id) ON DELETE CASCADE,
    instrument_id uuid REFERENCES market_instruments(id) ON DELETE SET NULL,
    organization_name varchar(240) NOT NULL,
    role_name varchar(200) NOT NULL,
    valid_from date,
    valid_to date,
    UNIQUE (person_id, organization_name, role_name, valid_from)
);

CREATE TABLE market_person_holding_snapshots (
    id bigserial PRIMARY KEY,
    person_id uuid NOT NULL REFERENCES market_people(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL REFERENCES market_instruments(id) ON DELETE CASCADE,
    direct_shares numeric(30, 4) NOT NULL CHECK (direct_shares >= 0),
    ownership_percent numeric(12, 6)
        CHECK (ownership_percent IS NULL OR ownership_percent BETWEEN 0 AND 100),
    public_date date NOT NULL,
    source_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (person_id, instrument_id, public_date)
);

CREATE TABLE watchlists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(80) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
    position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);
CREATE INDEX watchlists_user_position_idx ON watchlists (user_id, position, created_at);

CREATE TABLE watchlist_items (
    watchlist_id uuid NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL REFERENCES market_instruments(id) ON DELETE CASCADE,
    position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (watchlist_id, instrument_id)
);
CREATE INDEX watchlist_items_order_idx ON watchlist_items (watchlist_id, position, created_at);

CREATE TABLE market_view_preferences (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    view_key varchar(40) NOT NULL,
    preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, view_key),
    CHECK (jsonb_typeof(preferences) = 'object')
);

CREATE TABLE market_engagement_events (
    id uuid PRIMARY KEY,
    pseudonymous_session_hash char(64) NOT NULL,
    instrument_id uuid NOT NULL REFERENCES market_instruments(id) ON DELETE CASCADE,
    event_type varchar(40) NOT NULL
        CHECK (event_type IN ('symbol_view', 'symbol_search', 'news_open', 'watchlist_add')),
    occurred_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    rejected_as_automation boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_engagement_expiry_idx ON market_engagement_events (expires_at);
CREATE INDEX market_engagement_rank_idx
    ON market_engagement_events (instrument_id, event_type, occurred_at DESC)
    WHERE rejected_as_automation = false;

CREATE TABLE instrument_popularity_windows (
    instrument_id uuid NOT NULL REFERENCES market_instruments(id) ON DELETE CASCADE,
    window_key varchar(20) NOT NULL,
    window_ends_at timestamptz NOT NULL,
    score numeric(12, 6) NOT NULL,
    reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
    calculated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (instrument_id, window_key, window_ends_at),
    CHECK (jsonb_typeof(reason_codes) = 'array')
);
CREATE INDEX instrument_popularity_latest_idx
    ON instrument_popularity_windows (window_key, window_ends_at DESC, score DESC);

