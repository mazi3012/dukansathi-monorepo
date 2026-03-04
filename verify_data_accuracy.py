import asyncio
import os
import sys
import json
from unittest.mock import MagicMock, patch

# Force UTF-8 for printing to avoid charmap errors in Windows console
if sys.platform == "win32":
     import io
     sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf8')

# Add backend and ai-bot to path
sys.path.insert(0, os.path.abspath('backend'))
sys.path.insert(0, os.path.abspath('ai-bot'))

import local_db
from dukansathi_ai.agent_graph import process_user_input, fast_parse_action

async def verify_fixes():
    print("Verifying product name extraction and revenue reporting accuracy...")
    
    # 1. Test Regex for leading commas
    print("\nPhase 1: Testing product name extraction regex...")
    query = "add a product , maggie , price 20, cp 18, stock 50"
    result_json = fast_parse_action(query)
    result = json.loads(result_json)
    print(f"Extracted name: '{result.get('name')}'")
    if result.get('name') == "Maggie":
        print("SUCCESS: Name extracted correctly without leading comma.")
    else:
        print(f"FAILURE: Name extraction still buggy: '{result.get('name')}'")

    # 2. Test AI prioritization of DATA SNAPSHOT
    print("\nPhase 2: Verifying AI trusts snapshot over history...")
    user_token = "test_data_accuracy"
    model = "phi3:mini"
    
    # Simulate history containing "stock 50" but snapshot saying "stock 48"
    history = [
        {"role": "user", "message": "add a product dairy milk, stock 50, price 20"},
        {"role": "assistant", "message": "Sure, I've prepared the product draft. Please review and approve."}
    ]
    
    # Snapshot data
    mock_sales = [{"total_amount": 40.0, "customer_name": "Rahul"}]
    mock_products = [{"name": "Dairy Milk", "selling_price": 20.0, "stock_quantity": 48}]
    mock_customers = [{"name": "Rahul", "credit_balance": 0.0}]
    
    with patch("local_db.get_invoices_local", return_value=mock_sales), \
         patch("local_db.get_products_local", return_value=mock_products), \
         patch("local_db.get_customers_local", return_value=mock_customers), \
         patch("dukansathi_ai.agent_graph.get_chat_history", return_value=history):
        
        resp_data = await process_user_input(
            text="what is our total revenue and stock?", 
            user_token=user_token, 
            model=model, 
            is_demo=True
        )
        # Handle dict or string response
        resp = resp_data.get('messages')[0].content if isinstance(resp_data, dict) else str(resp_data)
        
        print(f"AI Response: {resp}")
        
        if "40" in resp and "48" in resp:
            print("SUCCESS: AI correctly reported 40 revenue and 48 stock from snapshot.")
        elif "50" in resp:
            print("FAILURE: AI still hallucinating 50 stock from history.")
        else:
            print("ERROR: AI summary incomplete or incorrect.")

if __name__ == "__main__":
    asyncio.run(verify_fixes())
