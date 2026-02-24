import sys
import os
import asyncio
from dotenv import load_dotenv

# Add backend and ai-bot to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ai-bot'))

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

from dukansathi_ai.agent_graph import process_user_input

async def test_llama_model():
    print("Testing llama-4-scout-17b-16e-instruct-maas model...")
    # Using a dummy token or a valid one if needed. The system might require a valid user_token to fetch history
    # We will just use 'test_user_token_123'
    user_token = "test_user_token_123"
    text = "Hello, what models do you use to power your intelligence?"
    
    print(f"User Input: {text}")
    print("Waiting for response...")
    
    try:
        response = await process_user_input(
            text=text, 
            user_token=user_token, 
            model="llama-4-scout-17b-16e-instruct-maas"
        )
        print(f"AI Response: {response}")
    except Exception as e:
        print(f"Error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(test_llama_model())
