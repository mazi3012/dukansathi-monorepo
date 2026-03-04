-- =====================================================================
-- Dukan Sathi - Invoice Bucket & Auto-Delete Setup
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================================

-- 1. Create the 'invoices' storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public access to view invoices (since they need to be shared)
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'invoices');

-- 3. Allow authenticated users to upload invoices
CREATE POLICY "Authenticated users can upload invoices" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id = 'invoices'
);

-- 4. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 5. Schedule a cron job to automatically delete invoices older than 24 hours
-- This runs every hour at minute 0 (0 * * * *)
SELECT cron.schedule(
    'delete-old-invoices',
    '0 * * * *',
    $$
    DELETE FROM storage.objects
    WHERE bucket_id = 'invoices'
      AND created_at < NOW() - INTERVAL '24 hours';
    $$
);
