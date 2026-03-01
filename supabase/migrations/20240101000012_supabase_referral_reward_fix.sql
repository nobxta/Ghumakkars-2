-- Improved process_referral_reward function with better error handling and logging
CREATE OR REPLACE FUNCTION process_referral_reward(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_referral_record RECORD;
  v_reward_amount DECIMAL(10, 2);
  v_is_first_booking BOOLEAN;
  v_booking_status VARCHAR(50);
BEGIN
  -- Get user_id and booking status from booking
  SELECT user_id, booking_status INTO v_user_id, v_booking_status
  FROM bookings
  WHERE id = p_booking_id;
  
  IF v_user_id IS NULL THEN
    RAISE WARNING 'Booking % not found', p_booking_id;
    RETURN FALSE;
  END IF;
  
  -- Check if booking is confirmed or seat_locked
  IF v_booking_status NOT IN ('confirmed', 'seat_locked') THEN
    RAISE WARNING 'Booking % status is %, not confirmed/seat_locked', p_booking_id, v_booking_status;
    RETURN FALSE;
  END IF;
  
  -- Check if this is user's first confirmed booking
  -- Count bookings with confirmed/seat_locked status, excluding current booking
  SELECT COUNT(*) = 0 INTO v_is_first_booking
  FROM bookings
  WHERE user_id = v_user_id
    AND booking_status IN ('confirmed', 'seat_locked')
    AND id != p_booking_id;
  
  -- Only process if this is first booking
  IF NOT v_is_first_booking THEN
    RAISE WARNING 'User % already has other confirmed bookings, skipping referral reward', v_user_id;
    RETURN FALSE;
  END IF;
  
  -- Get referral record (only pending ones)
  SELECT * INTO v_referral_record
  FROM referrals
  WHERE referred_user_id = v_user_id
    AND reward_status = 'pending';
  
  -- If no referral record, return (user wasn't referred or already processed)
  IF v_referral_record IS NULL THEN
    RAISE WARNING 'No pending referral found for user %', v_user_id;
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
    RAISE WARNING 'Error processing referral reward for booking %: %', p_booking_id, SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically process pending referrals for users who have bookings
CREATE OR REPLACE FUNCTION process_pending_referrals_for_bookings()
RETURNS TABLE(processed_count INTEGER, failed_count INTEGER) AS $$
DECLARE
  v_referral RECORD;
  v_booking RECORD;
  v_processed INTEGER := 0;
  v_failed INTEGER := 0;
  v_result BOOLEAN;
BEGIN
  -- Loop through all pending referrals
  FOR v_referral IN 
    SELECT * FROM referrals WHERE reward_status = 'pending'
  LOOP
    -- Find first confirmed booking for this referred user
    SELECT id INTO v_booking
    FROM bookings
    WHERE user_id = v_referral.referred_user_id
      AND booking_status IN ('confirmed', 'seat_locked')
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- If booking found, process the referral
    IF v_booking IS NOT NULL THEN
      SELECT process_referral_reward(v_booking.id) INTO v_result;
      
      IF v_result THEN
        v_processed := v_processed + 1;
      ELSE
        v_failed := v_failed + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_processed, v_failed;
END;
$$ LANGUAGE plpgsql;

