
import asyncio
import os
import sys

# Add current dir to path to import voice_service
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

try:
    from voice_service import transcribe_audio
except ImportError:
    print("❌ Could not import voice_service. Make sure you are in the root directory.")
    sys.exit(1)

async def smoke_test():
    print("🚀 Starting STT Smoke Test...")
    
    # Check for API Key
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("⚠️ GROQ_API_KEY not found in environment. Please set it.")
        return

    # Create a dummy valid-ish audio stream (tiny webm header or just bytes)
    # Groq needs at least some valid data to not just error with 400
    # Let's try sending 100 bytes of zeros - it will likely return an error about 
    # invalid format, but that PROVES the API is reachable and the key is valid.
    dummy_audio = b"\x1a\x45\xdf\xa3" + b"\x00" * 100 # Minimal EBML/WebM-ish header
    
    print("📡 Sending dummy audio to Groq Whisper...")
    try:
        result = await transcribe_audio(dummy_audio)
        if result == "":
            print("ℹ️ STT returned empty string (expected for dummy data).")
        else:
            print(f"✅ STT Result: '{result}'")
            
        print("🟢 Smoke Test: API Connection is HEALTHY.")
    except Exception as e:
        print(f"❌ Smoke Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(smoke_test())
