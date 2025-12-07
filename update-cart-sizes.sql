ALTER TABLE cart_items 
ADD COLUMN size TEXT,
ADD COLUMN product_data JSONB; -- Store snapshot of product data including specific size price if needed

-- Update RLS to allow access if not already (usually inherited)
