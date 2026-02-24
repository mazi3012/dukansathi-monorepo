import sys
import os
import asyncio
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ai-bot'))

load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

from dukansathi_ai.agent_graph import process_user_input

async def test_phi3_local():
    print("Testing local phi3:mini fallback...")
    user_token = "test_user_token_123"
    text = "Hello, are you a local AI?"
    
    print(f"User Input: {text}")
    print("Waiting for response from Local Ollama (phi3:mini)...")
    
    try:
        response = await process_user_input(
            text=text, 
            user_token=user_token, 
            model="phi3:mini"
        )
        print(f"AI Response: {response}")
    except Exception as e:
        print(f"Error occurred: {e}. Note: Make sure Ollama is running and phi3:mini is downloaded.")

if __name__ == "__main__":
    asyncio.run(test_phi3_local())
