-- BARATILLO DATABASE SETUP
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ikyejavruqmakamxztep/sql/new

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create items table (products)
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  image_url TEXT,
  barcode VARCHAR(100),
  sku VARCHAR(100),
  brand VARCHAR(100),
  model_number VARCHAR(100),
  distinguishing_features TEXT[],
  min_confidence DECIMAL(3,2) DEFAULT 0.70,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID
);

-- 3. Create product_images table
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type VARCHAR(50),
  embedding JSONB,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_brand ON items(brand);
CREATE INDEX IF NOT EXISTS idx_product_images_item ON product_images(item_id);

-- 5. Enable Row Level Security but allow public access for testing
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- 6. Create policies for public access (for testing)
CREATE POLICY "Allow public read on items" ON items FOR SELECT USING (true);
CREATE POLICY "Allow public insert on items" ON items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on items" ON items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on items" ON items FOR DELETE USING (true);

CREATE POLICY "Allow public read on product_images" ON product_images FOR SELECT USING (true);
CREATE POLICY "Allow public insert on product_images" ON product_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on product_images" ON product_images FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on product_images" ON product_images FOR DELETE USING (true);

-- Done! Your database is ready.
