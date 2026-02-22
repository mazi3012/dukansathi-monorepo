"""
File: telegram_bot.py
Purpose: Telegram Bot bridge for Dukan Sathi
Author: Dukan Sathi Team
Created: 2026-02-22

This bot allows users to interact with Sathi AI via Telegram.
It reuses the existing agent_graph.py (process_user_input) for all AI logic.

Commands:
  /start   - Welcome message & usage guide
  /connect - Link Telegram account to DukanSathi web account
  /help    - Show available commands

Usage:
  Run standalone: python telegram_bot.py
  Or import and call start_telegram_bot() from main.py
"""

import os
import sys
import json
import logging
import asyncio

# Setup paths — same pattern as main.py
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../ai-bot'))
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("telegram_bot.log", mode='a', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Import AI brain — same as main.py
try:
    from dukansathi_ai.agent_graph import process_user_input
    logger.info("✅ AI module loaded successfully for Telegram bot")
except Exception as e:
    logger.error(f"❌ Failed to import AI module: {e}")
    async def process_user_input(*args, **kwargs):
        return "Sorry Boss, AI module is not available right now."

# Import STT (Groq Whisper) for voice messages
try:
    from voice_service import transcribe_audio
    logger.info("✅ Voice/STT module loaded")
except Exception as e:
    logger.warning(f"⚠️ Voice/STT not available: {e}")
    async def transcribe_audio(audio_data: bytes) -> str:
        return ""

# Supabase client for user mapping
try:
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    supabase = create_client(url, key) if url and key else None
except Exception:
    supabase = None

# Bot token
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://dukansathi.vercel.app")


# ─── Helpers ───────────────────────────────────────────────

def get_user_token_for_chat(chat_id: int) -> str:
    """
    Look up the DukanSathi user_id linked to this Telegram chat.
    Falls back to telegram_{chat_id} as a guest token.
    """
    if supabase:
        try:
            result = supabase.table("telegram_users") \
                .select("user_id") \
                .eq("telegram_chat_id", chat_id) \
                .limit(1) \
                .execute()
            if result.data and result.data[0].get("user_id"):
                return result.data[0]["user_id"]
        except Exception as e:
            logger.error(f"Error looking up telegram user: {e}")

    # Fallback: use telegram chat ID as guest token
    return f"telegram_{chat_id}"


def format_draft_for_telegram(draft: dict) -> str:
    """
    Convert a draft JSON object into a readable Telegram message.
    """
    draft_type = draft.get("type", "unknown")

    if draft_type == "product_draft":
        name = draft.get("name", "Unknown")
        price = draft.get("selling_price", 0)
        stock = draft.get("stock_quantity", 0)
        cost = draft.get("cost_price", 0)
        lines = [
            "📦 *Product Draft*",
            f"  Name: {name}",
            f"  Selling Price: ₹{price}",
        ]
        if cost:
            lines.append(f"  Cost Price: ₹{cost}")
        if stock:
            lines.append(f"  Stock: {stock}")
        lines.append("\n_Reply 'approve' to confirm or 'cancel' to discard_")
        return "\n".join(lines)

    elif draft_type == "customer_draft":
        name = draft.get("name", "Unknown")
        phone = draft.get("phone", "N/A")
        lines = [
            "👤 *Customer Draft*",
            f"  Name: {name}",
            f"  Phone: {phone}",
            "\n_Reply 'approve' to confirm or 'cancel' to discard_"
        ]
        return "\n".join(lines)

    elif draft_type == "invoice_draft":
        customer = draft.get("customer_name", "Unknown")
        items = draft.get("items", [])
        total = draft.get("total_amount", 0)
        lines = [
            "🧾 *Invoice Draft*",
            f"  Customer: {customer}",
            "  Items:",
        ]
        for item in items:
            name = item.get("product_name", "?")
            qty = item.get("quantity", 0)
            price = item.get("price", 0)
            lines.append(f"    • {name} × {qty}  ₹{price * qty}")
        lines.append(f"  *Total: ₹{total}*")
        lines.append("\n_Reply 'approve' to confirm or 'cancel' to discard_")
        return "\n".join(lines)

    elif draft_type == "payment_draft":
        customer = draft.get("customer_name", "Unknown")
        amount = draft.get("amount", 0)
        ptype = draft.get("payment_type", "payment")
        emoji = "💚" if ptype == "payment" else "🔴"
        label = "Payment Received" if ptype == "payment" else "Credit Given"
        lines = [
            f"{emoji} *{label} Draft*",
            f"  Customer: {customer}",
            f"  Amount: ₹{amount}",
            "\n_Reply 'approve' to confirm or 'cancel' to discard_"
        ]
        return "\n".join(lines)

    else:
        return f"📋 Draft: {json.dumps(draft, indent=2)}"


# ─── Command Handlers ─────────────────────────────────────

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    user_name = update.effective_user.first_name or "Boss"

    welcome_text = (
        f"🙏 *Namaste {user_name}!*\n\n"
        f"Main *Sathi AI* hoon — aapka personal shop assistant!\n\n"
        f"📱 *Yahan kya kar sakte ho:*\n"
        f"• Invoice banao: \"bill for Amit 2 Rice 1 Oil\"\n"
        f"• Product add karo: \"add product Milk price 50\"\n"
        f"• Customer add karo: \"new customer Rahul 9876543210\"\n"
        f"• Payment record karo: \"Amit paid 500\"\n"
        f"• Kuch bhi pucho: \"total sales today\"\n"
        f"🎙️ *Voice bhi bhej sakte ho!* (Hindi/Hinglish supported)\n\n"
        f"🔗 Apna web account connect karo: /connect\n"
        f"❓ Help: /help"
    )

    keyboard = [[
        InlineKeyboardButton("🌐 Open Web App", url=FRONTEND_URL)
    ]]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        welcome_text,
        parse_mode="Markdown",
        reply_markup=reply_markup
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command"""
    help_text = (
        "📚 *Sathi AI Commands:*\n\n"
        "/start — Welcome message\n"
        "/connect — Link your DukanSathi web account\n"
        "/help — Show this help message\n\n"
        "💡 *Tips:*\n"
        "Just type or *send a voice message* in Hindi/Hinglish!\n"
        "Examples:\n"
        "• \"add sugar price 40 stock 100\"\n"
        "• \"bill for Rahul 3 Rice\"\n"
        "• \"show my products\"\n"
        "• \"kitna stock hai\"\n"
        "• 🎙️ _Voice message mein bolo kuch bhi!_"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")


async def connect_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle /connect CODE command.
    User gets a 6-char code from the web app Settings page and sends it here.
    """
    chat_id = update.effective_chat.id
    username = update.effective_user.username or ""

    # Check if already connected
    if supabase:
        try:
            result = supabase.table("telegram_users") \
                .select("user_id") \
                .eq("telegram_chat_id", chat_id) \
                .limit(1) \
                .execute()
            if result.data and result.data[0].get("user_id"):
                await update.message.reply_text(
                    "✅ Your Telegram is already connected!\n"
                    "You can start chatting with Sathi AI right away. 🚀"
                )
                return
        except Exception as e:
            logger.error(f"Error checking connection: {e}")

    # If no code provided — show simple instructions
    if not context.args:
        instructions = (
            "🔗 *Connect Your Account — 3 Easy Steps:*\n\n"
            "1️⃣ Open your *Dukan Sathi* app\n"
            "2️⃣ Go to ⚙️ *Settings* → *Connect Telegram*\n"
            "3️⃣ Tap *Generate Code* and send that code here:\n\n"
            "`/connect YOURCODE`\n\n"
            "🕐 _The code works for 10 minutes._"
        )
        await update.message.reply_text(instructions, parse_mode="Markdown")
        return

    # Code provided — verify with backend
    code = context.args[0].upper().strip()
    backend_url = os.environ.get("BACKEND_URL", "http://localhost:8000")

    await update.effective_chat.send_action("typing")

    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{backend_url}/api/telegram/verify-token",
                json={
                    "token": code,
                    "telegram_chat_id": chat_id,
                    "telegram_username": username,
                },
                timeout=10
            )
            data = resp.json()

        if data.get("success"):
            await update.message.reply_text(
                "🎉 *Connected successfully!*\n\n"
                "Your Telegram is now linked to your Dukan Sathi account.\n"
                "All your products, customers, and data are now accessible here!\n\n"
                "Try sending: _add product milk price 50_",
                parse_mode="Markdown"
            )
        else:
            error_msg = data.get("error", "Invalid code. Please try again.")
            await update.message.reply_text(
                f"❌ {error_msg}\n\n"
                "Go to your app → Settings → Connect Telegram → Generate Code."
            )
    except Exception as e:
        logger.error(f"Error verifying token: {e}")
        await update.message.reply_text(
            "❌ Could not connect right now. Please try again in a moment."
        )



