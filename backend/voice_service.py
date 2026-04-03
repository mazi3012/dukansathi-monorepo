"""
voice_service.py
Purpose: Cloud-only Speech-to-Text (Groq Whisper) and Text-to-Speech
         - Sarvam AI: Bengali (bn-IN) — elite quality for Indian languages
         - Google TTS: English (en-IN, en-US) and Hinglish (hi-IN) — reliable and fast
"""

import os
import io
import re
import base64
import asyncio
from typing import Optional
from google.cloud import texttospeech
from groq import AsyncGroq
from dotenv import load_dotenv
import logging
import requests

# Load .env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(env_path if os.path.exists(env_path) else None)

logger = logging.getLogger(__name__)

# --- Groq STT Client ---
groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

# --- Sarvam AI Client (for Bengali) ---
SARVAM_API_KEY = os.environ.get("SARVAM_API_KEY")
if SARVAM_API_KEY:
    logger.info("[OK] Sarvam AI TTS initialized (Bengali)")
else:
    logger.warning("[WARN] Sarvam AI API key missing. Bengali TTS will fallback to Google.")

# --- Google Cloud TTS Client (for English) ---
tts_client = None
try:
    if os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or os.getenv("K_SERVICE"):
        tts_client = texttospeech.TextToSpeechClient()
        logger.info("[OK] Google Cloud TTS initialized (English)")
    else:
        logger.warning("[WARN] Google Cloud credentials not found.")
except Exception as e:
    logger.error(f"[ERR] Failed to initialize Google Cloud TTS: {e}")

# --- Language Code Mapping (ai_language → Whisper language code) ---
LANG_TO_WHISPER = {
    "english":  "en",
    "hinglish": "hi",   # Groq Whisper handles Hindi/Hinglish with 'hi'
    "bangla":   "bn",   # Bengali (Kolkata Bangla)
}

# ─── Sarvam AI Voice Mapping (Bengali only) ───────────────────────────────
# Bulbul v3 is optimized for Indian languages.
#   - Mishti (female): Warm and natural for Bengali
#   - Shubh (male): Professional and clear for Bengali
SARVAM_VOICE_MAPPING = {
    "bn-IN-BashkarNeural": "shubh",
    "bn-IN-TanishaNeural": "priya",
}

SARVAM_URL = "https://api.sarvam.ai/text-to-speech"


# ─── Google TTS Voice Mapping (English only) ─────────────────────────────────
GOOGLE_VOICE_MAPPING = {
    "en-IN-PrabhatNeural": "en-IN-Neural2-B",   # Male  — Indian English
    "en-IN-NeerjaNeural":  "en-IN-Neural2-A",   # Female — Indian English
    "en-US-GuyNeural":     "en-US-Neural2-D",   # Male  — US English fallback
    "en-US-JennyNeural":   "en-US-Neural2-C",   # Female — US English fallback
}


# ─── STT ─────────────────────────────────────────────────────────────────────

def _mime_to_filename(mime_type: Optional[str]) -> str:
    """Map MIME type to a filename extension that Groq can parse reliably."""
    if not mime_type:
        return "audio.webm"

    normalized = mime_type.lower()
    if "mp4" in normalized or "m4a" in normalized:
        return "audio.m4a"
    if "ogg" in normalized:
        return "audio.ogg"
    if "wav" in normalized:
        return "audio.wav"
    if "mpeg" in normalized or "mp3" in normalized:
        return "audio.mp3"
    return "audio.webm"


async def transcribe_audio(audio_data: bytes, language: str = "hinglish", mime_type: Optional[str] = None) -> str:
    """Convert speech to text using Groq Whisper API."""
    whisper_lang = LANG_TO_WHISPER.get(language, "hi")
    try:
        audio_file = io.BytesIO(audio_data)
        audio_file.name = _mime_to_filename(mime_type)
        logger.info(f"[STT] {len(audio_data)} bytes | mime='{mime_type or 'unknown'}' | lang='{whisper_lang}' (pref='{language}')")
        transcription = await groq_client.audio.transcriptions.create(
            file=(audio_file.name, audio_file),
            model="whisper-large-v3",
            response_format="json",
            language=whisper_lang,
            temperature=0.0,
            # Prime Whisper with a short Hinglish/Roman example to prefer Roman script output.
            # IMPORTANT: This must be example speech text, NOT instructions — Whisper echoes instructions.
            prompt="Hamza ka bill banao do Maggi aur teen Parle-G. Aaj ka revenue kitna hua boss?" if whisper_lang in ("hi", "bn") else None
        )
        logger.info(f"[STT] Result: '{transcription.text}'")
        return transcription.text
    except Exception as e:
        logger.error(f"[STT] Groq transcription failed: {e}")
        return ""


# ─── TTS ─────────────────────────────────────────────────────────────────────

