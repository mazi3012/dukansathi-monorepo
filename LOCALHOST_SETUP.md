# Dukan Sathi - Localhost Setup Guide

## Quick Start (3 Terminals)

### Terminal 1: Backend API
```powershell
cd "e:/dukan sathi openclawd/backend"
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```
Server will run at: **http://localhost:8000**

---

### Terminal 2: Moltbot AI (already tested ✅)
Moltbot runs inside the backend, no separate server needed.

---

### Terminal 3: Frontend
```powershell
cd "e:/dukan sathi openclawd/frontend"
npm install
npm run dev
```
App will run at: **http://localhost:5173**

---

## Prerequisites Checklist

### ✅ Already Done
- [x] Backend virtual environment created
- [x] AI bot virtual environment created
- [x] Moltbot tested and working
- [x] Service account copied
- [x] Groq API key in .env
- [x] Frontend Vite project created

### ⚠️ Still Needed
- [ ] Backend `.env` - Add Supabase service key
- [ ] Install backend dependencies
- [ ] Install frontend dependencies
- [ ] Get Supabase anon key for frontend

---

## Step-by-Step Setup

### 1. Get Supabase Keys

You need 2 keys from your Supabase project:

**Go to:** https://supabase.com/dashboard/project/xfnoquphbeaqslownzxw/settings/api

Copy:
- **Service Role Key** (secret) → Backend `.env`
- **Anon/Public Key** → Frontend `.env.local`

### 2. Update Backend `.env`

Edit: `e:/dukan sathi openclawd/backend/.env`

```bash
# Update this line with your actual service key:
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_actual_key_here
```

### 3. Install Backend Dependencies

```powershell
cd "e:/dukan sathi openclawd/backend"
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 4. Create Frontend `.env.local`

Create: `e:/dukan sathi openclawd/frontend/.env.local`

```bash
VITE_SUPABASE_URL=https://xfnoquphbeaqslownzxw.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_BACKEND_WS_URL=ws://localhost:8000/ws/chat
```

### 5. Install Frontend Dependencies

```powershell
cd "e:/dukan sathi openclawd/frontend"
npm install
```

### 6. Test Each Component

#### Test Backend API
```powershell
cd "e:/dukan sathi openclawd/backend"
.\venv\Scripts\Activate.ps1
python main.py
```

Visit: **http://localhost:8000/docs** (API documentation)

Expected: Swagger UI showing endpoints

#### Test Frontend
```powershell
cd "e:/dukan sathi openclawd/frontend"
npm run dev
```

Visit: **http://localhost:5173**

Expected: React app loads

---

## Testing Voice Flow (End-to-End)

Once everything is running:

1. **Open:** http://localhost:5173
2. **Click:** Voice/Mic button
3. **Say:** "Hello Moltbot"
4. **See:** Text transcription (Groq Whisper)
5. **Wait:** AI response from Moltbot
6. **Hear:** Voice output (Edge TTS)

---

## Troubleshooting

### Port Already in Use
```powershell
# Backend (port 8000)
netstat -ano | findstr :8000
taskkill /PID <process_id> /F

# Frontend (port 5173)
netstat -ano | findstr :5173
taskkill /PID <process_id> /F
```

### Module Not Found
```powershell
# Backend
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### CORS Error
Make sure backend .env has:
```
FRONTEND_URL=http://localhost:5173
```

### WebSocket Connection Failed
Check:
1. Backend is running on port 8000
2. Frontend `.env.local` has correct WS URL
3. No firewall blocking

---

## What Works Right Now

✅ **Moltbot AI** - Tested, working perfectly  
✅ **Groq STT** - Credentials configured  
✅ **Edge TTS** - Free, no config needed  
✅ **Gemini** - Authenticated via service account  

⏳ **Pending Integration**
- Voice service integration in backend
- WebSocket message handling
- Frontend chat interface
- Database query execution (SQL specialist)

---

## Next Development Steps

1. **Integrate Moltbot into Backend**
   - Import `process_user_input` in main.py
   - Call from WebSocket handler
   
2. **Add Voice Services to Backend**
   - Import `transcribe_audio` and `speak_text`
   - Handle audio messages in WebSocket

3. **Build Frontend Chat UI**
   - Voice recording component
   - Chat message display
   - Draft approval buttons

4. **Connect to Database**
   - Implement SQL specialist node
   - Add draft creation RPCs
   - Enable actual data queries

---

## Quick Test Script

Save as `test_localhost.ps1`:

```powershell
# Test Backend
Write-Host "Testing Backend..." -ForegroundColor Green
$backend = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing
if ($backend.StatusCode -eq 200) {
    Write-Host "✅ Backend OK" -ForegroundColor Green
} else {
    Write-Host "❌ Backend Failed" -ForegroundColor Red
}

# Test Frontend
Write-Host "Testing Frontend..." -ForegroundColor Green
$frontend = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing
if ($frontend.StatusCode -eq 200) {
    Write-Host "✅ Frontend OK" -ForegroundColor Green
} else {
    Write-Host "❌ Frontend Failed" -ForegroundColor Red
}
```

Run with: `.\test_localhost.ps1`
