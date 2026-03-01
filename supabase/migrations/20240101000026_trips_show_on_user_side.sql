-- Toggle whether completed/cancelled/postponed trips are visible on user-facing pages
ALTER TABLE trips ADD COLUMN IF NOT EXISTS show_on_user_side BOOLEAN DEFAULT true;

COMMENT ON COLUMN trips.show_on_user_side IS 'When true, past trips (completed/cancelled/postponed) are visible to users for view-only. Admin can hide from user side.';

-- Update RLS: past trips visible only when show_on_user_side = true
DROP POLICY IF EXISTS "Anyone can view active or past trips" ON trips;

CREATE POLICY "Anyone can view active or past trips"
  ON trips FOR SELECT
  USING (
    is_active = true
    OR (
      status IN ('completed', 'cancelled', 'postponed')
      AND (show_on_user_side = true OR show_on_user_side IS NULL)
    )
  );
