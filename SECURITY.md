# Security Policy — DukanSathi

## Reporting a Vulnerability

If you discover a security vulnerability, please do **not** create a public GitHub issue.  
Email us privately or open a **private security advisory** on GitHub instead.

---

## Secrets & Credentials

| What | Where it goes | NEVER commit |
|------|--------------|-------------|
| Supabase URL & Service Key | `backend/.env` | ✅ |
| Supabase Anon Key | `frontend/.env.local` | ✅ |
| Groq API Key | `backend/.env` | ✅ |
| Google service account | `backend/service_account.json` | ✅ |
| Telegram Bot Token | `backend/.env` | ✅ |

All of the above are gitignored. **Never hardcode them in source files.**

---

## Supabase Row Level Security (RLS)

All tables must have RLS enabled. The rule of thumb:

- Users can only `SELECT/INSERT/UPDATE/DELETE` rows where `user_id = auth.uid()`
- Service role key (backend only) bypasses RLS — **never expose it to the frontend**
- Anon key (frontend) must only access data through strict RLS policies

After any schema migration, run:
```sql
ALTER TABLE <new_table> ENABLE ROW LEVEL SECURITY;
```

---

## Environment Variables

- Copy `backend/.env.example` to `backend/.env` and fill in real values
- Copy the pattern from `README.md → Environment Variables` for frontend
- Never commit `.env` or `.env.local` files — they are gitignored

---

## API Security

- All API endpoints require a valid Supabase JWT (`Authorization: Bearer <token>`)  
- Backend uses rate limiting (slowapi) and security headers  
- CORS is restricted to the configured `FRONTEND_URL`  
- All user inputs are validated before being passed to the DB or AI model  

---

## Emergency — If Keys Are Leaked

1. **Rotate immediately** at https://app.supabase.com → Project Settings → API → Roll keys
2. Regenerate Groq API key at https://console.groq.com/keys
3. Revoke and recreate Google service account at Google Cloud Console
4. Update `.env` files locally and in your deployment platform (Render/Vercel)
5. Force-push or use `git filter-repo` to wipe the key from git history

---

## Third-Party Dependencies

- Keep `requirements.txt` and `package.json` dependencies updated
- Run `pip audit` and `npm audit` periodically
- `genkit-ide-models/node_modules/` should NOT be committed to git

---

## Compliance

This project follows good practices aligned with OWASP Top 10 and best practices for SaaS applications handling Indian merchant data (GST/payment records).