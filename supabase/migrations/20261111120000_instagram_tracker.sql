-- Instagram follower tracker.
-- Counts come from the official Instagram Graph API (Business Discovery), so only
-- public Business/Creator accounts can be tracked automatically. Manual snapshots
-- are supported for everything else.
-- All tables are server-only: RLS on with no policies (service role bypasses RLS).

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE CHECK (username = lower(username) AND username ~ '^[a-z0-9._]{1,30}$'),
  display_name text,
  profile_picture_url text,
  is_active boolean NOT NULL DEFAULT true,
  check_interval_hours integer NOT NULL DEFAULT 6 CHECK (check_interval_hours BETWEEN 1 AND 168),
  followers_count integer,
  follows_count integer,
  media_count integer,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  next_check_at timestamptz NOT NULL DEFAULT now(),
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_error text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instagram_accounts_due_idx ON instagram_accounts (next_check_at) WHERE is_active;

CREATE TABLE IF NOT EXISTS instagram_snapshots (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  followers_count integer NOT NULL,
  follows_count integer,
  media_count integer,
  source text NOT NULL DEFAULT 'api' CHECK (source IN ('api', 'manual')),
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instagram_snapshots_account_time_idx ON instagram_snapshots (account_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS instagram_fetch_log (
  id bigserial PRIMARY KEY,
  account_id uuid REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  username text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'rate_limited', 'not_found', 'auth_error')),
  trigger text NOT NULL DEFAULT 'cron' CHECK (trigger IN ('cron', 'manual')),
  followers_count integer,
  error_code text,
  message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instagram_fetch_log_time_idx ON instagram_fetch_log (created_at DESC);
CREATE INDEX IF NOT EXISTS instagram_fetch_log_account_idx ON instagram_fetch_log (account_id, created_at DESC);

-- Single-row state: run lock, global back-off after rate limits, token health.
CREATE TABLE IF NOT EXISTS instagram_tracker_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  lock_until timestamptz,
  locked_by text,
  rate_limited_until timestamptz,
  token_error text,
  last_run_at timestamptz,
  last_run_summary jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO instagram_tracker_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Atomic run lock so overlapping cron runs (or cron + "Check now") never double-fetch.
CREATE OR REPLACE FUNCTION instagram_tracker_acquire_lock(p_owner text, p_seconds integer)
RETURNS boolean
LANGUAGE sql
AS $$
  UPDATE instagram_tracker_state
     SET lock_until = now() + make_interval(secs => p_seconds), locked_by = p_owner, updated_at = now()
   WHERE id = 1 AND (lock_until IS NULL OR lock_until < now())
  RETURNING true;
$$;

CREATE OR REPLACE FUNCTION instagram_tracker_release_lock(p_owner text)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE instagram_tracker_state SET lock_until = NULL, locked_by = NULL, updated_at = now()
   WHERE id = 1 AND locked_by = p_owner;
$$;

REVOKE ALL ON FUNCTION instagram_tracker_acquire_lock(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION instagram_tracker_release_lock(text) FROM PUBLIC, anon, authenticated;

ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_fetch_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_tracker_state ENABLE ROW LEVEL SECURITY;
