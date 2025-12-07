-- Add additional_images column for multi-angle product photos
-- Run this in Supabase SQL Editor

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS additional_images text[] DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN items.additional_images IS 'Array of base64 image URLs for additional product angles';
