-- Add additional profile fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS college_name VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_id VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS alternative_number VARCHAR(20);

-- Note: university and student_id already exist in the base schema
-- This ensures all fields are present

