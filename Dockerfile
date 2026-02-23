# =============================================
# DukanSathi Backend — Cloud Run Dockerfile
# Purpose: Containerize the FastAPI backend for
#          deployment on Google Cloud Run
# =============================================

FROM python:3.11-slim

# Install system dependencies needed by some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Install Python Dependencies ---
# Copy requirements first (better Docker layer caching)
COPY backend/requirements.txt ./backend/requirements.txt
COPY ai-bot/requirements.txt ./ai-bot/requirements.txt

RUN pip install --no-cache-dir \
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
ENV PYTHONPATH=/app/ai-bot:/app
# Cloud Run injects PORT automatically (default 8080)
ENV PORT=8080

WORKDIR /app/backend

# --- Healthcheck ---
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

# --- Start Server ---
# Cloud Run requires listening on 0.0.0.0:$PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
