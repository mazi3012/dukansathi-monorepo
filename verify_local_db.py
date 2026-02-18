import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_local_api_endpoints():
    print("\n--- Testing Local API Endpoints ---")
    try:
        # 1. Test Customers
        print("Fetching Local Customers...")
        resp = requests.get(f"{BASE_URL}/api/local/customers")
        if resp.status_code == 200:
            print(f"✅ /api/local/customers: OK ({len(resp.json())} records)")
        else:
            print(f"❌ /api/local/customers: Failed ({resp.status_code})")
            
        # 2. Test Products
        print("Fetching Local Products...")
        resp = requests.get(f"{BASE_URL}/api/local/products")
        if resp.status_code == 200:
            print(f"✅ /api/local/products: OK ({len(resp.json())} records)")
        else:
            print(f"❌ /api/local/products: Failed ({resp.status_code})")
            
    except Exception as e:
        print(f"❌ API Connection Error: {e}")
        print("Ensure the backend is running on port 8000!")

def simulate_draft_approval():
    print("\n--- Simulating Draft Approval (Backend Logic) ---")
    # This is trickier to test purely via API without WebSocket, 
    # but we can verify the DB write if we had a way to trigger it.
    # For now, we rely on the manual walkthrough steps.
    print("ℹ️  To verify draft persistence:")
    print("1. Start the app")
    print("2. Ask AI: 'Add customer TestUser 1234567890'")
    print("3. Approve the draft")
    print("4. Re-run this script to see if TestUser appears in /api/local/customers")

if __name__ == "__main__":
    test_local_api_endpoints()
    simulate_draft_approval()
