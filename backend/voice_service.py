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

# --- Offline STT (faster-whisper / Whisper Small) Initialization ---
import threading as _threading
_whisper_model = None
_whisper_ready = _threading.Event()  # Set ONLY when loading has fully finished

def _load_whisper_in_background():
    """Load faster-whisper model. Tries GPU (CUDA) first, auto-falls back to CPU on DLL errors."""
    global _whisper_model
    try:
        from faster_whisper import WhisperModel

        # Try GPU first
        try:
            import ctranslate2
            cuda_types = ctranslate2.get_supported_compute_types("cuda")
            if cuda_types:
                print("[OK] Trying Whisper on CUDA GPU (float16)...")
                _whisper_model = WhisperModel("small", device="cuda", compute_type="float16")
                print("[OK] Whisper Small running on GPU — Offline STT Ready")
                return
        except Exception as gpu_err:
            # Catches cublas64_12.dll / cudnn not found errors
            if "cublas" in str(gpu_err).lower() or "cudnn" in str(gpu_err).lower() or "cuda" in str(gpu_err).lower():
                print(f"[WARN] GPU not available ({gpu_err.__class__.__name__}: {gpu_err})")
                print("[INFO] CUDA 12 libraries missing. Falling back to CPU (int8).")
                print("[TIP]  To enable GPU: install CUDA Toolkit 12 from https://developer.nvidia.com/cuda-downloads")
            else:
                print(f"[WARN] GPU init failed: {gpu_err}")

        # Fallback: CPU with int8 (still fast for Whisper Small)
        print("[OK] Loading Whisper 'small' on CPU (int8)...")
        _whisper_model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
        print("[OK] Whisper Small loaded on CPU — Offline STT Ready")

    except ImportError:
        print("[ERR] faster-whisper not installed. Run: pip install faster-whisper")
    except Exception as e:
        print(f"[ERR] Failed to load Whisper model: {e}")
    finally:
        _whisper_ready.set()  # Always unblock callers

def _get_whisper_model(timeout: float = 90.0):
    """Wait up to `timeout` seconds for the model to load, then return it."""
    _whisper_ready.wait(timeout=timeout)
    return _whisper_model

# Start background loading ONLY if enabled (Saves 1GB+ RAM in production Cloud Run)
if os.getenv("ENABLE_OFFLINE_STT", "false").lower() == "true":
    print("[INFO] ENABLE_OFFLINE_STT is true. Starting Whisper background loader...")
    _threading.Thread(target=_load_whisper_in_background, daemon=True).start()
else:
    print("[INFO] ENABLE_OFFLINE_STT is false. Skipping Whisper loading to save memory.")
    _whisper_ready.set() # Unblock any accidental callers

# Initialize Google Cloud TTS Client
# Automatically uses GOOGLE_APPLICATION_CREDENTIALS from .env or Metadata Server
try:
    # If explicitly set to empty, don't even try (prevents some log noise)
    if os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or os.getenv("K_SERVICE"):
        tts_client = texttospeech.TextToSpeechClient()
        print("[OK] Google Cloud TTS Client initialized successfully")
    else:
        print("[WARN] Google Cloud credentials not found. TTS will be disabled.")
        tts_client = None
