"""
File: test_moltbot.py
Purpose: Test script for Moltbot AI agent
Author: Dukan Sathi Team
Created: 2026-02-05

This script tests the Moltbot agent locally without needing the full backend.
Run with: python test_moltbot.py
"""

import asyncio
import os
import sys

# Fix Windows console encoding for Hindi/Unicode
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())

# Add the package to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'dukansathi_ai'))

from dukansathi_ai.agent_graph import process_user_input

async def test_moltbot():
    """
    Test Moltbot with various queries
    """
    print("=" * 60)
    print("MOLTBOT TEST - Dukan Sathi AI Brain")
    print("=" * 60)
    
    # Dummy token for testing (replace with actual Supabase token for real tests)
    test_token = "test_token_12345"
    
    # Test cases
    test_queries = [
        "Hello Moltbot",
        "Namaste",
        "What is the stock?",
        "Show me today's sales",
        "राज को 500 रुपये का बिल बनाओ",
        "Thanks",
    ]
    
    print("\nRunning test queries...\n")
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n{'='*60}")
        print(f"Test {i}/{len(test_queries)}")
        print(f"User: {query}")
        print(f"{'-'*60}")
        
        try:
            response = await process_user_input(query, test_token)
            print(f"Moltbot: {response}")
            
        except Exception as e:
            print(f"❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
        
        # Small delay between tests
        await asyncio.sleep(0.5)
    
    print("\n" + "=" * 60)
    print("✅ Testing Complete!")
    print("=" * 60)

if __name__ == "__main__":
    # Run the async test
    asyncio.run(test_moltbot())
