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
- Multilingual AI (English, Hinglish, Kolkata Bangla)
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.responses import JSONResponse
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
import mimetypes
from datetime import datetime, timedelta, timezone
from PIL import Image

# Ensure WASM MIME type is registered for production environments (Cloud Run/Vercel)
mimetypes.add_type('application/wasm', '.wasm')

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

# Ensure GOOGLE_APPLICATION_CREDENTIALS is an absolute path
cred_env = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if cred_env and not os.path.isabs(cred_env):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(os.path.dirname(__file__), cred_env)
    print(f"DEBUG: Set GOOGLE_APPLICATION_CREDENTIALS to absolute path: {os.environ['GOOGLE_APPLICATION_CREDENTIALS']}")

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

# Local AI system imports have been permanently removed as the system is now cloud-only.



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


def _is_blank(value):
    return value is None or (isinstance(value, str) and value.strip() == "")


def _validate_action_draft_payload(action: str, draft_data):
    """Validate required fields before executing mutating draft actions."""
    if draft_data is None:
        return False, ["draft_data"]

    missing = []

    if action == "approve_customer":
        if _is_blank(draft_data.get("name")):
            missing.append("name")

    elif action == "approve_payment":
        if _is_blank(draft_data.get("customer_name")):
            missing.append("customer_name")
        amount = draft_data.get("amount")
        try:
            amount_val = float(amount)
            if amount_val == 0:
                missing.append("amount(non-zero)")
        except (TypeError, ValueError):
            missing.append("amount")

    elif action == "approve_bulk_products":
        items = draft_data if isinstance(draft_data, list) else draft_data.get("items", [])
        if not isinstance(items, list) or len(items) == 0:
            missing.append("items")

    return len(missing) == 0, missing

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

# Subscription Service (unchanged — keeps tier-based billing working)
from subscription_service import SubscriptionService
sub_service = SubscriptionService(supabase)

# Credit Service (new pay-as-you-go layer, additive only)
from credit_service import CreditService, CREDIT_PACKS
credit_service = CreditService(supabase)
from forecast_service import build_forecast_response, build_inventory_stockout_forecast_response
from notifications_service import generate_inventory_risk_notifications

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
async def cors_fallback_middleware(request: Request, call_next):
    """Failsafe CORS middleware: ensures CORS headers are set for all known origins."""
    origin = request.headers.get("origin", "")
    
    # Handle OPTIONS preflight directly
    if request.method == "OPTIONS" and origin in [o for o in ALLOWED_ORIGINS if o]:
        return JSONResponse(
            status_code=200,
            content={"ok": True},
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, X-Requested-With",
                "Access-Control-Max-Age": "86400",
            }
        )
    
    response = await call_next(request)
    
    # Inject CORS headers if missing (safety net)
    if origin in [o for o in ALLOWED_ORIGINS if o]:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    
    return response

# --- Authentication Dependency ---
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends

security = HTTPBearer()

async def verify_local_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validates the JWT token against Supabase for API endpoints."""
    token = credentials.credentials
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")
        
    try:
        # Remote Validation
        auth_user = supabase.auth.get_user(token)
        if not auth_user or not auth_user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return auth_user.user.id
    except Exception as e:
        logger.warning(f"Failed auth: {e}")
        raise HTTPException(status_code=401, detail="Unauthorized")



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
    """Lightweight health check for Cloud Run"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.options("/health")
