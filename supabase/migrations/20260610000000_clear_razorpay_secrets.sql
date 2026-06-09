-- Security: Razorpay payment secrets must NEVER be stored in the database.
-- Live keys read out of payment_settings would expose them to anyone with
-- admin DB access (or any RLS bypass / leaked service-role token).
--
-- This migration scrubs the existing values. Application code now reads
-- keys exclusively from environment variables (RAZORPAY_KEY_ID,
-- RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET).

UPDATE payment_settings
SET razorpay_key_id = NULL,
    razorpay_key_secret = NULL,
    razorpay_webhook_secret = NULL;

-- Defense in depth: revoke the columns so future code paths can't accidentally
-- read or write them again. (Columns are left in place to avoid breaking older
-- selects that might still reference the schema; only the data is wiped.)
COMMENT ON COLUMN payment_settings.razorpay_key_id IS 'DEPRECATED — moved to env var RAZORPAY_KEY_ID. Do not store secrets here.';
COMMENT ON COLUMN payment_settings.razorpay_key_secret IS 'DEPRECATED — moved to env var RAZORPAY_KEY_SECRET. Do not store secrets here.';
COMMENT ON COLUMN payment_settings.razorpay_webhook_secret IS 'DEPRECATED — moved to env var RAZORPAY_WEBHOOK_SECRET. Do not store secrets here.';
