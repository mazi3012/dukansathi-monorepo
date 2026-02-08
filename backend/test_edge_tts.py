
import asyncio
import edge_tts
import os

async def test_simple_tts():
    text = "Hello, this is a test of the Microsoft Edge TTS system."
    voice = "en-US-AriaNeural"
    output_file = "test_audio.mp3"
    
    print(f"Testing TTS with voice: {voice}")
    print(f"Text: {text}")
    
    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_file)
        
        if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
            print(f"✅ Success! Audio saved to {output_file} ({os.path.getsize(output_file)} bytes)")
        else:
            print("❌ Failed: File created but empty or missing.")
            
    except Exception as e:
        print(f"❌ Error during TTS: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    loop = asyncio.get_event_loop_policy().get_event_loop()
    loop.run_until_complete(test_simple_tts())
