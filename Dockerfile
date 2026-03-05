# =============================================
# DukanSathi Backend — Cloud Run Dockerfile
# Purpose: Containerize the FastAPI backend for
#          deployment on Google Cloud Run
# =============================================

FROM python:3.11-slim

# Install system dependencies needed by some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ python3-dev make ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Install Python Dependencies ---
# Copy requirements first (better Docker layer caching)
COPY backend/requirements.txt ./backend/requirements.txt
COPY ai-bot/requirements.txt ./ai-bot/requirements.txt

# Use --prefer-binary to avoid compiling from source (prevents timeout)
# Increase pip timeout for large packages like google-cloud-aiplatform
RUN pip install --no-cache-dir --prefer-binary \
    --timeout 300 --retries 3 \
    -r backend/requirements.txt \
    -r ai-bot/requirements.txt

# --- Copy Source Code ---
# Copy ai-bot package (imported by backend)
COPY ai-bot/ ./ai-bot/

# Copy backend source
COPY backend/ ./backend/

# --- Remove sensitive/dev-only files from image ---
RUN rm -f backend/.env backend/service_account.json \
    backend/dukansathi_offline.db backend/backend.log \
    backend/test_*.py backend/check_*.py backend/verify_*.py \
    backend/migrate_*.py backend/seed_data.py

# --- Environment ---
# PYTHONPATH so 'from dukansathi_ai...' imports work
ENV PYTHONPATH=/app/ai-bot:/app/backend:/app
# Cloud Run injects PORT automatically (default 8080)
ENV PORT=8080
# Disable heavy model loading by default in production to save RAM/Time
ENV ENABLE_OFFLINE_STT=false

WORKDIR /app/backend

# --- Start Server ---
# Cloud Run requires listening on 0.0.0.0:$PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
