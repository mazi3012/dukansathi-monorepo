-- Add is_gst_applicable to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_gst_applicable BOOLEAN DEFAULT false;
