"""
Database migration script for Dukan Sathi Launch Readiness
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
        "name": "Enable pg_trgm extension",
        "sql": "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
    },
    {
        "name": "Create customer_ledger table",
        "sql": """
CREATE TABLE IF NOT EXISTS customer_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'payment')),
    mode TEXT DEFAULT 'Cash',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
"""
    },
    {
        "name": "Enable RLS on customer_ledger",
        "sql": "ALTER TABLE customer_ledger ENABLE ROW LEVEL SECURITY;"
    },
    {
        "name": "Create RLS policy on customer_ledger",
        "sql": """
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='customer_ledger' AND policyname='Users can manage their own ledger'
  ) THEN
    CREATE POLICY "Users can manage their own ledger"
      ON customer_ledger FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
"""
    },
    {
        "name": "Create fuzzy_match_product RPC",
        "sql": """
CREATE OR REPLACE FUNCTION fuzzy_match_product(query TEXT, uid UUID)
RETURNS TABLE(id BIGINT, name TEXT, selling_price NUMERIC, tax_percent NUMERIC, stock_quantity INTEGER, unit TEXT, similarity_score REAL)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p.selling_price,
    p.tax_percent,
    p.stock_quantity,
    p.unit,
    similarity(lower(p.name), lower(query)) AS similarity_score
  FROM products p
  WHERE p.user_id = uid
    AND similarity(lower(p.name), lower(query)) > 0.15
  ORDER BY similarity_score DESC
  LIMIT 1;
$$;
"""
    },
    {
        "name": "Create fuzzy_match_customer RPC",
        "sql": """
CREATE OR REPLACE FUNCTION fuzzy_match_customer(query TEXT, uid UUID)
RETURNS TABLE(id BIGINT, name TEXT, credit_balance NUMERIC)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    c.id,
    c.name,
    c.credit_balance
  FROM customers c
  WHERE c.user_id = uid
    AND similarity(lower(c.name), lower(query)) > 0.2
  ORDER BY similarity(lower(c.name), lower(query)) DESC
  LIMIT 1;
$$;
"""
    },
    {
        "name": "Create increment_stock RPC",
        "sql": """
CREATE OR REPLACE FUNCTION increment_stock(p_id BIGINT, qty INT)
RETURNS VOID
LANGUAGE SQL
AS $$
  UPDATE products
  SET stock_quantity = stock_quantity + qty,
      updated_at = NOW()
  WHERE id = p_id;
$$;
"""
    },
    {
        "name": "Create decrement_stock RPC (idempotent)",
        "sql": """
CREATE OR REPLACE FUNCTION decrement_stock(p_id BIGINT, qty INT)
RETURNS VOID
LANGUAGE SQL
AS $$
  UPDATE products
  SET stock_quantity = GREATEST(0, stock_quantity - qty),
      updated_at = NOW()
  WHERE id = p_id;
$$;
"""
    },
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
