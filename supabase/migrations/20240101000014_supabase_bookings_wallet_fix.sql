-- Add wallet_amount_used column to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS wallet_amount_used DECIMAL(10, 2) DEFAULT 0;

-- Add payment_mode to payment_transactions table to track payment method
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50); -- 'cash', 'razorpay', 'manual', 'wallet'

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_bookings_wallet_amount_used ON bookings(wallet_amount_used);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_mode ON payment_transactions(payment_mode);

