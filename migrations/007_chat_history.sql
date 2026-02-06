-- Chat History Table
-- Stores conversation history for users with automatic 12-hour cleanup

CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast retrieval by user and time
CREATE INDEX idx_chat_history_user_time ON chat_history(user_id, created_at DESC);

-- Function to cleanup messages older than 12 hours
CREATE OR REPLACE FUNCTION cleanup_old_chat_history()
RETURNS void AS $$
BEGIN
  DELETE FROM chat_history 
  WHERE created_at < NOW() - INTERVAL '12 hours';
END;
$$ LANGUAGE plpgsql;

-- Note: For automatic cleanup, you can set up a cron job or use pg_cron extension:
-- SELECT cron.schedule('cleanup-chat-history', '0 * * * *', 'SELECT cleanup_old_chat_history()');
