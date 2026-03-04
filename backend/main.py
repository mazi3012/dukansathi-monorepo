"""
File: main.py
Purpose: FastAPI entry point for Dukan Sathi backend server
Author: Dukan Sathi Team
Created: 2026-02-05

This is the main entry point for the Dukan Sathi backend server.
It handles:
- WebSocket connections for real-time AI chat
- API endpoints for CRUD operations
- Authentication middleware
- CORS configuration
- System Setup & Local AI (Offline mode)
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import sys
import asyncio
import base64
import logging
import io
import uuid
import threading
import tempfile
from datetime import datetime, timedelta, timezone
from PIL import Image

# Load environment variables FIRST
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from pydantic import BaseModel

from supabase import create_client, Client

# Configure logging immediately
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("backend.log", mode='a', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Replace print with logger.info/error
def print(*args, **kwargs):
    logger.info(" ".join(map(str, args)))

# Add the ai-bot package AND backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../ai-bot'))
sys.path.insert(0, os.path.dirname(__file__))



# Initialize Supabase Client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = None
if url and key:
    supabase = create_client(url, key)
else:
    logger.warning("Supabase credentials missing. Cleanup tasks may fail.")

try:
    # We NO LONGER import voice_service and agent_graph globally!
    # They take 60+ seconds to initialize on Render's 0.1 CPU Free Tier,
    # which causes Uvicorn to hit the 60s Port Scan Timeout and abort deployment.
    # Instead, we lazily import them inside websocket_endpoint() and background tasks!
    pass
except Exception as e:
    pass

# Import Setup Routes & Local AI
try:
    from setup_routes import router as setup_router
    from local_ai import LocalLLMService
    import local_db # Import local_db for direct access
except ImportError as e:
    logger.error(f"Failed to import Setup/LocalAI modules: {e}")
    setup_router = None
    local_db = None



# Create FastAPI app
app = FastAPI(
    title="Dukan Sathi API",
    description="Voice-first shop management backend for Indian small businesses",
    version="1.0.0"
)

# --- Rate Limiter (per IP) — shared by WebSocket + REST ---
from collections import defaultdict
_rate_limit_store = defaultdict(list)  # key -> [timestamp, ...]

def check_rate_limit(key: str, max_requests: int = 30, window_seconds: int = 60) -> bool:
    """Generic rate limiter. Returns True if allowed, False if rate-limited."""
    now = datetime.now()
    _rate_limit_store[key] = [t for t in _rate_limit_store[key] if (now - t).total_seconds() < window_seconds]
    if len(_rate_limit_store[key]) >= max_requests:
        return False
    _rate_limit_store[key].append(now)
    return True

# Max input length for AI text (prevents prompt injection cost DoS)
MAX_AI_INPUT_LENGTH = 5000

# Telegram webhook secret (set via env, used for HMAC verification)
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")

# Configure CORS — restrict to known origins in production
ALLOWED_ORIGINS = [
    "https://dukansathi.vercel.app",
    "https://dukanv22.vercel.app",
    "https://www.dukansathi.com",   # Verified Production domain
    "https://dukansathi.com",       # Verified Production domain (no www)
    os.getenv("FRONTEND_URL", ""),  # From env var if set
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

# Also allow any Cloud Run preview/service URL
cloud_run_url = os.getenv("CLOUD_RUN_URL", "")
if cloud_run_url:
    ALLOWED_ORIGINS.append(cloud_run_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],  # Filter empty strings
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_request_origins(request, call_next):
    origin = request.headers.get("origin")
    if "/api/setup" in str(request.url):
        logger.info(f"Setup Request: {request.method} {request.url} from Origin: {origin}")
    return await call_next(request)
# Register Setup Router
if setup_router:
    app.include_router(setup_router)

# --- Local Data Endpoints (for Offline Mode) ---
@app.get("/api/local/customers")
async def get_local_customers(user_id: str = "local_guest"):
    """Get customers from local SQLite DB"""
    if not local_db:
        raise HTTPException(status_code=503, detail="Local DB not available")
    return local_db.get_customers_local(user_id)

@app.get("/api/local/products")
async def get_local_products(user_id: str = "local_guest"):
    """Get products from local SQLite DB"""
    if not local_db:
        raise HTTPException(status_code=503, detail="Local DB not available")
    return local_db.get_products_local(user_id)

@app.post("/api/local/products")
async def save_local_product(request: Request, user_id: str = "local_guest"):
    """Save a product to local SQLite DB"""
    if not local_db:
        raise HTTPException(status_code=503, detail="Local DB not available")
    data = await request.json()
    product_id = local_db.save_product_local(data, user_id)
    if product_id is None:
         raise HTTPException(status_code=500, detail="Failed to save product locally")
    return {"status": "success", "id": product_id}

@app.post("/api/local/customers")
async def save_local_customer(request: Request, user_id: str = "local_guest"):
    """Save a customer to local SQLite DB"""
    if not local_db:
        raise HTTPException(status_code=503, detail="Local DB not available")
    data = await request.json()
    customer_id = local_db.save_customer_local(data, user_id)
    if customer_id is None:
         raise HTTPException(status_code=500, detail="Failed to save customer locally")
    return {"status": "success", "id": customer_id}

@app.post("/api/local/restock")
async def restock_local_product(request: Request):
    """Restock a product in local SQLite DB"""
    if not local_db:
        raise HTTPException(status_code=503, detail="Local DB not available")
    data = await request.json()
    product = local_db.restock_product_local(data)
    if product is None:
        raise HTTPException(status_code=500, detail="Failed to restock product locally")
    return {"status": "success", "product": product}

@app.get("/api/local/customers/{customer_id}")
async def get_local_customer_detail(customer_id: int):
    """Get customer details by rowid locally."""
    if not local_db:
        raise HTTPException(status_code=503, detail="Local DB not available")
    customer = local_db.get_customer_by_id_local(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@app.post("/api/local/sales")
async def save_local_sale(request: Request):
    """Save an offline invoice/sale to local SQLite DB"""
    if not local_db:
        raise HTTPException(status_code=503, detail="Local DB not available")
    data = await request.json()
    sale_id = local_db.save_invoice_local(data)
    if sale_id is None:
        raise HTTPException(status_code=500, detail="Failed to save invoice locally")
    return {"status": "success", "id": sale_id}

@app.get("/api/local/sales")
async def get_local_sales(customer_name: str = None):
    """Get all offline invoices from local SQLite DB"""
    if not local_db:
        raise HTTPException(status_code=503, detail="Local DB not available")
    return local_db.get_invoices_local(customer_name)

@app.post("/api/local/payments")
async def save_local_payment(request: Request):
    """Save an offline payment or due record to local SQLite DB"""
    if not local_db:
        raise HTTPException(status_code=503, detail="Local DB not available")
    data = await request.json()
    payment_id = local_db.save_payment_local(data)
    if payment_id is None:
        raise HTTPException(status_code=500, detail="Failed to save payment locally")
    return {"status": "success", "id": payment_id}

@app.get("/api/local/payments")
async def get_local_payments(customer_name: str = None):
    """Get all offline payment/due records from local SQLite DB"""
    if not local_db:
        raise HTTPException(status_code=503, detail="Local DB not available")
    return local_db.get_payments_local(customer_name)



# --- Telegram Bot Link Endpoint ---
@app.get("/api/telegram/bot-link")
async def get_telegram_bot_link():
    """Return the Telegram bot link for the frontend"""
    bot_username = os.getenv("TELEGRAM_BOT_USERNAME", "")
    if bot_username:
        return {
            "connected": True,
            "bot_url": f"https://t.me/{bot_username}",
            "bot_username": bot_username
        }
    return {"connected": False, "bot_url": "", "bot_username": ""}




@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Dukan Sathi Backend",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Detailed health check with actual service status"""
    db_status = "disconnected"
    if supabase:
        try:
            supabase.table("profiles").select("id").limit(1).execute()
            db_status = "connected"
        except Exception:
            db_status = "error"
    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "ai_service": "ready",
        "telegram_configured": bool(os.getenv("TELEGRAM_BOT_TOKEN"))
    }

