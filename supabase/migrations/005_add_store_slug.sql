-- Ensure stores table has slug column and unique index, backfilled for existing rows
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill slug values for existing rows missing slug
WITH bases AS (
  SELECT
    id,
    LOWER(regexp_replace(COALESCE(NULLIF(name, ''), 'store'), '[^a-z0-9]+', '-', 'g')) AS base,
    ROW_NUMBER() OVER (PARTITION BY LOWER(regexp_replace(COALESCE(NULLIF(name, ''), 'store'), '[^a-z0-9]+', '-', 'g')) ORDER BY created_at, id) AS rn
  FROM stores
  WHERE slug IS NULL
)
UPDATE stores AS s
SET slug = CONCAT(b.base, CASE WHEN b.rn > 1 THEN '-' || b.rn ELSE '' END)
FROM bases AS b
WHERE s.id = b.id;

-- Enforce not null and uniqueness
ALTER TABLE stores
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_slug_unique ON stores(slug);
