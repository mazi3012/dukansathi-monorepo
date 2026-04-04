/**
 * File: 028_clear_telegram_memory.sql
 * Purpose: Clear stuck Telegram conversation memory and reset pipeline
 * Author: Dukan Sathi Team
 * Created: 2026-04-04
 *
 * This migration clears all accumulated telegram_conversation_memory to reset the pipeline
 * and allow fresh interactions without stale context interfering with the bot.
 */

-- Clear all telegram conversation memory
DELETE FROM telegram_conversation_memory;

-- Reset any locks/pending state by truncating the table
-- (The PENDING_DRAFTS dict in memory will be reset when bot restarts)

COMMENT ON TABLE telegram_conversation_memory IS 'Short-term context storage for Telegram conversations (cleared periodically)';
