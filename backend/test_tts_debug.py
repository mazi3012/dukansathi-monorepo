import asyncio
import edge_tts
import os

async def test_tts():
    text = "Hello, this is a test of the voice system."
    voice = "en-IN-PrabhatNeural"
    rate = "+0%"
    
    print(f"Testing TTS with Voice: {voice}, Rate: {rate}")
    
    try:
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        audio_bytes = b""
        
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_bytes += chunk["data"]
        
        if audio_bytes:
            print(f"✅ Success! Generated {len(audio_bytes)} bytes of audio.")
            # optional: save to file to verify
            with open("test_output.mp3", "wb") as f:
                f.write(audio_bytes)
            print("Saved to test_output.mp3")
        else:
            print("❌ Failed: No audio bytes received.")
            
    except Exception as e:
        print(f"❌ Error occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_tts())
