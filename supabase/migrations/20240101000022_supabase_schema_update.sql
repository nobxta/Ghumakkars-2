-- Add new columns to profiles table for enhanced user data
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Update existing full_name if first_name and last_name are added
-- This is a migration script, run it once

