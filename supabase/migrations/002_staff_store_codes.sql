-- Add store scoping to staff and indexes to support join-code onboarding
ALTER TABLE staff
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_staff_store ON staff(store_id);
