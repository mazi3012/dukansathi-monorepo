-- =====================================================================
-- Dukan Sathi - Invoice Bucket & Auto-Delete Setup (SECURED)
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================================

-- 1. Create the 'invoices' storage bucket (PRIVATE — not public)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Allow authenticated users to READ their own invoices only
-- File path format: user_id/filename.pdf
CREATE POLICY "Users can view own invoices" ON storage.objects
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'invoices' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Allow authenticated users to upload invoices to their own folder
CREATE POLICY "Users can upload own invoices" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id = 'invoices' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Allow authenticated users to delete their own invoices
CREATE POLICY "Users can delete own invoices" ON storage.objects
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'invoices' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 6. Schedule a cron job to automatically delete invoices older than 24 hours
SELECT cron.schedule(
    'delete-old-invoices',
    '0 * * * *',
    $$
    DELETE FROM storage.objects
    WHERE bucket_id = 'invoices'
      AND created_at < NOW() - INTERVAL '24 hours';
    $$
);
