import sys
import os
import asyncio
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ai-bot'))

load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

from dukansathi_ai.agent_graph import process_user_input

async def test_legacy_gemini():
    print("Testing legacy gemini fallback...")
    
    user_token = "test_user_token_123"
    text = "Hello, are you fixed?"
    # Here simulate what the frontend sent when old model_id was in localstorage
    legacy_model_id = "gemini-2.0-flash-001" 
    
    print(f"User Input: {text}")
    print(f"Passed Model: {legacy_model_id}")
    
    try:
        response = await process_user_input(
            text=text, 
            user_token=user_token, 
            model=legacy_model_id
        )
        print("====== RESULT ======")
        print(f"Response: {response}")
        print("====== END ======")
        if "offline" in response.lower():
            print("FAIL: The brain is offline error is still present!")
        else:
            print("SUCCESS: Legacy gemini string was successfully intercepted and handled by Llama!")
    except Exception as e:
        print(f"Error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(test_legacy_gemini())
