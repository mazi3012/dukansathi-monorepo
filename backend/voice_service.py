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
    Convert text to speech using Microsoft Edge TTS (FREE)
    
    Args:
        text: Text to convert to speech
        voice: Voice ID (see options below)
        rate: Speech rate (e.g., "+0%", "-25%", "+50%")
        
    Returns:
        Base64-encoded audio string for frontend playback
        
    Why Edge TTS:
    - Completely free (no API key needed)
    - High-quality Indian voices
    - Hindi + English support
    - Works offline after first download
        
    Voice Options:
    Hindi:
    - hi-IN-MadhurNeural (Male, natural)
    - hi-IN-SwaraNeural (Female, clear)
    
    English (India):
    - en-IN-PrabhatNeural (Male)
    - en-IN-NeerjaNeural (Female)
    """
    try:
        # Create TTS communicator
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        
        # Use a temporary file instead of streaming to avoid async generator issues
        temp_filename = f"tts_{uuid.uuid4().hex}.mp3"
        
        await communicate.save(temp_filename)
        
        if not os.path.exists(temp_filename) or os.path.getsize(temp_filename) == 0:
            print("⚠️ speak_text: TTS file generation failed (empty or missing).")
            return None
            
        # Read the file back
        with open(temp_filename, "rb") as f:
            audio_bytes = f.read()
            
        # Clean up
        os.remove(temp_filename)
        
        # Return as base64 for frontend to decode and play
        b64_str = base64.b64encode(audio_bytes).decode('utf-8')
        print(f"✅ speak_text: Generated base64 string (Length: {len(b64_str)})")
        return b64_str
        
    except Exception as e:
        # Error handling with Hindi message
        print(f"❌ TTS Error in voice_service: {e}")
        import traceback
        traceback.print_exc()
        
        # Cleanup if error occurred after file creation
        try:
             if 'temp_filename' in locals() and os.path.exists(temp_filename):
                os.remove(temp_filename)
        except:
            pass
            
        return None
