/**
 * Migration 008: Storage and Product Images
 * Purpose: 
 * 1. Add image_url to products table
 * 2. Configure storage buckets for chat and product images
 * 3. Set up RLS policies for storage access
 */

-- 1. Add image_url to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create Storage Buckets
-- Note: We use "ON CONFLICT DO NOTHING" to avoid errors if they already exist

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('chat-images', 'chat-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']), -- 5MB limit
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']) -- 5MB limit
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS Policies

-- CHAT IMAGES: Authenticated users can upload, view, delete
CREATE POLICY "Public Access to Chat Images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'chat-images' );

CREATE POLICY "Authenticated Users can Upload Chat Images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated Users can Delete Chat Images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-images'
  AND auth.role() = 'authenticated'
);

-- PRODUCT IMAGES: Authenticated users can upload/delete, Public can view
CREATE POLICY "Public Access to Product Images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

CREATE POLICY "Authenticated Users can Upload Product Images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated Users can Update Product Images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated Users can Delete Product Images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);
