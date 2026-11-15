-- Smarter auto-reply rules: more triggers, conditions, "stay silent" rules,
-- hand-over-to-team mutes, and a pause after the team replies in a chat.
-- Additive only: existing rules keep working exactly as before.

-- Triggers: + photo/video/shared post (media) and story reply/mention (story).
ALTER TABLE instagram_reply_rules DROP CONSTRAINT IF EXISTS instagram_reply_rules_trigger_check;
ALTER TABLE instagram_reply_rules ADD CONSTRAINT instagram_reply_rules_trigger_check
  CHECK (trigger IN ('any', 'keywords', 'media', 'story'));

-- Keyword matching: + "starts with".
ALTER TABLE instagram_reply_rules DROP CONSTRAINT IF EXISTS instagram_reply_rules_match_type_check;
ALTER TABLE instagram_reply_rules ADD CONSTRAINT instagram_reply_rules_match_type_check
  CHECK (match_type IN ('contains', 'exact', 'starts'));

-- reply = send one of the rule's replies; ignore = match and stay silent (leave it to the team).
ALTER TABLE instagram_reply_rules ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT 'reply';
ALTER TABLE instagram_reply_rules DROP CONSTRAINT IF EXISTS instagram_reply_rules_action_check;
ALTER TABLE instagram_reply_rules ADD CONSTRAINT instagram_reply_rules_action_check CHECK (action IN ('reply', 'ignore'));

-- Conditions (see lib/instagram-tracker/rules-core.ts → RuleConditions):
-- keyword_logic, exclude, audience, follows, min_followers, days, starts_on, ends_on,
-- delay_minutes, daily_limit, mute_hours, skip_tags.
ALTER TABLE instagram_reply_rules ADD COLUMN IF NOT EXISTS conditions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- People handed over to the team: no auto replies to them until `until`.
CREATE TABLE IF NOT EXISTS instagram_reply_mutes (
  recipient_id text PRIMARY KEY,
  username text,
  until timestamptz NOT NULL,
  rule_id uuid REFERENCES instagram_reply_rules(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instagram_reply_mutes_until_idx ON instagram_reply_mutes (until);
ALTER TABLE instagram_reply_mutes ENABLE ROW LEVEL SECURITY;

-- After someone from the team writes in a chat, the bot stays quiet there for N hours (0 = off).
ALTER TABLE instagram_automation ADD COLUMN IF NOT EXISTS human_pause_hours integer NOT NULL DEFAULT 12;
ALTER TABLE instagram_automation DROP CONSTRAINT IF EXISTS instagram_automation_human_pause_hours_check;
ALTER TABLE instagram_automation ADD CONSTRAINT instagram_automation_human_pause_hours_check CHECK (human_pause_hours BETWEEN 0 AND 168);

-- Faster "team replied recently" lookups.
CREATE INDEX IF NOT EXISTS instagram_dm_messages_conv_out_idx ON instagram_dm_messages (conversation_id, direction, created_at DESC);
