import asyncio
import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "ai-bot"))
from dotenv import load_dotenv
load_dotenv("e:\\dukanv22\\backend\\.env")
from dukansathi_ai.agent_graph import process_user_input

# Use the test user ID
TEST_USER_ID = "00000000-0000-0000-0000-000000000000"

async def test_date():
    print("Testing Date Context...")
    response = await process_user_input(
        text="What is today's date?",
        user_token=TEST_USER_ID,
        model="llama-4-scout-17b-16e-instruct-maas"
    )
    print(f"Date Response: {response}")

if __name__ == "__main__":
    asyncio.run(test_date())
