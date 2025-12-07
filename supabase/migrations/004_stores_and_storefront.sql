-- Stores table with unique URL parameter (slug) and store scoping
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  organizer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cover_url TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_organizer ON stores(organizer_id);

-- Ensure timestamp trigger helper exists (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Keep updated_at current
DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Core catalog/checkout tables (created here to keep later ALTER statements safe)
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  description TEXT,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  is_wholesale BOOLEAN DEFAULT false,
  tier_label VARCHAR(50),
  size VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS transfer_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code VARCHAR(6) UNIQUE NOT NULL,
  cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id),
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transfer_code_id UUID REFERENCES transfer_codes(id),
  staff_id UUID REFERENCES staff(id),
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  total_discount DECIMAL(10,2) DEFAULT 0,
  payment_method VARCHAR(50),
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES items(id),
  product_name VARCHAR(200),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  is_wholesale BOOLEAN DEFAULT false,
  tier_label VARCHAR(50)
);

-- Store scoping across catalog and checkout
ALTER TABLE items ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_items_store ON items(store_id);

ALTER TABLE product_images ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_product_images_store ON product_images(store_id);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_categories_store ON categories(store_id);

ALTER TABLE carts ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_carts_store ON carts(store_id);

ALTER TABLE transfer_codes ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transfer_codes_store ON transfer_codes(store_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);

-- Row level security for stores
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read stores" ON stores;
CREATE POLICY "Public read stores" ON stores
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage stores" ON stores;
CREATE POLICY "Admins manage stores" ON stores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Organizers manage own stores" ON stores;
CREATE POLICY "Organizers manage own stores" ON stores
  FOR ALL USING (
    organizer_id = auth.uid() AND
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'organizer')
  )
  WITH CHECK (
    organizer_id = auth.uid() AND
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'organizer')
  );
