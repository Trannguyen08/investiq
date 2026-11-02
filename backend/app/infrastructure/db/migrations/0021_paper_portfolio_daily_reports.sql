-- 0021_paper_portfolio_daily_reports.sql
-- Subscriptions for automated daily paper portfolio performance reports and AI feedback

CREATE TABLE IF NOT EXISTS paper_portfolio_daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(120) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_sent_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paper_daily_reports_active ON paper_portfolio_daily_reports (is_active);
CREATE INDEX IF NOT EXISTS idx_paper_daily_reports_user ON paper_portfolio_daily_reports (user_id);

