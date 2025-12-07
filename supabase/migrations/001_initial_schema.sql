-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- User profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Items table
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
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Product images table (multiple images per product)
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type VARCHAR(50) CHECK (image_type IN ('front', 'back', 'side', 'detail', 'label', 'barcode')),
  embedding vector(1024),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Align embedding column type for existing databases that used jsonb
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_images'
      AND column_name = 'embedding'
      AND udt_name <> 'vector'
  ) THEN
    ALTER TABLE product_images
      ALTER COLUMN embedding TYPE vector(1024) USING NULL;
  END IF;
END $$;

-- Legacy embeddings table (for backward compatibility)
CREATE TABLE IF NOT EXISTS item_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  embedding vector(1024),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Similar products mapping
CREATE TABLE IF NOT EXISTS similar_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item1_id UUID REFERENCES items(id) ON DELETE CASCADE,
  item2_id UUID REFERENCES items(id) ON DELETE CASCADE,
  similarity_score DECIMAL(3,2),
  distinguishing_features TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(item1_id, item2_id)
);

-- Search corrections/feedback
CREATE TABLE IF NOT EXISTS search_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_image_url TEXT,
  predicted_item_id UUID REFERENCES items(id),
  correct_item_id UUID REFERENCES items(id),
  confidence_score DECIMAL(3,2),
  correction_reason TEXT,
  corrected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'used_for_training'))
);

-- Training pairs for fine-tuning
CREATE TABLE IF NOT EXISTS training_pairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  embedding vector(1024),
  is_positive BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_images_item ON product_images(item_id);
CREATE INDEX IF NOT EXISTS idx_product_images_embedding ON product_images USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_item_embeddings_item ON item_embeddings(item_id);
CREATE INDEX IF NOT EXISTS idx_item_embeddings_embedding ON item_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_similar_products ON similar_products(item1_id, item2_id);
CREATE INDEX IF NOT EXISTS idx_search_corrections_status ON search_corrections(status);
CREATE INDEX IF NOT EXISTS idx_items_created_by ON items(created_by);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);

-- Row Level Security Policies

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE similar_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_pairs ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Items policies
CREATE POLICY "Anyone can view items"
  ON items FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage items"
  ON items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Staff can add and edit items"
  ON items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Staff can update own items"
  ON items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Product images policies
CREATE POLICY "Anyone can view product images"
  ON product_images FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage images"
  ON product_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Embeddings policies
CREATE POLICY "Authenticated users can manage embeddings"
  ON item_embeddings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Similar products policies
CREATE POLICY "Anyone can view similar products"
  ON similar_products FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage similar products"
  ON similar_products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Search corrections policies
CREATE POLICY "Admin can view corrections"
  ON search_corrections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can manage corrections"
  ON search_corrections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Training pairs policies
CREATE POLICY "Admin can manage training pairs"
  ON training_pairs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

