-- Create function to increment coupon usage count
CREATE OR REPLACE FUNCTION increment_coupon_usage(coupon_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE coupon_codes
  SET used_count = used_count + 1,
      updated_at = NOW()
  WHERE id = coupon_id_param;
END;
$$ LANGUAGE plpgsql;

