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
    CallbackQueryHandler,
    filters,
    ContextTypes,
)

# For generating PDFs (using platypus for professional layouts)
from reportlab.lib.pagesizes import letter

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

# We DO NOT import AI brain and STT here globally, to avoid blocking Uvicorn startup
# during the initial import of telegram_bot.py in main.py.
# Instead, we lazily import them directly inside the handlers (handle_ai_interaction, handle_voice).

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

# Global Draft State
PENDING_DRAFTS = {}

# ─── Helpers ───────────────────────────────────────────────

def extract_json(text: str) -> dict:
    """Safely extract and parse JSON from an AI response even if wrapped in markdown."""
    try:
        if isinstance(text, dict):
            return text
        
        # Remove markdown ticks
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
            
        # Brace counting fallback
        start_idx = text.find('{')
        if start_idx != -1:
            brace_count = 0
            for i in range(start_idx, len(text)):
                char = text[i]
                if char == '{': brace_count += 1
                elif char == '}': brace_count -= 1
                if brace_count == 0:
                    json_str = text[start_idx:i+1]
                    try:
                        return json.loads(json_str)
                    except:
                        pass
                    break
        return json.loads(text)
    except Exception as e:
        logger.warning(f"Failed to extract JSON: {e}")
        return None

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
        unit = draft.get("unit", "pcs")
        cost = draft.get("cost_price", 0)
        lines = [
            "📦 *Product Draft*",
            f"  Name: {name}",
            f"  Selling Price: ₹{price} / {unit}",
        ]
        if cost:
            lines.append(f"  Cost Price: ₹{cost}")
        if stock:
            lines.append(f"  Stock: {stock} {unit}")
        return "\n".join(lines)

    elif draft_type == "customer_draft":
        name = draft.get("name", "Unknown")
        phone = draft.get("phone", "N/A")
        lines = [
            "👤 *Customer Draft*",
            f"  Name: {name}",
            f"  Phone: {phone}"
        ]
        return "\n".join(lines)

    elif draft_type == "invoice_draft":
        customer = draft.get("customer_name", "Unknown")
        items = draft.get("items", [])
        invoice_type = draft.get("invoice_type", "regular")
        is_gst = invoice_type == "gst"
        is_igst = draft.get("isOutOfState", False)

        # Header
        header_emoji = "🧾"
        header_label = "GST Tax Invoice Draft" if is_gst else "Bill of Supply Draft"
        lines = [
            f"{header_emoji} *{header_label}*",
            f"  Customer: {customer}",
        ]
        if is_igst:
            lines.append("  🔄 *IGST (Inter-State) applicable*")

        lines.append("  Items:")
        subtotal = 0
        total_tax = 0
        for item in items:
            name = item.get("product_name", "?")
            qty = float(item.get("quantity", 0))
            unit = item.get("unit", "pcs")
            price = float(item.get("price", 0))
            item_sub = qty * price
            subtotal += item_sub
            hsn = item.get("hsn_code", "")
            hsn_str = f" (HSN:{hsn})" if hsn and is_gst else ""
            lines.append(f"    • {name}{hsn_str} × {qty} {unit}  ₹{item_sub:.2f}")

        if is_gst:
            lines.append(f"  Taxable Value: ₹{subtotal:.2f}")
            # Tax will be calculated at approval, just note it's GST
            if is_igst:
                lines.append("  Tax Type: IGST")
            else:
                lines.append("  Tax Type: CGST + SGST")

        lines.append(f"  *Note: Final total calculated on approval*")
        return "\n".join(lines)

    elif draft_type == "restock_draft":
        product = draft.get("product_name", "Unknown Product")
        qty = draft.get("quantity", 0)
        cost = draft.get("cost_price")
        lines = [
            "📦 *Restock Draft*",
            f"🔹 Product: {product}",
            f"🔹 Qty to Add: {qty}"
        ]
        if cost:
            lines.append(f"🔹 New Cost Price: ₹{cost}")
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
            f"  Amount: ₹{amount}"
        ]
        return "\n".join(lines)

    elif draft_type == "report_draft":
        title = draft.get("title", "Report")
        data = draft.get("data", [])
        summary = draft.get("summary", "")
        
        lines = [f"📊 *{title}*"]
        if summary:
            lines.append(f"\n{summary}")
        
        if data and len(data) > 0:
            lines.append("\nPreview (First 5 items):")
            for i, row in enumerate(data[:5]):
                row_str = " | ".join([f"{v}" for v in row.values()][:3]) # Show first 3 columns
                lines.append(f"• {row_str}")
            
            if len(data) > 5:
                lines.append(f"\n_... and {len(data)-5} more items in CSV below_")
        
        return "\n".join(lines)

    else:
        return f"📋 Draft: {json.dumps(draft, indent=2)}"