async def _synthesize_sarvam(text: str, voice_id: str) -> Optional[str]:
    """Synthesize using Sarvam AI Bulbul v3 — primarily for Bengali."""
    if not SARVAM_API_KEY:
        return None
    try:
        speaker = SARVAM_VOICE_MAPPING.get(voice_id, "priya")
        logger.info(f"[TTS] Sarvam AI: voice='{speaker}'")
        
        payload = {
            "inputs": [text],
            "target_language_code": "bn-IN",
            "speaker": speaker,
            "model": "bulbul:v3",
            "sampling_rate": 24000,
            "enable_preprocessing": True
        }
        headers = {
            "api-subscription-key": SARVAM_API_KEY,
            "Content-Type": "application/json"
        }

        def _run():
            response = requests.post(SARVAM_URL, json=payload, headers=headers, timeout=10)
            if response.status_code == 200:
                return response.json().get("audios", [None])[0]
            else:
                logger.error(f"[TTS] Sarvam AI error: {response.status_code} - {response.text}")
                return None

        audio_base64 = await asyncio.get_event_loop().run_in_executor(None, _run)
        return audio_base64  # Sarvam already returns base64
    except Exception as e:
        logger.error(f"[TTS] Sarvam AI exception: {e}")
    return None


async def _synthesize_google(text: str, voice_id: str, speaking_rate: float = 1.0) -> Optional[str]:
    """Synthesize using Google Cloud TTS — for English voices."""
    if not tts_client:
        return None
    try:
        google_voice_name = GOOGLE_VOICE_MAPPING.get(voice_id, "en-IN-Neural2-B")
        language_code = "-".join(voice_id.split("-")[:2])   # e.g. 'en-IN'
        logger.info(f"[TTS] Google: voice='{google_voice_name}' lang='{language_code}'")
        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice_params = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=google_voice_name
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=speaking_rate,
            effects_profile_id=["headphone-class-device"]
        )
        def _run():
            response = tts_client.synthesize_speech(
                input=synthesis_input,
                voice=voice_params,
                audio_config=audio_config
            )
            return response.audio_content
        audio_content = await asyncio.get_event_loop().run_in_executor(None, _run)
        if audio_content:
            return base64.b64encode(audio_content).decode('utf-8')
    except Exception as e:
        logger.error(f"[TTS] Google TTS error: {e}")
    return None


async def synthesize_speech(text: str, voice_id: str = "hi-IN-MadhurNeural", speaking_rate: float = 1.0, voice: str = None, rate: str = None) -> Optional[str]:
    """
    Main TTS entry point.
    - Bengali (bn-IN)            → Sarvam AI (Bulbul v3)
    - Hindi/Hinglish (hi-IN)     → Google Cloud TTS
    - English (en-IN, en-US)      → Google Cloud TTS

    Supports 'voice' and 'rate' aliases for backward compatibility with main.py calls.
    """
    # Handle aliases
    if voice:
        voice_id = voice
    
    # Handle rate string (e.g., "+0%", "-10%")
    if rate and isinstance(rate, str):
        try:
            # Convert "+10%" -> 1.1, "-10%" -> 0.9, "+0%" -> 1.0
            val = float(rate.replace('%', ''))
            speaking_rate = 1.0 + (val / 100.0)
        except ValueError:
            speaking_rate = 1.0

    if not text:
        return None

    is_bengali = voice_id.startswith("bn-")

    if is_bengali:
        # ── Bengali: Sarvam AI (with Google fallback) ───────────────────────
        result = await _synthesize_sarvam(text, voice_id)
        if result:
            return result
        logger.warning("[TTS] Sarvam AI unavailable, falling back to Google for Bengali")

    # ── English / Hinglish / Fallback: Google TTS ───────────────────────────
    # Map to closest Google voice if not already a Google mapping
    google_fallback = {
        "hi-IN-MadhurNeural":  "hi-IN-Neural2-D",
        "hi-IN-SwaraNeural":   "hi-IN-Neural2-A",
        "bn-IN-BashkarNeural": "bn-IN-Wavenet-B",
        "bn-IN-TanishaNeural": "bn-IN-Wavenet-A",
    }
    
    if voice_id in google_fallback:
        mapped_voice = google_fallback[voice_id]
        # Temporarily extend google map for call
        GOOGLE_VOICE_MAPPING[voice_id] = mapped_voice
        result = await _synthesize_google(text, voice_id, speaking_rate)
        GOOGLE_VOICE_MAPPING.pop(voice_id, None)
        return result
    else:
        return await _synthesize_google(text, voice_id, speaking_rate)

# Backward compatibility alias
speak_text = synthesize_speech

def clean_text_for_tts(text: str) -> str:
    """Remove JSON blocks and special markers from text for clean speech"""
    if not text:
        return ""
    
    # 1. Remove $$ACTION_JSON$$ ... $$END_JSON$$ blocks (Robust regex)
    cleaned = re.sub(r'\$\$\s*ACTION_JSON\s*\$\$.*?\$\$\s*END_JSON\s*\$\$', '', text, flags=re.DOTALL | re.IGNORECASE)
    
    # 2. Remove Markdown code blocks (e.g. ```json ... ```)
    cleaned = re.sub(r'```.*?```', '', cleaned, flags=re.DOTALL)

    # 3. Clean up extra whitespace/newlines
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    # 4. Handle simple Hindi/English abbreviations if needed (e.g., ₹ -> rupees)
    cleaned = cleaned.replace('₹', 'rupees')
    
    return cleaned
