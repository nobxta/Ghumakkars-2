-- Add rejection_reason column to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

