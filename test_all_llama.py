import sys
import os
import asyncio
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ai-bot'))

load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

from dukansathi_ai.agent_graph import process_user_input, generate_sql_query, extract_action_params

async def test_all_llama():
    print("--- Testing ALL Llama-4 Pipelines ---")
    model_id = "llama-4-scout-17b-16e-instruct-maas"
    dummy_user = "test_user_id_123"
    
    print("\n[1] Testing Chat Pipeline...")
    try:
        chat_resp = await process_user_input("What is your name and capabilities?", dummy_user, model=model_id)
        print(f"PASS Chat Output: {chat_resp}")
    except Exception as e:
        print(f"FAIL Chat Error: {e}")

    print("\n[2] Testing SQL Generation Pipeline...")
    try:
        sql_query = "Show me all customers who owe me money"
        sql_resp = await generate_sql_query(sql_query, dummy_user, model=model_id)
        print(f"PASS SQL Output: {sql_resp}")
    except Exception as e:
        print(f"FAIL SQL Error: {e}")

    print("\n[3] Testing JSON Action Extraction Pipeline...")
    try:
        extract_query = "Add product Maggi price 15 rupees stock 50"
        json_resp = await extract_action_params(extract_query, model=model_id)
        print(f"PASS JSON Output: {json_resp}")
    except Exception as e:
        print(f"FAIL JSON Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_all_llama())
