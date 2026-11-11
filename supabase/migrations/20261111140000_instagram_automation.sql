-- Instagram inbox sync + auto replies (DMs and comments).
-- Uses the official Graph API (instagram_manage_messages / instagram_manage_comments).
-- Replies come from admin-saved templates — fixed or picked at random. No AI.
-- All tables are server-only: RLS on, no policies.

-- Settings + runtime status (single row).
CREATE TABLE IF NOT EXISTS instagram_automation (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  dm_enabled boolean NOT NULL DEFAULT false,
  dm_enabled_at timestamptz,
  dm_mode text NOT NULL DEFAULT 'random' CHECK (dm_mode IN ('fixed', 'random')),
  -- 0 = answer every new message; otherwise at most one auto reply per person per N hours.
  dm_cooldown_hours integer NOT NULL DEFAULT 12 CHECK (dm_cooldown_hours BETWEEN 0 AND 720),
  comment_enabled boolean NOT NULL DEFAULT false,
  comment_enabled_at timestamptz,
  comment_mode text NOT NULL DEFAULT 'random' CHECK (comment_mode IN ('fixed', 'random')),
  -- Also send the commenter a private DM (Instagram "private reply").
  comment_dm_enabled boolean NOT NULL DEFAULT false,
  comment_posts_to_watch integer NOT NULL DEFAULT 10 CHECK (comment_posts_to_watch BETWEEN 1 AND 25),
  last_sync_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  paused_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO instagram_automation (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS instagram_reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('dm', 'comment')),
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 1000),
  is_active boolean NOT NULL DEFAULT true,
  -- The reply used when mode = 'fixed'.
  pinned boolean NOT NULL DEFAULT false,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instagram_reply_templates_kind_idx ON instagram_reply_templates (kind, is_active);

-- Every DM seen while syncing (inbound and outbound).
CREATE TABLE IF NOT EXISTS instagram_dm_messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  user_id text,           -- the other person (sender for 'in', recipient for 'out')
  username text,
  text text,
  has_attachment boolean NOT NULL DEFAULT false,
  is_auto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS instagram_dm_messages_time_idx ON instagram_dm_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS instagram_dm_messages_conv_idx ON instagram_dm_messages (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS instagram_comments (
  id text PRIMARY KEY,
  media_id text NOT NULL,
  media_permalink text,
  user_id text,
  username text,
  text text,
  created_at timestamptz NOT NULL,
  replied boolean NOT NULL DEFAULT false,
  reply_source text CHECK (reply_source IN ('auto', 'manual')),
  reply_text text,
  replied_at timestamptz,
  dm_sent boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS instagram_comments_time_idx ON instagram_comments (created_at DESC);
CREATE INDEX IF NOT EXISTS instagram_comments_pending_idx ON instagram_comments (created_at) WHERE NOT replied;

-- Every auto reply attempt.
CREATE TABLE IF NOT EXISTS instagram_auto_replies (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('dm', 'comment', 'comment_dm')),
  target_id text NOT NULL,       -- message id or comment id answered
  recipient_id text,
  recipient text,
  template_id uuid REFERENCES instagram_reply_templates(id) ON DELETE SET NULL,
  text text,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instagram_auto_replies_time_idx ON instagram_auto_replies (created_at DESC);
CREATE INDEX IF NOT EXISTS instagram_auto_replies_target_idx ON instagram_auto_replies (kind, target_id);
CREATE INDEX IF NOT EXISTS instagram_auto_replies_recipient_idx ON instagram_auto_replies (kind, recipient_id, created_at DESC);

-- Named run locks (follower tracker uses its own; this is for the inbox sync).
CREATE TABLE IF NOT EXISTS instagram_locks (
  name text PRIMARY KEY,
  owner text,
  lock_until timestamptz
);

CREATE OR REPLACE FUNCTION instagram_try_lock(p_name text, p_owner text, p_seconds integer)
RETURNS boolean
LANGUAGE sql
AS $$
  INSERT INTO instagram_locks (name, owner, lock_until)
  VALUES (p_name, p_owner, now() + make_interval(secs => p_seconds))
  ON CONFLICT (name) DO UPDATE
     SET owner = EXCLUDED.owner, lock_until = EXCLUDED.lock_until
   WHERE instagram_locks.lock_until IS NULL OR instagram_locks.lock_until < now()
  RETURNING true;
$$;

CREATE OR REPLACE FUNCTION instagram_unlock(p_name text, p_owner text)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE instagram_locks SET lock_until = NULL, owner = NULL WHERE name = p_name AND owner = p_owner;
$$;

CREATE OR REPLACE FUNCTION instagram_template_used(p_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE instagram_reply_templates SET use_count = use_count + 1 WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION instagram_try_lock(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION instagram_unlock(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION instagram_template_used(uuid) FROM PUBLIC, anon, authenticated;

ALTER TABLE instagram_automation ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_auto_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_locks ENABLE ROW LEVEL SECURITY;
