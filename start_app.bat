@echo off
title Dukan Sathi - Local Dev Server
color 0A

echo.
echo  =====================================================
echo       DUKAN SATHI - LOCAL DEVELOPMENT SERVER
echo  =====================================================
echo.

:: Check Python is available
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Python is not found in PATH. Please install Python 3.11+.
    pause
    exit /b 1
)

:: Check Node.js is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not found in PATH. Please install Node.js 18+.
    pause
    exit /b 1
)

:: Check if venv exists
if not exist "backend\venv\Scripts\activate.bat" (
    echo  [ERROR] Backend virtual environment not found at backend\venv
    echo  [TIP]   Run: python -m venv backend\venv
    echo          Then: cd backend ^& venv\Scripts\activate ^& pip install -r requirements.txt
    pause
    exit /b 1
)

:: Check if frontend node_modules exist
if not exist "frontend\node_modules" (
    echo  [INFO] Frontend dependencies not installed. Running npm install...
    cd /d e:\dukanv22\frontend
    npm install
    cd /d e:\dukanv22
)

echo  [1/2] Starting Backend (FastAPI + Uvicorn) ...
echo        URL: http://localhost:8000
start "Dukan Sathi Backend" cmd /k "cd /d e:\dukanv22\backend && venv\Scripts\activate.bat && uvicorn main:app --reload --reload-dir e:\dukanv22\backend --reload-dir e:\dukanv22\ai-bot --port 8000 --host 0.0.0.0"

:: Brief wait so backend starts binding before frontend connects
timeout /t 3 /nobreak >nul

echo  [2/2] Starting Frontend (Vite + React) ...
echo        URL: http://localhost:5173
start "Dukan Sathi Frontend" cmd /k "cd /d e:\dukanv22\frontend && npm run dev"

echo.
echo  =====================================================
echo   All servers started! Open your browser at:
echo.
echo       http://localhost:5173
echo.
echo   Backend API available at:
echo       http://localhost:8000
echo       http://localhost:8000/docs  (API Docs)
echo.
echo   Close this window anytime. The servers keep
echo   running in their own windows.
echo  =====================================================
echo.
pause
