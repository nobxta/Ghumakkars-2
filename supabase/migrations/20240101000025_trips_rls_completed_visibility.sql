-- Trips RLS: allow admins to see all trips; allow everyone to see active + completed/cancelled/postponed
-- Fix: marking a trip "completed" set is_active = false, so it disappeared due to "Anyone can view active trips" (is_active = true only).

-- Drop the old policy that only allowed is_active = true
DROP POLICY IF EXISTS "Anyone can view active trips" ON trips;

-- Admins can view ALL trips (any status)
CREATE POLICY "Admins can view all trips"
  ON trips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Anyone can view: active trips (bookable) OR completed/cancelled/postponed (view-only)
CREATE POLICY "Anyone can view active or past trips"
  ON trips FOR SELECT
  USING (
    is_active = true
    OR status IN ('completed', 'cancelled', 'postponed')
  );

COMMENT ON POLICY "Admins can view all trips" ON trips IS 'Admin sees every trip regardless of status';
COMMENT ON POLICY "Anyone can view active or past trips" ON trips IS 'Users see bookable (is_active) and view-only past (completed/cancelled/postponed)';
