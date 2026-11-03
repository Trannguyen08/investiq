-- Migration 0016: Community Theses & Social Paper Trading

ALTER TABLE paper_portfolios ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE paper_portfolios ADD COLUMN IF NOT EXISTS nickname varchar(80) NULL;

CREATE TABLE IF NOT EXISTS investment_theses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name varchar(120) NOT NULL,
    symbol varchar(24) NOT NULL,
    stance varchar(10) NOT NULL CHECK (stance IN ('bullish', 'bearish', 'neutral')),
    entry_price numeric(24, 4) NOT NULL CHECK (entry_price > 0),
    target_price numeric(24, 4) NOT NULL CHECK (target_price > 0),
    stop_loss_price numeric(24, 4) NOT NULL CHECK (stop_loss_price > 0),
    horizon_months integer NOT NULL CHECK (horizon_months IN (1, 3, 6, 12)),
    title varchar(240) NOT NULL,
    thesis_body text NOT NULL,
    catalysts text[] NOT NULL DEFAULT '{}',
    status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hit_target', 'stopped_out', 'expired')),
    outcome_roi numeric(8, 2) NULL,
    closed_at timestamptz NULL,
    closed_price numeric(24, 4) NULL,
    upvotes integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investment_theses_symbol_idx ON investment_theses (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS investment_theses_status_idx ON investment_theses (status, created_at DESC);
CREATE INDEX IF NOT EXISTS investment_theses_user_idx ON investment_theses (user_id, created_at DESC);
