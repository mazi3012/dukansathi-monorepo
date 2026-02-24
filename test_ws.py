import asyncio
import websockets
import json

async def test_websocket():
    # Test the new aligned route
    uri = "ws://localhost:8000/ws/chat"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected to WebSocket!")
            
            message = {
                "type": "text",
                "content": "Hello, can you help me?",
                "access_token": "test_token_12345"
            }
            
            print(f"Sending: {json.dumps(message)}")
            await websocket.send(json.dumps(message))
            
            print("Waiting for response...")
            response = await websocket.recv()
            print(f"Received: {response}")
            
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket())
