
import asyncio
import edge_tts
import os

VOICES = [
    "hi-IN-MadhurNeural",
    "hi-IN-SwaraNeural",
    "en-IN-PrabhatNeural",
    "en-IN-NeerjaNeural"
]

TEXT = "Namaste, this is a test."

async def test_voices():
    print("Testing voices...")
    available_voices = []
    
    # helper to check if a voice exists in the library
    all_voices = await edge_tts.list_voices()
    avg_ids = [v['ShortName'] for v in all_voices]
    
    for v in VOICES:
        if v in avg_ids:
            print(f"✅ Voice found in library: {v}")
        else:
            print(f"❌ Voice NOT found in library: {v}")

    print("\nGenerating audio samples...")
    for voice in VOICES:
        output_file = f"test_{voice}.mp3"
        try:
            communicate = edge_tts.Communicate(TEXT, voice)
            await communicate.save(output_file)
            if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                print(f"✅ Success: {voice} -> {output_file}")
                # clean up
                os.remove(output_file)
                available_voices.append(voice)
            else:
                print(f"❌ Failed (Empty File): {voice}")
        except Exception as e:
            print(f"❌ Error: {voice} -> {e}")

    print(f"\nSummary: {len(available_voices)}/{len(VOICES)} voices working.")

if __name__ == "__main__":
    asyncio.run(test_voices())
