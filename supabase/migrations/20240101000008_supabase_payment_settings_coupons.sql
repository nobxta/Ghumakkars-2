-- Create payment_settings table
CREATE TABLE IF NOT EXISTS payment_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_qr_url TEXT,
  payment_upi_id VARCHAR(255),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default payment settings (if none exists)
INSERT INTO payment_settings (id, payment_qr_url, payment_upi_id)
VALUES (gen_random_uuid(), NULL, NULL)
ON CONFLICT DO NOTHING;

-- Create coupon_codes table
CREATE TABLE IF NOT EXISTS coupon_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
  discount_value DECIMAL(10, 2) NOT NULL,
  min_amount DECIMAL(10, 2) DEFAULT 0, -- Minimum booking amount to use coupon
  max_discount DECIMAL(10, 2), -- Maximum discount amount (for percentage)
  usage_limit INTEGER, -- Total usage limit (NULL = unlimited)
  used_count INTEGER DEFAULT 0,
  expiry_date DATE,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create coupon_usages table to track who used which coupon
CREATE TABLE IF NOT EXISTS coupon_usages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID REFERENCES coupon_codes(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  discount_amount DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(booking_id) -- One coupon per booking
);

-- Add coupon fields to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10, 2); -- Amount after coupon discount

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_coupon_codes_code ON coupon_codes(code);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_active ON coupon_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user ON coupon_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon ON coupon_usages(coupon_id);

-- Enable RLS
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;

-- Policies for payment_settings (readable by all, writable by admins)
CREATE POLICY "Anyone can view payment settings"
  ON payment_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update payment settings"
  ON payment_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert payment settings"
  ON payment_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for coupon_codes (readable by all authenticated, writable by admins)
CREATE POLICY "Authenticated users can view active coupons"
  ON coupon_codes FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage coupons"
  ON coupon_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for coupon_usages (users can view their own usage)
CREATE POLICY "Users can view their own coupon usage"
  ON coupon_usages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create coupon usage"
  ON coupon_usages FOR INSERT
  WITH CHECK (true); -- Will be handled server-side

-- Function to update updated_at timestamp for payment_settings
CREATE OR REPLACE FUNCTION update_payment_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_settings_updated_at
  BEFORE UPDATE ON payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_settings_updated_at();

-- Function to update updated_at timestamp for coupon_codes
CREATE OR REPLACE FUNCTION update_coupon_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_coupon_codes_updated_at
  BEFORE UPDATE ON coupon_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_coupon_codes_updated_at();

