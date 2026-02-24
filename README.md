# 🏪 DukanSathi AI

> **Voice-first shop management platform for Indian small businesses**  
> Say it in Hindi, Hinglish, or English — the AI understands.

---

## 📑 Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Quick Start (Local)](#quick-start-local)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Database Migrations](#database-migrations)
- [AI Command Reference](#ai-command-reference)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
                   ┌─────────────────┐
                   │   Frontend      │
                   │  React + Vite   │  ← Vercel
                   │  Tailwind CSS   │
                   └────────┬────────┘
                            │ WebSocket (ws://...)
                            │ REST (Supabase SDK)
                   ┌────────▼────────┐
                   │    Backend      │
                   │   FastAPI       │  ← Render
                   │   Python 3.11   │
                   └───┬────────┬────┘
                       │        │
            ┌──────────▼──┐  ┌──▼──────────────┐
            │  AI Bot     │  │  Voice Services  │
            │ agent_graph │  │  STT: Groq       │
            │ Gemini/Local│  │  TTS: Edge-TTS   │
            └─────────────┘  └─────────────────┘
                       │
            ┌──────────▼──────────┐
            │     Supabase        │
            │  PostgreSQL DB      │
            │  Auth               │
            │  Storage (images)   │
            └─────────────────────┘
```

---

## Features

| Feature | Status |
|---------|--------|
| 🎤 Voice input (Hindi/Hinglish/English) | ✅ |
| 📦 Product management (add, edit, stock) | ✅ |
| 👤 Customer management (add, track dues) | ✅ |
| 🧾 Invoice/bill creation via AI | ✅ |
| 💸 Payment recording & dues tracking | ✅ |
| 📊 Profit margin display | ✅ |
| 🔴 Low-stock alerts | ✅ |
| 🔄 Offline mode (local SQLite + Ollama) | ✅ |
| 🔊 AI voice responses (Edge TTS) | ✅ |
| 📷 Product image upload | ✅ |

---

## Project Structure

```
dukanv22/
├── backend/                  # FastAPI server
│   ├── main.py               # Entry point: WebSocket, REST API, CORS
│   ├── voice_service.py      # STT (Groq Whisper) + TTS (Edge-TTS)
│   ├── local_ai.py           # Ollama local LLM integration
│   ├── local_db.py           # SQLite offline database
│   ├── setup_routes.py       # System setup endpoints
│   └── requirements.txt
│
├── ai-bot/
│   └── dukansathi_ai/
│       └── agent_graph.py    # NLP engine: fast regex + LLM fallback
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Chat.jsx       # AI chat interface
│       │   ├── Inventory.jsx  # Product management
│       │   ├── Customers.jsx  # Customer management
│       │   ├── Dashboard.jsx  # Sales overview
│       │   └── Settings.jsx   # Voice settings, profile
│       ├── components/
│       │   ├── ActionCard.jsx # Draft approval UI (product/customer/payment)
│       │   └── BottomNav.jsx  # Mobile navigation
│       └── hooks/
│           └── useChat.js     # WebSocket + TTS + chat state
│
├── migrations/               # Supabase SQL migrations (run in order)
│   ├── 001_*.sql ... 014_*.sql
│
├── vercel.json               # Frontend deployment config
├── render.yaml               # Backend deployment config
└── package.json              # Monorepo scripts
```

---

## Quick Start (Local)

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Supabase project

### 1. Clone & install

```powershell
# Backend
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Set environment variables

**`backend/.env`**
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
FRONTEND_URL=http://localhost:5173
```

**`frontend/.env.local`**
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_BACKEND_WS_URL=ws://localhost:8000/ws/chat
VITE_BACKEND_URL=http://localhost:8000
```

### 3. Run migrations (Supabase SQL Editor)

Run files in `migrations/` from `001_*.sql` to `014_*.sql` in order.

### 4. Start servers

```powershell
# Terminal 1 — Backend
cd backend
.\venv\Scripts\Activate.ps1
python main.py
# → http://localhost:8000

# Terminal 2 — Frontend
cd frontend
npm run dev
# → http://localhost:5173
```

Or use the convenience script:
```powershell
.\start_app.bat
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role key (never expose to frontend) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `GROQ_API_KEY` | ✅ | Groq Whisper STT key |
| `FRONTEND_URL` | ✅ | Allowed frontend origin for CORS |
| `PORT` | Optional | Server port (default: 8000) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `VITE_BACKEND_WS_URL` | ✅ | WebSocket URL for AI chat |
| `VITE_BACKEND_URL` | ✅ | REST API base URL |

---

## Deployment

### Frontend → Vercel

- Auto-deploys on push to `main`
- Build command: `cd frontend && npm run build`
- Output directory: `frontend/dist`
- Config: [`vercel.json`](vercel.json)

### Backend → Render

- Auto-deploys on push to `main`
- Start command: `cd backend && pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port $PORT`
- Config: [`render.yaml`](render.yaml)

> **After deploy:** Set all environment variables in Render dashboard and `FRONTEND_URL` to your Vercel URL.

---

## Database Migrations

Run SQL files in `migrations/` in order via Supabase SQL Editor:

| File | Description |
|------|-------------|
| `001_*.sql` | Initial schema |
| `002-011_*.sql` | Core features (auth, products, customers, invoices) |
| `012_auto_update_customer_balance.sql` | Auto-trigger for customer credit on sale |
| `013_ai_helper_functions.sql` | AI helper RPCs |
| `014_receive_payment_rpc.sql` | Payment & credit RPCs |

---

## AI Command Reference

The AI understands natural Hindi/Hinglish/English commands:

### Products
```
"Add Maggi price 20 stock 100"
"New product milk 50 rupees, cost 35"
"Add soap category FMCG price 40"
```

### Customers
```
"Add customer Rohit"
"New customer Priya phone 9876543210"
```

### Dues & Payments
```
"Add 500 due to Amit"          → adds ₹500 credit (red)
"Deduct 300 from Rahul due"    → deducts ₹300 (green)
"Rahul paid 1000"              → records ₹1000 payment
"Received 200 from Seema"      → records ₹200 payment
```

### Invoices
```
"Bill for Amit 2 rice and 1 oil"
"Create invoice for Raj 3 Maggi"
```

---

## API Reference

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/health` | Detailed health (DB status) |
| `POST` | `/api/tts-preview` | TTS audio preview |
| `POST` | `/upload-product-image` | Upload product image |
| `GET` | `/api/local/customers` | Offline customer list |
| `GET` | `/api/local/products` | Offline product list |
| `GET` | `/api/setup/*` | System setup routes |

### WebSocket `/ws/chat`

Messages are JSON objects:

**Client → Server:**
```json
{ "type": "text", "content": "Add customer Rahul", "user_id": "...", "model": "llama-4-scout-17b-16e-instruct-maas", "voice_id": "en-IN-PrabhatNeural" }
{ "type": "voice", "content": "<base64_audio>" }
{ "type": "image", "content": "<base64_image>" }
```

**Server → Client:**
```json
{ "type": "text", "content": "Review and confirm below!", "audio": "<base64_mp3>", "attachment": { "type": "customer_draft", ... } }
{ "type": "transcription", "content": "Add customer Rahul" }
{ "type": "error", "content": "Something went wrong" }
```

---

## Troubleshooting

### WebSocket not connecting
1. Check backend is running: `curl http://localhost:8000/health`
2. Verify `VITE_BACKEND_WS_URL` in frontend `.env.local`
3. Check for CORS errors in browser console — add your origin to `ALLOWED_ORIGINS` in `backend/main.py`

### AI draft not showing
- Backend must return `{ "type": "text", ..., "attachment": { "type": "customer_draft", ... } }`
- Check `backend.log` for `[AI] AI Raw Response` log line

### Payment direction wrong
- All NLP patterns now include `payment_type: "payment"` (deduct) or `"credit"` (add)
- ActionCard sends this to Chat.jsx which uses it to determine add/subtract direction

### Supabase RLS blocking requests
- Ensure service role key is in backend `.env` (not anon key)
- Frontend uses anon key with user-scoped RLS policies

---

## Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m "feat: add my feature"`
4. Push and open a PR

---

*Built with ❤️ for Indian shopkeepers*
