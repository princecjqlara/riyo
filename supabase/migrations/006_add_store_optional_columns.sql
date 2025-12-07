-- Add optional columns expected by app (avatar_url, cover_url, bio)
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT;
