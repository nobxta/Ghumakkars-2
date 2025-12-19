-- Add new fields to coupon_codes table for enhanced filtering

-- Trip-specific coupons (JSONB array of trip IDs)
ALTER TABLE coupon_codes ADD COLUMN IF NOT EXISTS trip_ids JSONB DEFAULT NULL; -- Array of trip UUIDs, NULL = all trips

-- User-specific coupons (JSONB array of user IDs)
ALTER TABLE coupon_codes ADD COLUMN IF NOT EXISTS user_ids JSONB DEFAULT NULL; -- Array of user UUIDs, NULL = all users

-- Date range for coupon validity
ALTER TABLE coupon_codes ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT NULL; -- Valid from date, NULL = no start date
-- expiry_date already exists, but we'll keep it as "valid until"

-- Early bird discount settings
ALTER TABLE coupon_codes ADD COLUMN IF NOT EXISTS is_early_bird BOOLEAN DEFAULT false;
ALTER TABLE coupon_codes ADD COLUMN IF NOT EXISTS early_bird_days_before INTEGER DEFAULT NULL; -- Days before trip start date to qualify as early bird

-- Per-user usage limit (how many times a single user can use this coupon)
ALTER TABLE coupon_codes ADD COLUMN IF NOT EXISTS per_user_limit INTEGER DEFAULT NULL; -- NULL = unlimited per user

-- Maximum discount amount (overall cap, separate from max_discount which is per transaction)
ALTER TABLE coupon_codes ADD COLUMN IF NOT EXISTS max_total_discount DECIMAL(10, 2) DEFAULT NULL; -- Total discount amount that can be given across all uses

-- Current total discount given (track total discount distributed)
ALTER TABLE coupon_codes ADD COLUMN IF NOT EXISTS total_discount_given DECIMAL(10, 2) DEFAULT 0;

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_coupon_codes_trip_ids ON coupon_codes USING GIN(trip_ids);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_user_ids ON coupon_codes USING GIN(user_ids);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_early_bird ON coupon_codes(is_early_bird);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_date_range ON coupon_codes(start_date, expiry_date);

