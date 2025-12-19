-- Referral System Database Schema
-- Run this SQL in your Supabase SQL editor

-- Add referral fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(10, 2) DEFAULT 0;

-- Create referrals table to track referral relationships
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL,
  reward_amount DECIMAL(10, 2) DEFAULT 100.00,
  reward_status VARCHAR(20) DEFAULT 'pending', -- pending, credited, cancelled
  first_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  credited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(referred_user_id) -- A user can only be referred once
);

-- Create wallet_transactions table for wallet history
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL, -- credit, debit
  amount DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  description TEXT,
  reference_type VARCHAR(50), -- referral_reward, booking_payment, refund, etc.
  reference_id UUID, -- booking_id, referral_id, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS VARCHAR(20) AS $$
DECLARE
  new_code VARCHAR(20);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 8-character alphanumeric code
    new_code := UPPER(
      SUBSTRING(
        MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT),
        1, 8
      )
    );
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp for referrals
CREATE OR REPLACE FUNCTION update_referrals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for referrals updated_at
CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_referrals_updated_at();

-- Function to credit wallet
CREATE OR REPLACE FUNCTION credit_wallet(
  p_user_id UUID,
  p_amount DECIMAL(10, 2),
  p_description TEXT,
  p_reference_type VARCHAR(50) DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_new_balance DECIMAL(10, 2);
BEGIN
  -- Update wallet balance
  UPDATE profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
  WHERE id = p_user_id
  RETURNING wallet_balance INTO v_new_balance;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description,
    reference_type,
    reference_id
  ) VALUES (
    p_user_id,
    'credit',
    p_amount,
    v_new_balance,
    p_description,
    p_reference_type,
    p_reference_id
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to debit wallet
CREATE OR REPLACE FUNCTION debit_wallet(
  p_user_id UUID,
  p_amount DECIMAL(10, 2),
  p_description TEXT,
  p_reference_type VARCHAR(50) DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance DECIMAL(10, 2);
  v_new_balance DECIMAL(10, 2);
BEGIN
  -- Get current balance
  SELECT COALESCE(wallet_balance, 0) INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id;
  
  -- Check if sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;
  
  -- Update wallet balance
  UPDATE profiles
  SET wallet_balance = v_current_balance - p_amount
  WHERE id = p_user_id
  RETURNING wallet_balance INTO v_new_balance;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description,
    reference_type,
    reference_id
  ) VALUES (
    p_user_id,
    'debit',
    p_amount,
    v_new_balance,
    p_description,
    p_reference_type,
    p_reference_id
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to process referral reward when first booking is confirmed
CREATE OR REPLACE FUNCTION process_referral_reward(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_referral_record RECORD;
  v_reward_amount DECIMAL(10, 2) := 100.00;
  v_is_first_booking BOOLEAN;
BEGIN
  -- Get user_id from booking
  SELECT user_id INTO v_user_id
  FROM bookings
  WHERE id = p_booking_id;
  
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if this is user's first confirmed booking
  SELECT COUNT(*) = 0 INTO v_is_first_booking
  FROM bookings
  WHERE user_id = v_user_id
    AND booking_status IN ('confirmed', 'seat_locked')
    AND id != p_booking_id;
  
  -- Only process if this is first booking
  IF NOT v_is_first_booking THEN
    RETURN FALSE;
  END IF;
  
  -- Get referral record
  SELECT * INTO v_referral_record
  FROM referrals
  WHERE referred_user_id = v_user_id
    AND reward_status = 'pending';
  
  -- If no referral record, return (user wasn't referred)
  IF v_referral_record IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Credit wallet to referrer
  PERFORM credit_wallet(
    v_referral_record.referrer_id,
    v_reward_amount,
    'Referral reward - ' || (SELECT email FROM profiles WHERE id = v_user_id),
    'referral_reward',
    v_referral_record.id
  );
  
  -- Update referral record
  UPDATE referrals
  SET reward_status = 'credited',
      first_booking_id = p_booking_id,
      credited_at = NOW()
  WHERE id = v_referral_record.id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referrals
CREATE POLICY "Users can view their own referrals as referrer"
  ON referrals FOR SELECT
  USING (referrer_id = auth.uid());

CREATE POLICY "Admins can view all referrals"
  ON referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for wallet_transactions
CREATE POLICY "Users can view their own wallet transactions"
  ON wallet_transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all wallet transactions"
  ON wallet_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Generate referral codes for existing users (optional - run if needed)
-- UPDATE profiles
-- SET referral_code = generate_referral_code()
-- WHERE referral_code IS NULL;

