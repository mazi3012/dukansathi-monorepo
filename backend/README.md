# Dukan Sathi Backend

**Purpose:** FastAPI backend server for Dukan Sathi - India's first voice-first shop management solution.

## Features

- 🎙️ **Real-time AI Chat** via WebSocket
- 🗣️ **Voice Input/Output** (Google Cloud STT/TTS)
- 🤖 **Claude AI Integration** for natural language processing
- 📊 **Supabase Database** with Row-Level Security
- 🔐 **Authentication** via Google OAuth & OTP
- 📝 **Draft Workflows** for invoice/inventory approval

## Tech Stack

- **Framework:** FastAPI 0.115
- **AI:** Llama 4 Scout 17B (via Vertex AI MaaS)
- **Database:** Supabase (PostgreSQL + RLS + Storage)
- **Voice:** Groq Whisper (STT) + Microsoft Edge TTS
- **Agent:** LangGraph (multi-node state machine)
- **Bot:** Telegram Bot API (Webhook / Polling)
- **Security:** WebSocket rate limiting, SQL injection guard, sanitized errors
- **Deployment:** Google Cloud Run / Render with Docker

## Local Development Setup

### Prerequisites

- Python 3.9+ installed
- Supabase project created
- Groq API key (free from groq.com)
- Google Cloud service account (for Gemini via Vertex AI)

### Installation

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\\Scripts\\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Edit .env with your actual credentials
nano .env
```

### Environment Variables

Required variables in `.env`:

```
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_KEY=your_key_here
GROQ_API_KEY=your_groq_key_here
GOOGLE_APPLICATION_CREDENTIALS=service_account.json
FRONTEND_URL=http://localhost:5173
PORT=8000
```

### Run Development Server

```bash
# Start server with hot reload
python main.py

# Or use uvicorn directly
uvicorn main:app --reload --port 8000
```

Server will be available at: `http://localhost:8000`

API docs at: `http://localhost:8000/docs`

## Project Structure

```
backend/
├── main.py                 # FastAPI entry point
├── requirements.txt        # Python dependencies
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
├── services/              # Business logic services
│   ├── claude_service.py  # AI chat handler
│   ├── supabase_service.py# Database operations
│   └── voice_service.py   #STT/TTS handlers
├── models/                # Pydantic data models
└── utils/                 # Helper functions
```

## API Endpoints

### HTTP Endpoints

- `GET /` - Health check
- `GET /health` - Detailed service status

### WebSocket Endpoints

- `WS /ws/chat` - Real-time AI chat

## Deployment

### Docker

```bash
# Build image
docker build -t dukansathi-backend .

# Run container
docker run -p 8000:8000 --env-file .env dukansathi-backend
```

### Railway/Render

1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push to `main`

## Contributing

1. Follow English comment standards (see implementation_plan.md)
2. Include file headers in all new files
3. Add error handling with descriptive messages
4. Test locally before pushing

## License

Proprietary - Dukan Sathi Team 2026
