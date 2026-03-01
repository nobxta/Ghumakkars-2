-- Enhance trips table with new fields

ALTER TABLE trips ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS full_description TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS day_wise_itinerary JSONB;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS seat_lock_price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS gallery_images TEXT[] DEFAULT '{}';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS booking_deadline_date DATE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS early_bird_price DECIMAL(10, 2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS early_bird_conditions JSONB;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS whatsapp_group_link TEXT;

-- Update existing trips to set seat_lock_price to 10% of discounted_price if not set
UPDATE trips 
SET seat_lock_price = ROUND(discounted_price * 0.10, 2)
WHERE seat_lock_price IS NULL OR seat_lock_price = 0;


