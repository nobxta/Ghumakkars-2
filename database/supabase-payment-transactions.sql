-- Create payment_transactions table to track multiple payments for a booking
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  transaction_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_type VARCHAR(50) NOT NULL, -- 'seat_lock', 'remaining', 'full'
  payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  payment_reviewed_at TIMESTAMP WITH TIME ZONE,
  payment_reviewed_by UUID REFERENCES auth.users(id),
  payment_review_notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_payment_transactions_booking_id ON payment_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(payment_status);

-- Migrate existing transaction_id to payment_transactions
-- This will create a payment_transaction for existing bookings with transaction_id
-- Only insert if payment_transaction doesn't already exist for this booking
INSERT INTO payment_transactions (booking_id, transaction_id, amount, payment_type, payment_status, payment_reviewed_at, payment_reviewed_by, payment_review_notes, rejection_reason)
SELECT 
  id as booking_id,
  transaction_id,
  payment_amount as amount,
  CASE 
    WHEN payment_method = 'seat_lock' THEN 'seat_lock'
    ELSE 'full'
  END as payment_type,
  payment_status,
  payment_reviewed_at,
  payment_reviewed_by,
  payment_review_notes,
  rejection_reason
FROM bookings
WHERE transaction_id IS NOT NULL 
  AND transaction_id != ''
  AND id NOT IN (SELECT DISTINCT booking_id FROM payment_transactions);

-- RLS policies
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts on re-run)
DROP POLICY IF EXISTS "Users can view their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Admins can view all payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Admins can update payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Admins can insert payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can insert payment transactions for their own bookings" ON payment_transactions;

-- Users can view their own payment transactions
CREATE POLICY "Users can view their own payment transactions"
  ON payment_transactions FOR SELECT
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE user_id = auth.uid()
    )
  );

-- Admins can view all payment transactions
CREATE POLICY "Admins can view all payment transactions"
  ON payment_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update payment transactions
CREATE POLICY "Admins can update payment transactions"
  ON payment_transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can insert payment transactions
CREATE POLICY "Admins can insert payment transactions"
  ON payment_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can insert payment transactions for their own bookings
CREATE POLICY "Users can insert payment transactions for their own bookings"
  ON payment_transactions FOR INSERT
  WITH CHECK (
    booking_id IN (
      SELECT id FROM bookings WHERE user_id = auth.uid()
    )
  );

