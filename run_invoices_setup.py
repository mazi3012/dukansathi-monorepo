"""
Database migration script for Dukan Sathi Auto-Delete Invoices
Run from: e:\dukanv22\backend\ directory
"""
import os
import sys
sys.path.insert(0, 'e:/dukanv22/backend')

from dotenv import load_dotenv
load_dotenv('e:/dukanv22/backend/.env')

from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
client = create_client(url, key)

print("Connected to Supabase:", url)

migrations = [
    {
        "name": "Create 'invoices' storage bucket",
        "sql": """
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;
"""
    },
    {
        "name": "Allow public access to view invoices",
        "sql": """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Public Access' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Public Access" ON storage.objects
        FOR SELECT USING (bucket_id = 'invoices');
    END IF;
END
$$;
"""
    },
    {
        "name": "Allow authenticated users to upload invoices",
        "sql": """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Authenticated users can upload invoices' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Authenticated users can upload invoices" ON storage.objects
        FOR INSERT WITH CHECK (
            auth.role() = 'authenticated' AND
            bucket_id = 'invoices'
        );
    END IF;
END
$$;
"""
    },
    {
        "name": "Enable pg_cron extension",
        "sql": "CREATE EXTENSION IF NOT EXISTS pg_cron;"
    },
    {
        "name": "Schedule auto-delete invoices cron job",
        "sql": """
SELECT cron.schedule(
    'delete-old-invoices',
    '0 * * * *',
    $$ DELETE FROM storage.objects WHERE bucket_id = 'invoices' AND created_at < NOW() - INTERVAL '24 hours'; $$
);
"""
    }
]

success_count = 0
fail_count = 0

for m in migrations:
    try:
        client.rpc("exec_sql", {"sql": m["sql"]}).execute()
        print(f"  [OK] {m['name']}")
        success_count += 1
    except Exception as e:
        # Try direct PostgreSQL via postgrest endpoint
        try:
            import requests
            resp = requests.post(
                f"{url}/rest/v1/rpc/exec_sql",
                headers={
                    "apikey": key,
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json"
                },
                json={"sql": m["sql"]},
                timeout=15
            )
            if resp.status_code in (200, 201, 204):
                print(f"  [OK via REST] {m['name']}")
                success_count += 1
            else:
                print(f"  [FAIL] {m['name']}: {resp.status_code} - {resp.text[:200]}")
                fail_count += 1
        except Exception as e2:
            print(f"  [ERROR] {m['name']}: {e2}")
            fail_count += 1

print(f"\nDone: {success_count} succeeded, {fail_count} failed")
