-- KASHPOS v1.0 Database Schema Update v7
-- Run this SQL in your Supabase SQL Editor
-- 
-- This update removes unit_type from products and sales tables
-- since we're now using pieces only
-- Also ensures earnings_datetime has a default trigger

-- ============================================
-- 1. REMOVE unit_type FROM PRODUCTS TABLE
-- ============================================

-- Drop the constraint first
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_unit_type_check;

-- Remove the unit_type column
ALTER TABLE products DROP COLUMN IF EXISTS unit_type;

-- ============================================
-- 2. REMOVE unit_type FROM SALES TABLE
-- ============================================

-- Drop the constraint first
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_unit_type_check;

-- Remove the unit_type column
ALTER TABLE sales DROP COLUMN IF EXISTS unit_type;

-- ============================================
-- 3. ENSURE earnings_datetime HAS DEFAULT
-- ============================================
-- Make sure earnings_datetime has a default value trigger

-- Add column if it doesn't exist
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS earnings_datetime TIMESTAMP WITH TIME ZONE;

-- Set default for existing records
UPDATE sales 
SET earnings_datetime = created_at 
WHERE earnings_datetime IS NULL;

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION set_earnings_datetime()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.earnings_datetime IS NULL THEN
    NEW.earnings_datetime = COALESCE(NEW.created_at, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS set_earnings_datetime_trigger ON sales;
CREATE TRIGGER set_earnings_datetime_trigger
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_earnings_datetime();

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'Schema update completed! unit_type removed and earnings_datetime trigger set.' as status;
