-- Bring the database schema in line with the app's store-scoped catalog/cart flows.

-- Ensure timestamp trigger helper exists (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure required extensions exist for vector columns
CREATE EXTENSION IF NOT EXISTS "vector";

-- Allow organizer role in user profiles
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('organizer', 'admin', 'staff'));

-- Ensure stores have required columns and constraints
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT;

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

ALTER TABLE stores
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_slug_unique ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_organizer ON stores(organizer_id);

DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Items: optional fields used by the app and store scoping
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS additional_images TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scan_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wholesale_tiers JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS product_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_items_store ON items(store_id);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_product_code ON items(product_code);
CREATE INDEX IF NOT EXISTS idx_items_scan_count ON items(scan_count DESC);

-- Ensure embeddings table exists (used by policies below)
CREATE TABLE IF NOT EXISTS item_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  embedding vector(1024),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_item_embeddings_item ON item_embeddings(item_id);
CREATE INDEX IF NOT EXISTS idx_item_embeddings_embedding ON item_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Product images store scoping
ALTER TABLE product_images
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_product_images_store ON product_images(store_id);

-- Categories store scoping and hierarchy
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_categories_store ON categories(store_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- Cart/checkout tables
ALTER TABLE carts
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_carts_store ON carts(store_id);

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS size VARCHAR(100);

ALTER TABLE transfer_codes
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transfer_codes_store ON transfer_codes(store_id);
CREATE INDEX IF NOT EXISTS idx_transfer_codes_code ON transfer_codes(code);
CREATE INDEX IF NOT EXISTS idx_transfer_codes_status ON transfer_codes(status);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);

-- Admin invites for store owners
CREATE TABLE IF NOT EXISTS store_admin_invites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'accepted', 'revoked')),
  invite_token UUID NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_admin_invites_store ON store_admin_invites(store_id);
CREATE INDEX IF NOT EXISTS idx_store_admin_invites_email ON store_admin_invites(email);

-- Enable RLS where needed
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_embeddings ENABLE ROW LEVEL SECURITY;

-- Category access (public read)
DROP POLICY IF EXISTS "Public read categories" ON categories;
CREATE POLICY "Public read categories" ON categories
  FOR SELECT USING (true);

-- Category management by authenticated roles
DROP POLICY IF EXISTS "Manage categories" ON categories;
CREATE POLICY "Manage categories" ON categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff', 'organizer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff', 'organizer')
    )
  );

-- Cart and checkout flows are session-based and public
DROP POLICY IF EXISTS "Public cart access" ON carts;
CREATE POLICY "Public cart access" ON carts FOR ALL USING (true);

DROP POLICY IF EXISTS "Public cart_items access" ON cart_items;
CREATE POLICY "Public cart_items access" ON cart_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Public transfer_codes access" ON transfer_codes;
CREATE POLICY "Public transfer_codes access" ON transfer_codes FOR ALL USING (true);

-- Staff and orders management (authenticated users only)
DROP POLICY IF EXISTS "Auth manage staff" ON staff;
CREATE POLICY "Auth manage staff" ON staff FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth manage orders" ON orders;
CREATE POLICY "Auth manage orders" ON orders FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth manage order_items" ON order_items;
CREATE POLICY "Auth manage order_items" ON order_items FOR ALL USING (auth.role() = 'authenticated');

-- Items and related assets: allow organizers alongside admins/staff
DROP POLICY IF EXISTS "Staff can add and edit items" ON items;
DROP POLICY IF EXISTS "Staff can update own items" ON items;

CREATE POLICY "Staff and organizers can add items" ON items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff', 'organizer')
    )
  );

CREATE POLICY "Staff and organizers can update items" ON items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff', 'organizer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff', 'organizer')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage images" ON product_images;
CREATE POLICY "Authenticated users can manage images" ON product_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff', 'organizer')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage embeddings" ON item_embeddings;
CREATE POLICY "Authenticated users can manage embeddings" ON item_embeddings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff', 'organizer')
    )
  );
