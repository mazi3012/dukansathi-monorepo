import asyncio
import os
import sys
import json
from unittest.mock import MagicMock, patch

# Add backend and ai-bot to path
sys.path.insert(0, os.path.abspath('backend'))
sys.path.insert(0, os.path.abspath('ai-bot'))

import local_db
from dukansathi_ai.agent_graph import process_user_input, MEMORY_STORE

async def verify_demo_reset():
    print("Verifying demo reset isolation...")
    
    user_token = "demo_session"
    model = "phi3:mini"
    
    # 1. Simulate a previous session with state
    print("\nPhase 1: Creating a previous session context...")
    # Mock some sales in the DB so AI sees them
    test_sales = [{"total_amount": 100}]
    
    with patch("local_db.get_invoices_local", return_value=test_sales), \
         patch("local_db.get_products_local", return_value=[]), \
         patch("local_db.get_customers_local", return_value=[]):
        
        resp1 = await process_user_input(
            text="we sold items worth 100 today", 
            user_token=user_token, 
            model=model, 
            is_demo=True
        )
        print(f"AI Response 1: {resp1}")
        
        # Verify memory exists
        session_id = list(MEMORY_STORE.keys())[0] if MEMORY_STORE else None
        print(f"Memory Store Sessions: {list(MEMORY_STORE.keys())}")
    
    # 2. Trigger Reset (Directly call the logic we added to main.py or simulate it)
    print("\nPhase 2: Resetting Demo...")
    from dukansathi_ai.agent_graph import clear_user_memory
    clear_user_memory("demo_session")
    
    # 3. Verify fresh start
    print("\nPhase 3: Verifying fresh state...")
    # Mock EMPTY DB now
    with patch("local_db.get_invoices_local", return_value=[]), \
         patch("local_db.get_products_local", return_value=[]), \
         patch("local_db.get_customers_local", return_value=[]):
        
        resp2 = await process_user_input(
            text="what is total revenue?", 
            user_token=user_token, 
            model=model, 
            is_demo=True
        )
        print(f"AI Response 2: {resp2}")
        
        if "100" in resp2 or "hundred" in resp2.lower():
            print("FAILURE: AI still remembers the previous 100 revenue!")
        else:
            print("SUCCESS: AI has no memory of the previous 100 revenue.")

if __name__ == "__main__":
    asyncio.run(verify_demo_reset())
