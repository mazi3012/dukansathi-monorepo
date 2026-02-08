import asyncio
import edge_tts

async def list_voices():
    voices = await edge_tts.list_voices()
    print(f"Found {len(voices)} voices.")
    
    # Filter for India
    india_voices = [v for v in voices if "IN" in v['ShortName']]
    
    print("\n--- Indian Voices ---")
    for v in india_voices:
        print(f"Name: {v['ShortName']}, Gender: {v['Gender']}, Loc: {v['Locale']}")

if __name__ == "__main__":
    asyncio.run(list_voices())
