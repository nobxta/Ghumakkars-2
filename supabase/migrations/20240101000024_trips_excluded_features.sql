-- Add excluded_features to trips (what's not included in the trip)
-- Matches included_features: array of text items shown on trip and booking pages
ALTER TABLE trips ADD COLUMN IF NOT EXISTS excluded_features TEXT[] DEFAULT '{}';

COMMENT ON COLUMN trips.excluded_features IS 'List of items not included in the trip (e.g. Lunch, Dinner, Personal expenses)';
