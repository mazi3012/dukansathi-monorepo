"""
File: voice_service.py
Purpose: Speech-to-Text (Groq) and Text-to-Speech (Google Cloud) services
Author: Dukan Sathi Team
Created: 2026-02-05
Updated: 2026-02-10 (Migrated to Google Cloud TTS)

This module provides:
- STT via Groq's free Whisper API (whisper-large-v3)
- TTS via Google Cloud Text-to-Speech (Official API)
  - Supports Hindi, English (India), and Assamese
  - High quality Neural2 voices
"""

import os
import io
import base64
import tempfile
import json
from groq import AsyncGroq
from google.cloud import texttospeech
from dotenv import load_dotenv

load_dotenv()

# Initialize Async Groq Client for STT
groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

# Initialize Google Cloud TTS Client
# Automatically uses GOOGLE_APPLICATION_CREDENTIALS from .env
try:
    tts_client = texttospeech.TextToSpeechClient()
    print("✅ Google Cloud TTS Client initialized successfully")
except Exception as e:
    print(f"❌ Failed to initialize Google Cloud TTS: {e}")
    tts_client = None

# Voice Mapping: Frontend ID -> Google Cloud Voice Name
# Using Neural2 for Hindi/English (High Quality) and Standard for Assamese
VOICE_MAPPING = {
    # Hindi (India)
    "hi-IN-MadhurNeural": "hi-IN-Neural2-D",  # Male
    "hi-IN-SwaraNeural": "hi-IN-Neural2-A",   # Female
    
    # English (India)
    "en-IN-PrabhatNeural": "en-IN-Neural2-B", # Male
    "en-IN-NeerjaNeural": "en-IN-Neural2-A",  # Female
    
    # Bengali (India)
    "bn-IN-Wavenet-B": "bn-IN-Wavenet-B",   # Male
    "bn-IN-Wavenet-A": "bn-IN-Wavenet-A",   # Female
    
    # Fallbacks / Legacy
    "en-US-GuyNeural": "en-US-Neural2-D",
    "en-US-JennyNeural": "en-US-Neural2-C"
}

async def transcribe_audio(audio_data: bytes) -> str:
    """
    Convert speech to text using Groq's Whisper model (FREE)
    """
    try:
        audio_file = io.BytesIO(audio_data)
        audio_file.name = "audio.webm"
        
        print(f"STT: Transcribing {len(audio_data)} bytes...")
        
        transcription = await groq_client.audio.transcriptions.create(
            file=(audio_file.name, audio_file),
            model="whisper-large-v3",
            response_format="json",
            temperature=0.0
        )
        
        print(f"STT Result: '{transcription.text}'")
        return transcription.text
        
    except Exception as e:
        print(f"STT Error: {e}")
        return ""


async def speak_text(
    text: str,
    voice: str = "en-IN-PrabhatNeural",
    rate: str = "+0%"
) -> str:
    """
    Convert text to speech using Google Cloud TTS
    
    Args:
        text: Text to synthesize
        voice: Voice ID from frontend (mapped to Google voice)
        rate: Speech rate (e.g., "+0%", "+10%")
    
    Returns:
        Base64 encoded MP3 audio
    """
    if not tts_client:
        print("❌ TTS Error: Google Cloud Client not initialized")
        return None

    try:
        # Validate and map voice
        google_voice_name = VOICE_MAPPING.get(voice)
        if not google_voice_name:
            print(f"⚠️ Unknown voice '{voice}', defaulting to 'en-IN-Neural2-B'")
            google_voice_name = "en-IN-Neural2-B"
            
        # Parse language code from voice name (e.g., "hi-IN-Neural2-D" -> "hi-IN")
        language_code = "-".join(google_voice_name.split("-")[:2])
        
        # Calculate speaking rate
        # Google accepts 0.25 to 4.0. Default is 1.0.
        # Frontend sends "+10%", "-10%", "+0%"
        speaking_rate = 1.0
        try:
            if rate.endswith('%'):
                percent = int(rate.replace('%', '').replace('+', ''))
                # +10% -> 1.1, -10% -> 0.9
                speaking_rate = 1.0 + (percent / 100.0)
        except Exception:
            speaking_rate = 1.0
            
        print(f"🔊 Google TTS: voice='{google_voice_name}' (lang={language_code}), rate={speaking_rate}")
        print(f"🔊 Text: '{text[:50]}...'")

        # 1. Set the text input
        synthesis_input = texttospeech.SynthesisInput(text=text)

        # 2. Build the voice request
        voice_params = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=google_voice_name
        )

        # 3. Select the type of audio file you want returned
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=speaking_rate
        )

        # 4. Perform the text-to-speech request
        response = tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice_params,
            audio_config=audio_config
        )

        # 5. Return base64 audio
        audio_bytes = response.audio_content
        b64_str = base64.b64encode(audio_bytes).decode('utf-8')
        
        print(f"✅ Google TTS Success: Generated {len(audio_bytes)} bytes")
        return b64_str
        
    except Exception as e:
        print(f"❌ Google TTS Error: {e}")
        import traceback
        print(traceback.format_exc())
        return None