# ─── Message Handler ──────────────────────────────────────

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle regular text messages — route to AI"""
    user_text = update.message.text
    chat_id = update.effective_chat.id

    if not user_text or not user_text.strip():
        return

    logger.info(f"[TG] Message from {chat_id}: {user_text[:80]}")

    # Show "typing..." indicator
    await update.effective_chat.send_action("typing")

    # Get the user token (linked account or guest)
    user_token = get_user_token_for_chat(chat_id)

    try:
        # Call the SAME AI brain used by the web app
        ai_response = await process_user_input(
            text=user_text,
            user_token=user_token,
            model="gemini-2.0-flash-001"  # Use cloud model for Telegram
        )

        logger.info(f"[TG] AI Response: {ai_response[:100]}")

        # Parse the response — might be JSON with draft or plain text
        try:
            response_data = json.loads(ai_response)
            if isinstance(response_data, dict):
                display_text = response_data.get("text", ai_response)
                draft = response_data.get("draft")

                # Send the text response
                await update.message.reply_text(display_text)

                # If there's a draft, format and send it
                if draft and isinstance(draft, dict) and draft.get("type"):
                    draft_message = format_draft_for_telegram(draft)
                    await update.message.reply_text(
                        draft_message,
                        parse_mode="Markdown"
                    )
            else:
                await update.message.reply_text(ai_response)
        except (json.JSONDecodeError, ValueError):
            # Plain text response
            await update.message.reply_text(ai_response)

    except Exception as e:
        logger.error(f"[TG] Error processing message: {e}")
        await update.message.reply_text(
            "Sorry Boss, I'm having trouble right now. Please try again."
        )

async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle voice messages — transcribe with Groq Whisper, then pass to AI.
    Supports OGG/OPUS (Telegram default) and any audio file.
    """
    chat_id = update.effective_chat.id

    # Show recording indicator while processing
    await update.effective_chat.send_action("typing")

    try:
        # Get the voice/audio file object
        if update.message.voice:
            file_ref = update.message.voice
            mime = "audio/ogg"
        elif update.message.audio:
            file_ref = update.message.audio
            mime = update.message.audio.mime_type or "audio/ogg"
        else:
            return

        logger.info(f"[TG] Voice message from {chat_id} — {file_ref.file_size} bytes")

        # Download the audio bytes
        tg_file = await context.bot.get_file(file_ref.file_id)
        audio_bytes = await tg_file.download_as_bytearray()
        audio_bytes = bytes(audio_bytes)

        # Transcribe with Groq Whisper
        await update.effective_chat.send_action("typing")
        transcribed = await transcribe_audio(audio_bytes)

        if not transcribed or not transcribed.strip():
            await update.message.reply_text(
                "🎙️ Sorry, I couldn't understand that audio. Please try again or type your message."
            )
            return

        logger.info(f"[TG] Voice transcribed: '{transcribed[:80]}'")

        # Echo what was understood (helps non-tech users know it worked)
        await update.message.reply_text(f"🎙️ _Suna:_ \"{transcribed}\"\n", parse_mode="Markdown")

        # Now pass the transcription to the same AI handler
        user_token = get_user_token_for_chat(chat_id)
        ai_response = await process_user_input(
            text=transcribed,
            user_token=user_token,
            model="gemini-2.0-flash-001"
        )

        # Parse and send the AI response (same as text handler)
        try:
            response_data = json.loads(ai_response)
            if isinstance(response_data, dict):
                display_text = response_data.get("text", ai_response)
                draft = response_data.get("draft")
                await update.message.reply_text(display_text)
                if draft and isinstance(draft, dict) and draft.get("type"):
                    draft_message = format_draft_for_telegram(draft)
                    await update.message.reply_text(draft_message, parse_mode="Markdown")
            else:
                await update.message.reply_text(ai_response)
        except (json.JSONDecodeError, ValueError):
            await update.message.reply_text(ai_response)

    except Exception as e:
        logger.error(f"[TG] Voice handling error: {e}")
        await update.message.reply_text(
            "❌ Voice message process nahi ho paya. Please type karke try karein."
        )




async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Log errors"""
    logger.error(f"Telegram error: {context.error}")


# ─── Main ─────────────────────────────────────────────────

def start_telegram_bot():
    """Start the Telegram bot (blocking — run in a separate process)"""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("❌ TELEGRAM_BOT_TOKEN not set in environment!")
        logger.info("👉 Create a bot via @BotFather on Telegram and add the token to .env")
        return

    logger.info("🚀 Starting Dukan Sathi Telegram Bot...")

    # Build the application
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Register handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("connect", connect_command))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))          # 🎙️ Voice
    app.add_handler(MessageHandler(filters.AUDIO, handle_voice))          # 🎵 Audio files
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))  # 💬 Text

    # Error handler
    app.add_error_handler(error_handler)

    # Start polling
    logger.info("✅ Bot is live! Waiting for messages...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    start_telegram_bot()
