CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(320) NOT NULL UNIQUE,
    display_name varchar(80) NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 80),
    password_hash text,
    role varchar(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    email_verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider varchar(30) NOT NULL CHECK (provider IN ('password', 'google')),
    provider_subject varchar(255),
    provider_display_name varchar(120),
    avatar_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_subject),
    UNIQUE (user_id, provider)
);

CREATE TABLE auth_challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pre_auth_id uuid NOT NULL,
    purpose varchar(30) NOT NULL CHECK (purpose IN ('registration', 'password_reset')),
    email varchar(320) NOT NULL,
    display_name varchar(80),
    password_hash text,
    otp_digest char(64) NOT NULL,
    deliverable boolean NOT NULL DEFAULT true,
    generation integer NOT NULL DEFAULT 1 CHECK (generation > 0),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    expires_at timestamptz NOT NULL,
    resend_available_at timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_challenges_lookup_idx ON auth_challenges (id, pre_auth_id, purpose);
CREATE INDEX auth_challenges_cleanup_idx ON auth_challenges (expires_at);

CREATE TABLE auth_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider varchar(30) NOT NULL CHECK (provider IN ('password', 'google')),
    remember_session boolean NOT NULL,
    idle_expires_at timestamptz NOT NULL,
    absolute_expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_active_idx ON auth_sessions (user_id, revoked_at);

CREATE TABLE refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
    token_hash char(64) NOT NULL UNIQUE,
    parent_id uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_session_idx ON refresh_tokens (session_id);

CREATE TABLE password_reset_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id uuid NOT NULL REFERENCES auth_challenges(id) ON DELETE CASCADE,
    grant_hash char(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_email_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id uuid REFERENCES auth_challenges(id) ON DELETE CASCADE,
    template varchar(40) NOT NULL CHECK (template IN ('registration_otp', 'password_reset_otp', 'registration_success', 'password_changed')),
    encrypted_payload text NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
    attempts integer NOT NULL DEFAULT 0,
    available_at timestamptz NOT NULL DEFAULT now(),
    deadline_at timestamptz NOT NULL,
    locked_until timestamptz,
    provider_message_id text,
    last_error_category varchar(40),
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz
);
CREATE INDEX auth_email_jobs_dispatch_idx ON auth_email_jobs (status, available_at, deadline_at);
CREATE INDEX auth_email_jobs_challenge_idx ON auth_email_jobs (challenge_id, created_at DESC);

CREATE TABLE auth_audit_events (
    id bigserial PRIMARY KEY,
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    event_type varchar(60) NOT NULL,
    outcome varchar(20) NOT NULL,
    request_id varchar(128),
    occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_audit_events_time_idx ON auth_audit_events (occurred_at DESC);