async def health_check_options():
    """Handle OPTIONS preflight / bot probe for /health"""
    return JSONResponse(
        status_code=200,
        content={"status": "ok"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.on_event("startup")
async def startup_event():
    """Start background tasks after binding to port"""
    print(f"INFO: Dukan Sathi Backend starting (Port: {os.getenv('PORT', '8080')})")
    # We yield to the event loop to ensure port binding happens ASAP
    asyncio.create_task(deferred_startup())

async def deferred_startup():
    """Heavy startup tasks run in background after port binding"""
    await asyncio.sleep(2) # Brief delay to let uvicorn settle
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
                if not os.path.exists(lock_file):
                    with open(lock_file, "w") as f: f.write("locked")
                    from telegram_bot import start_telegram_bot
                    print("INFO: Starting Telegram Bot polling thread (Local Mode)...")
                    bot_thread = threading.Thread(target=start_telegram_bot, daemon=True)
                    bot_thread.start()
                else:
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


class NotificationReadRequest(BaseModel):
    notification_id: int

@app.post("/api/tts-preview")
async def tts_preview(request: TTSRequest, user_id: str = Depends(verify_local_auth)):
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
        logger.error(f"Preview Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Subscription & Usage Routes ---

@app.get("/api/subscription/usage")
async def get_usage_token(user_id: str = Depends(verify_local_auth)):
    """Get current usage stats and a signed JWT usage token"""
    stats = await sub_service.get_usage_stats(user_id)
    if not stats:
        raise HTTPException(status_code=500, detail="Failed to fetch usage stats")
    
    token = sub_service.generate_usage_token(user_id, stats)
    return {
        "token": token,
        "stats": stats
    }

@app.post("/api/subscription/create")
async def create_subscription(plan_id: str, user_id: str = Depends(verify_local_auth)):
    """Create a new Razorpay subscription (Trial included)"""
    try:
        subscription = await sub_service.create_checkout_session(user_id, plan_id)
        
        # Save subscription ID to profile
        supabase.table("profiles").update({
            "razorpay_subscription_id": subscription["id"],
            "subscription_status": "pending" # Until webhook confirms
        }).eq("id", user_id).execute()
        
        return subscription
    except Exception as e:
        logger.error(f"Subscription creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/subscription/cancel")
async def cancel_subscription(user_id: str = Depends(verify_local_auth)):
    """Cancel the current Razorpay subscription and downgrade user to free tier."""
    try:
        # 1. Get the user's current subscription ID
        profile_res = supabase.table("profiles") \
            .select("razorpay_subscription_id, subscription_tier") \
            .eq("id", user_id).single().execute()
        
        if not profile_res or not profile_res.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        current_tier = profile_res.data.get("subscription_tier", "free")
        sub_id = profile_res.data.get("razorpay_subscription_id")
        
        if current_tier == "free":
            raise HTTPException(status_code=400, detail="Already on free plan")
        
        # 2. Cancel the Razorpay subscription (if exists)
        if sub_id and sub_service.client:
            try:
                sub_service.client.subscription.cancel(sub_id, {"cancel_at_cycle_end": 0})
                logger.info(f"[Cancel] Cancelled Razorpay subscription {sub_id} for user {user_id}")
            except Exception as rzp_err:
                logger.warning(f"[Cancel] Razorpay cancel failed (may already be cancelled): {rzp_err}")
                # Continue anyway — we still want to downgrade in our DB
        
        # 3. Downgrade profile to free in Supabase
        result = supabase.table("profiles").update({
            "subscription_tier": "free",
            "subscription_status": "cancelled",
            "razorpay_subscription_id": None,
            "updated_at": datetime.now().isoformat()
        }).eq("id", user_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update profile")
        
        logger.info(f"[Cancel] ✅ Downgraded user {user_id} from {current_tier} to free")
        return {
            "status": "cancelled",
            "previous_tier": current_tier,
            "current_tier": "free",
            "message": "Subscription cancelled. You are now on the Free plan."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Cancel] Error cancelling subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel subscription")


class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str

@app.post("/api/subscription/verify")
async def verify_subscription_payment(
    payload: VerifyPaymentRequest,
    user_id: str = Depends(verify_local_auth)
):
    """Verify Razorpay payment signature and activate subscription immediately.
    
    This is the PRIMARY activation path — called by the frontend right after
    a successful Razorpay checkout. The webhook remains as a secondary fallback
    for renewals, cancellations, etc.
    
    Security layers:
      1. JWT auth — only logged-in users can call this
      2. HMAC signature verification — unforgeable without RAZORPAY_KEY_SECRET
      3. Server-side plan lookup — tier determined from Razorpay API, not client
    """
    if not sub_service.client:
        raise HTTPException(status_code=503, detail="Payment system not configured")
    
    # ── Step 1: Verify payment signature (HMAC-SHA256) ─────────────────
    try:
        sub_service.client.utility.verify_subscription_payment_signature({
            'razorpay_payment_id': payload.razorpay_payment_id,
            'razorpay_subscription_id': payload.razorpay_subscription_id,
            'razorpay_signature': payload.razorpay_signature
        })
        logger.info(f"[Verify] ✅ Signature valid for payment {payload.razorpay_payment_id}")
    except Exception as e:
        logger.error(f"[Verify] ❌ Signature verification FAILED: {e}")
        raise HTTPException(status_code=400, detail="Payment verification failed — invalid signature")
    
    # ── Step 2: Fetch subscription from Razorpay API to get plan_id ────
    try:
        rzp_subscription = sub_service.client.subscription.fetch(payload.razorpay_subscription_id)
        plan_id = rzp_subscription.get("plan_id", "")
        rzp_status = rzp_subscription.get("status", "")
        logger.info(f"[Verify] Fetched subscription: plan_id={plan_id}, status={rzp_status}")
    except Exception as e:
        logger.error(f"[Verify] Failed to fetch subscription from Razorpay: {e}")
        raise HTTPException(status_code=502, detail="Could not verify subscription with payment provider")
    
    # ── Step 3: Map plan_id → tier (server-side, not from client) ──────
    PLAN_TIER_MAP = {
        "plan_SZvL8EkGvNvdg2": "starter",
        "plan_SYJ1ZJWBFTgZWx": "pro",
        "plan_SYJ1a3OcE6bwDB": "ultra",
    }
    tier = PLAN_TIER_MAP.get(plan_id)
    
    if not tier:
        logger.error(f"[Verify] Unknown plan_id '{plan_id}' — cannot map to tier")
        raise HTTPException(status_code=400, detail=f"Unknown plan: {plan_id}")
    
    # ── Step 4: Update user profile in Supabase ────────────────────────
    try:
        result = supabase.table("profiles").update({
            "subscription_tier": tier,
            "subscription_status": "active",
            "razorpay_subscription_id": payload.razorpay_subscription_id,
            "updated_at": datetime.now().isoformat()
        }).eq("id", user_id).execute()
        
        if not result.data:
            logger.error(f"[Verify] Profile update returned no data for user {user_id}")
            raise HTTPException(status_code=500, detail="Failed to update subscription")
        
        logger.info(f"[Verify] ✅ Activated {tier.upper()} for user {user_id}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Verify] Database update failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to activate subscription")
    
    return {
        "status": "active",
        "tier": tier,
        "message": f"{tier.capitalize()} plan activated successfully!"
    }


@app.get("/api/forecast")
async def get_forecast(
    horizon_days: int = 30,
    lookback_days: int = 120,
    user_id: str = Depends(verify_local_auth)
):
    """Return revenue forecast and historical daily aggregates in IST (Asia/Kolkata)."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")

    if horizon_days < 7 or horizon_days > 90:
        raise HTTPException(status_code=400, detail="horizon_days must be between 7 and 90")
    if lookback_days < 30 or lookback_days > 365:
        raise HTTPException(status_code=400, detail="lookback_days must be between 30 and 365")

    try:
        return await build_forecast_response(
            supabase=supabase,
            user_id=user_id,
            lookback_days=lookback_days,
            horizon_days=horizon_days,
        )
    except Exception as e:
        logger.error(f"Forecast generation failed for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate forecast")


@app.get("/api/inventory-forecast")
async def get_inventory_forecast(
    lookback_days: int = 60,
    user_id: str = Depends(verify_local_auth)
):
    """Return product-wise demand velocity and stockout risk forecast."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")

    if lookback_days < 14 or lookback_days > 180:
        raise HTTPException(status_code=400, detail="lookback_days must be between 14 and 180")

    try:
        return await build_inventory_stockout_forecast_response(
            supabase=supabase,
            user_id=user_id,
            lookback_days=lookback_days,
        )
    except Exception as e:
        logger.error(f"Inventory forecast failed for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate inventory forecast")


@app.post("/api/notifications/generate")
async def generate_notifications(
    lookback_days: int = 60,
    risk_days_threshold: int = 14,
    user_id: str = Depends(verify_local_auth)
):
    """Generate fresh notifications (currently stockout-risk alerts)."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")

    if lookback_days < 14 or lookback_days > 180:
        raise HTTPException(status_code=400, detail="lookback_days must be between 14 and 180")
    if risk_days_threshold < 1 or risk_days_threshold > 45:
        raise HTTPException(status_code=400, detail="risk_days_threshold must be between 1 and 45")

    try:
        result = await generate_inventory_risk_notifications(
            supabase=supabase,
            user_id=user_id,
            lookback_days=lookback_days,
            risk_days_threshold=risk_days_threshold,
        )
        return {
            "status": "ok",
            "generated": result.get("created", 0),
            "skipped": result.get("skipped", 0),
        }
    except Exception as e:
        logger.error(f"Notification generation failed for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate notifications")


@app.get("/api/notifications")
async def list_notifications(
    unread_only: bool = False,
    limit: int = 20,
    user_id: str = Depends(verify_local_auth)
):
    """List user notifications for in-app notification center."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")

    limit = max(1, min(limit, 100))
    query = supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit)
    if unread_only:
        query = query.eq("is_read", False)

    result = query.execute()
    rows = result.data if result and result.data else []
    unread_count = supabase.table("notifications").select("id", count="exact").eq("user_id", user_id).eq("is_read", False).execute().count or 0

    return {
        "notifications": rows,
        "unread_count": unread_count,
    }


@app.post("/api/notifications/mark-read")
async def mark_notification_read(
    body: NotificationReadRequest,
    user_id: str = Depends(verify_local_auth)
):
    """Mark a single notification as read."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")

    update_res = (
        supabase.table("notifications")
        .update({"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", body.notification_id)
        .eq("user_id", user_id)
        .select("id")
        .execute()
    )
    if not update_res:
        raise HTTPException(status_code=500, detail="Failed to mark notification as read")

    updated_rows = update_res.data if hasattr(update_res, "data") else None
    if not updated_rows:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"status": "ok"}

@app.post("/api/subscription/webhook")
async def razorpay_webhook(request: Request):
    """Handle Razorpay webhook for subscription updates."""
    # Read body ONCE — stream cannot be consumed twice
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")
    
    if not sub_service.verify_webhook(raw_body, signature):
        logger.error("[Webhook] Invalid signature - rejecting webhook")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Parse the already-read bytes
    import json as _json
    try:
        data = _json.loads(raw_body)
    except Exception as e:
        logger.error(f"[Webhook] JSON parse error: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    event = data.get("event", "")
    logger.info(f"[Webhook] Received event: {event}")
    
    # Safely extract subscription entity
    try:
        sub_entity = data["payload"]["subscription"]["entity"]
        sub_id    = sub_entity["id"]
        status    = sub_entity["status"]
        plan_id   = sub_entity.get("plan_id", "")
        notes     = sub_entity.get("notes", {}) or {}
        user_id_from_notes = notes.get("user_id", "")
        
        logger.info(f"[Webhook] SubID: {sub_id}, Status: {status}, PlanID: {plan_id}")
        logger.info(f"[Webhook] Notes received: {notes}")
        logger.info(f"[Webhook] User ID from notes: {user_id_from_notes or 'EMPTY'}")
    except (KeyError, TypeError) as e:
        logger.error(f"[Webhook] Malformed payload: {e}")
        logger.error(f"[Webhook] Full payload: {data}")
        return {"status": "ok"}
    
    # Plan-ID → Tier mapping (must match Plans.jsx rzpPlanId values)
    PLAN_TIER_MAP = {
        "plan_SZvL8EkGvNvdg2": "starter",
        "plan_SYJ1ZJWBFTgZWx": "pro",
        "plan_SYJ1a3OcE6bwDB": "ultra",
    }
    tier = PLAN_TIER_MAP.get(plan_id)
    
    if not tier and event in ["subscription.authenticated", "subscription.activated", "subscription.charged"]:
        logger.error(f"[Webhook] Unknown plan_id '{plan_id}' for event '{event}'")
        logger.error(f"[Webhook] Available mappings: {list(PLAN_TIER_MAP.keys())}")
        # Still proceed with fallback, but tier will be None
    
    # ── subscription.authenticated ────────────────────────────────────────
    # Fires immediately after user completes Razorpay checkout (mandate captured).
    if event == "subscription.authenticated":
        logger.info(f"[Webhook] Authenticated event - tier: {tier}")
        result = await sub_service.update_user_subscription(
            sub_id, "active", tier, fallback_user_id=user_id_from_notes
        )
        if not result:
            logger.error(f"[Webhook] Failed to update subscription for {user_id_from_notes}")
        return {"status": "ok"}
    
    # ── subscription.activated ────────────────────────────────────────────
    elif event == "subscription.activated":
        logger.info(f"[Webhook] Activated event - tier: {tier}")
        result = await sub_service.update_user_subscription(
            sub_id, "active", tier, fallback_user_id=user_id_from_notes
        )
        if not result:
            logger.error(f"[Webhook] Failed to activate subscription for {user_id_from_notes}")
        return {"status": "ok"}
    
    # ── subscription.charged ─────────────────────────────────────────────
    elif event == "subscription.charged":
        logger.info(f"[Webhook] Charged event - tier: {tier}")
        result = await sub_service.update_user_subscription(
            sub_id, "active", tier, fallback_user_id=user_id_from_notes
        )
        if not result:
            logger.error(f"[Webhook] Failed to process charge for {user_id_from_notes}")
        return {"status": "ok"}
    
    else:
        logger.info(f"[Webhook] Unhandled event (ignored): {event}")
    
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────
# CREDIT ROUTES (Pay-As-You-Go — additive on top of subscriptions)
# ─────────────────────────────────────────────────────────────

class CreditOrderRequest(BaseModel):
    pack_id: str   # 'micro' | 'small' | 'business' | 'retail'

class CreditVerifyRequest(BaseModel):
    razorpay_order_id:   str
    razorpay_payment_id: str
    razorpay_signature:  str
    pack_id:             str

@app.post("/api/credits/order")
async def create_credit_order(
    body: CreditOrderRequest,
    user_id: str = Depends(verify_local_auth)
):
    """Create a Razorpay one-time Order for a credit pack purchase."""
    try:
        order = credit_service.create_credit_order(pack_id=body.pack_id, user_id=user_id)
        pack_info = CREDIT_PACKS.get(body.pack_id, {})
        return {
            "order_id":   order["id"],
            "amount":     order["amount"],
            "currency":   order["currency"],
            "credits":    pack_info.get("credits", 0),
            "label":      pack_info.get("label", ""),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[Credits] Order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create credit order")


@app.post("/api/credits/verify")
async def verify_credit_payment(
    body: CreditVerifyRequest,
    user_id: str = Depends(verify_local_auth)
):
    """
    Verify Razorpay payment HMAC and add purchased credits to the ledger.
    Security: Server verifies signature against RAZORPAY_KEY_SECRET — client cannot forge.
    """
    try:
        result = credit_service.verify_credit_payment(
            razorpay_order_id=body.razorpay_order_id,
            razorpay_payment_id=body.razorpay_payment_id,
            razorpay_signature=body.razorpay_signature,
            user_id=user_id,
            pack_id=body.pack_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[Credits] Payment verification failed for {user_id}: {e}")
        raise HTTPException(status_code=400, detail="Payment verification failed")


@app.get("/api/credits/balance")
async def get_credit_balance(user_id: str = Depends(verify_local_auth)):
    """Get current credit balance. Also triggers monthly refresh if not done yet."""
    try:
        # Check and apply monthly refresh if needed
        profile_res = supabase.table("profiles").select("subscription_tier").eq("id", user_id).single().execute()
        tier = profile_res.data.get("subscription_tier", "free") if profile_res and profile_res.data else "free"
        credit_service.refresh_monthly_credits(user_id, tier)

        balance = credit_service.get_balance(user_id)
        return {"balance": balance, "tier": tier}
    except Exception as e:
        logger.error(f"[Credits] Balance fetch failed for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch credit balance")


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
        import traceback
        logger.error(f"Failed to import AI modules after {time.time() - start_time:.2f}s: {e}\n{traceback.format_exc()}")
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
            # 60-second idle timeout to prevent zombie Cloud Run billing
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=60)
            except asyncio.TimeoutError:
                logger.info(f"[WS] Idle timeout (60s) for {client_ip}. Closing connection.")
                try:
                    await websocket.send_json({"type": "info", "content": "Connection closed due to inactivity. Please reconnect."})
                    await websocket.close(code=1000, reason="Idle timeout")
                except Exception:
                    pass
                return

            # Parse incoming message
            message_type = data.get("type", "text")
            content = data.get("content", "")
            user_token = data.get("access_token", "")
            client_user_id = data.get("user_id", "")
            voice_id = data.get("voice_id", "hi-IN-MadhurNeural")
            voice_rate = data.get("voice_rate", "+0%")
            model_id = data.get("model", "gemini-3.1-flash-lite-preview")
            ai_language = data.get("language", "hinglish")  # 'english' | 'hinglish' | 'bangla'

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
            user_id = verified_user_id or "anon"
            user_token = user_id  # Agent expects user_token = user_id
            
            # --- TIER ENFORCEMENT ---
            user_tier = "free"
            if user_id != "anon":
                profile_res = supabase.table("profiles").select("subscription_tier").eq("id", user_id).single().execute()
                user_tier = profile_res.data.get("subscription_tier", "free") if profile_res and profile_res.data else "free"
            
            # AI Credit Check — Deduct from credit ledger (2 credits per message)
            if user_id != "anon":
                # Determine action cost (voice = 5, text = 2)
                _credit_action = "voice_bill" if message_type == "voice" else "ai_chat"
                _credit_result = credit_service.deduct(
                    user_id=user_id,
                    action=_credit_action,
                    description=f"AI {message_type} message"
                )
                if not _credit_result.get("success"):
                    await websocket.send_json({
                        "type": "error",
                        "content": f"You're out of credits! Top up from the Credits page to keep chatting. (Balance: {_credit_result.get('balance', 0)})",
                        "code": "NO_CREDITS"
                    })
                    continue
            
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
                    user_text = await transcribe_audio(
                        audio_bytes,
                        language=ai_language,
                        mime_type=data.get("content_type")
                    )
                    print(f"[STT] Transcribed ({ai_language}): {user_text}")
                    
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
                    is_valid_action, missing_fields = _validate_action_draft_payload(action, draft_data)
                    if not is_valid_action:
                        await websocket.send_json({
                            "type": "error",
                            "content": f"Draft incomplete. Missing required fields: {', '.join(missing_fields)}",
                            "code": "DRAFT_INCOMPLETE",
                            "missing_fields": missing_fields
                        })
                        continue

                    if action == "approve_customer" and draft_data:
                        # 0. Subscription Limit Check
                        if not await sub_service.check_limit(user_id, "customers"):
                            await websocket.send_json({
                                "type": "error",
                                "content": "Boss, your Customer limit is reached! Upgrade your plan to add more customers.",
                                "code": "UPGRADE_REQUIRED"
                            })
                            continue

                        # Validate customer name
                        customer_name = draft_data.get("name", "").strip()
                        if not customer_name:
                            await websocket.send_json({
                                "type": "error",
                                "content": "Customer name is required."
                            })
                            continue
                        
                        # Add or reuse customer atomically (prevents duplicate rows in concurrent flows).
                        result = supabase.rpc("get_or_create_customer", {
                            "p_user_id": safe_user_id,
                            "p_name": customer_name,
                            "p_phone": draft_data.get("phone"),
                            "p_address": draft_data.get("address"),
                            "p_state": draft_data.get("state")
                        }).execute()
                        
                        if result and result.data:
                            created = bool(result.data[0].get("created", False))
                            message = (
                                f"Customer {customer_name} added successfully Boss!"
                                if created else
                                f"Customer {customer_name} already existed. Linked safely Boss!"
                            )
                            await websocket.send_json({
                                "type": "text",
                                "content": message
                            })
                        else:
                             # Fallback to local sync
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
                                    # 0. Subscription Limit Check
                                    if not await sub_service.check_limit(user_id, "products"):
                                        errors.append(f"Limit reached! Cannot add {item.get('name')}. Please upgrade.")
                                        continue

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
                        # Unknown or missing action — log the details internally only
                        logger.warning(f"[WARN] Unknown or invalid action: {action}")
                        await websocket.send_json({
                            "type": "error",
                            "content": "That action could not be processed. Please try again."
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

            # 4. Process with AI
            try:
                ai_response_raw = ""
                # Cloud AI — always use process_user_input with language context
                ai_response_raw = await process_user_input(
                    user_text,
                    user_token,
                    model=model_id,
                    language=ai_language
                )

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
                logger.error(f"[ERR] AI Processing Error: {e}")
                await websocket.send_json({"type": "error", "content": "AI processing failed. Please try again."})
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
            model_id = "gemini-3.1-flash-lite-preview" # Enforce cloud model for customer bot
            
            # The store_id acts as the user_token/user_id for DB context
            user_token = store_id
            safe_user_id = store_id
            
            # 1. Handle Voice Input (STT)
            if message_type == "voice" and content:
                try:
                    audio_bytes = base64.b64decode(content)
                    user_text = await transcribe_audio(audio_bytes, mime_type=data.get("content_type"))
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
    b'\xff\xd8': 'image/jpeg',   # Standard JPEG SOI
    b'\x89PNG': 'image/png',
    b'RIFF': 'image/webp',       # RIFF....WEBP
}
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5MB

@app.post("/api/upload-product-image")
async def upload_product_image(request: Request, file: UploadFile = File(...), user_id: str = Depends(verify_local_auth)):
    """
    Upload and optimize a product image.
    Validates MIME type, magic bytes, and file size.
    """
    # Rate limit: 10 uploads/minute per IP
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(f"upload:{client_ip}", max_requests=10, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many uploads. Try again later.")
    # 0. Subscription Limit Check
    if not await sub_service.check_limit(user_id, "products"):
        raise HTTPException(status_code=403, detail="Product limit reached! Upgrade your plan to add more products.")

    try:
        # Log upload attempt
        logger.info(f"[UPLOAD] Attempting image upload. MIME: {file.content_type}, Name: {file.filename}")
        
        # 1. MIME type check
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            logger.warning(f"[UPLOAD] Rejected: Invalid MIME type {file.content_type}")
            raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed.")
        
        # 2. Size check
        content = await file.read()
        file_size = len(content)
        logger.info(f"[UPLOAD] File size: {file_size} bytes")
        
        if file_size > MAX_UPLOAD_SIZE:
             logger.warning(f"[UPLOAD] Rejected: File too large ({file_size} bytes)")
             raise HTTPException(status_code=400, detail="File too large. Maximum 5MB.")
        
        if file_size == 0:
             logger.warning("[UPLOAD] Rejected: Empty file")
             raise HTTPException(status_code=400, detail="Empty file uploaded.")

        # 3. Magic byte validation (prevents spoofed MIME types)
        is_valid_magic = False
        magic_snippet = content[:8]
        for magic, mime in IMAGE_MAGIC_BYTES.items():
            if content[:len(magic)] == magic:
                is_valid_magic = True
                logger.info(f"[UPLOAD] Valid magic bytes found: {mime}")
                break
        
        if not is_valid_magic:
            logger.warning(f"[UPLOAD] Rejected: Invalid magic bytes. Snippet (hex): {magic_snippet.hex()}")
            raise HTTPException(status_code=400, detail="Invalid image file format.")
        
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
