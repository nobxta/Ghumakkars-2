-- Admin-pinned ("Featured") trips are shown first on the public trips page.

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN trips.is_featured IS 'Pinned by admin: shown at the top of the public trips list with a Featured badge';
