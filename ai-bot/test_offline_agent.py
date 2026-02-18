import asyncio
import sys
import os
import json

# Setup paths - Insert at 0 to prioritize local source over site-packages
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "dukansathi_ai"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))

# Load Env (Essential for agent_graph init)
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../backend/.env"))

# Set dummy if missing (for pure offline test)
if not os.getenv("SUPABASE_URL"):
    os.environ["SUPABASE_URL"] = "https://example.supabase.co"
if not os.getenv("SUPABASE_SERVICE_KEY"):
    os.environ["SUPABASE_SERVICE_KEY"] = "dummy_key"

import dukansathi_ai.agent_graph
print(f"DEBUG: Loaded agent_graph from {dukansathi_ai.agent_graph.__file__}")

from dukansathi_ai.agent_graph import process_user_input
import local_db

# Mock user
USER_ID = "00000000-0000-0000-0000-000000000000"

def seed_data():
    conn = local_db.get_db_connection()
    c = conn.cursor()
    # Clear and seed
    c.execute("DELETE FROM products")
    c.execute("INSERT INTO products (name, selling_price, stock_quantity, user_id) VALUES ('Maggi', 12, 100, ?)", (USER_ID,))
    conn.commit()
    conn.close()
    print("Seeded Local DB with 'Maggi'")

async def test_offline_flow():
    seed_data()
    
    print("\n--- TEST 1: Offline Draft Creation (Action) ---")
    response = await process_user_input("Add Maggi price 12 qty 5", USER_ID, model="phi3:mini")
    print(f"Agent Response: {response}")
    
    # Check if draft is in local DB (Logic in action_node should save it)
    conn = local_db.get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM draft_invoices")
    drafts = c.fetchall()
    conn.close()
    
    if drafts:
        print(f"Local Draft Found: {dict(drafts[0])}")
    else:
        print("No Local Draft Saved!")

    print("\n--- TEST 2: Offline Search (Business) ---")
    # This might fail if SQL generation is too complex for phi3:mini, but let's see
    response_search = await process_user_input("Show products", USER_ID, model="phi3:mini")
    print(f"Search Response: {response_search}")

if __name__ == "__main__":
    asyncio.run(test_offline_flow())
