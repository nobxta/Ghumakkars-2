-- Add referral_reward_amount to payment_settings table
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS referral_reward_amount DECIMAL(10, 2) DEFAULT 100.00;

-- Update existing payment_settings to have default referral reward amount if NULL
UPDATE payment_settings 
SET referral_reward_amount = 100.00 
WHERE referral_reward_amount IS NULL;

-- Update process_referral_reward function to use configurable amount
CREATE OR REPLACE FUNCTION process_referral_reward(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_referral_record RECORD;
  v_reward_amount DECIMAL(10, 2);
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
  
  -- Get configurable reward amount from payment_settings
  SELECT COALESCE(referral_reward_amount, 100.00) INTO v_reward_amount
  FROM payment_settings
  LIMIT 1;
  
  -- If no settings found, use default
  IF v_reward_amount IS NULL THEN
    v_reward_amount := 100.00;
  END IF;
  
  -- Update referral record with the reward amount (only if not already set or using old default)
  UPDATE referrals
  SET reward_amount = v_reward_amount
  WHERE id = v_referral_record.id
    AND (reward_amount IS NULL OR reward_amount = 100.00);
  
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

