-- DukanSathi — Telegram OTP Connect Tokens (idempotent)
CREATE TABLE IF NOT EXISTS telegram_connect_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE
);

ALTER TABLE telegram_connect_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe re-run)
DROP POLICY IF EXISTS "Users can read their own token" ON telegram_connect_tokens;
DROP POLICY IF EXISTS "Users can insert their own token" ON telegram_connect_tokens;
DROP POLICY IF EXISTS "Service role full access on connect tokens" ON telegram_connect_tokens;

CREATE POLICY "Users can read their own token"
    ON telegram_connect_tokens FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own token"
    ON telegram_connect_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on connect tokens"
    ON telegram_connect_tokens FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_telegram_tokens_token ON telegram_connect_tokens(token);
