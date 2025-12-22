-- PerexPastil Database Schema Update v5 - Fix Foreign Key Constraint
-- Run this SQL in your Supabase SQL Editor
-- https://supabase.com/dashboard/project/uwhinxqsgwwvwnvdxqvp/sql
-- 
-- This fixes the foreign key constraint issue where sales.product_id
-- was pointing to products (inventory) but should now point to finished_products

-- ============================================
-- 1. DROP THE OLD FOREIGN KEY CONSTRAINT
-- ============================================
-- The sales table should NOT require product_id to exist in products table
-- because we now sell finished_products, not inventory items directly

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_product_id_fkey;

-- ============================================
-- 2. ADD NEW FOREIGN KEY TO FINISHED_PRODUCTS (OPTIONAL)
-- ============================================
-- Uncomment if you want to enforce that product_id must exist in finished_products
-- For flexibility, we'll leave it without a constraint so old sales data still works

-- ALTER TABLE sales 
-- ADD CONSTRAINT sales_product_id_fkey 
-- FOREIGN KEY (product_id) REFERENCES finished_products(id) ON DELETE SET NULL;

-- ============================================
-- 3. MAKE product_id NULLABLE
-- ============================================
-- In case a finished product is deleted, we don't want to lose the sale record

ALTER TABLE sales ALTER COLUMN product_id DROP NOT NULL;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Schema update v5 completed - Foreign key constraint removed!' as status;

-- Show current constraints on sales table
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'sales';

