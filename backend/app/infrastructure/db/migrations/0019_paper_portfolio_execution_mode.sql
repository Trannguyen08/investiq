ALTER TABLE paper_portfolios
ADD COLUMN IF NOT EXISTS execution_mode varchar(32) NOT NULL DEFAULT 'instant';
