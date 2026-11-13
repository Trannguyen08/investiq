-- 0024_paper_cash_advances.sql
CREATE TABLE IF NOT EXISTS paper_cash_advances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gross_amount numeric(24, 0) NOT NULL CHECK (gross_amount > 0),
    fee_amount numeric(24, 0) NOT NULL CHECK (fee_amount >= 0),
    net_received numeric(24, 0) NOT NULL CHECK (net_received > 0),
    days_advanced integer NOT NULL DEFAULT 2 CHECK (days_advanced > 0),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paper_cash_advances_user_idx ON paper_cash_advances (user_id, created_at DESC);
