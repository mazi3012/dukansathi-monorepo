import asyncio
import sys
import os
import json

# Setup paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "dukansathi_ai"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))

# Load Env
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../backend/.env"))

# Set dummy if missing
os.environ["SUPABASE_URL"] = os.getenv("SUPABASE_URL", "https://example.supabase.co")
os.environ["SUPABASE_SERVICE_KEY"] = os.getenv("SUPABASE_SERVICE_KEY", "dummy_key")

from dukansathi_ai.agent_graph import process_user_input
import local_db

USER_ID = "00000000-0000-0000-0000-000000000000"
TEST_MODEL = "phi3:mini"

async def run_test(query):
    print(f"\n--- Testing Query: '{query}' ---")
    try:
        response_raw = await process_user_input(query, USER_ID, model=TEST_MODEL)
        print(f"Raw Response: {response_raw}")
        try:
            payload = json.loads(response_raw)
            print(f"Parsed JSON Payload: {payload}")
            if "draft" in payload and payload["draft"]:
                print("SUCCESS: Draft object found!")
            else:
                print("FAILURE: No draft object in payload.")
        except:
            print("FAILURE: Response is not valid JSON.")
    except Exception as e:
        print(f"Error: {e}")

async def main():
    local_db.init_db()
    # The user's exact query
    await run_test("add a customer name amit with contact 6901739134")

if __name__ == "__main__":
    asyncio.run(main())