# ─── GST Tax Calculation (Python Port of gstUtils.js) ─────────────────

HSN_TAX_RATES = {
    "0401": 0, "0713": 0, "1001": 0, "1006": 0, "0702": 0, "0703": 0, "2501": 0, "0805": 0,
    "0402": 5, "0405": 5, "1101": 5, "1512": 5, "1701": 5, "1704": 5, "1904": 5,
    "0901": 5, "2106": 5, "3004": 5, "4901": 5,
    "1902": 12, "2009": 12, "2201": 12, "3401": 12, "3402": 12, "6810": 12,
    "1905": 18, "2103": 18, "2104": 18, "2202": 18, "3305": 18, "3306": 18,
    "3307": 18, "7318": 18, "7326": 18, "8544": 18, "8536": 18, "3926": 18,
    "6109": 18,
    "2402": 28, "2711": 28, "8703": 28, "3303": 28, "3304": 28, "2101": 28,
}

def calculate_tax(price: float, quantity: float, tax_percent: float, tax_type: str = "exclusive", force_inter_state: bool = False) -> dict:
    """
    Calculate GST for a line item.
    - Exclusive: Taxable = price * qty, Total = Taxable + Tax
    - Inclusive: Total = price * qty, Taxable = Total / (1 + rate/100)
    """
    total_amount = price * quantity
    rate = float(tax_percent or 0)
    
    if tax_type == "inclusive" and rate > 0:
        taxable = total_amount / (1 + (rate / 100))
        tax_amt = total_amount - taxable
    else:
        taxable = total_amount
        tax_amt = (taxable * rate) / 100

    if force_inter_state:
        igst = round(tax_amt, 2)
        cgst = sgst = 0.0
    else:
        half = tax_amt / 2
        cgst = round(half, 2)
        sgst = round(half, 2)
        igst = 0.0
        
    return {
        "taxable": round(taxable, 2),
        "cgst": cgst,
        "sgst": sgst,
        "igst": igst,
        "rate": rate,
        "total": round(taxable + cgst + sgst + igst, 2)
    }


# ─── PDF Generator (GST-Aware, Professional) ─────────────────────────

