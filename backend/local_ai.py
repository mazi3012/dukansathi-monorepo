import os
import platform
import subprocess
import requests
import json
import psutil
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = "http://localhost:11434"

# Global progress tracking
pull_status = {
    "status": "idle",
    "model": "",
    "progress": 0,
    "completed": False,
    "error": None,
    "logs": []
}

class LocalLLMService:
    @staticmethod
    def get_hardware_specs():
        specs = {
            "os": platform.system(),
            "cpu": platform.processor(),
            "ram_total_gb": round(psutil.virtual_memory().total / (1024**3), 2),
            "gpu": "Unknown",
            "vram_gb": 0,
            "recommended_model": "phi3:mini" # Default
        }

        try:
            if platform.system() == "Windows":
                # Get CPU Name clearly
                cpu_cmd = "wmic cpu get name"
                cpu_res = subprocess.check_output(cpu_cmd, shell=True).decode().split('\n')[1].strip()
                if cpu_res:
                    specs["cpu"] = cpu_res

                # Get GPU Info via PowerShell (More reliable for VRAM)
                ps_cmd = "powershell \"Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM\""
                gpu_res = subprocess.check_output(ps_cmd, shell=True).decode()
                
                # Parse PowerShell output
                lines = [line.strip() for line in gpu_res.split('\n') if line.strip()]
                # Skip header lines (Name/AdapterRAM and separators)
                gpu_info = []
                for line in lines:
                    if "Name" in line or "----" in line:
                        continue
                    # Simple heuristic parsing (Name is usually first, numbers at end)
                    parts = line.rsplit(' ', 1)
                    if len(parts) == 2:
                        name = parts[0].strip()
                        try:
                            vram = int(parts[1]) / (1024**3)
                            gpu_info.append(f"{name} ({round(vram, 2)} GB)")
                            # Heuristic: Prefer dedicated GPU for specs
                            if "NVIDIA" in name or "AMD" in name and "Radeon Graphics" not in name:
                                specs["gpu"] = name
                                specs["vram_gb"] = round(vram, 2)
                        except:
                            pass
                
                if not specs["gpu"] and gpu_info:
                    specs["gpu"] = gpu_info[0] # Fallback to first GPU found

        except Exception as e:
            logger.error(f"Hardware detection failed: {e}")

        # Recommendation Logic
        if specs["vram_gb"] >= 4:
            specs["recommended_model"] = "phi3:mini"
        elif specs["vram_gb"] >= 2:
            specs["recommended_model"] = "gemma:2b"
        else:
            specs["recommended_model"] = "tinyllama" # Very low resource fallback

        return specs

    @staticmethod
    def check_ollama_status():
        try:
            logger.info(f"Checking Ollama status at {OLLAMA_BASE_URL}/api/tags")
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
            logger.info(f"Ollama response status: {response.status_code}")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Ollama check failed: {e}")
            return False

    @staticmethod
    def list_models():
        try:
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
            if response.status_code == 200:
                return response.json().get('models', [])
            return []
        except Exception as e:
            logger.error(f"List models failed: {e}")
            return []

    @staticmethod
    def get_pull_status():
        return pull_status

    @staticmethod
    def pull_model(model_name: str):
        """
        Trigger model pull with streaming progress tracking.
        """
        global pull_status
        pull_status["status"] = "pulling"
        pull_status["model"] = model_name
        pull_status["progress"] = 0
        pull_status["completed"] = False
        pull_status["error"] = None
        pull_status["logs"] = [f"Starting pull for {model_name}..."]

        try:
            # Check if model already exists to avoid redundant pull
            existing = LocalLLMService.list_models()
            if any(m.get('name') == model_name for m in existing):
                pull_status["status"] = "done"
                pull_status["progress"] = 100
                pull_status["completed"] = True
                pull_status["logs"].append("Model already exists locally.")
                return True

            response = requests.post(
                f"{OLLAMA_BASE_URL}/api/pull", 
                json={"name": model_name, "stream": True}, 
                stream=True
            )
            
            if response.status_code != 200:
                pull_status["status"] = "error"
                pull_status["error"] = f"Ollama returned {response.status_code}"
                return False

            for line in response.iter_lines():
                if line:
                    data = json.loads(line)
                    status_text = data.get("status", "")
                    
                    if status_text == "success":
                        pull_status["status"] = "done"
                        pull_status["progress"] = 100
                        pull_status["completed"] = True
                        pull_status["logs"].append("Download successful!")
                    elif "pulling" in status_text or "downloading" in status_text:
                        completed = data.get("completed", 0)
                        total = data.get("total", 0)
                        if total > 0:
                            progress = int((completed / total) * 100)
                            pull_status["progress"] = progress
                    
                    # Log interesting status changes
                    if status_text and status_text not in ["pulling manifest", "verifying sha256"]:
                         if not pull_status["logs"] or pull_status["logs"][-1] != status_text:
                             pull_status["logs"].append(status_text)
            
            return True
        except Exception as e:
            logger.error(f"Pull model failed: {e}")
            pull_status["status"] = "error"
            pull_status["error"] = str(e)
            return False

    @staticmethod
    def generate_response(model: str, prompt: str, system_prompt: str = ""):
        try:
            payload = {
                "model": model,
                "prompt": prompt,
                "system": system_prompt,
                "stream": False
            }
            logger.info(f"Generatng response with payload: {json.dumps(payload)}")
            response = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=30)
            if response.status_code == 200:
                return response.json().get('response', '')
            logger.error(f"Ollama Error {response.status_code}: {response.text}")
            return f"Error: Ollama returned {response.status_code} - {response.text}"
        except Exception as e:
            return f"Error connecting to Local AI: {e}"
