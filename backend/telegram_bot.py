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
import traceback
from io import BytesIO
from datetime import datetime, timezone

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

# For generating PDFs
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

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


# ─── Draft Execution (Telegram Backend Replacement for Chat.jsx) ───

PENDING_DRAFTS = {}

def generate_invoice_pdf(customer_name: str, items: list, total: float, invoice_id: str) -> BytesIO:
    """Generates a simple PDF invoice in memory using reportlab."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Header
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, height - 50, "DukanSathi Invoice")
    
    # Details
    c.setFont("Helvetica", 12)
    c.drawString(50, height - 90, f"Invoice #: DS-{invoice_id}")
    c.drawString(50, height - 110, f"Customer: {customer_name}")
    
    # Table Header
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, height - 150, "Item")
    c.drawString(300, height - 150, "Quantity")
    c.drawString(400, height - 150, "Price")
    c.drawString(500, height - 150, "Total")
    
    c.line(50, height - 155, 550, height - 155)
    
    # Items
    c.setFont("Helvetica", 12)
    y = height - 175
    for item in items:
        prod_name = item.get("product_name", "Unknown Item")
        qty = float(item.get("quantity", 0))
        price = float(item.get("price", 0))
        item_total = qty * price
        
        c.drawString(50, y, str(prod_name)[:30])
        c.drawString(300, y, str(qty))
        c.drawString(400, y, f"Rs {price:.2f}")
        c.drawString(500, y, f"Rs {item_total:.2f}")
        y -= 20
        
    c.line(50, y - 5, 550, y - 5)
    
    # Total
    c.setFont("Helvetica-Bold", 14)
    c.drawString(400, y - 30, "Grand Total:")
    c.drawString(500, y - 30, f"Rs {total:.2f}")
    
    # Footer
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(50, 50, "Thank you for your business! - Generated by DukanSathi AI")
    
    c.save()
    buffer.seek(0)
    return buffer

async def execute_draft(user_id: str, draft: dict) -> tuple[str, BytesIO | None]:
    """
    Executes a draft natively in Python by performing direct Supabase operations.
    Returns: (status_message, optional_file_buffer)
    """
    if not supabase: 
        return "❌ Database not connected.", None
        
    if str(user_id).startswith("telegram_"):
        return "❌ You must connect your account to save data. Go to your Web App Settings -> Telegram and link your account first!", None
    
    draft_type = draft.get("type")
    
    try:
        if draft_type == "product_draft":
            name = draft.get("name")
            if not name: return "❌ Missing product name.", None
            
            supabase.table("products").insert({
                "user_id": user_id,
                "name": name,
                "selling_price": float(draft.get("selling_price", 0) or 0),
                "cost_price": float(draft.get("cost_price", 0) or 0),
                "stock_quantity": int(draft.get("stock_quantity", 0) or 0),
                "category": draft.get("category", "General") or "General"
            }).execute()
            return f"✅ Product '{name}' saved successfully!", None

        elif draft_type == "customer_draft":
            name = draft.get("name")
            if not name: return "❌ Missing customer name.", None
            
            supabase.table("customers").insert({
                "user_id": user_id,
                "name": name,
                "phone": draft.get("phone", ""),
                "address": draft.get("address", "")
            }).execute()
            return f"✅ Customer '{name}' saved successfully!", None

        elif draft_type == "payment_draft":
            customer_name = draft.get("customer_name", "")
            amount = abs(float(draft.get("amount", 0)))
            is_payment = draft.get("payment_type") == "payment"
            
            cust_res = supabase.table("customers").select("id, name, credit_balance").ilike("name", customer_name).eq("user_id", user_id).limit(1).execute()
            if not cust_res.data:
                return f"❌ Customer '{customer_name}' not found.", None
                
            customer = cust_res.data[0]
            raw_balance = customer.get("credit_balance")
            old_balance = float(raw_balance) if raw_balance is not None else 0.0
            
            if is_payment:
                new_balance = float(max(0, old_balance - amount))
            else:
                new_balance = float(old_balance + amount)
            
            supabase.table("customers").update({"credit_balance": new_balance}).eq("id", customer.get("id")).execute()
            
            return f"✅ Recorded ₹{amount} {payment_type} for {customer_name}. \nNew udhar balance: ₹{new_balance}", None

        elif draft_type == "invoice_draft":
            customer_name = draft.get("customer_name", "Walk-in")
            customer_id = None
            if customer_name and customer_name.lower() != "walk-in":
                cust_res = supabase.table("customers").select("id").ilike("name", customer_name).eq("user_id", user_id).limit(1).execute()
                if cust_res.data:
                    customer_id = cust_res.data[0]["id"]
                else:
                    new_cust = supabase.table("customers").insert({"user_id": user_id, "name": customer_name}).execute()
                    customer_id = new_cust.data[0]["id"] if new_cust.data else None
            
            items = draft.get("items", [])
            total = sum([float(item.get("quantity", 0)) * float(item.get("price", 0)) for item in items])
            
            sale_res = supabase.table("sales").insert({
                "user_id": user_id,
                "customer_id": customer_id,
                "invoice_type": "regular",
                "subtotal": total,
                "total_amount": total,
                "payment_status": "paid",
            }).execute()
            
            # Defensive check to avoid 500 crashes
            if not sale_res or not hasattr(sale_res, 'data') or not sale_res.data:
                return "❌ Failed to create invoice record.", None
                
            sale_id = sale_res.data[0].get("id")
            if not sale_id: 
                return "❌ Failed to create invoice record.", None
            
            for item in items:
                prod_name = item.get("product_name")
                qty = int(item.get("quantity", 0))
                price = float(item.get("price", 0))
                
                prod_res = supabase.table("products").select("id").ilike("name", prod_name).eq("user_id", user_id).limit(1).execute()
                prod_id = prod_res.data[0]["id"] if prod_res.data else None
                
                supabase.table("sale_items").insert({
                    "user_id": user_id,
                    "sale_id": sale_id,
                    "product_id": prod_id,
                    "quantity": qty,
                    "unit_price": price,
                    "total_price": float(qty * price)
                }).execute()
                
                if prod_id:
                     try: supabase.rpc("decrement_stock", {"p_id": prod_id, "qty": qty}).execute()
                     except: pass
            
            pdf_buffer = generate_invoice_pdf(customer_name, items, total, str(sale_id))
            return "✅ Invoice created successfully!", pdf_buffer
            
        return "❌ Unknown draft type.", None
    except Exception as e:
        err_msg = str(e)
        with open('error_log.txt', 'w', encoding='utf-8') as f:
            f.write(traceback.format_exc())
        print("CRITICAL DBSAVE ERROR:", traceback.format_exc())
        logger.error(f"Draft execution error: {err_msg}")
        return f"❌ Failed to save. Database returned an error.", None


async def handle_ai_interaction(update: Update, text: str, chat_id: int):
    """Shared helper to process text (from message or voice), check for draft approvals, and call AI."""
    user_token = get_user_token_for_chat(chat_id)
    text_lower = text.strip().lower()

    # --- 1. Check Draft Approvals ---
    if text_lower in ["approve", "confirm", "yes", "ok", "done", "save", "ha", "haan"]:
        if chat_id in PENDING_DRAFTS:
            draft = PENDING_DRAFTS[chat_id]
            del PENDING_DRAFTS[chat_id]
            
            await update.message.reply_text("⏳ Saving to database...")
            result_msg, file_buffer = await execute_draft(user_token, draft)
            
            # Output PDF format if a buffer was returned
            if file_buffer:
                await update.message.reply_document(
                    document=file_buffer,
                    filename=f"Invoice_{draft.get('customer_name', 'Walkin')}.pdf",
                    caption=result_msg
                )
            else:
                await update.message.reply_text(result_msg)
            
            # Silently inform AI of the context
            try: await process_user_input(text=f"User approved the draft. System result: {result_msg}", user_token=user_token, model="gemini-2.0-flash-001")
            except: pass
            return

    elif text_lower in ["cancel", "no", "discard", "abort", "nahi"]:
        if chat_id in PENDING_DRAFTS:
            del PENDING_DRAFTS[chat_id]
            await update.message.reply_text("❌ Draft discarded.")
            try: await process_user_input(text=f"User discarded the draft.", user_token=user_token, model="gemini-2.0-flash-001")
            except: pass
            return

    # --- 2. Standard AI Flow ---
    try:
        # Call the SAME AI brain used by the web app
        ai_response = await process_user_input(
            text=text,
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
                    PENDING_DRAFTS[chat_id] = draft
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
        await update.message.reply_text("Sorry Boss, I'm having trouble right now. Please try again.")


# ─── Command Handlers ─────────────────────────────────────

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command and deep linking connections"""
    user_name = update.effective_user.first_name or "Boss"
    chat_id = update.effective_chat.id
    username = update.effective_user.username or ""

    # -- Deep Linking Connection Flow (/start <TOKEN>) --
    if context.args and len(context.args) > 0:
        token = context.args[0].strip()
        
        if supabase:
            try:
                # 1. Verify token exists, is unused, and not expired
                result = supabase.table("telegram_connect_tokens") \
                    .select("id, user_id") \
                    .eq("token", token) \
                    .eq("used", False) \
                    .gte("expires_at", datetime.now(timezone.utc).isoformat()) \
                    .execute()

                if result.data and len(result.data) > 0:
                    user_id = result.data[0]["user_id"]
                    token_id = result.data[0]["id"]
                    
                    # 2. Link account
                    supabase.table("telegram_users").upsert({
                        "telegram_chat_id": chat_id,
                        "user_id": user_id,
                        "telegram_username": username
                    }).execute()
                    
                    # 3. Mark token as used
                    supabase.table("telegram_connect_tokens") \
                        .update({"used": True}) \
                        .eq("id", token_id) \
                        .execute()
                    
                    await update.message.reply_text(
                        "🎉 *Connected successfully!*\n\n"
                        "Your Telegram is now securely linked to your Dukan Sathi account.\n"
                        "All your products, customers, and data are now accessible here!\n\n"
                        "Try tracking a sale: _bill for Amit 2 Rice_",
                        parse_mode="Markdown"
                    )
                    return
                else:
                    await update.message.reply_text(
                        "❌ Link expired, invalid, or already used.\n"
                        "Please go to your Web App Settings and click 'Connect' again."
                    )
                    return
            except Exception as e:
                logger.error(f"Error during deep link connect: {e}")
                await update.message.reply_text("❌ Could not connect right now. Please try again.")
                return

    # -- Standard Welcome Flow (No Deep Link) --
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

    await handle_ai_interaction(update, user_text, chat_id)

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

        # Reuse shared helper for checking drafts and calling AI
        await update.effective_chat.send_action("typing")
        await handle_ai_interaction(update, transcribed, chat_id)

    except Exception as e:
        logger.error(f"[TG] Voice handling error: {e}")
        await update.message.reply_text(
            "❌ Voice message process nahi ho paya. Please type karke try karein."
        )




async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Log errors"""
    logger.error(f"Telegram error: {context.error}")


# ─── Main Application Setup ─────────────────────────────────

# Build the application globally so it can be accessed by main.py
if TELEGRAM_BOT_TOKEN:
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    # Register handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))          # 🎙️ Voice
    app.add_handler(MessageHandler(filters.AUDIO, handle_voice))          # 🎵 Audio files
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))  # 💬 Text
    app.add_error_handler(error_handler)
else:
    app = None
    logger.error("❌ TELEGRAM_BOT_TOKEN not set in environment. Bot will not start.")


def start_telegram_bot():
    """Start the Telegram bot (blocking — run in a separate process/terminal)"""
    if not app:
        return

    logger.info("🚀 Starting Dukan Sathi Telegram Bot (Blocking Mode)...")
    logger.info("✅ Bot is live! Waiting for messages...")
    
    # Create a new event loop for this thread if one doesn't exist
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    start_telegram_bot()