def generate_invoice_pdf(
    shop_name: str,
    shop_address: str,
    shop_gstin: str,
    customer_name: str,
    items: list,
    sale_id,
    is_gst: bool,
    is_igst: bool,
    subtotal: float,
    cgst_total: float,
    sgst_total: float,
    igst_total: float,
    grand_total: float,
    amount_paid: float,
    balance_due: float,
    payment_status: str,
    invoice_number: str = None
) -> BytesIO:
    """Generates a professional GST-aware PDF invoice in memory using reportlab."""
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                            topMargin=15*mm, bottomMargin=15*mm,
                            leftMargin=15*mm, rightMargin=15*mm)
    styles = getSampleStyleSheet()
    story = []

    # ── Title ──
    title_style = ParagraphStyle('title', parent=styles['Heading1'], fontSize=18, spaceAfter=2)
    sub_style = ParagraphStyle('sub', parent=styles['Normal'], fontSize=9, textColor=colors.grey)
    inv_label = "TAX INVOICE" if is_gst else "BILL OF SUPPLY"
    inv_no = invoice_number or f"DS-{sale_id}"

    header_data = [
        [Paragraph(f"<b>{shop_name}</b>", title_style),
         Paragraph(f"<b>{inv_label}</b>", ParagraphStyle('inv', parent=styles['Normal'], fontSize=14, alignment=TA_RIGHT))],
        [Paragraph(shop_address or "", sub_style),
         Paragraph(f"Invoice #: {inv_no}", ParagraphStyle('r', parent=sub_style, alignment=TA_RIGHT))],
    ]
    if is_gst and shop_gstin:
        header_data.append([
            Paragraph(f"GSTIN: <b>{shop_gstin}</b>", sub_style),
            Paragraph(f"Date: {datetime.now().strftime('%d %b %Y')}", ParagraphStyle('r', parent=sub_style, alignment=TA_RIGHT))
        ])
    else:
        header_data.append([
            Paragraph("", sub_style),
            Paragraph(f"Date: {datetime.now().strftime('%d %b %Y')}", ParagraphStyle('r', parent=sub_style, alignment=TA_RIGHT))
        ])

    t_header = Table(header_data, colWidths=[260, 200])
    t_header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 8*mm))

    # ── Billed To ──
    story.append(Paragraph("BILLED TO", sub_style))
    story.append(Paragraph(f"<b>{customer_name}</b>", styles['Normal']))
    story.append(Spacer(1, 6*mm))

    # ── Items Table ──
    if is_gst:
        tax_label = "IGST Amt" if is_igst else "GST Amt"
        col_names = ["#", "Description", "HSN", "Qty", "Unit Rate", "Taxable", tax_label, "Total"]
        col_widths = [15, 130, 40, 25, 50, 50, 45, 45]
    else:
        col_names = ["#", "Description", "Qty", "Unit Rate", "Total"]
        col_widths = [15, 190, 30, 60, 65]

    table_data = [col_names]
    for idx, item in enumerate(items):
        name = item.get("product_name", "Item")
        qty = float(item.get("quantity", 0))
        price = float(item.get("price", 0))
        hsn = item.get("hsn_code", "-")
        taxable = item.get("_taxable", qty * price)
        cgst = item.get("_cgst", 0)
        sgst = item.get("_sgst", 0)
        igst_amt = item.get("_igst", 0)
        tax_rate = item.get("_rate", 0)
        item_total = item.get("_total", taxable)

        if is_gst:
            tax_display = f"({tax_rate}%) {igst_amt:.2f}" if is_igst else f"{(cgst+sgst):.2f}"
            row = [str(idx+1), name[:25], str(hsn), str(qty), f"{price:.2f}",
                   f"{taxable:.2f}", tax_display, f"{item_total:.2f}"]
        else:
            row = [str(idx+1), name[:30], str(qty), f"{price:.2f}", f"{item_total:.2f}"]
        table_data.append(row)

    t_items = Table(table_data, colWidths=col_widths)
    t_items.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
        ('GRID', (0,0), (-1,-1), 0.3, colors.lightgrey),
        ('ALIGN', (2,0), (-1,-1), 'RIGHT'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_items)
    story.append(Spacer(1, 6*mm))

    # ── Totals Summary ──
    summary_rows = [["Taxable Value:", f"Rs. {subtotal:.2f}"]]
    if is_gst:
        if is_igst:
            summary_rows.append(["IGST:", f"Rs. {igst_total:.2f}"])
        else:
            summary_rows.append(["CGST:", f"Rs. {cgst_total:.2f}"])
            summary_rows.append(["SGST:", f"Rs. {sgst_total:.2f}"])
    summary_rows.append(["Grand Total:", f"Rs. {grand_total:.2f}"])
    if balance_due > 0:
        summary_rows.append([f"Amount Paid ({payment_status.title()}):", f"Rs. {amount_paid:.2f}"])
        summary_rows.append(["Balance Due:", f"Rs. {balance_due:.2f}"])

    bold_right = ParagraphStyle('br', parent=styles['Normal'], alignment=TA_RIGHT, fontName='Helvetica-Bold')
    right = ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT)
    summary_data = [[Paragraph(r[0], right), Paragraph(r[1], bold_right)] for r in summary_rows]
    t_summary = Table(summary_data, colWidths=[350, 110], hAlign='RIGHT')
    t_summary.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        # Highlight Grand Total row
        ('TEXTCOLOR', (0, sum(1 for r in summary_rows if 'Grand' in r[0])-1), (-1, sum(1 for r in summary_rows if 'Grand' in r[0])-1), colors.HexColor('#4f46e5')),
        ('FONTNAME', (0, sum(1 for r in summary_rows if 'Grand' in r[0])-1), (-1, sum(1 for r in summary_rows if 'Grand' in r[0])-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, sum(1 for r in summary_rows if 'Grand' in r[0])-1), (-1, sum(1 for r in summary_rows if 'Grand' in r[0])-1), 12),
        # Red for balance due
        ('TEXTCOLOR', (0, len(summary_rows)-1), (-1, len(summary_rows)-1), colors.red) if balance_due > 0 else ('TEXTCOLOR', (0,0),(0,0), colors.black),
    ]))
    story.append(t_summary)

    story.append(Spacer(1, 8*mm))
    story.append(Paragraph("Thank you for your business!", ParagraphStyle('footer', parent=sub_style, alignment=TA_CENTER)))
    story.append(Paragraph("This is a computer generated invoice — Dukan Sathi AI", ParagraphStyle('footer2', parent=sub_style, alignment=TA_CENTER, fontSize=7)))

    doc.build(story)
    buffer.seek(0)
    return buffer


