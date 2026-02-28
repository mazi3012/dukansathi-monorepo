import asyncio
import os
import sys

# Add backend and ai-bot to path
sys.path.insert(0, os.path.abspath('backend'))
sys.path.insert(0, os.path.abspath('ai-bot'))

import local_db
from dukansathi_ai.agent_graph import process_user_input

async def check_snapshot():
    print("Checking Agent Graph's view of the local database...")
    
    # We don't even need to call process_user_input, just import local_db and call the same functions agent_graph uses
    local_sales = local_db.get_invoices_local()
    total_rev = sum(s.get('total_amount', 0) for s in local_sales)
    
    print(f"Number of sales found: {len(local_sales)}")
    print(f"Total Revenue calculated: {total_rev}")
    
    if local_sales:
        print(f"Sample sale: {local_sales[0]}")
        
    local_products = local_db.get_products_local()
    print(f"Number of products: {len(local_products)}")
    if local_products:
        print(f"Sample product: {dict(local_products[0])}")

if __name__ == "__main__":
    asyncio.run(check_snapshot())
