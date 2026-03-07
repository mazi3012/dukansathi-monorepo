import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

sql = """
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_type TEXT DEFAULT 'exclusive' CHECK (tax_type IN ('inclusive', 'exclusive'));
COMMENT ON COLUMN products.tax_type IS 'Whether the selling price is inclusive or exclusive of GST';
"""

try:
    # Use rpc if running raw SQL is restricted, but the service key usually allows it via migrations or direct execute
    # Since we need to run DDL, and I don't have a specific RPC for it, 
    # I'll rely on the fact that migrations are normally managed via supabase-py or similar.
    # Actually, Supabase doesn't have a direct 'execute_sql' in the python client easily available for DDL 
    # unless you have a custom RPC.
    
    # Alternative: check if I can just use a simple POST request to the postgres endpoint if enabled
    print("Please run this SQL in your Supabase Dashboard SQL Editor:")
    print(sql)
except Exception as e:
    print(f"Error: {e}")
