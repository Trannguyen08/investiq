ALTER TABLE auth_audit_events
    ADD COLUMN details jsonb NOT NULL DEFAULT '{}'::jsonb;
