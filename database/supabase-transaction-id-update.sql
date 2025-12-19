-- Replace payment_screenshot_url with transaction_id
ALTER TABLE bookings DROP COLUMN IF EXISTS payment_screenshot_url;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255);

-- Add index for transaction ID lookups
CREATE INDEX IF NOT EXISTS idx_bookings_transaction_id ON bookings(transaction_id);

