/**
 * Migration 016: Add Product Image URL and Policies
 * Purpose: 
 * 1. Add image_url to products table
 * 2. Ensure RLS policies for product-photos bucket
 */

-- Add image_url column if it doesn't exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ensure RLS policies for product-photos bucket
-- Policy for public viewing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access to Product Photos'
    ) THEN
        CREATE POLICY "Public Access to Product Photos"
        ON storage.objects FOR SELECT
        USING ( bucket_id = 'product-photos' );
    END IF;
END $$;

-- Policy for authenticated uploads
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated Users can Upload Product Photos'
    ) THEN
        CREATE POLICY "Authenticated Users can Upload Product Photos"
        ON storage.objects FOR INSERT
        WITH CHECK (
          bucket_id = 'product-photos' 
          AND auth.role() = 'authenticated'
        );
    END IF;
END $$;

-- Policy for authenticated updates
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated Users can Update Product Photos'
    ) THEN
        CREATE POLICY "Authenticated Users can Update Product Photos"
        ON storage.objects FOR UPDATE
        USING (
          bucket_id = 'product-photos' 
          AND auth.role() = 'authenticated'
        );
    END IF;
END $$;

-- Policy for authenticated deletions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated Users can Delete Product Photos'
    ) THEN
        CREATE POLICY "Authenticated Users can Delete Product Photos"
        ON storage.objects FOR DELETE
        USING (
          bucket_id = 'product-photos' 
          AND auth.role() = 'authenticated'
        );
    END IF;
END $$;
