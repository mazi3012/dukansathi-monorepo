import asyncio
import os
import sys
from unittest.mock import MagicMock, patch

# Add backend and ai-bot to path
sys.path.insert(0, os.path.abspath('backend'))
sys.path.insert(0, os.path.abspath('ai-bot'))

import local_db
from dukansathi_ai.agent_graph import process_user_input

async def verify_revenue_fix():
    print("Verifying revenue hallucination fix...")
    
    # Mock local_db.get_invoices_local to return revenue of 20
    test_sales = [{"total_amount": 20}]
    
    with patch("local_db.get_invoices_local", return_value=test_sales), \
         patch("local_db.get_products_local", return_value=[]), \
         patch("local_db.get_customers_local", return_value=[]):
        
        # We need to simulate a guest/demo session
        user_token = "demo_session"
        text = "what is our total revenue"
        
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
        
        if "20 lakh" in response.lower():
            print("FAILURE: AI still hallucinated 'lakh'!")
        elif "20" in response or "twenty" in response.lower():
            print("SUCCESS: AI correctly reported '20' without 'lakh'.")
        else:
            print("AMBIGUOUS: AI response didn't contain '20'. Check content.")

if __name__ == "__main__":
    asyncio.run(verify_revenue_fix())
