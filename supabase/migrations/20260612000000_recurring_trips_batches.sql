-- Recurring weekly trips ("every Friday" departures).
-- One trip row = the template; each booking stores its chosen departure_date (the batch).
-- Applied to production via Supabase MCP on 2026-06-12.

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_day smallint,
  ADD COLUMN IF NOT EXISTS recurrence_weeks_ahead smallint NOT NULL DEFAULT 4;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS departure_date date;

CREATE INDEX IF NOT EXISTS idx_bookings_trip_departure ON bookings(trip_id, departure_date);

COMMENT ON COLUMN trips.is_recurring IS 'Trip departs weekly on recurrence_day; bookings carry departure_date';
COMMENT ON COLUMN trips.recurrence_day IS '0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat';
COMMENT ON COLUMN bookings.departure_date IS 'Chosen departure (batch) for recurring trips; NULL for fixed-date trips';
