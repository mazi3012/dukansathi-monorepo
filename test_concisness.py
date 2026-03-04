import asyncio
import os
import sys
from unittest.mock import MagicMock, patch

# Add backend and ai-bot to path
sys.path.insert(0, os.path.abspath('backend'))
sys.path.insert(0, os.path.abspath('ai-bot'))

import local_db
from dukansathi_ai.agent_graph import process_user_input

async def verify_concisness():
    print("Verifying conciseness and role marker suppression...")
    
    # Mock local_db.get_invoices_local to return revenue of 40
    test_sales = [{"total_amount": 20}, {"total_amount": 20}]
    
    with patch("local_db.get_invoices_local", return_value=test_sales), \
         patch("local_db.get_products_local", return_value=[]), \
         patch("local_db.get_customers_local", return_value=[]):
        
        user_token = "demo_session_concise_test"
        text = "what is total sale?"
        
        print(f"Query: {text}")
        
        # Use a local model for testing (phi3:mini)
        response = await process_user_input(
            text=text, 
            user_token=user_token, 
            model="phi3:mini", 
            is_demo=True
        )
        
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        print(f"AI Response: {response}")
        
        # CHECK 1: Length
        words = response.split()
        if len(words) > 20:
             print(f"FAILURE: Response too long ({len(words)} words)!")
        else:
             print(f"SUCCESS: Response is concise ({len(words)} words).")
             
        # CHECK 2: Role Markers
        bad_markers = ["User:", "Assistant:", "User Assistant:"]
        found_marker = False
        for marker in bad_markers:
            if marker.lower() in response.lower():
                print(f"FAILURE: Found role marker '{marker}' in response!")
                found_marker = True
                break
        
        if not found_marker:
            print("SUCCESS: No role markers found.")

if __name__ == "__main__":
    asyncio.run(verify_concisness())
