import sys
import os
import asyncio

# Ensure project root is in path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
# Load .env from backend
load_dotenv(os.path.join(os.path.dirname(__file__), "../backend/.env"))

from dukansathi_ai.agent_graph import process_user_input

async def main():
    print("Testing Llama 4 Scout Reply via Vertex AI...")
    try:
        response = await process_user_input(
            text="Hi Sathi, who are you?",
            user_token="fresh_user_123",
            model="llama-4-scout-17b-16e-instruct-maas"
        )
        print("\n--- MODEL REPLY ---")
        print(response)
        print("-------------------")
    except Exception as e:
        print(f"Error during generation: {e}")

if __name__ == "__main__":
    asyncio.run(main())
