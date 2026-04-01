#!/bin/bash

# =====================================================
#      DUKAN SATHI - LOCAL DEVELOPMENT SERVER (LINUX)
# =====================================================

set -e

# ANSI Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Dukan Sathi Localhost Environment...${NC}\n"

# Verify Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[ERROR] python3 is not found. Please install Python 3.11+.${NC}"
    exit 1
fi

# Verify Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not found. Please install Node.js 18+.${NC}"
    exit 1
fi

# Backend Setup
echo -e "${GREEN}[1/3] Setting up Backend...${NC}"
cd backend
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment & installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt
cd ..

# Frontend Setup
echo -e "${GREEN}[2/3] Setting up Frontend...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Frontend dependencies not found. Installing..."
    npm install
fi
cd ..

# Run Servers
echo -e "${GREEN}[3/3] Starting Backend (8000) and Frontend (5173)...${NC}"

# Start Backend in background
cd backend
# Make sure we're still using the venv python
./venv/bin/uvicorn main:app --reload --reload-dir . --reload-dir ../ai-bot --port 8000 --host 0.0.0.0 &
BACKEND_PID=$!
cd ..

# Give backend a moment to bind
sleep 3

# Start Frontend in background
cd frontend
npm run dev -- --host &
FRONTEND_PID=$!
cd ..

echo -e "\n${GREEN}=====================================================${NC}"
echo -e " All servers started!"
echo -e " Backend API: http://localhost:8000/docs"
echo -e " Frontend UI: http://localhost:5173"
echo -e " Press Ctrl+C to stop both servers gracefully."
echo -e "${GREEN}=====================================================${NC}\n"

# Trap Ctrl+C (SIGINT) and kill both child processes
trap "echo -e '\n${RED}Shutting down servers...${NC}'; kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM

# Wait indefinitely for background jobs to finish
wait $BACKEND_PID $FRONTEND_PID