@app.on_event("startup")
async def startup_event():
    """Start background tasks"""
    print("INFO: Starting background tasks...")
    asyncio.create_task(cleanup_scheduler())
    
    # Start Telegram Bot
    if os.getenv("TELEGRAM_BOT_TOKEN"):
        webhook_url = os.getenv("WEBHOOK_URL")
        if webhook_url:
            print(f"INFO: Configuring Telegram Webhook at {webhook_url}/api/telegram/webhook")
            try:
                from telegram_bot import app as ptb_app
                if ptb_app:
                    await ptb_app.initialize()
                    await ptb_app.start()
                    
                    # Ensure the URL is clean without trailing slashes
                    clean_webhook = webhook_url.rstrip('/')
                    await ptb_app.bot.set_webhook(
                        f"{clean_webhook}/api/telegram/webhook",
                        secret_token=TELEGRAM_WEBHOOK_SECRET or None
                    )
                    print("INFO: Telegram Webhook configured successfully on Cloud Run.")
            except Exception as e:
                logger.error(f"Failed to initialize Telegram Webhook: {e}")
        else:
            try:
                # Local Development / Render legacy fallback (Polling)
                lock_file = os.path.join(tempfile.gettempdir(), "dukansathi_telegram.lock")
                fd = os.open(lock_file, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.close(fd)
                from telegram_bot import start_telegram_bot
                print("INFO: Starting Telegram Bot polling thread (Local Mode)...")
                bot_thread = threading.Thread(target=start_telegram_bot, daemon=True)
                bot_thread.start()
            except FileExistsError:
                print("INFO: Telegram Bot polling already running in another worker.")
            except Exception as e:
                logger.error(f"Failed to initialize Telegram Polling: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanly shutdown webhook queues if running on Cloud Run"""
    print("INFO: Shutting down FastAPI application...")
    webhook_url = os.getenv("WEBHOOK_URL")
    if webhook_url:
        try:
            from telegram_bot import app as ptb_app
            if ptb_app:
                print("INFO: Stopping Telegram Webhook application...")
                await ptb_app.stop()
                await ptb_app.shutdown()
                print("INFO: Telegram Webhook stopped safely.")
        except Exception as e:
            logger.error(f"Error shutting down Telegram app: {e}")

from fastapi.responses import JSONResponse

@app.post("/api/telegram/webhook")
async def telegram_webhook(request: Request):
    """Receive webhook updates from Telegram via Cloud Run."""
    # Rate limit: max 120 webhook calls/minute per IP
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(f"tg_webhook:{client_ip}", max_requests=120, window_seconds=60):
        return JSONResponse(status_code=429, content={"status": "rate_limited"})
    
    # HMAC verification: reject unverified webhook payloads
    if TELEGRAM_WEBHOOK_SECRET:
        token_header = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if token_header != TELEGRAM_WEBHOOK_SECRET:
            logger.warning(f"[TG] Rejected webhook — invalid secret from {client_ip}")
            return JSONResponse(status_code=403, content={"status": "forbidden"})
    
    try:
        from telegram import Update
        from telegram_bot import app as ptb_app
        if not ptb_app:
            return JSONResponse(status_code=500, content={"status": "error"})
            
        data = await request.json()
        update = Update.de_json(data, ptb_app.bot)
        
        await ptb_app.update_queue.put(update)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Telegram Webhook Error: {e}")
        return JSONResponse(status_code=500, content={"status": "error"})

async def cleanup_scheduler():
    """Run chat history and storage cleanup every few hours (delete > 24 hours old)"""
    # Yield immediately to let Uvicorn bind to the port on startup
    await asyncio.sleep(60)
    while True:
        try:
            print("INFO: Running scheduled chat and storage cleanup...")
            
            if supabase:
                # 1. Database Cleanup
                try:
                    from dukansathi_ai.agent_graph import perform_history_cleanup
                    await perform_history_cleanup()
                except Exception as e:
                    print(f"WARN: DB Cleanup failed: {e}")

                # 2. Storage Cleanup (chat-images)
                try:
                    print("INFO: Cleaning up old chat images from storage...")
                    files = supabase.storage.from_("chat-images").list()
                    if files:
                        now = datetime.now(timezone.utc)
                        to_remove = []
                        for f in files:
                            try:
                                # Parse Supabase timestamp
                                created_at = datetime.fromisoformat(f['created_at'].replace('Z', '+00:00'))
                                if (now - created_at) > timedelta(hours=24):
                                    to_remove.append(f['name'])
                            except Exception:
                                continue
                        
                        if to_remove:
                            print(f"INFO: Removing {len(to_remove)} expired images...")
                            supabase.storage.from_("chat-images").remove(to_remove)
                except Exception as e:
                    print(f"WARN: Storage Cleanup failed: {e}")
            
            print("INFO: Cleanup cycle finished.")
        except Exception as e:
            print(f"ERROR: Cleanup task failed: {e}")
        
        # Run every 6 hours
        await asyncio.sleep(6 * 3600)

# Helper: Optimize Image
def optimize_image(image_bytes: bytes, max_size: int = 1024, quality: int = 80) -> bytes:
    """Resize and compress image for performance"""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB (in case of RGBA/PNG)
        if img.mode != 'RGB':
            img = img.convert('RGB')
            
        # Resize if dimension exceeds max_size
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size))
            
        # Save to buffer
        output_buffer = io.BytesIO()
        img.save(output_buffer, format='JPEG', quality=quality, optimize=True)
        return output_buffer.getvalue()
    except Exception as e:
        print(f"[WARN] Image optimization failed: {e}")
        return image_bytes # Return original if optimization fails

