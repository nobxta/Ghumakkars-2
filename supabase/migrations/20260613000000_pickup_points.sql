-- Pickup points: admin sets a list of options per trip; each booking stores the chosen one.
-- Applied to production via Supabase MCP on 2026-06-13.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS pickup_points text[];
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_point text;

COMMENT ON COLUMN trips.pickup_points IS 'List of pickup options shown as a dropdown at booking';
COMMENT ON COLUMN bookings.pickup_point IS 'The pickup point the traveler selected';
