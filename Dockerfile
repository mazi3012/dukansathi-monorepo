# =============================================
# DukanSathi Backend — Cloud Run Dockerfile
# Purpose: Containerize the FastAPI backend for
#          deployment on Google Cloud Run
# Security: No credentials baked in. All secrets
#          injected at runtime via Cloud Run env vars.
# =============================================

FROM python:3.11-slim

# Install system dependencies needed by some Python packages
# libffi-dev and libssl-dev are often required by gRPC/networking packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ python3-dev make ffmpeg libffi-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv (standard official method for Docker)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv
ENV UV_SYSTEM_PYTHON=1

WORKDIR /app

# --- Install Python Dependencies ---
# Copy requirements first (better Docker layer caching)
COPY backend/requirements.txt ./backend/requirements.txt
COPY ai-bot/requirements.txt ./ai-bot/requirements.txt

# Use uv for blazing fast dependency installation (prevents 1-hour timeout)
RUN uv pip install --no-cache \
    -r backend/requirements.txt \
    -r ai-bot/requirements.txt

# --- Copy Source Code ---
# Copy ai-bot package (imported by backend)
COPY ai-bot/ ./ai-bot/

# Copy backend source
COPY backend/ ./backend/

# --- Security: Remove all secrets & dev artifacts ---
# These should not be baked into the image. If they somehow ended up
# in the build context (despite .dockerignore), remove them now.
RUN rm -f backend/.env \
           backend/.env.local \
           backend/service_account.json \
           backend/*-credentials.json \
           backend/credentials.json \
           backend/dukansathi_offline.db \
           backend/backend.log \
           backend/telegram_bot.log \
           backend/test_*.py \
           backend/check_*.py \
           backend/verify_*.py \
           backend/migrate_*.py \
           backend/seed_data.py \
           ai-bot/.env \
           ai-bot/service_account.json

# --- Security check: fail the build if any .env or service_account files remain ---
RUN ! find /app -name ".env" -o -name "service_account.json" -o -name "*-credentials.json" | grep -q "." \
    || (echo "ERROR: Secret files found in image — aborting build" && exit 1)

# --- Environment ---
# PYTHONPATH so 'from dukansathi_ai...' imports work
ENV PYTHONPATH=/app/ai-bot:/app/backend:/app
# Cloud Run injects PORT automatically (default 8080)
ENV PORT=8080
# Mark as production so setup_routes /api/setup/save is blocked
ENV ENV=production
# Disable heavy offline STT model loading in production to save RAM/Time
ENV ENABLE_OFFLINE_STT=false

WORKDIR /app/backend

# --- Security: Run as Non-Root User ---
RUN useradd -m appuser \
    && chown -R appuser:appuser /app
USER appuser

# --- Start Server ---
# Cloud Run requires listening on 0.0.0.0:$PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]

