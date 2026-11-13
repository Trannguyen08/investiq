CREATE TABLE IF NOT EXISTS financial_statements (
    symbol VARCHAR(20) NOT NULL,
    period_type VARCHAR(10) NOT NULL, -- 'quarter' or 'year'
    periods JSONB NOT NULL,
    charts JSONB NOT NULL,
    income_statement JSONB NOT NULL,
    balance_sheet JSONB NOT NULL,
    cash_flow JSONB NOT NULL,
    source VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (symbol, period_type)
);

CREATE INDEX IF NOT EXISTS idx_financial_statements_symbol ON financial_statements(symbol);
CREATE INDEX IF NOT EXISTS idx_financial_statements_updated_at ON financial_statements(updated_at DESC);
