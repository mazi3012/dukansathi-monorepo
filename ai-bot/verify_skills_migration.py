import asyncio
import json
import websockets
import sys

# Color codes
GREEN = "\033[92m"
RED = "\033[91m"
RESET = "\033[0m"

WS_URL = "ws://127.0.0.1:8000/ws/chat"
USER_ID = "00000000-0000-0000-0000-000000000000"
TEST_MODEL = "phi3:mini"

async def test_websocket_flow():
    print(f"\n{GREEN}--- Starting WebSocket Integration Test ---{RESET}")
    
    try:
        # Use explicit origin parameter for websockets.connect
        # Note: The backend endpoint is defined as @app.websocket("/ws/chat") without path param
        async with websockets.connect(WS_URL, origin="http://localhost:5173") as websocket:
            print(f"Connected to {WS_URL}")
            
            # TEST 1: Customer Draft
            query = "Add a customer name Amit with contact 9988776655"
            print(f"\nSending Query: '{query}' with model {TEST_MODEL}")
            
            payload = {
                "type": "text",
                "content": query,
                "model": TEST_MODEL,
                "user_id": USER_ID
            }
            await websocket.send(json.dumps(payload))
            
            # Wait for response
            response = await websocket.recv()
            data = json.loads(response)
            print(f"Received: {data}")
            
            if "attachment" in data and data["attachment"]:
                draft = data["attachment"]
                if draft.get("type") == "customer_draft" or draft.get("draft_type") == "customer":
                     print(f"{GREEN}SUCCESS: Customer Draft Received!{RESET}")
                else:
                     print(f"{RED}FAILURE: Wrong draft type: {draft.get('type')}{RESET}")
            else:
                 print(f"{RED}FAILURE: No attachment found.{RESET}")

            # TEST 2: Payment Draft
            query = "Amit paid 500 rupees"
            print(f"\nSending Query: '{query}'")
            payload = {
                "type": "text",
                "content": query,
                "model": TEST_MODEL,
                "user_id": USER_ID
            }
            await websocket.send(json.dumps(payload))
            
            response = await websocket.recv()
            data = json.loads(response)
            print(f"Received: {data}")
            
            if "attachment" in data and data["attachment"]:
                draft = data["attachment"]
                if draft.get("type") == "payment_draft" or draft.get("draft_type") == "payment":
                     print(f"{GREEN}SUCCESS: Payment Draft Received!{RESET}")
                else:
                     print(f"{RED}FAILURE: Wrong draft type: {draft.get('type')}{RESET}")
            else:
                 print(f"{RED}FAILURE: No attachment found.{RESET}")

    except Exception as e:
        print(f"{RED}ERROR: {e}{RESET}")
        print("Ensure the backend server is running on localhost:8000")

if __name__ == "__main__":
    # Install websockets if missing: pip install websockets
    # But since we are inside the env, we might not have it.
    # We will try to run assuming it's there or use standard verify if complicates.
    # Actually, we can just use the previous verify script but verify that agent_graph works.
    # The websocket test confirms main.py integration.
    try:
        import websockets
        asyncio.run(test_websocket_flow())
    except ImportError:
        print("websockets module not found. Installing...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
        import websockets
        asyncio.run(test_websocket_flow())
