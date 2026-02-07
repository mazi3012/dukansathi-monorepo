
import asyncio
import os
import sys
import base64

# Add current dir to path to import voice_service
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

try:
    from voice_service import speak_text
except ImportError:
    print("❌ Could not import voice_service. Make sure you are in the root directory.")
    sys.exit(1)

async def smoke_test():
    print("🚀 Starting TTS Smoke Test...")
    
    test_text = "Namaste! Main Sathi AI hoon. Kya aap mujhe sun sakte hain?"
    test_voice = "hi-IN-MadhurNeural"
    
    print(f"📡 Requesting TTS for: '{test_text}' with voice: {test_voice}")
    try:
        b64_audio = await speak_text(test_text, voice=test_voice)
        
        if not b64_audio:
            print("❌ Smoke Test Failed: speak_text returned None or empty string.")
            return

        print(f"✅ Received base64 audio (Length: {len(b64_audio)})")
        
        # Save to local file to verify it's a real audio file
        try:
            audio_data = base64.b64decode(b64_audio)
            with open("test_tts_output.mp3", "wb") as f:
                f.write(audio_data)
            print(f"💾 Audio saved to 'test_tts_output.mp3' ({len(audio_data)} bytes).")
            print("🟢 Smoke Test: TTS Backend is HEALTHY.")
        except Exception as e:
            print(f"❌ Failed to decode or save audio: {e}")
            
    except Exception as e:
        print(f"❌ Smoke Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(smoke_test())
