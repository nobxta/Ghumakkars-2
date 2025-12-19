-- Update referrals table to store user details directly
-- Run this SQL in your Supabase SQL editor

-- Add columns to store referrer and referred user details
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_name VARCHAR(255);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_email VARCHAR(255);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referred_user_name VARCHAR(255);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referred_user_email VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_email ON referrals(referrer_email);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_email ON referrals(referred_user_email);

