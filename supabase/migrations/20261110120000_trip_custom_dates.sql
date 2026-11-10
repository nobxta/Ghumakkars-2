-- Multi-departure trips: hand-picked dates in addition to (or instead of) the weekly rule.
-- is_recurring now means "trip has multiple departures; bookings carry departure_date".
-- recurrence_day stays nullable: NULL = no weekly rule, only custom_dates.

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS custom_dates date[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN trips.custom_dates IS 'Hand-picked departure dates for multi-departure trips (combined with weekly recurrence_day if set)';
COMMENT ON COLUMN trips.is_recurring IS 'Trip has multiple departures (weekly rule and/or custom_dates); bookings carry departure_date';
