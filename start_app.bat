@echo off
echo =========================================
echo       Starting Dukan Sathi Locally
echo =========================================
echo.

:: --- Pre-flight Checks (Offline Voice) ---
set "OFFLINE_VOICE_READY=YES"
set "ENABLE_OFFLINE_STT=true"

if not exist "backend\vosk-model-small-en-in-0.4" (
    echo [WARNING] Vosk model not found in backend folder!
    echo           Offline Speech-to-Text will use Whisper Small if available.
)

:: 1. Start Ollama
echo [1/3] Checking Local AI (Ollama)...
netstat -ano | findstr :11434 > nul
if %errorlevel% neq 0 (
    echo [INFO] Ollama is not running. Starting Ollama...
    start "Ollama Local AI" cmd /c "ollama serve"
    echo [WAIT] Waiting for Ollama to initialize...
    :wait_ollama
    timeout /t 2 /nobreak > nul
    netstat -ano | findstr :11434 > nul
    if %errorlevel% neq 0 goto wait_ollama
    echo [OK] Ollama is now responsive.
) else (
    echo [OK] Ollama is already running.
)

:: 2. Start Backend with Hot Reload
echo [2/3] Starting Python Backend Server...
start "Dukan Backend" cmd /k "cd /d e:\dukanv22\backend && venv\Scripts\activate.bat && set "ENABLE_OFFLINE_STT=true" && uvicorn main:app --reload --reload-dir e:\dukanv22\backend --reload-dir e:\dukanv22\ai-bot --port 8000"

:: 3. Start Frontend
echo [3/3] Starting React/Vite Frontend Server...
start "Dukan Frontend" cmd /k "cd /d e:\dukanv22\frontend && cmd /c npm run dev"

echo.
echo =========================================
echo  Done! Servers are opening in new windows.
echo  - Local AI Engine triggered
echo  - Backend running on: http://localhost:8000
echo  - Frontend running on: http://localhost:5173
echo =========================================
echo You can close this window now.
pause
