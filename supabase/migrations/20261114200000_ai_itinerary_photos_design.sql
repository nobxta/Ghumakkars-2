-- AI Itinerary Studio: photos attached to an itinerary (used inside the PDF),
-- image roles, design-reference colours, and a brand logo in private storage.

-- Reference files can now be photos for the PDF.
ALTER TABLE ai_itinerary_references DROP CONSTRAINT IF EXISTS ai_itinerary_references_purpose_check;
ALTER TABLE ai_itinerary_references ADD CONSTRAINT ai_itinerary_references_purpose_check
  CHECK (purpose IN ('auto','extract','structure','design','compare','rewrite','terms','new_from_old','photo'));

-- Photo role + per-file metadata (palette extracted from photos / design-reference PDFs, image size …)
ALTER TABLE ai_itinerary_references ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'document'
  CHECK (kind IN ('document','image'));
ALTER TABLE ai_itinerary_references ADD COLUMN IF NOT EXISTS image_role text
  CHECK (image_role IS NULL OR image_role IN ('auto','cover','day','gallery','exclude'));
ALTER TABLE ai_itinerary_references ADD COLUMN IF NOT EXISTS image_day integer;
ALTER TABLE ai_itinerary_references ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE ai_itinerary_references ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Allow images in the private bucket (photos + brand logo).
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf','text/plain','text/markdown','image/jpeg','image/png','image/webp']
WHERE id = 'ai-itineraries';
