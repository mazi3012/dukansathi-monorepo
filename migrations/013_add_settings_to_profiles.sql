-- Migration: Add settings columns to profiles
-- Created: 2026-02-09

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS voice_id TEXT DEFAULT 'en-IN-PrabhatNeural';

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS voice_speed TEXT DEFAULT '+0%';

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS model_id TEXT DEFAULT 'gemini-2.0-flash-001';

-- Comment on columns
COMMENT ON COLUMN profiles.voice_id IS 'Preferred TTS Voice ID';
COMMENT ON COLUMN profiles.voice_speed IS 'TTS Speaking Rate (e.g. +0%, -10%)';
COMMENT ON COLUMN profiles.model_id IS 'Preferred AI Model ID';
