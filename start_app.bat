@echo off
echo =========================================
echo       Starting Dukan Sathi Locally
echo =========================================
echo.

:: 1. Start Ollama
echo [1/3] Starting Local AI (Ollama)...
start "Ollama Local AI" cmd /c "ollama serve"

:: 2. Start Backend with Hot Reload
echo [2/3] Starting Python Backend Server...
start "Dukan Backend" cmd /k "cd /d e:\dukanv22\backend && venv\Scripts\activate.bat && uvicorn main:app --reload --port 8000"

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
