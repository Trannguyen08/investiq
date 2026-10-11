CREATE TABLE paper_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id uuid NOT NULL REFERENCES paper_portfolios(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL REFERENCES market_instruments(id) ON DELETE RESTRICT,
    idempotency_key varchar(128) NOT NULL,
    side varchar(4) NOT NULL CHECK (side IN ('buy', 'sell')),
    order_type varchar(8) NOT NULL CHECK (order_type = 'LO'),
    status varchar(24) NOT NULL
        CHECK (status IN ('pending', 'open', 'filled', 'cancelled', 'rejected', 'expired')),
    symbol varchar(24) NOT NULL,
    instrument_name varchar(240) NOT NULL,
    exchange varchar(20) NOT NULL,
    quantity bigint NOT NULL CHECK (quantity > 0),
    filled_quantity bigint NOT NULL DEFAULT 0
        CHECK (filled_quantity >= 0 AND filled_quantity <= quantity),
    limit_price numeric(24, 8) NOT NULL CHECK (limit_price > 0),
    reserved_cash numeric(24, 0) NOT NULL DEFAULT 0 CHECK (reserved_cash >= 0),
    reserved_quantity bigint NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    provider varchar(80) NOT NULL,
    price_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL,
    delay_class varchar(40) NOT NULL,
    expires_at timestamptz NOT NULL,
    cancelled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (portfolio_id, idempotency_key),
    CHECK ((status IN ('pending', 'open') AND (
              (side = 'buy' AND reserved_cash > 0 AND reserved_quantity = 0)
              OR (side = 'sell' AND reserved_cash = 0 AND reserved_quantity = quantity)
          )) OR (status IN ('filled', 'cancelled', 'rejected', 'expired')
              AND reserved_cash = 0 AND reserved_quantity = 0)),
    CHECK ((status = 'filled' AND filled_quantity = quantity)
        OR (status <> 'filled' AND filled_quantity = 0)),
    CHECK ((status = 'cancelled' AND cancelled_at IS NOT NULL)
        OR (status <> 'cancelled' AND cancelled_at IS NULL))
);

CREATE INDEX paper_orders_portfolio_status_time_idx
    ON paper_orders (portfolio_id, status, created_at DESC, id DESC);

ALTER TABLE paper_trades
    ADD COLUMN order_id uuid REFERENCES paper_orders(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX paper_trades_order_idx
    ON paper_trades (order_id) WHERE order_id IS NOT NULL;
