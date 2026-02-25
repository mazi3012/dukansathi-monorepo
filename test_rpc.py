import os
import asyncio
from supabase import create_client
from dotenv import load_dotenv

load_dotenv("e:\\dukanv22\\backend\\.env")
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

TEST_USER_ID = "00000000-0000-0000-0000-000000000000"

def test_rpc_due_payment():
    print("--- Testing Payment RPCs ---")
    
    # Ensure test customer exists
    cust_res = supabase.table("customers").select("id, credit_balance").eq("name", "TestCustomer").eq("user_id", TEST_USER_ID).execute()
    
    if not cust_res.data:
        new_cust = supabase.table("customers").insert({"name": "TestCustomer", "user_id": TEST_USER_ID, "credit_balance": 0}).execute()
        cust_id = new_cust.data[0]["id"]
        print("Created TestCustomer.")
    else:
        cust_id = cust_res.data[0]["id"]
        # Reset to 0
        supabase.table("customers").update({"credit_balance": 0}).eq("id", cust_id).execute()
        print("Reset TestCustomer balance to 0.")

    # 1. Add Due (500)
    print("\nAdding 500 Due...")
    res1 = supabase.rpc("add_customer_credit", {
        "p_user_id": TEST_USER_ID,
        "p_customer_id": cust_id,
        "p_amount": 500
    }).execute()
    print(f"New Balance (Expected 500): {res1.data}")

    # 2. Receive Payment (300)
    print("\nReceiving 300 Payment...")
    res2 = supabase.rpc("receive_payment", {
        "p_user_id": TEST_USER_ID,
        "p_customer_id": cust_id,
        "p_amount": 300
    }).execute()
    print(f"New Balance (Expected 200): {res2.data}")

    # 3. Receive Payment Overdue (500) - Should clamp to 0, not negative
    print("\nReceiving 500 Payment (Over-payment guard test)...")
    res3 = supabase.rpc("receive_payment", {
        "p_user_id": TEST_USER_ID,
        "p_customer_id": cust_id,
        "p_amount": 500
    }).execute()
    print(f"New Balance (Expected 0, NOT -300): {res3.data}")

if __name__ == "__main__":
    test_rpc_due_payment()
