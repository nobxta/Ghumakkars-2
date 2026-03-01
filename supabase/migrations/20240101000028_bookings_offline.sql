-- Offline (face-to-face) bookings: no user account, admin adds manually (user_id already nullable in schema)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_offline_booking BOOLEAN DEFAULT false;
COMMENT ON COLUMN bookings.is_offline_booking IS 'True when booking was added by admin for face-to-face; no website account.';
