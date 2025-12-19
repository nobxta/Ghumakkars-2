-- Trip Management Enhancements
-- Add fields for trip status, scheduling, and management features

-- Add status field (draft, scheduled, active, completed, cancelled, postponed)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
-- Update existing active trips
UPDATE trips SET status = CASE 
  WHEN is_active = true THEN 'active'
  ELSE 'draft'
END WHERE status IS NULL;

-- Add scheduling fields
ALTER TABLE trips ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

-- Add management fields
ALTER TABLE trips ADD COLUMN IF NOT EXISTS booking_disabled BOOLEAN DEFAULT false;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS postponed_to_date DATE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS actual_participants INTEGER DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS trip_start_time TIME;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS trip_end_time TIME;

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_scheduled_publish_at ON trips(scheduled_publish_at);
CREATE INDEX IF NOT EXISTS idx_trips_completed_at ON trips(completed_at);

-- Function to automatically publish scheduled trips
CREATE OR REPLACE FUNCTION publish_scheduled_trips()
RETURNS void AS $$
BEGIN
  UPDATE trips
  SET 
    status = 'active',
    is_active = true,
    published_at = NOW()
  WHERE 
    status = 'scheduled'
    AND scheduled_publish_at IS NOT NULL
    AND scheduled_publish_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a function to check and update trip status based on dates
CREATE OR REPLACE FUNCTION update_trip_status()
RETURNS void AS $$
BEGIN
  -- Mark trips as completed if end_date has passed
  UPDATE trips
  SET status = 'completed', completed_at = NOW()
  WHERE status = 'active'
    AND end_date IS NOT NULL
    AND end_date < CURRENT_DATE
    AND completed_at IS NULL;
    
  -- Publish scheduled trips
  PERFORM publish_scheduled_trips();
END;
$$ LANGUAGE plpgsql;

