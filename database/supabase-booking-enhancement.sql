-- Enhance bookings table with new fields
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS primary_passenger_name VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS primary_passenger_email VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS primary_passenger_phone VARCHAR(20);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS primary_passenger_gender VARCHAR(20);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS primary_passenger_age INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS college VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passengers JSONB; -- Array of passenger objects
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'upi';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_upi_id VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending'; -- pending, verified, rejected
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_reviewed_by UUID REFERENCES auth.users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_review_notes TEXT;

-- Remove UNIQUE constraint to allow multiple bookings per user for same trip (in case of rebooking)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_trip_id_user_id_key;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON bookings(trip_id);

