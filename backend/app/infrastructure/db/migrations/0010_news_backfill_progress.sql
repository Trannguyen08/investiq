CREATE TABLE news_backfill_progress (
    start_day date NOT NULL,
    end_day date NOT NULL,
    next_page integer NOT NULL CHECK (next_page BETWEEN 1 AND 151),
    status varchar(16) NOT NULL CHECK (status IN ('running', 'complete')),
    lease_until timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (start_day, end_day),
    CHECK (end_day >= start_day),
    CHECK (end_day - start_day <= 90)
);
