from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import os
import logging
from dotenv import load_dotenv
from local_ai import LocalLLMService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/setup", tags=["setup"])
security = HTTPBearer()

from supabase import create_client, Client

async def verify_admin_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verifies that the request comes from an authenticated user."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise HTTPException(status_code=503, detail="Database not connected")
    
    supabase: Client = create_client(url, key)
    token = credentials.credentials
    try:
        auth_user = supabase.auth.get_user(token)
        if not auth_user or not auth_user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return auth_user.user.id
    except Exception as e:
        logger.warning(f"Failed setup auth: {e}")
        raise HTTPException(status_code=401, detail="Unauthorized")

class EnvConfig(BaseModel):
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    GROQ_API_KEY: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = ""

class InstallRequest(BaseModel):
    model_name: str

@router.get("/status")
def get_setup_status():
    """Check if critical environment variables are set"""
    missing = []
    if not os.getenv("SUPABASE_URL"): missing.append("SUPABASE_URL")
    if not os.getenv("SUPABASE_SERVICE_KEY"): missing.append("SUPABASE_SERVICE_KEY")
    
    # Check at least one AI provider or Local setup
    has_ai = os.getenv("GROQ_API_KEY") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or False
    
    return {
        "is_configured": len(missing) == 0 and has_ai,
        "missing_keys": missing,
        "ai_ready": has_ai
    }

@router.get("/hardware")
def get_hardware_info():
    """Get system hardware specs for local AI feasibility"""
    return LocalLLMService.get_hardware_specs()

@router.post("/save")
def save_env_config(config: EnvConfig):
    """Save configuration to .env file"""
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    
    # Read existing
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if "=" in line:
                    key, val = line.strip().split("=", 1)
                    env_vars[key] = val
    
    # Update
    if config.SUPABASE_URL: env_vars["SUPABASE_URL"] = config.SUPABASE_URL
    if config.SUPABASE_SERVICE_KEY: env_vars["SUPABASE_SERVICE_KEY"] = config.SUPABASE_SERVICE_KEY
    if config.GROQ_API_KEY: env_vars["GROQ_API_KEY"] = config.GROQ_API_KEY
    
    # Write back
    with open(env_path, "w") as f:
        for key, val in env_vars.items():
            f.write(f"{key}={val}\n")
            
    # Force reload in current process (partial)
    os.environ["SUPABASE_URL"] = config.SUPABASE_URL
    os.environ["SUPABASE_SERVICE_KEY"] = config.SUPABASE_SERVICE_KEY
    if config.GROQ_API_KEY: os.environ["GROQ_API_KEY"] = config.GROQ_API_KEY
    
    return {"status": "saved", "message": "Configuration saved. Please restart backend if needed for all changes."}

@router.post("/install-ai")
async def install_local_ai(req: InstallRequest, background_tasks: BackgroundTasks):
    """Trigger local model installation"""
    # Verify Ollama is running
    if not LocalLLMService.check_ollama_status():
        raise HTTPException(status_code=503, detail="Ollama is not running. Please install and start Ollama first.")
    
    # Trigger pull
    # Since pull can be long, we might want to run it in background
    # But LocalLLMService.pull_model is currently blocking/simple requests.
    # To avoid blocking Main thread, we run it in threadpool or assume it returns quick.
    # We'll use BackgroundTasks for the actual pull if we switch to a blocking call.
    # For now, let's call the simple pull (which might timeout if 1s).
    
    # Actually, let's just trigger it and hope for the best or assume user manages it?
    # Better: Use background task to run the pull command.
    
    background_tasks.add_task(LocalLLMService.pull_model, req.model_name)
    
    return {"status": "started", "message": f"Pulling model {req.model_name} in background..."}

@router.get("/local-models")
def list_local_models():
    """List installed local models"""
    if not LocalLLMService.check_ollama_status():
         return {"models": [], "error": "Ollama not running"}
    
    models = LocalLLMService.list_models()
    return {"models": models}

@router.get("/pull-status")
def get_pull_status():
    """Get the current model pull status"""
    return LocalLLMService.get_pull_status()

@router.get("/hardware")
def get_hardware():
    """Scan and return system hardware specs"""
    specs = LocalLLMService.get_hardware_specs()
    logger.info(f"Hardware Scan: {specs}")
    return specs

@router.get("/ollama-check")
def check_ollama():
    """Check if Ollama is running and accessible"""
    try:
        is_running = LocalLLMService.check_ollama_status()
        return {
            "is_running": is_running,
            "ollama_url": "http://127.0.0.1:11434",
            "message": "Ollama is running" if is_running else "Ollama not reachable"
        }
    except Exception as e:
        return {
            "is_running": False,
            "error": str(e),
            "ollama_url": "http://127.0.0.1:11434"
        }
