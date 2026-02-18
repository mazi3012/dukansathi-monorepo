@echo off
echo Starting Dukan Sathi...

:: 1. Start Backend
start "Dukan Backend" cmd /k "cd /d e:\dukanv22\backend && venv\Scripts\activate && python main.py"

:: 2. Start Frontend
start "Dukan Frontend" cmd /k "cd /d e:\dukanv22\frontend && npm run dev"

echo Done! Servers are starting in new windows.
echo You can close this window.
