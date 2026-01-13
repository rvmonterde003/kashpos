-- ============================================
-- KASHPOS v1.0 - Complete Database Schema
-- ============================================
-- Run this SQL in your Supabase SQL Editor for a fresh database
-- This is a complete, standalone schema for KASHPOS v1.0
--
-- Features:
-- - Inventory management (products with pieces only)
-- - Sales tracking with transaction numbers
-- - OPEX (Operating Expenses) management
-- - Payment methods and customer types
-- - Earnings tracking with editable report dates
--
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PRODUCTS TABLE (Inventory Items)
-- ============================================
-- Stores inventory items that can be sold directly
-- Uses pieces only (no weight/volume)

CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  qty DECIMAL(10, 2) NOT NULL DEFAULT 0,
  cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. SALES TABLE
-- ============================================
-- Stores all sales transactions

CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  qty DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  selling_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  customer_type TEXT NOT NULL,
  dine_in_takeout TEXT CHECK (dine_in_takeout IN ('dine_in', 'takeout', NULL)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  transaction_id UUID,
  transaction_number TEXT,
  customer_payment DECIMAL(10, 2),
  earnings_datetime TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- 3. PAYMENT METHODS TABLE
-- ============================================
-- Stores available payment methods (Cash, Card, etc.)

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. CUSTOMER TYPES TABLE
-- ============================================
-- Stores customer categories (Regular, Student, etc.)

CREATE TABLE IF NOT EXISTS customer_types (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#22c55e',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. SETTINGS TABLE
-- ============================================
-- Stores application settings

CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. OPEX TABLE (Operating Expenses)
-- ============================================
-- Stores monthly operating expenses (rent, electricity, etc.)

CREATE TABLE IF NOT EXISTS opex (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. OPEX SETTINGS TABLE
-- ============================================
-- Stores OPEX-related settings (target monthly sales, etc.)

CREATE TABLE IF NOT EXISTS opex_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  target_monthly_sales DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TRIGGER FUNCTIONS
-- ============================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to set earnings_datetime on insert
CREATE OR REPLACE FUNCTION set_earnings_datetime()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.earnings_datetime IS NULL THEN
    NEW.earnings_datetime = COALESCE(NEW.created_at, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to restore inventory (used when cancelling sales)
CREATE OR REPLACE FUNCTION restore_inventory(p_product_id UUID, p_qty DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET qty = qty + p_qty
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_opex_updated_at ON opex;
CREATE TRIGGER update_opex_updated_at
  BEFORE UPDATE ON opex
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_opex_settings_updated_at ON opex_settings;
CREATE TRIGGER update_opex_settings_updated_at
  BEFORE UPDATE ON opex_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Earnings datetime trigger
DROP TRIGGER IF EXISTS set_earnings_datetime_trigger ON sales;
CREATE TRIGGER set_earnings_datetime_trigger
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_earnings_datetime();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE opex ENABLE ROW LEVEL SECURITY;
ALTER TABLE opex_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================
-- Allow all operations (since we're using fixed credentials in the app)
-- In production, you might want to implement proper authentication

DROP POLICY IF EXISTS "Allow all operations on products" ON products;
CREATE POLICY "Allow all operations on products" ON products
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on sales" ON sales;
CREATE POLICY "Allow all operations on sales" ON sales
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on payment_methods" ON payment_methods;
CREATE POLICY "Allow all operations on payment_methods" ON payment_methods
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on customer_types" ON customer_types;
CREATE POLICY "Allow all operations on customer_types" ON customer_types
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on settings" ON settings;
CREATE POLICY "Allow all operations on settings" ON settings
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on opex" ON opex;
CREATE POLICY "Allow all operations on opex" ON opex
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on opex_settings" ON opex_settings;
CREATE POLICY "Allow all operations on opex_settings" ON opex_settings
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- INDEXES
-- ============================================
-- For better query performance

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_cancelled ON sales(cancelled);
CREATE INDEX IF NOT EXISTS idx_sales_earnings_datetime ON sales(earnings_datetime);
CREATE INDEX IF NOT EXISTS idx_sales_transaction_number ON sales(transaction_number);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Default payment methods
INSERT INTO payment_methods (name, color) VALUES
  ('Cash', '#22c55e'),
  ('Card', '#3b82f6'),
  ('GCash', '#0ea5e9')
ON CONFLICT (name) DO NOTHING;

-- Default customer types
INSERT INTO customer_types (name, color) VALUES
  ('Regular', '#6366f1'),
  ('Student', '#f59e0b'),
  ('Senior', '#ec4899')
ON CONFLICT (name) DO NOTHING;

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('dine_in_takeout_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Default OPEX settings
INSERT INTO opex_settings (target_monthly_sales) 
SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM opex_settings);

-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================
-- Note: You need to create this manually in Supabase Dashboard > Storage
-- Bucket name: product-images
-- Public bucket: Yes
-- 
-- Steps:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: product-images
-- 4. Check "Public bucket"
-- 5. Click "Create bucket"

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'KASHPOS v1.0 schema setup completed!' as status;

-- Verify all tables exist
SELECT 
  'products' as table_name,
  EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'products') as exists
UNION ALL
SELECT 'sales', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales')
UNION ALL
SELECT 'payment_methods', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_methods')
UNION ALL
SELECT 'customer_types', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customer_types')
UNION ALL
SELECT 'settings', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'settings')
UNION ALL
SELECT 'opex', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'opex')
UNION ALL
SELECT 'opex_settings', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'opex_settings');
