CREATE TABLE paper_portfolios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    currency char(3) NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
    starting_cash numeric(24, 0) NOT NULL CHECK (starting_cash > 0),
    cash_balance numeric(24, 0) NOT NULL CHECK (cash_balance >= 0),
    realized_pnl numeric(24, 0) NOT NULL DEFAULT 0,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE paper_holdings (
    portfolio_id uuid NOT NULL REFERENCES paper_portfolios(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL REFERENCES market_instruments(id) ON DELETE RESTRICT,
    quantity bigint NOT NULL CHECK (quantity > 0),
    total_cost_basis numeric(24, 0) NOT NULL CHECK (total_cost_basis >= 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (portfolio_id, instrument_id)
);
CREATE INDEX paper_holdings_portfolio_idx ON paper_holdings (portfolio_id, updated_at DESC);

CREATE TABLE paper_trades (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id uuid NOT NULL REFERENCES paper_portfolios(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL REFERENCES market_instruments(id) ON DELETE RESTRICT,
    idempotency_key varchar(128) NOT NULL,
    side varchar(4) NOT NULL CHECK (side IN ('buy', 'sell')),
    symbol varchar(24) NOT NULL,
    instrument_name varchar(240) NOT NULL,
    exchange varchar(20) NOT NULL,
    quantity bigint NOT NULL CHECK (quantity > 0),
    execution_price numeric(24, 8) NOT NULL CHECK (execution_price > 0),
    gross_amount numeric(24, 0) NOT NULL CHECK (gross_amount > 0),
    fee_rate numeric(12, 8) NOT NULL CHECK (fee_rate >= 0 AND fee_rate <= 1),
    fee_amount numeric(24, 0) NOT NULL CHECK (fee_amount >= 0),
    tax_rate numeric(12, 8) NOT NULL CHECK (tax_rate >= 0 AND tax_rate <= 1),
    tax_amount numeric(24, 0) NOT NULL CHECK (tax_amount >= 0),
    cash_effect numeric(24, 0) NOT NULL,
    realized_pnl numeric(24, 0),
    provider varchar(80) NOT NULL,
    price_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL,
    delay_class varchar(40) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (portfolio_id, idempotency_key),
    CHECK ((side = 'buy' AND cash_effect < 0 AND tax_amount = 0 AND realized_pnl IS NULL)
        OR (side = 'sell' AND cash_effect > 0 AND realized_pnl IS NOT NULL))
);
CREATE INDEX paper_trades_portfolio_time_idx
    ON paper_trades (portfolio_id, created_at DESC, id DESC);