except Exception as e:
    # Do not raise - allow app to start even if TTS is broken
    print(f"[ERR] Failed to initialize Google Cloud TTS: {e}")
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
    Convert speech to text using Groq's Whisper model (FREE).
    Fallback to local Whisper Small (faster-whisper) if Groq fails or offline.
    """
    try:
        audio_file = io.BytesIO(audio_data)
        audio_file.name = "audio.webm"
        
        print(f"STT: Transcribing {len(audio_data)} bytes via Groq...")
        
        transcription = await groq_client.audio.transcriptions.create(
            file=(audio_file.name, audio_file),
            model="whisper-large-v3",
            response_format="json",
            language="en",   # Lock to English/Hinglish (Roman script)
            temperature=0.0
        )
        
        print(f"STT Result: '{transcription.text}'")
        return transcription.text
        
    except Exception as e:
        print(f"STT Groq Error — Falling back to LOCAL Whisper Small: {e}")
        return await transcribe_audio_offline(audio_data)

async def transcribe_audio_offline(audio_data: bytes) -> str:
    """
    Convert speech to text entirely offline using faster-whisper (Whisper Small).
    Automatically uses GPU (CUDA) if available, falls back to CPU.
    Audio processing via portable imageio-ffmpeg (no system ffmpeg needed).
    """
    temp_in_name = None
    temp_out_name = None
    try:
        import asyncio
        import subprocess

        # Write incoming audio to temp file
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_in:
            temp_in.write(audio_data)
            temp_in_name = temp_in.name

        temp_out_name = temp_in_name.replace(".webm", ".wav")

        # Convert to WAV using portable imageio-ffmpeg binary
        try:
            import imageio_ffmpeg
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            subprocess.run(
                [ffmpeg_exe, "-y", "-i", temp_in_name, "-ar", "16000", "-ac", "1", "-f", "wav", temp_out_name],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
        except (subprocess.CalledProcessError, FileNotFoundError, ImportError) as ffmpeg_err:
            return f"[Offline STT Error: Audio conversion failed — {ffmpeg_err}]"

        # Get (or load) the Whisper model
        model = _get_whisper_model()
        if model is None:
            return "[Offline STT Error: Whisper model not loaded. Please restart the backend.]"

        print(f"[Whisper] Transcribing {len(audio_data)} bytes locally...")

        # Run blocking Whisper inference in an executor thread (non-blocking async)
        loop = asyncio.get_running_loop()
        
        def _run_whisper():
            global _whisper_model
            try:
                segments, info = model.transcribe(
                    temp_out_name,
                    language="en",
                    beam_size=5,
                    vad_filter=True,
                    vad_parameters={
                        "min_silence_duration_ms": 500,
                        "speech_pad_ms": 200
                    }
                )
                return " ".join(seg.text.strip() for seg in segments)
            except Exception as transcribe_err:
                err_str = str(transcribe_err).lower()
                if "cublas" in err_str or "cudnn" in err_str or "cuda" in err_str or "library" in err_str:
                    # CUDA DLLs load lazily — failure happens here on first transcribe()
                    print(f"[WARN] GPU transcription failed ({transcribe_err.__class__.__name__}). Reloading on CPU...")
                    from faster_whisper import WhisperModel
                    _whisper_model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
                    print("[OK] Whisper reloaded on CPU (int8) — retrying transcription")
                    segments, info = _whisper_model.transcribe(
                        temp_out_name,
                        language="en",
                        beam_size=5,
                        vad_filter=True,
                        vad_parameters={
                            "min_silence_duration_ms": 500,
                            "speech_pad_ms": 200
                        }
                    )
                    return " ".join(seg.text.strip() for seg in segments)
                raise  # re-raise non-CUDA errors

        result_text = await loop.run_in_executor(None, _run_whisper)
        
        print(f"[Whisper] Result: '{result_text}'")
        return result_text.strip()

    except Exception as e:
        print(f"[Whisper] Offline STT Error: {e}")
        import traceback
        traceback.print_exc()
        return f"[Offline STT failed: {e}]"
    finally:
        # Clean up temp files
        for f in [temp_in_name, temp_out_name]:
            if f and os.path.exists(f):
                try: os.remove(f)
                except: pass


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
        print("[ERR] TTS Error: Google Cloud Client not initialized")
        return None

    try:
        # Validate and map voice
        google_voice_name = VOICE_MAPPING.get(voice)
        if not google_voice_name:
            print(f"[WARN] Unknown voice '{voice}', defaulting to 'en-IN-Neural2-B'")
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
            
        print(f"[TTS] Google TTS: voice='{google_voice_name}' (lang={language_code}), rate={speaking_rate}")
        print(f"[TTS] Text: '{text[:50]}...'")

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

        # 4. Perform the text-to-speech request (Non-blocking)
        # synthesize_speech is a gRPC call and is blocking, so we run it in executor
        import asyncio
        loop = asyncio.get_running_loop()
        
        def _call_tts():
            return tts_client.synthesize_speech(
                input=synthesis_input,
                voice=voice_params,
                audio_config=audio_config
            )

        response = await loop.run_in_executor(None, _call_tts)

        # 5. Return base64 audio
        audio_bytes = response.audio_content
        b64_str = base64.b64encode(audio_bytes).decode('utf-8')
        
        print(f"[OK] Google TTS Success: Generated {len(audio_bytes)} bytes")
        return b64_str
        
    except Exception as e:
        print(f"[ERR] Google TTS Error: {e}")
        import traceback
        print(traceback.format_exc())
        return None
