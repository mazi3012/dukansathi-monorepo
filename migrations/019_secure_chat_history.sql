-- Enable Row Level Security
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see only their own chat history
CREATE POLICY "Users can view their own chat history" 
    ON chat_history FOR SELECT 
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own chat history
CREATE POLICY "Users can insert their own chat history" 
    ON chat_history FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own chat history
CREATE POLICY "Users can delete their own chat history" 
    ON chat_history FOR DELETE 
    USING (auth.uid() = user_id);
    
-- (Optional) Update policy if needed, though chat is usually append-only
CREATE POLICY "Users can update their own chat history" 
    ON chat_history FOR UPDATE 
    USING (auth.uid() = user_id);
