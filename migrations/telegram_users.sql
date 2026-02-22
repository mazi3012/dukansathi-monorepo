-- DukanSathi — Telegram Users Migration (idempotent)
CREATE TABLE IF NOT EXISTS telegram_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    telegram_chat_id BIGINT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_username TEXT,
    connected_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe re-run)
DROP POLICY IF EXISTS "Users can read their own telegram link" ON telegram_users;
DROP POLICY IF EXISTS "Service role full access on telegram_users" ON telegram_users;

CREATE POLICY "Users can read their own telegram link"
    ON telegram_users FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on telegram_users"
    ON telegram_users FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_telegram_users_chat_id ON telegram_users(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id ON telegram_users(user_id);
