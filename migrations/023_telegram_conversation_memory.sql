-- Telegram conversation memory for short-term context across messages.

CREATE TABLE IF NOT EXISTS telegram_conversation_memory (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    telegram_chat_id BIGINT NOT NULL,
    user_token TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    message_type TEXT NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tcm_chat_created ON telegram_conversation_memory(telegram_chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tcm_user_token_created ON telegram_conversation_memory(user_token, created_at DESC);

-- Enable RLS and allow service-role driven backend access.
ALTER TABLE telegram_conversation_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on telegram_conversation_memory" ON telegram_conversation_memory;
CREATE POLICY "Service role full access on telegram_conversation_memory"
    ON telegram_conversation_memory FOR ALL
    USING (true)
    WITH CHECK (true);
