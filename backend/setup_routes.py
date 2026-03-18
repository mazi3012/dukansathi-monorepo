"""
setup_routes.py - Cloud configuration endpoints (no offline/local AI).
Used for checking cloud service status and saving environment config.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import os
import logging
from supabase import create_client, Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/setup", tags=["setup"])
security = HTTPBearer()


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


@router.get("/status")
def get_setup_status():
    """Check if critical cloud environment variables are set"""
    missing = []
    if not os.getenv("SUPABASE_URL"):
        missing.append("SUPABASE_URL")
    if not os.getenv("SUPABASE_SERVICE_KEY"):
        missing.append("SUPABASE_SERVICE_KEY")

    has_ai = bool(os.getenv("GROQ_API_KEY") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))

    return {
        "is_configured": len(missing) == 0 and has_ai,
        "missing_keys": missing,
        "ai_ready": has_ai,
        "mode": "cloud"
    }


@router.post("/save")
def save_env_config(config: EnvConfig):
    """Save cloud configuration to .env file"""
    env_path = os.path.join(os.path.dirname(__file__), ".env")

    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    key, val = line.strip().split("=", 1)
                    env_vars[key] = val

    if config.SUPABASE_URL:
        env_vars["SUPABASE_URL"] = config.SUPABASE_URL
    if config.SUPABASE_SERVICE_KEY:
        env_vars["SUPABASE_SERVICE_KEY"] = config.SUPABASE_SERVICE_KEY
    if config.GROQ_API_KEY:
        env_vars["GROQ_API_KEY"] = config.GROQ_API_KEY
    if config.GOOGLE_APPLICATION_CREDENTIALS:
        env_vars["GOOGLE_APPLICATION_CREDENTIALS"] = config.GOOGLE_APPLICATION_CREDENTIALS

    with open(env_path, "w") as f:
        for key, val in env_vars.items():
            f.write(f"{key}={val}\n")

    os.environ["SUPABASE_URL"] = config.SUPABASE_URL
    os.environ["SUPABASE_SERVICE_KEY"] = config.SUPABASE_SERVICE_KEY
    if config.GROQ_API_KEY:
        os.environ["GROQ_API_KEY"] = config.GROQ_API_KEY

    return {"status": "saved", "message": "Configuration saved. Please restart backend."}
