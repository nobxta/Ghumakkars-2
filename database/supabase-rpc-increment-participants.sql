-- Create function to increment trip participants
CREATE OR REPLACE FUNCTION increment_trip_participants(
  trip_id UUID,
  increment_by INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE trips
  SET current_participants = current_participants + increment_by,
      updated_at = NOW()
  WHERE id = trip_id;
END;
$$ LANGUAGE plpgsql;

