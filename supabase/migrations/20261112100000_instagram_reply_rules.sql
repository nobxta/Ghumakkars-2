-- Instagram reply rules: WHEN (any / keywords, which posts, which hours) → SEND (rich replies).
-- Replies gain formats: plain text, text + link buttons, a card, or live trip cards,
-- plus optional quick-reply chips. Existing saved replies are moved into two default
-- rules so behaviour is unchanged.

CREATE TABLE IF NOT EXISTS instagram_reply_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('dm', 'comment')),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  trigger text NOT NULL DEFAULT 'any' CHECK (trigger IN ('any', 'keywords')),
  keywords text[] NOT NULL DEFAULT '{}',
  match_type text NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'exact')),
  media_ids text[] NOT NULL DEFAULT '{}',             -- comments: only these posts (empty = all watched)
  reply_mode text NOT NULL DEFAULT 'random' CHECK (reply_mode IN ('random', 'fixed')),
  cooldown_hours integer NOT NULL DEFAULT 12 CHECK (cooldown_hours BETWEEN 0 AND 720), -- DMs: per person, per rule
  send_dm boolean NOT NULL DEFAULT false,              -- comments: also DM the commenter
  active_from smallint CHECK (active_from BETWEEN 0 AND 23), -- IST hour; NULL = all day
  active_to smallint CHECK (active_to BETWEEN 0 AND 23),
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instagram_reply_rules_channel_idx ON instagram_reply_rules (channel, position);

ALTER TABLE instagram_reply_templates
  ADD COLUMN IF NOT EXISTS rule_id uuid REFERENCES instagram_reply_rules(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quick_replies jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE instagram_reply_templates DROP CONSTRAINT IF EXISTS instagram_reply_templates_format_check;
ALTER TABLE instagram_reply_templates ADD CONSTRAINT instagram_reply_templates_format_check CHECK (format IN ('text', 'card', 'trips'));
-- Trip-card replies may have no intro text.
ALTER TABLE instagram_reply_templates DROP CONSTRAINT IF EXISTS instagram_reply_templates_text_check;
ALTER TABLE instagram_reply_templates ADD CONSTRAINT instagram_reply_templates_text_check CHECK (length(text) <= 1000);
CREATE INDEX IF NOT EXISTS instagram_reply_templates_rule_idx ON instagram_reply_templates (rule_id);

ALTER TABLE instagram_auto_replies
  ADD COLUMN IF NOT EXISTS rule_id uuid REFERENCES instagram_reply_rules(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS instagram_auto_replies_rule_idx ON instagram_auto_replies (rule_id, recipient_id, created_at DESC);

-- Public site address used for trip-card links (Instagram needs https).
ALTER TABLE instagram_automation ADD COLUMN IF NOT EXISTS site_url text;

-- Move existing replies into default rules (once).
DO $$
DECLARE
  cfg record;
  dm_rule uuid;
  cm_rule uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM instagram_reply_rules) THEN RETURN; END IF;
  SELECT * INTO cfg FROM instagram_automation WHERE id = 1;

  INSERT INTO instagram_reply_rules (channel, name, trigger, reply_mode, cooldown_hours, position)
  VALUES ('dm', 'Any other message', 'any', COALESCE(cfg.dm_mode, 'random'), COALESCE(cfg.dm_cooldown_hours, 12), 100)
  RETURNING id INTO dm_rule;

  INSERT INTO instagram_reply_rules (channel, name, trigger, reply_mode, send_dm, cooldown_hours, position)
  VALUES ('comment', 'Any other comment', 'any', COALESCE(cfg.comment_mode, 'random'), COALESCE(cfg.comment_dm_enabled, false), 0, 100)
  RETURNING id INTO cm_rule;

  -- Commenter DMs used the general DM replies: give the comment rule its own copies.
  IF COALESCE(cfg.comment_dm_enabled, false) THEN
    INSERT INTO instagram_reply_templates (kind, text, is_active, pinned, rule_id)
    SELECT 'dm', text, is_active, pinned, cm_rule FROM instagram_reply_templates WHERE kind = 'dm' AND rule_id IS NULL;
  END IF;

  UPDATE instagram_reply_templates SET rule_id = dm_rule WHERE kind = 'dm' AND rule_id IS NULL;
  UPDATE instagram_reply_templates SET rule_id = cm_rule WHERE kind = 'comment' AND rule_id IS NULL;
END $$;

ALTER TABLE instagram_reply_rules ENABLE ROW LEVEL SECURITY;
