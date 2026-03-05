-- Storage RLS policies for the 'invoices' bucket.
-- Authenticated users can only access invoices in their own folder (user_id/).

-- Allow upload to own folder
CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoices' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow reading own invoices
CREATE POLICY "Authenticated users can read own invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoices' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow deleting own invoices
CREATE POLICY "Authenticated users can delete own invoices"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoices' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
