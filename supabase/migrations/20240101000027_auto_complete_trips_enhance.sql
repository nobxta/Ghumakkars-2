-- Auto-complete trips when end_date has passed; set actual_participants and booking_disabled
CREATE OR REPLACE FUNCTION update_trip_status()
RETURNS void AS $$
BEGIN
  -- Mark trips as completed if end_date has passed (set all fields like manual "Mark complete")
  UPDATE trips t
  SET
    status = 'completed',
    completed_at = COALESCE(t.completed_at, NOW()),
    is_active = false,
    booking_disabled = true,
    actual_participants = t.current_participants
  WHERE t.status = 'active'
    AND t.end_date IS NOT NULL
    AND t.end_date < CURRENT_DATE
    AND t.completed_at IS NULL;

  -- Publish scheduled trips
  PERFORM publish_scheduled_trips();
END;
$$ LANGUAGE plpgsql;
