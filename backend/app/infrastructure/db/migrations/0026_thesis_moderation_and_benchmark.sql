-- Migration 0026: Community Thesis Moderation Queue & VN-Index Benchmark Tracking

ALTER TABLE investment_theses
    ADD COLUMN IF NOT EXISTS entry_vnindex numeric(18, 4) NULL,
    ADD COLUMN IF NOT EXISTS benchmark_roi numeric(8, 2) NULL,
    ADD COLUMN IF NOT EXISTS moderation_status varchar(20) NOT NULL DEFAULT 'visible'
        CHECK (moderation_status IN ('visible', 'flagged', 'hidden'));

CREATE TABLE IF NOT EXISTS thesis_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thesis_id uuid NOT NULL REFERENCES investment_theses(id) ON DELETE CASCADE,
    reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason varchar(300) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'hidden', 'dismissed')),
    moderator_note varchar(500) NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz NULL,
    UNIQUE (thesis_id, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS thesis_reports_status_idx
    ON thesis_reports (status, created_at DESC);
