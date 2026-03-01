-- Add payment_mode to payment_settings
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'manual'; -- 'manual' or 'razorpay'
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS razorpay_key_id VARCHAR(255);
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS razorpay_key_secret VARCHAR(255);
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS razorpay_webhook_secret VARCHAR(255);

-- Update bookings table with new payment fields
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50); -- 'manual', 'razorpay', 'cash'
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending'; -- 'pending', 'paid', 'failed', 'cash_pending', 'cancelled'
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reference_id VARCHAR(255); -- UTR/Transaction ID/Reference
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS razorpay_response JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bookings_payment_mode ON bookings(payment_mode);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_reference_id ON bookings(reference_id);

