import asyncio
import os
import sys
import json
from unittest.mock import MagicMock, patch

# Add backend and ai-bot to path
sys.path.insert(0, os.path.abspath('backend'))
sys.path.insert(0, os.path.abspath('ai-bot'))

from dukansathi_ai.agent_graph import fast_parse_action, extract_action_params_local

async def verify_action_parsing():
    print("Verifying action parsing improvements...")
    
    test_queries = [
        "make a bill for amit , with 2 maggie",
        "bill of Rahul 5 rice and 2 dal",
        "create bill for Sunil 1 soap"
    ]
    
    for q in test_queries:
        print(f"\nQuery: {q}")
        # Test Fast Parse
        fast_result = fast_parse_action(q)
        if fast_result:
            print(f"Fast Parse Success: {fast_result}")
            data = json.loads(fast_result)
            if data.get("type") == "invoice_draft":
                print(f" - Customer: {data.get('customer_name')}")
                print(f" - Items: {len(data.get('items', []))}")
        else:
            print("Fast Parse Failed. Falling back to LLM simulation...")
            # Simulate LLM if fast parse fails (though we want fast parse to work)
            llm_result = await extract_action_params_local(q, model="phi3:mini")
            print(f"LLM Parse Result: {llm_result}")

if __name__ == "__main__":
    asyncio.run(verify_action_parsing())
