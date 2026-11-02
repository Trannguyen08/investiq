-- Migration 0020: Event and Dividend Email Reminders
CREATE TABLE IF NOT EXISTS event_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    event_id VARCHAR(120) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    event_title VARCHAR(500) NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    event_at TIMESTAMPTZ NOT NULL,
    days_before INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_reminders_status_event_at ON event_reminders(status, event_at);
CREATE INDEX IF NOT EXISTS idx_event_reminders_email_event_id ON event_reminders(email, event_id);

