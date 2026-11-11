-- Last time Meta delivered an Instagram webhook event (shown in admin → Instagram → Settings).
ALTER TABLE instagram_automation ADD COLUMN IF NOT EXISTS webhook_last_at timestamptz;
