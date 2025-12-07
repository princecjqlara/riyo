-- ============================================
-- E-Commerce System Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Categories (kept from previous migration)
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE items ADD COLUMN IF NOT EXISTS additional_images TEXT[] DEFAULT NULL;
ALTER TABLE items ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS scan_count INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS wholesale_tiers JSONB DEFAULT '[]';
-- New columns
ALTER TABLE items ADD COLUMN IF NOT EXISTS product_code VARCHAR(100);
ALTER TABLE items ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '[]';
-- sizes format: [{"size": "S", "price": 100, "stock": 10}, {"size": "M", "price": 120, "stock": 5}]
ALTER TABLE items ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}';
-- specs: {"weight": "500g", "material": "Cotton", "color": "Blue"}
CREATE INDEX IF NOT EXISTS idx_items_product_code ON items(product_code);

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopping carts (session-based)
CREATE TABLE IF NOT EXISTS carts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cart items
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  is_wholesale BOOLEAN DEFAULT false,
  tier_label VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cart_id, product_id)
);

-- Transfer codes
CREATE TABLE IF NOT EXISTS transfer_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code VARCHAR(6) UNIQUE NOT NULL,
  cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders (completed transactions)
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transfer_code_id UUID REFERENCES transfer_codes(id),
  staff_id UUID REFERENCES staff(id),
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_scan_count ON items(scan_count DESC);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_transfer_codes_code ON transfer_codes(code);
CREATE INDEX IF NOT EXISTS idx_transfer_codes_status ON transfer_codes(status);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Public read policies
DROP POLICY IF EXISTS "Public read categories" ON categories;
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read items" ON items;
CREATE POLICY "Public read items" ON items FOR SELECT USING (true);

-- Cart policies (public access via session)
DROP POLICY IF EXISTS "Public cart access" ON carts;
CREATE POLICY "Public cart access" ON carts FOR ALL USING (true);

DROP POLICY IF EXISTS "Public cart_items access" ON cart_items;
CREATE POLICY "Public cart_items access" ON cart_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Public transfer_codes access" ON transfer_codes;
CREATE POLICY "Public transfer_codes access" ON transfer_codes FOR ALL USING (true);

-- Staff policies
DROP POLICY IF EXISTS "Auth manage staff" ON staff;
CREATE POLICY "Auth manage staff" ON staff FOR ALL USING (auth.role() = 'authenticated');

-- Order policies
DROP POLICY IF EXISTS "Auth manage orders" ON orders;
CREATE POLICY "Auth manage orders" ON orders FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth manage order_items" ON order_items;
CREATE POLICY "Auth manage order_items" ON order_items FOR ALL USING (auth.role() = 'authenticated');