func_get_profile = lambda user_id: supabase.table("profiles").select(
    "business_name,business_address,gstin,is_gst_registered,state_name"
).eq("id", user_id).limit(1).execute() if supabase else None


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
                "unit": draft.get("unit", "pcs") or "pcs",
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

        elif draft_type == "restock_draft":
            name = draft.get("product_name")
            qty = int(draft.get("quantity", 0))
            cost = draft.get("cost_price")
            
            p_res = supabase.table("products").select("id").ilike("name", name).eq("user_id", user_id).limit(1).execute()
            if not p_res.data:
                return f"❌ Product '{name}' not found.", None
            
            p_id = p_res.data[0]["id"]
            upd = {"stock_quantity": supabase.table("products").select("stock_quantity").eq("id", p_id).execute().data[0]["stock_quantity"] + qty}
            if cost: upd["cost_price"] = float(cost)
            
            supabase.table("products").update(upd).eq("id", p_id).execute()
            return f"✅ Restocked {qty} units of '{name}'!", None
            customer_name = draft.get("customer_name", "")
            amount = abs(float(draft.get("amount", 0)))
            is_payment = draft.get("payment_type") == "payment"
            
            cust_res = supabase.table("customers").select("id, name, credit_balance").ilike("name", customer_name).eq("user_id", user_id).limit(1).execute()
            if not cust_res.data:
                return f"❌ Customer '{customer_name}' not found.", None
                
            customer_id = cust_res.data[0]["id"]
            
            if is_payment:
                update_result = supabase.rpc("receive_payment", {
                    "p_user_id": user_id,
                    "p_customer_id": customer_id,
                    "p_amount": amount
                }).execute()
                new_balance = update_result.data if update_result and update_result.data is not None else 0
                return f"✅ Recorded ₹{amount} payment for {customer_name}. \nNew udhar balance: ₹{new_balance}", None
            else:
                update_result = supabase.rpc("add_customer_credit", {
                    "p_user_id": user_id,
                    "p_customer_id": customer_id,
                    "p_amount": amount
                }).execute()
                new_balance = update_result.data if update_result and update_result.data is not None else 0
                return f"✅ Added ₹{amount} Udhar for {customer_name}. \nNew udhar balance: ₹{new_balance}", None

        elif draft_type == "invoice_draft":
            pr = func_get_profile(user_id)
            if pr and pr.data:
                profile = pr.data[0]
            
            shop_state = profile.get("state_name", "Unknown").lower().strip()
            shop_name = profile.get("business_name", "My Shop")
            shop_address = profile.get("business_address", "")
            shop_gstin = profile.get("gstin", "")

            # ── 2. Find / create customer & detect IGST ──
            customer_name = draft.get("customer_name", "Walk-in")
            customer_id = None
            customer_state = "unknown"
            
            if customer_name and customer_name.lower() != "walk-in":
                cust_res = supabase.table("customers").select("id, state").ilike("name", customer_name).eq("user_id", user_id).limit(1).execute()
                if cust_res.data:
                    customer_id = cust_res.data[0]["id"]
                    customer_state = str(cust_res.data[0].get("state") or "").lower().strip()
                else:
                    new_cust = supabase.table("customers").insert({"user_id": user_id, "name": customer_name}).execute()
                    customer_id = new_cust.data[0]["id"] if new_cust.data else None

            # Automatic IGST detection (matching web app logic)
            is_igst = draft.get("isOutOfState", False)
            if not is_igst and customer_state != "unknown" and shop_state != "unknown":
                if customer_state and shop_state and customer_state != shop_state:
                    is_igst = True
                    logger.info(f"DEBUG: Auto-detected Inter-State (IGST) for {customer_name}: {customer_state} vs {shop_state}")

            is_gst = (
                draft.get("invoice_type") == "gst" 
                or (profile.get("is_gst_registered", False) and draft.get("invoice_type") != "regular")
            )

            # ── 3. Calculate taxes for each item ──
            items = draft.get("items", [])
            subtotal = 0.0
            total_cgst = 0.0
            total_sgst = 0.0
            total_igst = 0.0
            enriched_items = []

            for item in items:
                qty = float(item.get("quantity", 0))
                prod_name = item.get("product_name", "")
                
                # RE-FETCH LIVE DATA TO ENSURE ACCURACY (Hinglish/Inclusive fix)
                v_price = float(item.get("price", 0))
                v_tax_percent = 0
                v_tax_type = "exclusive" 
                v_hsn = item.get("hsn_code", "")
                v_prod_id = None

                p_res = supabase.table("products").select("id, selling_price, tax_percent, tax_type, hsn_code").ilike("name", prod_name).eq("user_id", user_id).limit(1).execute()
                if p_res.data:
                    p = p_res.data[0]
                    v_prod_id = p["id"]
                    v_price = float(p.get("selling_price") or v_price)
                    v_tax_percent = float(p.get("tax_percent") or 0)
                    v_tax_type = p.get("tax_type", "exclusive")
                    v_hsn = p.get("hsn_code", v_hsn)

                tc = calculate_tax(v_price, qty, v_tax_percent, v_tax_type, force_inter_state=is_igst) if is_gst else {
                    "taxable": qty * v_price, "cgst": 0, "sgst": 0, "igst": 0, "rate": 0, "total": qty * v_price
                }
                
                subtotal += tc["taxable"]
                total_cgst += tc["cgst"]
                total_sgst += tc["sgst"]
                total_igst += tc["igst"]
                enriched_items.append({
                    **item,
                    "product_id": v_prod_id,
                    "price": v_price,
                    "hsn_code": v_hsn,
                    "_taxable": tc["taxable"],
                    "_cgst": tc["cgst"],
                    "_sgst": tc["sgst"],
                    "_igst": tc["igst"],
                    "_rate": tc["rate"],
                    "_total": tc["total"]
                })

            grand_total = round(subtotal + total_cgst + total_sgst + total_igst, 2)
            payment_status = draft.get("payment_status", "paid")
            amount_paid = float(draft.get("amount_paid", grand_total if payment_status == "paid" else 0))
            balance_due = round(max(0, grand_total - amount_paid), 2)

            # ── 4. Get next bill number ──
            count_res = supabase.table("sales").select("id", count="exact").eq("user_id", user_id).execute()
            next_num = (count_res.count or 0) + 1
            invoice_number = f"Bill-{next_num}"

            # ── 5. Insert sale header ──
            sale_res = supabase.table("sales").insert({
                "user_id": user_id,
                "customer_id": customer_id,
                "invoice_type": "gst" if is_gst else "regular",
                "invoice_number": invoice_number,
                "subtotal": subtotal,
                "cgst_amount": total_cgst,
                "sgst_amount": total_sgst,
                "igst_amount": total_igst,
                "total_tax_amount": total_cgst + total_sgst + total_igst,
                "total_amount": grand_total,
                "payment_status": "paid" if payment_status == "paid" else ("partial" if balance_due > 0 and amount_paid > 0 else "credit"),
                "amount_paid": amount_paid,
                "balance_due": balance_due,
                "is_out_of_state": is_igst,
            }).execute()
            
            if not sale_res or not getattr(sale_res, 'data', None):
                return "❌ Failed to create invoice record.", None
                
            sale_id = sale_res.data[0].get("id")
            if not sale_id: 
                return "❌ Failed to create invoice record.", None

            # ── 6. Insert sale items & decrement stock ──
            for item in enriched_items:
                prod_name = item.get("product_name", "")
                qty = float(item.get("quantity", 0))
                price = float(item.get("price", 0))
                hsn = item.get("hsn_code")
                prod_res = supabase.table("products").select("id").ilike("name", prod_name).eq("user_id", user_id).limit(1).execute()
                prod_id = prod_res.data[0]["id"] if prod_res.data else None

                supabase.table("sale_items").insert({
                    "user_id": user_id,
                    "sale_id": sale_id,
                    "product_id": prod_id,
                    "quantity": int(qty),
                    "unit_price": price,
                    "hsn_code": hsn if is_gst else None,
                    "taxable_amount": item["_taxable"],
                    "cgst_percent": item["_rate"] / 2 if not is_igst else 0,
                    "cgst_amount": item["_cgst"],
                    "sgst_percent": item["_rate"] / 2 if not is_igst else 0,
                    "sgst_amount": item["_sgst"],
                    "igst_percent": item["_rate"] if is_igst else 0,
                    "igst_amount": item["_igst"],
                    "total_price": item["_total"]
                }).execute()

                # Decrement stock is now handled automatically by a database trigger on sale_items insertion
                # if prod_id:
                #     try: supabase.rpc("decrement_stock", {"p_id": prod_id, "qty": int(qty)}).execute()
                #     except: pass

            # ── 7. Handle udhar/credit ledger ──
            if balance_due > 0 and customer_id:
                try:
                    supabase.rpc("add_customer_credit", {
                        "p_user_id": user_id, "p_customer_id": customer_id, "p_amount": balance_due
                    }).execute()
                    supabase.table("customer_ledger").insert({
                        "user_id": user_id, "customer_id": customer_id,
                        "amount": balance_due, "type": "credit", "mode": "Invoice",
                        "note": f"Pending from Invoice #{invoice_number}"
                    }).execute()
                except Exception as ledger_err:
                    logger.warning(f"Ledger update failed: {ledger_err}")

            # ── 8. Generate PDF ──
            pdf_buffer = generate_invoice_pdf(
                shop_name=shop_name,
                shop_address=shop_address,
                shop_gstin=shop_gstin,
                customer_name=customer_name,
                items=enriched_items,
                sale_id=sale_id,
                is_gst=is_gst,
                is_igst=is_igst,
                subtotal=subtotal,
                cgst_total=total_cgst,
                sgst_total=total_sgst,
                igst_total=total_igst,
                grand_total=grand_total,
                amount_paid=amount_paid,
                balance_due=balance_due,
                payment_status=payment_status,
                invoice_number=invoice_number
            )

            tax_note = ""
            if is_gst:
                if is_igst:
                    tax_note = f"\n🔄 IGST: ₹{total_igst:.2f}"
                else:
                    tax_note = f"\n📊 CGST: ₹{total_cgst:.2f} | SGST: ₹{total_sgst:.2f}"

            status_line = f"\n💰 Amount Paid: ₹{amount_paid:.2f}"
            if balance_due > 0:
                status_line += f"\n🔴 Balance Due: ₹{balance_due:.2f}"

        elif draft_type == "report_draft":
            title = draft.get("title", "Report")
            data = draft.get("data", [])
            if not data:
                return "❌ The report contains no data.", None
            
            # Generate CSV in memory
            import csv
            import io as _io
            output = _io.StringIO()
            if len(data) > 0:
                keys = data[0].keys()
                dict_writer = csv.DictWriter(output, keys)
                dict_writer.writeheader()
                dict_writer.writerows(data)
            
            csv_bytes = _io.BytesIO(output.getvalue().encode('utf-8'))
            csv_bytes.name = f"{title.replace(' ', '_')}.csv"
            return f"✅ Report '{title}' generated successfully!", csv_bytes

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
    try:
        from dukansathi_ai.agent_graph import process_user_input
    except Exception as e:
        logger.error(f"❌ Failed to load AI module: {e}")
        await update.message.reply_text("Sorry Boss, AI module is not available right now. Let me sleep!")
        return

    user_token = get_user_token_for_chat(chat_id)
    text_lower = text.strip().lower()

    # --- 1. Check Draft Approvals / IGST Toggle ---
    if text_lower in ["approve", "confirm", "yes", "ok", "done", "save", "ha", "haan"]:
        if chat_id in PENDING_DRAFTS:
            draft = PENDING_DRAFTS[chat_id]
            del PENDING_DRAFTS[chat_id]
            
            await update.message.reply_text("⏳ Saving to database...")
            result_msg, file_buffer = await execute_draft(user_token, draft)
            
            # Output format if a buffer was returned
            if file_buffer:
                # Dynamic filename based on draft type
                ext = ".pdf" if draft.get("type") == "invoice_draft" else ".csv"
                base_name = draft.get("customer_name") or draft.get("title") or "Document"
                safe_name = base_name.replace(" ", "_").replace("/", "-")
                
                await update.message.reply_document(
                    document=file_buffer,
                    filename=f"{safe_name}{ext}",
                    caption=result_msg
                )
            else:
                await update.message.reply_text(result_msg)
            
            # Silently inform AI of the context
            try: await process_user_input(text=f"User approved the draft. System result: {result_msg}", user_token=user_token, model="gemini-3.1-flash-lite-preview")
            except: pass
            return

    elif text_lower == "igst" and chat_id in PENDING_DRAFTS:
        # Toggle inter-state IGST on the pending invoice draft
        draft = PENDING_DRAFTS[chat_id]
        if draft.get("type") == "invoice_draft":
            draft["isOutOfState"] = not draft.get("isOutOfState", False)
            PENDING_DRAFTS[chat_id] = draft
            status = "ON ✅" if draft["isOutOfState"] else "OFF ❌"
            draft_msg = format_draft_for_telegram(draft)
            await update.message.reply_text(f"🔄 IGST toggled {status}\n\n{draft_msg}", parse_mode="Markdown")
        else:
            await update.message.reply_text("ℹ️ IGST toggle only works for invoice drafts.")
        return

    elif text_lower in ["cancel", "no", "discard", "abort", "nahi"]:
        if chat_id in PENDING_DRAFTS:
            del PENDING_DRAFTS[chat_id]
            await update.message.reply_text("❌ Draft discarded.")
            try: await process_user_input(text=f"User discarded the draft.", user_token=user_token, model="gemini-3.1-flash-lite-preview")
            except: pass
            return

    # --- 2. Standard AI Flow ---
    try:
        # Call the SAME AI brain used by the web app
        ai_response = await process_user_input(
            text=text,
            user_token=user_token,
            model="gemini-3.1-flash-lite-preview"  # Use cloud model for Telegram
        )

        logger.info(f"[TG] AI Response: {ai_response[:100]}")

        # Parse the response using robust extraction
        response_data = extract_json(ai_response)
        
        if response_data and isinstance(response_data, dict) and (response_data.get("draft") or response_data.get("type")):
            # It's a structured response (either wrapped in {"text":..., "draft":...} or just the draft itself)
            display_text = response_data.get("text", "I've prepared a draft for you, Boss:")
            draft = response_data.get("draft") or (response_data if response_data.get("type") else None)
            
            if display_text and display_text != "I've prepared a draft for you, Boss:":
                await update.message.reply_text(display_text)
            
            if draft:
                PENDING_DRAFTS[chat_id] = draft
                draft_message = format_draft_for_telegram(draft)
                
                # Create Interactive Buttons
                keyboard = [
                    [
                        InlineKeyboardButton("✅ Approve", callback_data="draft_approve"),
                        InlineKeyboardButton("❌ Discard", callback_data="draft_discard")
                    ]
                ]
                
                # Special button for IGST if it's an invoice
                if draft.get("type") == "invoice_draft":
                    is_igst = draft.get("isOutOfState", False)
                    toggle_label = "📍 Switch to Local (CGST/SGST)" if is_igst else "✈️ Switch to Inter-State (IGST)"
                    keyboard.append([InlineKeyboardButton(toggle_label, callback_data="draft_igst_toggle")])
                
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await update.message.reply_text(
                    draft_message,
                    parse_mode="Markdown",
                    reply_markup=reply_markup
                )
        else:
            # Plain text response
            await update.message.reply_text(ai_response)

        # --- 3. Output Voice (TTS) ---
        # If the input was voice, or user requested it, respond with voice
        try:
            from telegram_bot import clean_text_for_tts
            from voice_service import synthesize_speech
            
            # Fetch text for TTS (either display text or the whole response)
            tts_text = ai_response
            if response_data and isinstance(response_data, dict):
                tts_text = response_data.get("text", ai_response)

            # Fetch user profile for voice preference
            voice_id = "hi-IN-MadhurNeural"
            voice_rate = "1.0"
            pr = func_get_profile(user_token)
            if pr and pr.data:
                voice_id = pr.data[0].get("voice_id", voice_id)
                voice_rate = pr.data[0].get("voice_speed", "+0%")

            clean_text = clean_text_for_tts(tts_text)
            if clean_text and len(clean_text) > 1:
                audio_b64 = await synthesize_speech(clean_text, voice_id=voice_id, rate=voice_rate)
                if audio_b64:
                    audio_bytes = base64.b64decode(audio_b64)
                    await update.message.reply_voice(
                        voice=audio_bytes,
                        caption="🔊 Listen to update" if len(tts_text) > 300 else None
                    )
        except Exception as tts_err:
            logger.warning(f"Voice output failed: {tts_err}")

    except Exception as e:
        logger.error(f"[TG] Error processing message: {e}")
        import traceback
        logger.error(traceback.format_exc())
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

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle button clicks from Inline Keyboards"""
    query = update.callback_query
    chat_id = update.effective_chat.id
    user_token = get_user_token_for_chat(chat_id)
    
    await query.answer()
    
    if chat_id not in PENDING_DRAFTS:
        await query.edit_message_text("❌ No pending draft found. It may have expired.")
        return
        
    draft = PENDING_DRAFTS[chat_id]
    
    if query.data == "draft_approve":
        del PENDING_DRAFTS[chat_id]
        await query.edit_message_text("⏳ Saving to database...")
        
        result_msg, file_buffer = await execute_draft(user_token, draft)
        
        if file_buffer:
            ext = ".pdf" if draft.get("type") == "invoice_draft" else ".csv"
            base_name = draft.get("customer_name") or draft.get("title") or "Document"
            safe_name = base_name.replace(" ", "_").replace("/", "-")
            
            await query.message.reply_document(
                document=file_buffer,
                filename=f"{safe_name}{ext}",
                caption=result_msg
            )
            await query.edit_message_text(f"✅ Document generated: {safe_name}{ext}")
        else:
            await query.edit_message_text(result_msg)
            
        # Silently inform AI of the context
        try: 
            from dukansathi_ai.agent_graph import process_user_input
            await process_user_input(text=f"User approved the draft via button. System result: {result_msg}", user_token=user_token, model="gemini-3.1-flash-lite-preview")
        except: pass

    elif query.data == "draft_discard":
        del PENDING_DRAFTS[chat_id]
        await query.edit_message_text("❌ Draft discarded.")
        try: 
            from dukansathi_ai.agent_graph import process_user_input
            await process_user_input(text=f"User discarded the draft via button.", user_token=user_token, model="gemini-3.1-flash-lite-preview")
        except: pass

    elif query.data == "draft_igst_toggle":
        if draft.get("type") == "invoice_draft":
            draft["isOutOfState"] = not draft.get("isOutOfState", False)
            PENDING_DRAFTS[chat_id] = draft
            
            # Re-format the message
            draft_message = format_draft_for_telegram(draft)
            
            # Re-create buttons
            keyboard = [
                [
                    InlineKeyboardButton("✅ Approve", callback_data="draft_approve"),
                    InlineKeyboardButton("❌ Discard", callback_data="draft_discard")
                ]
            ]
            is_igst = draft.get("isOutOfState", False)
            toggle_label = "📍 Switch to Local (CGST/SGST)" if is_igst else "✈️ Switch to Inter-State (IGST)"
            keyboard.append([InlineKeyboardButton(toggle_label, callback_data="draft_igst_toggle")])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.edit_message_text(
                draft_message,
                parse_mode="Markdown",
                reply_markup=reply_markup
            )

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
        try:
            from voice_service import transcribe_audio
            transcribed = await transcribe_audio(audio_bytes)
        except Exception as e:
            logger.warning(f"Voice/STT not available: {e}")
            transcribed = ""

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
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))          # 🎙️ Voice
    app.add_handler(MessageHandler(filters.AUDIO, handle_voice))          # 🎵 Audio files
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))  # 💬 Text
    app.add_error_handler(error_handler)
else:
    app = None
    logger.error("TELEGRAM_BOT_TOKEN not set in environment. Bot will not start.")


def start_telegram_bot():
    """Start the Telegram bot (blocking — run in a separate process/terminal)"""
    if not app:
        return

    logger.info("Starting Dukan Sathi Telegram Bot (Blocking Mode)...")
    logger.info("Bot is live! Waiting for messages...")
    
    # Create a new event loop for this thread if one doesn't exist
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    # stop_signals=False avoids 'set_wakeup_fd only works in main thread' in background threads
    app.run_polling(allowed_updates=Update.ALL_TYPES, stop_signals=False, close_loop=False)


if __name__ == "__main__":
    start_telegram_bot()
