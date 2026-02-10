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
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import sys
import asyncio
import base64
import logging
import io
import uuid
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
    from voice_service import transcribe_audio, speak_text
    from dukansathi_ai.agent_graph import process_user_input, perform_history_cleanup
except Exception as e:
    logger.error(f"Failed to import AI modules: {e}")
    import traceback
    logger.error(traceback.format_exc())
    # Define dummy functions so app can still start (for debugging)
    async def process_user_input(*args): return "AI Module Load Failed"
    async def transcribe_audio(*args): return "STT Module Load Failed"
    async def speak_text(*args): return None



# Create FastAPI app
app = FastAPI(
    title="Dukan Sathi API",
    description="Voice-first shop management backend for Indian small businesses",
    version="1.0.0"
)

# Configure CORS to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    """Detailed health check with service status"""
    return {
        "status": "ok",
        "database": "connected",  # TODO: Add actual DB check
        "ai_service": "ready"     # TODO: Add actual AI service check
    }

@app.on_event("startup")
async def startup_event():
    """Start background tasks"""
    print("INFO: Starting background tasks...")
    asyncio.create_task(cleanup_scheduler())

async def cleanup_scheduler():
    """Run chat history cleanup every hour (delete items > 12 hours old)"""
    while True:
        try:
            print("INFO: Running scheduled chat history cleanup...")
            
            # 1. Delete old chat history from DB
            # We use a direct SQL via RPC if available, or just standard delete via Supabase client if possible
            # Standard delete: delete from chat_history where created_at < now - 12h
            
            if supabase:
                try:
                    # Calculate threshold time (12 hours ago)
                    time_threshold = (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()
                    
                    # First, we need to find files to delete (if we tracked them)
                    # For now, we'll try to delete from DB. 
                    # Ideally, we should list files in storage > 12h old and delete them, 
                    # but Supabase Storage API doesn't easily support "list by age".
                    # Instead, we rely on the implementation that we name files with timestamps or track them.
                    # Or simpler: Just keep storage clean by specific periodic manual purge or improved logic later.
                    # Implementing a simple DB cleanup for now.
                    
                    # Call the PostgreSQL function directly via RPC
                    await perform_history_cleanup()
                    
                    # Also try to clean up storage if possible (Listing all files is expensive)
                    # For a robust solution, we would need a table tracking file uploads.
                    # Given the constraints, we will rely on DB cleanup and consider storage cleanup 
                    # as a future improvement or best-effort if we can identify files.
                    
                    print("INFO: Chat history cleanup executed.")
                except Exception as e:
                    print(f"ERROR during cleanup operation: {e}")
            
        except Exception as e:
            print(f"ERROR: Cleanup task failed: {e}")
        
        # Wait for 1 hour (3600 seconds)
        await asyncio.sleep(3600)

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
        print(f"⚠️ Image optimization failed: {e}")
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
        print(f"❌ Storage Upload Error: {e}")
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
        # Use existing service
        base64_audio = await speak_text(request.text, request.voice_id, request.rate)
        if not base64_audio:
            raise HTTPException(status_code=500, detail="Failed to generate audio")
            
        return {"audio_base64": base64_audio}
    except Exception as e:
        print(f"Preview Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/chat")
async def chat_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time AI chat communication
    """
    await websocket.accept()
    print("🔌 WebSocket Connection Established")
    
    try:
        while True:
            # Wait for message from client
            # print("⏳ Waiting for message...")
            data = await websocket.receive_json()
            # print(f"📨 RAW DATA RECEIVED: {data}")
            
            # Parse incoming message
            message_type = data.get("type", "text")
            content = data.get("content", "")
            user_token = data.get("access_token", "default_token")
            user_id = data.get("user_id", "")
            voice_id = data.get("voice_id", "en-IN-PrabhatNeural") # Default to Prabhat (English India)
            voice_rate = data.get("voice_rate", "+0%") # Default to normal speed
            model_id = data.get("model", "gemini-2.0-flash-001")
            
            # Better User ID Handling
            # If explicit user_id is provided (from authenticated frontend), use it as the token for the agent lookup
            if user_id and len(user_id) > 10:
                user_token = user_id
            
            # Default to a safe user_id if token is invalid, used for file paths
            safe_user_id = user_id if user_id and len(user_id) > 10 else "anon"
            if safe_user_id == "anon" and user_token and len(user_token) >= 10:
                safe_user_id = user_token[-10:]
            
            print(f"✅ WS Received: Type={message_type}, Length={len(content)}, Model={model_id}")
            print(f"🎤 Voice Params: ID={voice_id}, Rate={voice_rate}") # DEBUG LOG

            # 1. Handle Voice Input (STT)
            if message_type == "voice" and content:
                try:
                    audio_bytes = base64.b64decode(content)
                    user_text = await transcribe_audio(audio_bytes)
                    print(f"🎤 Transcribed: {user_text}")
                    
                    # IMMEDIATE FEEDBACK
                    await websocket.send_json({
                        "type": "transcription",
                        "content": user_text
                    })
                except Exception as e:
                    print(f"❌ STT Error: {e}")
                    await websocket.send_json({"type": "error", "content": f"Voice processing failed: {str(e)}"})
                    continue
                    
            # 2. Handle Image Input (Gemini Vision)
            elif message_type == "image" and content:
                # ... (Keep existing Image Logic if needed, but for now focus on Voice/Text flow matching legacy)
                # Assuming simple flow for now or keeping existing logic
                try:
                    image_bytes = base64.b64decode(content)
                    file_path = f"{safe_user_id}/{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}.jpg"
                    public_url = await upload_to_storage("chat-images", file_path, optimize_image(image_bytes))
                    user_text = f"I have uploaded an image. Image URL: {public_url} \n\nPlease analyze this image."
                    await websocket.send_json({"type": "text", "content": "Image uploaded successfully. Analyzing..."})
                except Exception as e:
                     await websocket.send_json({"type": "error", "content": f"Image error: {e}"})
                     continue

            # 3. Handle Text Input
            elif message_type == "text":
                user_text = content
                print(f"💬 Text message: {user_text}")
            
            # 4. Handle Draft Approvals
            elif message_type == "action":
                action = data.get("action")
                draft_data = data.get("draft_data")
                print(f"🎯 Draft approval action: {action}")
                
                try:
                    if action == "approve_customer" and draft_data:
                        # Add customer using RPC
                        result = supabase.rpc("add_customer", {
                            "p_name": draft_data.get("name"),
                            "p_phone": draft_data.get("phone"),
                            "p_address": draft_data.get("address")
                        }).execute()
                        
                        if result.data:
                            await websocket.send_json({
                                "type": "text",
                                "content": f"Customer {draft_data.get('name')} added successfully Boss!"
                            })
                        else:
                            await websocket.send_json({
                                "type": "error",
                                "content": "Failed to add customer."
                            })
                    
                    elif action == "approve_payment" and draft_data:
                        # Find customer and update credit
                        customer_name = draft_data.get("customer_name", "").strip()
                        amount = float(draft_data.get("amount", 0))
                        
                        # Find customer by name using RPC
                        customer_result = supabase.rpc("find_customer_by_name", {
                            "p_name": customer_name
                        }).execute()
                        
                        if customer_result.data and len(customer_result.data) > 0:
                            customer_id = customer_result.data[0]["id"]
                            
                            # Update credit balance (payment reduces credit)
                            update_result = supabase.rpc("update_customer_credit", {
                                "p_customer_id": customer_id,
                                "p_amount": amount,
                                "p_operation": "subtract"  # Payment reduces credit
                            }).execute()
                            
                            if update_result.data:
                                await websocket.send_json({
                                    "type": "text",
                                    "content": f"Payment of ₹{amount} recorded for {customer_name} Boss!"
                                })
                            else:
                                await websocket.send_json({
                                    "type": "error",
                                    "content": "Failed to update payment."
                                })
                        else:
                            await websocket.send_json({
                                "type": "error",
                                "content": f"Customer '{customer_name}' not found."
                            })
                    
                    else:
                        print(f"Unknown action: {action}")
                        
                except Exception as e:
                    print(f"❌ Draft approval error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "content": f"Failed to process draft: {str(e)}"
                    })
                
                continue  # Skip AI processing for action messages
            
            else:
                user_text = content
            
            if not user_text: continue

            # 4. Process with AI
            try:
                ai_response_raw = await process_user_input(user_text, user_token, model=model_id)
                print(f"✨ AI Raw Response: {ai_response_raw[:100]}...")
                
                # PARSE STRUCTURED RESPONSE
                import json
                display_text = ai_response_raw
                attachment = None
                
                try:
                    data = json.loads(ai_response_raw)
                    if isinstance(data, dict):
                        display_text = data.get("text", ai_response_raw)
                        attachment = data.get("draft") 
                        # Or 'attachment' key if I used that in agent_graph? 
                        # I used 'draft' key in agent_graph update just now.
                except:
                    # Not JSON, plain text
                    pass
                
            except Exception as e:
                print(f"❌ AI Processing Error: {e}")
                await websocket.send_json({"type": "error", "content": f"AI Error: {str(e)}"})
                continue

            # 5. Generate TTS (On Display Text ONLY)
            audio_response = None
            try:
                # Legacy didn't use clean_text_for_tts because it separated the text cleanly.
                # But we can still use it to be safe against mild markdown.
                tts_text = clean_text_for_tts(display_text) 
                if tts_text:
                    print(f"🔊 Generating TTS for: '{tts_text[:50]}...'")
                    audio_response = await speak_text(tts_text, voice=voice_id, rate=voice_rate)
            except Exception as e:
                print(f"⚠️ TTS Exception: {e}")

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
        print("🔌 Client disconnected from WebSocket")
    except Exception as e:
        print(f"💥 FATAL WebSocket Error: {e}")
        import traceback
        traceback.print_exc()

# New Endpoint: Upload Product Image
from fastapi import UploadFile, File, HTTPException

@app.post("/upload-product-image")
async def upload_product_image(file: UploadFile = File(...)):
    """
    Upload and optimize a product image
    Returns the public URL
    """
    try:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
            
        content = await file.read()
        
        # Optimize
        optimized_bytes = optimize_image(content)
        
        # Upload to 'product-images'
        file_ext = "jpg" # Always converting to JPG in optimize_image
        file_name = f"product_{uuid.uuid4().hex}.{file_ext}"
        
        public_url = await upload_to_storage("product-images", file_name, optimized_bytes)
        
        return {"url": public_url}
        
    except Exception as e:
        print(f"Error uploading product image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False  # Disable hot reload to fix Windows multiprocessing crash
    )