def clean_text_for_tts(text: str) -> str:
    """Remove JSON blocks and special markers from text for clean speech"""
    if not text:
        return ""
    
    # 1. Remove $$ACTION_JSON$$ ... $$END_JSON$$ blocks (Robust regex)
    import re
    cleaned = re.sub(r'\$\$\s*ACTION_JSON\s*\$\$.*?\$\$\s*END_JSON\s*\$\$', '', text, flags=re.DOTALL | re.IGNORECASE)
    
    # 2. Remove Markdown code blocks (e.g. ```json ... ```)
    cleaned = re.sub(r'```.*?```', '', cleaned, flags=re.DOTALL)

    # 3. Clean up extra whitespace/newlines
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    # 4. Handle simple Hindi/English abbreviations if needed (e.g., ₹ -> rupees)
    cleaned = cleaned.replace('₹', 'rupees')
    
    return cleaned

# Helper: Upload to Supabase Storage
async def upload_to_storage(bucket: str, file_path: str, file_bytes: bytes, mime_type: str = 'image/jpeg') -> str:
    """Upload file to Supabase Storage and return Public URL"""
    if not supabase:
        raise Exception("Supabase client not initialized")
        
    try:
        # Upload
        supabase.storage.from_(bucket).upload(
            path=file_path,
            file=file_bytes,
            file_options={"content-type": mime_type, "upsert": "true"}
        )
        
        # Get Public URL
        public_url = supabase.storage.from_(bucket).get_public_url(file_path)
        return public_url
    except Exception as e:
        print(f"[ERR] Storage Upload Error: {e}")
        raise e

