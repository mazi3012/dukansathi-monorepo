"""
File: voice_service.py
Purpose: Speech-to-Text (Groq) and Text-to-Speech (Edge TTS) services
Author: Dukan Sathi Team
Created: 2026-02-05

This module provides:
- STT via Groq's free Whisper API (whisper-large-v3)
- TTS via Microsoft Edge TTS (free, Hindi/English support)
"""

import os
import io
import base64
import tempfile
import uuid
from groq import AsyncGroq
import edge_tts
from dotenv import load_dotenv

load_dotenv()

# Initialize Async Groq Client for STT
groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

# Valid voice options for validation
VALID_VOICES = {
    "hi-IN-MadhurNeural": "Hindi (Male)",
    "hi-IN-SwaraNeural": "Hindi (Female)",
    "en-IN-PrabhatNeural": "English India (Male)",
    "en-IN-NeerjaNeural": "English India (Female)",
    "en-US-GuyNeural": "English US (Male)",
    "en-US-JennyNeural": "English US (Female)"
}

async def transcribe_audio(audio_data: bytes) -> str:
    """
    Convert speech to text using Groq's Whisper model (FREE)
    
    Args:
        audio_data: Audio bytes (webm format from browser)
        
    Returns:
        Transcribed text in Hindi/English
        
    Why Groq:
    - Completely free Whisper API
    - Faster than OpenAI Whisper
    - Auto-detects Hindi/English
    - No quotas or limits for MVP
    """
    try:
        # Create file-like object (Groq expects file upload)
        audio_file = io.BytesIO(audio_data)
        audio_file.name = "audio.webm"  # Browser typically sends webm
        
        print(f"STT: Transcribing {len(audio_data)} bytes...")
        
        # Call Groq Whisper API
        transcription = await groq_client.audio.transcriptions.create(
            file=(audio_file.name, audio_file),
            model="whisper-large-v3",  # Best accuracy model
            response_format="json",
            # language auto-detected (Hindi/Hinglish support)
            temperature=0.0  # Deterministic output
        )
        
        print(f"STT Result: '{transcription.text}'")
        return transcription.text
        
    except Exception as e:
        # User-friendly error handling
        print(f"STT Error: {e}")
        return ""


async def speak_text(
    text: str,
    voice: str = "en-IN-PrabhatNeural",
    rate: str = "+0%"
) -> str:
    """
    Convert text to speech using Microsoft Edge TTS (Legacy Stream Implementation)
    """
    try:
        # VALIDATE VOICE ID
        if voice not in VALID_VOICES:
            print(f"⚠️ WARNING: Invalid voice '{voice}', falling back to default 'en-IN-PrabhatNeural'")
            voice = "en-IN-PrabhatNeural"
        
        # DETAILED LOGGING - Track exactly what voice is being used
        print(f"🔊 TTS: Using voice='{voice}' ({VALID_VOICES.get(voice, 'Unknown')}), rate='{rate}'")
        print(f"🔊 TTS: Generating audio for text: '{text[:50]}...'")
        
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        audio_bytes = b""
        
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_bytes += chunk["data"]
                
        if not audio_bytes:
            print("❌ TTS: No audio bytes generated!")
            return None

        # Return as base64 for frontend to decode and play
        b64_str = base64.b64encode(audio_bytes).decode('utf-8')
        print(f"✅ TTS Success: Generated {len(audio_bytes)} bytes ({len(b64_str)} base64 chars) using voice '{voice}'")
        return b64_str
        
    except Exception as e:
        print(f"❌ TTS Error in voice_service: {e}")
        import traceback
        print(traceback.format_exc())
        return None