# WebSocket endpoint for AI chat

class TTSRequest(BaseModel):
    text: str
    voice_id: str
    rate: str = "+0%"

@app.post("/api/tts-preview")
async def tts_preview(request: TTSRequest):
    """
    Generate a one-off TTS preview for the settings page.
    """
    try:
        from voice_service import speak_text
        # Use existing service
        base64_audio = await speak_text(request.text, request.voice_id, request.rate)
        if not base64_audio:
            raise HTTPException(status_code=500, detail="Failed to generate audio")
            
        return {"audio_base64": base64_audio}
    except Exception as e:
        print(f"Preview Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket, user_id: str = "anon"):
    # Rate limit WebSocket connections per IP
    client_ip = websocket.client.host if websocket.client else "unknown"
    if not check_rate_limit(f"ws:{client_ip}", max_requests=30, window_seconds=60):
        await websocket.close(code=1008, reason="Rate limited")
        logger.warning(f"[WS] Rate limited IP: {client_ip}")
        return
    
    await websocket.accept()
    
    # LAZY IMPORT HEAVY MODULES ON FIRST CONNECTION!
    import time
    start_time = time.time()
    try:
        from voice_service import transcribe_audio, speak_text
        from dukansathi_ai.agent_graph import process_user_input
        logger.info(f"[WS] AI Modules loaded in {time.time() - start_time:.2f}s")
    except Exception as e:
        logger.error(f"Failed to import AI modules after {time.time() - start_time:.2f}s: {e}")
        await websocket.send_json({"type": "error", "content": "AI System Offline. Please retry in a minute."})
        await websocket.close()
        return

    # Check database and credentials
    if not supabase:
        await websocket.send_json({"type": "error", "content": "Database connection not available."})
        await websocket.close()
        return

    logger.info("[WS] WebSocket Connection Established")
    
    # Per-connection pending image context
    pending_image_context = {}
    
    # Server-side verified user ID (set once from JWT on first message)
    verified_user_id = None
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Parse incoming message
            message_type = data.get("type", "text")
            content = data.get("content", "")
            user_token = data.get("access_token", "")
            client_user_id = data.get("user_id", "")
            voice_id = data.get("voice_id", "en-IN-PrabhatNeural")
            voice_rate = data.get("voice_rate", "+0%")
            model_id = data.get("model", "llama-4-scout-17b-16e-instruct-maas")

            # --- SERVER-SIDE USER AUTH ---
            # Verify user_id via Supabase JWT on first message, then cache for session
            if not verified_user_id:
                if user_token and len(user_token) > 20:
                    try:
                        # Validate token with Supabase to get real user
                        auth_user = supabase.auth.get_user(user_token)
                        if auth_user and auth_user.user:
                            verified_user_id = auth_user.user.id
                            logger.info(f"[WS] Authenticated user: {verified_user_id}")
                    except Exception as auth_err:
                        logger.warning(f"[WS] JWT validation failed: {auth_err}")
                
                # Fallback: trust client user_id only if JWT validation not possible
                if not verified_user_id and client_user_id and len(client_user_id) > 10:
                    verified_user_id = client_user_id
                    logger.info(f"[WS] Using client user_id (no JWT): {verified_user_id}")
            
            # Use verified ID for all operations
            user_id = verified_user_id or ""
            user_token = user_id  # Agent expects user_token = user_id
            
            # Safe user_id for file paths (never use client-supplied values)
            safe_user_id = user_id if user_id and len(user_id) > 10 else "anon"
            if safe_user_id == "anon" and user_token and len(user_token) >= 10:
                safe_user_id = user_token[-10:]
            
            print(f"[WS] WS Received: Type={message_type}, Length={len(content)}, Model={model_id}")
            print(f"[WS] Voice Params: ID={voice_id}, Rate={voice_rate}") # DEBUG LOG

            # Optional Inline Attachment Processing for text/voice
            attachment_context = ""
            if message_type in ["text", "voice"]:
                att_type = data.get("attachment_type")
                att_data = data.get("attachment_data")
                att_filename = data.get("filename", "")
                
                if att_type and att_data:
                    try:
                        att_bytes = base64.b64decode(att_data)
                        if att_type == "image":
                            file_path = f"{safe_user_id}/{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}.jpg"
                            public_url = await upload_to_storage("chat-images", file_path, optimize_image(att_bytes))
                            attachment_context = f"[IMAGE CONTEXT: {public_url}]\n"
                        elif att_type == "excel":
                            import pandas as pd
                            import io
                            if att_filename and att_filename.endswith('.csv'):
                                df = pd.read_csv(io.BytesIO(att_bytes))
                            else:
                                df = pd.read_excel(io.BytesIO(att_bytes))
                            csv_text = df.to_csv(index=False)
                            attachment_context = f"[EXCEL BULK DATA:\n{csv_text}\n]\n"
                    except Exception as e:
                        logger.error(f"Attachment processing failed: {e}")
                        await websocket.send_json({"type": "error", "content": "Attachment processing failed. Please try again."})
                        continue

            # 1. Handle Voice Input (STT)
            if message_type == "voice" and content:
                try:
                    audio_bytes = base64.b64decode(content)
                    user_text = await transcribe_audio(audio_bytes)
                    print(f"[STT] Transcribed: {user_text}")
                    
                    if attachment_context:
                        user_text = f"{attachment_context}{user_text}"
                    
                    # Inject pending image context if available (Legacy fallback)
                    pending_img = pending_image_context.pop(safe_user_id, None)
                    if pending_img:
                        user_text = f"[IMAGE CONTEXT: {pending_img['url']}] {user_text}"
                    
                    # IMMEDIATE FEEDBACK
                    await websocket.send_json({
                        "type": "transcription",
                        "content": user_text
                    })
                except Exception as e:
                    logger.error(f"STT Error: {e}")
                    await websocket.send_json({"type": "error", "content": "Voice processing failed. Please try again."})
                    continue
                    
            # 2. Handle Image Input (Vision with Deferred Context)
            elif message_type == "image" and content:
                try:
                    image_bytes = base64.b64decode(content)
                    file_path = f"{safe_user_id}/{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}.jpg"
                    public_url = await upload_to_storage("chat-images", file_path, optimize_image(image_bytes))
                    
                    # Store as pending context — wait for next voice/text to know the intent
                    pending_image_context[safe_user_id] = {"url": public_url}
                    
                    # Send a prompt nudge to the user
                    await websocket.send_json({
                        "type": "image_pending",
                        "content": "Image received! Now tell me what to do — create an invoice, add products, or restock existing items?",
                        "image_url": public_url
                    })
                except Exception as e:
                     logger.error(f"Image processing error: {e}")
                     await websocket.send_json({"type": "error", "content": "Image processing failed. Please try again."})
                continue  # Don't process AI yet — wait for intent from user

            # 3. Handle Excel/CSV Input (Bulk Import)
            elif message_type == "excel" and content:
                try:
                    import pandas as pd
                    import io
                    
                    file_bytes = base64.b64decode(content)
                    filename = data.get("filename", "upload.csv")
                    
                    try:
                        if filename.endswith('.csv'):
                            df = pd.read_csv(io.BytesIO(file_bytes))
                        else:
                            df = pd.read_excel(io.BytesIO(file_bytes))
                            
                        # Convert to markdown/text for the LLM context
                        csv_text = df.to_csv(index=False)
                        
                        # Generate a prompt telling the LLM to process this as a bulk draft
                        bulk_prompt = f"I am uploading a list of products. Please extract them into a bulk_product_draft. Here is the data:\n\n{csv_text}"
                        
                        # We inject this text directly into the AI pipeline
                        user_text = bulk_prompt
                        print(f"[EXCEL] Parsed {len(df)} rows from {filename}")
                        
                        # Send immediate feedback
                        await websocket.send_json({
                            "type": "transcription",
                            "content": f"Processing {len(df)} products from {filename}..."
                        })
                        
                    except Exception as parse_err:
                        # Fallback if pandas fails
                        print(f"[ERR] Pandas parse error: {parse_err}")
                        await websocket.send_json({"type": "error", "content": f"Could not read file {filename}."})
                        continue
                        
                except Exception as e:
                    await websocket.send_json({"type": "error", "content": f"Excel processing failed: {str(e)}"})
                    continue

            # 4. Handle Text Input
            elif message_type == "text":
                raw_text = content.strip()
                att_type = data.get("attachment_type", "")
                
                # Determine intent text — add smart default if text is empty but attachment exists
                if not raw_text and attachment_context:
                    if att_type == "excel":
                        intent_text = "Please extract this list of products and add them to inventory as a bulk_product_draft."
                    else:
                        intent_text = "Please read this image carefully. Extract all products with their name, category, cost price (CP), selling price (SP), and available stock quantity. Return them as a bulk_product_draft."
                else:
                    intent_text = raw_text
                
                user_text = intent_text
                
                if attachment_context:
                    user_text = f"{attachment_context}{intent_text}"
                    
                # Inject pending image context if available (Legacy fallback)
                pending_img = pending_image_context.pop(safe_user_id, None)
                if pending_img:
                    user_text = f"[IMAGE CONTEXT: {pending_img['url']}] {user_text}"
                        
                print(f"[CHAT] Text message (len={len(user_text)}): {user_text[:120]}...")
            
            # 4. Handle Draft Approvals
            elif message_type == "action":
                action = data.get("action")
                draft_data = data.get("draft_data")
                print(f"[ACTION] Draft approval action: {action}")
                
                # Validate supabase client is available
                if not supabase:
                    await websocket.send_json({
                        "type": "error",
                        "content": "Database connection not available."
                    })
                    continue
                
                try:
                    if action == "approve_customer" and draft_data:
                        # Validate customer name
                        customer_name = draft_data.get("name", "").strip()
                        if not customer_name:
                            await websocket.send_json({
                                "type": "error",
                                "content": "Customer name is required."
                            })
                            continue
                        
                        # Add customer using RPC
                        result = supabase.rpc("add_customer", {
                            "p_name": customer_name,
                            "p_phone": draft_data.get("phone"),
                            "p_address": draft_data.get("address")
                        }).execute()
                        
                        if result and result.data:
                            await websocket.send_json({
                                "type": "text",
                                "content": f"Customer {customer_name} added successfully Boss!"
                            })
                        else:
                             # Fallback to Local DB if Supabase fails or returns empty (and we want local persistence)
                             # Or if we want to save to local DB ANYWAY for offline sync.
                             if local_db:
                                 local_id = local_db.save_customer_local({
                                     "name": customer_name,
                                     "phone": draft_data.get("phone"),
                                     "credit_balance": 0
                                 }, user_id)
                                 if local_id:
                                      await websocket.send_json({
                                        "type": "text",
                                        "content": f"Customer {customer_name} saved LOCALLY Boss! (Sync pending)"
                                    })
                                      continue

                             await websocket.send_json({
                                "type": "error",
                                "content": "Failed to add customer."
                            })
                    
                    elif action == "approve_payment" and draft_data:
                        # Validate customer name and amount
                        customer_name = draft_data.get("customer_name", "").strip()
                        if not customer_name:
                            await websocket.send_json({
                                "type": "error",
                                "content": "Customer name is required."
                            })
                            continue
                        
                        # Safe float conversion with validation
                        try:
                            amount = float(draft_data.get("amount", 0))
                            if amount == 0:
                                await websocket.send_json({
                                    "type": "error",
                                    "content": "Payment amount cannot be zero."
                                })
                                continue
                        except (ValueError, TypeError):
                            await websocket.send_json({
                                "type": "error",
                                "content": "Invalid payment amount."
                            })
                            continue
                        
                        # Find customer by name using RPC
                        customer_result = supabase.rpc("find_customer_by_name", {
                            "p_name": customer_name
                        }).execute()
                        
                        # Check if customer exists
                        if not customer_result or not customer_result.data or len(customer_result.data) == 0:
                            await websocket.send_json({
                                "type": "error",
                                "content": f"Customer '{customer_name}' not found."
                            })
                            continue
                        
                        customer_id = customer_result.data[0]["id"]
                        
                        # Determine if this is a payment or giving due
                        payment_type = draft_data.get("payment_type", "payment")
                        
                        if payment_type == "payment":
                            # Payment received (reduces due)
                            update_result = supabase.rpc("receive_payment", {
                                "p_user_id": safe_user_id,
                                "p_customer_id": customer_id,
                                "p_amount": amount
                            }).execute()
                            success_msg = f"Payment of ₹{amount} recorded for {customer_name} Boss!"
                        else:
                            # Udhar/Credit given (increases due)
                            update_result = supabase.rpc("add_customer_credit", {
                                "p_user_id": safe_user_id,
                                "p_customer_id": customer_id,
                                "p_amount": amount
                            }).execute()
                            success_msg = f"₹{amount} Udhar added for {customer_name} Boss!"
                        
                        if update_result and update_result.data is not None:
                            await websocket.send_json({
                                "type": "text",
                                "content": success_msg
                            })
                        else:
                            await websocket.send_json({
                                "type": "error",
                                "content": "Failed to update payment."
                            })

                    elif action == "approve_bulk_products" and draft_data:
                        # Frontend sends the array of items directly as 'data'
                        items = draft_data if isinstance(draft_data, list) else draft_data.get("items", [])
                        if not items:
                            await websocket.send_json({"type": "error", "content": "No items to import."})
                            continue
                            
                        # Process each item based on its assigned action (add vs restock)
                        success_count = 0
                        errors = []
                        
                        for item in items:
                            try:
                                item_action = item.get("action", "add")
                                
                                if item_action == "restock" and item.get("existing_id"):
                                    # Call RPC to safely increment stock
                                    res = supabase.rpc("increment_stock", {
                                        "p_product_id": item["existing_id"],
                                        "p_quantity": float(item.get("stock_quantity", 0)),
                                        "p_user_id": safe_user_id
                                    }).execute()
                                    if res and res.data:
                                        success_count += 1
                                    else:
                                        errors.append(f"Failed to restock {item.get('name')}")
                                
                                elif item_action == "add":
                                    # Insert new product
                                    res = supabase.table("products").insert({
                                        "user_id": safe_user_id,
                                        "name": item.get("name"),
                                        "category": item.get("category", "General"),
                                        "cost_price": float(item.get("cost_price")) if item.get("cost_price") else 0,
                                        "selling_price": float(item.get("selling_price")) if item.get("selling_price") else 0,
                                        "stock_quantity": float(item.get("stock_quantity", 0)),
                                        "unit": item.get("unit", "pcs")
                                    }).execute()
                                    # Check data for success, as Supabase Python Client relies on it
                                    if hasattr(res, 'data') and res.data:
                                        success_count += 1
                                    else:
                                        errors.append(f"Failed to add {item.get('name')}")
                                        
                            except Exception as item_err:
                                errors.append(f"Error on {item.get('name', 'unknown')}: {item_err}")
                                
                        reply_msg = f"Processed {success_count} / {len(items)} items successfully."
                        if errors:
                            reply_msg += f" Had {len(errors)} errors."
                            print(f"[ERR] Bulk Insert Errors: {errors}")
                            
                        await websocket.send_json({
                            "type": "text",
                            "content": reply_msg
                        })
                    
                    else:
                        # Unknown or missing action
                        print(f"[WARN] Unknown or invalid action: {action}")
                        await websocket.send_json({
                            "type": "error",
                            "content": f"Unknown action '{action}' or missing draft data."
                        })
                        
                except Exception as e:
                    logger.error(f"Draft approval error: {e}")
                    import traceback
                    traceback.print_exc()
                    await websocket.send_json({
                        "type": "error",
                        "content": "Failed to process the action. Please try again."
                    })
                
                continue  # Skip AI processing for action messages
            
            else:
                user_text = content
            
            if not user_text: continue

            # 4. Process with AI (Cloud or Local)
            try:
                ai_response_raw = ""
                
                # Check for Local Mode
                is_local_mode = model_id.startswith("local:") or model_id in ["phi3:mini", "gemma:2b", "time:latest"]
                
                if is_local_mode or data.get("ai_mode") == "local":
                     local_model_name = model_id.replace("local:", "") if model_id.startswith("local:") else model_id
                     print(f"[AI] Using LOCAL AI Engine ({local_model_name})...")
                     ai_response_raw = await process_user_input(user_text, user_token, model=local_model_name)
                     
                else:
                    # Cloud AI
                    ai_response_raw = await process_user_input(user_text, user_token, model=model_id)

                print(f"[AI] AI Raw Response: {ai_response_raw[:100]}...")
                
                # PARSE STRUCTURED RESPONSE
                # IMPORTANT: Use response_data not data to avoid shadowing the WS message variable
                import json
                display_text = ai_response_raw
                attachment = None
                
                try:
                    response_data = json.loads(ai_response_raw)
                    if isinstance(response_data, dict):
                        display_text = response_data.get("text", ai_response_raw)
                        attachment = response_data.get("draft") or response_data.get("attachment")
                except (json.JSONDecodeError, ValueError):
                    # Not JSON — plain text response, use as-is
                    pass
                
            except Exception as e:
                print(f"[ERR] AI Processing Error: {e}")
                await websocket.send_json({"type": "error", "content": f"AI Error: {str(e)}"})
                continue

            # 5. Generate TTS (On Display Text ONLY)
            audio_response = None
            try:
                # Legacy didn't use clean_text_for_tts because it separated the text cleanly.
                # But we can still use it to be safe against mild markdown.
                tts_text = clean_text_for_tts(display_text) 
                if tts_text:
                    print(f"[TTS] Generating TTS for: '{tts_text[:50]}...'")
                    audio_response = await speak_text(tts_text, voice=voice_id, rate=voice_rate)
            except Exception as e:
                print(f"[WARN] TTS Exception: {e}")

            # 6. Send Response
            response_payload = {
                "type": "text",
                "content": display_text,
                "audio": audio_response
            }
            
            if attachment:
                response_payload["attachment"] = attachment
                # Legacy frontend expects 'draft' or 'attachment'? 
                # ChatInterface.jsx uses: msg.attachment
                # And it checks msg.draft_type.
                # My agent_graph update added draft_type to the draft object.
                # So attachment is the draft object.
            
            await websocket.send_json(response_payload)
            
    except WebSocketDisconnect:
        print("[WS] Client disconnected from WebSocket")
    except Exception as e:
        print(f"[ERR] FATAL WebSocket Error: {e}")
        import traceback
        traceback.print_exc()

@app.websocket("/ws/customer_chat/{store_id}")
async def customer_websocket_endpoint(websocket: WebSocket, store_id: str):
    await websocket.accept()
    
    # LAZY IMPORT HEAVY MODULES ON FIRST CONNECTION!
    import time
    start_time = time.time()
    try:
        from voice_service import transcribe_audio, speak_text
        from dukansathi_ai.agent_graph import process_user_input
        logger.info(f"[WS-CUST] AI Modules loaded in {time.time() - start_time:.2f}s")
    except Exception as e:
        logger.error(f"Failed to import AI modules after {time.time() - start_time:.2f}s: {e}")
        await websocket.send_json({"type": "error", "content": "AI System Offline. Please retry in a minute."})
        await websocket.close()
        return

    if not supabase:
        await websocket.send_json({"type": "error", "content": "Database connection not available."})
        await websocket.close()
        return

    print(f"[WS-CUST] WebSocket Connection Established for Store: {store_id}")
    
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type", "text")
            content = data.get("content", "")
            voice_id = data.get("voice_id", "en-IN-PrabhatNeural")
            voice_rate = data.get("voice_rate", "+0%")
            model_id = "llama-4-scout-17b-16e-instruct-maas" # Enforce cloud model for customer bot
            
            # The store_id acts as the user_token/user_id for DB context
            user_token = store_id
            safe_user_id = store_id
            
            # 1. Handle Voice Input (STT)
            if message_type == "voice" and content:
                try:
                    audio_bytes = base64.b64decode(content)
                    user_text = await transcribe_audio(audio_bytes)
                    await websocket.send_json({
                        "type": "transcription",
                        "content": user_text
                    })
                except Exception as e:
                    await websocket.send_json({"type": "error", "content": f"Voice processing failed: {str(e)}"})
                    continue
            else:
                user_text = content
                
            # Customer bots do not process draft approvals or images yet
            if not user_text:
                continue
                
            try:
                # Call agent graph with role="customer"
                ai_response_raw = await process_user_input(user_text, user_token, model=model_id, role="customer")
                
                import json
                display_text = ai_response_raw
                attachment = None
                
                try:
                    response_data = json.loads(ai_response_raw)
                    if isinstance(response_data, dict):
                        display_text = response_data.get("text", ai_response_raw)
                        attachment = response_data.get("draft") or response_data.get("attachment")
                except (json.JSONDecodeError, ValueError):
                    pass
                
                # Auto-save customer invoice drafts
                if attachment and attachment.get("draft_type") == "invoice":
                    try:
                        # Find "customer_name" if AI somehow extracted it, else default
                        customer_name = attachment.get("customer_name", "Customer Request")
                        items = attachment.get("items", [])
                        total_amount = sum(float(item.get('total_price', 0)) for item in items)
                        supabase.table("draft_invoices").insert({
                            "user_id": store_id,
                            "customer_name": customer_name,
                            "items": items,
                            "total_amount": total_amount,
                            "status": "customer_request"
                        }).execute()
                        print("[WS-CUST] Saved customer draft invoice to DB")
                    except Exception as e:
                        print(f"[ERR] Failed to save customer draft: {e}")
                
                # Generate TTS
                audio_response = None
                try:
                    tts_text = clean_text_for_tts(display_text) 
                    if tts_text:
                        audio_response = await speak_text(tts_text, voice=voice_id, rate=voice_rate)
                except Exception as e:
                    pass

                response_payload = {
                    "type": "text",
                    "content": display_text,
                    "audio": audio_response
                }
                
                if attachment:
                    response_payload["attachment"] = attachment
                
                await websocket.send_json(response_payload)
            except Exception as e:
                print(f"[ERR] Customer AI Error: {e}")
                await websocket.send_json({"type": "error", "content": f"AI Error: {str(e)}"})
                
    except WebSocketDisconnect:
        print("[WS-CUST] Client disconnected from WebSocket")
    except Exception as e:
        print(f"[ERR] FATAL Customer WebSocket Error: {e}")

# New Endpoint: Upload Product Image
from fastapi import UploadFile, File, HTTPException

# Allowed image MIME types and magic bytes
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
IMAGE_MAGIC_BYTES = {
    b'\xff\xd8\xff': 'image/jpeg',
    b'\x89PNG': 'image/png',
    b'RIFF': 'image/webp',  # RIFF....WEBP
}
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5MB

@app.post("/upload-product-image")
async def upload_product_image(request: Request, file: UploadFile = File(...)):
    """
    Upload and optimize a product image.
    Validates MIME type, magic bytes, and file size.
    """
    # Rate limit: 10 uploads/minute per IP
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(f"upload:{client_ip}", max_requests=10, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many uploads. Try again later.")
    
    try:
        # 1. MIME type check
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed.")
        
        # 2. Size check
        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Maximum 5MB.")
        
        # 3. Magic byte validation (prevents spoofed MIME types)
        is_valid_magic = False
        for magic, mime in IMAGE_MAGIC_BYTES.items():
            if content[:len(magic)] == magic:
                is_valid_magic = True
                break
        if not is_valid_magic:
            raise HTTPException(status_code=400, detail="Invalid image file.")
        
        # 4. Optimize (convert to JPG, resize)
        optimized_bytes = optimize_image(content)
        
        # 5. Server-generated UUID filename (never user-supplied)
        file_name = f"product_{uuid.uuid4().hex}.jpg"
        
        public_url = await upload_to_storage("product-photos", file_name, optimized_bytes)
        
        return {"url": public_url}
        
    except HTTPException:
        raise  # Re-raise validation errors as-is
    except Exception as e:
        logger.error(f"Product image upload error: {e}")
        raise HTTPException(status_code=500, detail="Image upload failed. Please try again.")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    # Use 0.0.0.0 — required for Cloud Run (also works locally)
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False
    )
