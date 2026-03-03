"""
File: agent_graph.py
Purpose: Moltbot - Llama-powered AI agent for Dukan Sathi
Author: Dukan Sathi Team
Created: 2026-02-05

This is the brain of Dukan Sathi. It uses:
- Llama-4-Scout via Vertex AI Model Garden for natural language understanding
- LangGraph for conversation flow management
- SQL generation for database queries
- Draft workflow for invoice/inventory approvals

Why Llama instead of Claude:
- Better Hindi/Hinglish understanding
- Faster response times
- Lower cost at scale
- Can be fine-tuned for shop domain
"""

import os
from typing import TypedDict, Annotated
from langchain_google_vertexai import ChatVertexAI
try:
    from langchain_ollama import ChatOllama
except ImportError:
    ChatOllama = None  # Not available on cloud (Render) - only needed locally
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from google.oauth2 import service_account
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client, Client
import asyncio
from functools import lru_cache
import re
import hashlib
import logging
from .language_detector import detect_language

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    filename=os.path.join(os.path.dirname(__file__), "agent_debug.log"),
    filemode='w',
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load OpenClaw Skill Definitions to save tokens
skill_path = os.path.join(os.path.dirname(__file__), "skill.md")
OPENCLAW_SKILLS = ""
if os.path.exists(skill_path):
    with open(skill_path, "r", encoding="utf-8") as f:
        OPENCLAW_SKILLS = f.read()
else:
    logger.warning("skill.md not found. OpenClaw token-efficient skills may be impaired.")

# Add backend to path for local_db import
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "../../backend"))
try:
    import local_db
    # Initialize DB on load to ensure tables exist
    local_db.init_db()
except ImportError:
    logger.warning("Could not import local_db. Offline features may fail.")
    local_db = None


load_dotenv()

# Initialize Supabase Client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    logger.warning("SUPABASE_URL or SUPABASE_SERVICE_KEY missing. Supabase features will be disabled.")
    supabase = None
else:
    try:
        supabase: Client = create_client(url, key)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        supabase = None

# Context keywords for query categorization
contextual_pronouns = ["this", "that", "it", "them", "him", "her"]
action_keywords = ["create", "add", "new", "make a", "draft", "register", "restock", "received", "maal aaya", "aa gaya"]
business_keywords = ["price", "cost", "stock", "inventory", "sale", "customer", "profit", "loss", "revenue", "bill", "invoice"]


# ─── Indian Rupee Helpers ────────────────────────────────────────────────────
def format_inr(amount) -> str:
    """Format a number in Indian number system: 1,00,000 (lakh), 1,00,00,000 (crore)."""
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return f"₹{amount}"
    if amount == int(amount):
        amount = int(amount)
    # Indian grouping: last 3 digits, then pairs of 2
    s = str(int(amount))
    if len(s) > 3:
        last3 = s[-3:]
        rest = s[:-3]
        groups = []
        while rest:
            groups.append(rest[-2:])
            rest = rest[:-2]
        formatted = ",".join(reversed(groups)) + "," + last3
    else:
        formatted = s
    return f"₹{formatted}"


def number_to_hinglish_words(amount) -> str:
    """Convert a number to Indian spoken words: e.g. 150000 → '1 lakh 50 hazaar'."""
    try:
        n = int(float(amount))
    except (TypeError, ValueError):
        return str(amount)
    if n == 0:
        return "zero"
    parts = []
    crore = n // 10_000_000
    n %= 10_000_000
    lakh = n // 100_000
    n %= 100_000
    hazaar = n // 1_000
    n %= 1_000
    hundred = n // 100
    n %= 100
    if crore:
        parts.append(f"{crore} crore")
    if lakh:
        parts.append(f"{lakh} lakh")
    if hazaar:
        parts.append(f"{hazaar} hazaar")
    if hundred:
        parts.append(f"{hundred} sau")
    if n:
        parts.append(str(n))
    return " ".join(parts) + " rupaye"


# ─── Shared Voice + Language Rules (injected into every prompt) ──────────────
VOICE_RULES = (
    "VOICE RULE: This response will be SPOKEN aloud. "
    "Reply in MAX 2 short sentences. No bullet points, no markdown, no lists. "
    "GIVE DIRECT ANSWERS. DO NOT INCLUDE ROLE NAMES LIKE 'USER:' OR 'ASSISTANT:'. "
    "For large amounts (>= 1,00,000), use 'lakh' or 'crore'. For smaller amounts, just say the number followed by 'rupees'. "
    "LANGUAGE: Reply ONLY in English or Hinglish (Hindi words in Roman script). "
    "NEVER use Devanagari script."
)


# Database schema for AI context - this helps Llama understand our data structure
DATABASE_SCHEMA = """
TABLES & COLUMNS:
1. profiles (
    id UUID PRIMARY KEY, 
    business_name TEXT, 
    business_category TEXT,
    is_gst_registered BOOLEAN,
    subscription_tier TEXT
)
2. products (
    id BIGINT PRIMARY KEY, 
    name TEXT, 
    selling_price NUMERIC, 
    cost_price NUMERIC,
    stock_quantity INTEGER, 
    category TEXT,
    tax_percent NUMERIC,
    discount NUMERIC,
    user_id UUID
)
3. customers (
    id BIGINT PRIMARY KEY, 
    name TEXT, 
    phone TEXT,
    total_spend NUMERIC, 
    credit_balance NUMERIC,
    last_visit TIMESTAMP,
    user_id UUID
)
4. sales (
    id BIGINT PRIMARY KEY, 
    customer_id BIGINT, 
    total_amount NUMERIC, 
    payment_method TEXT,
    payment_status TEXT,
    created_at TIMESTAMP,
    user_id UUID
)
5. sale_items (
    id BIGINT PRIMARY KEY, 
    sale_id BIGINT, 
    product_id BIGINT, 
    quantity INTEGER, 
    unit_price NUMERIC,
    total_price NUMERIC
)
6. draft_invoices (
    id BIGINT PRIMARY KEY, 
    customer_name TEXT, 
    items JSONB,
    total_amount NUMERIC, 
    status TEXT,
    user_id UUID
)
7. draft_inventory_batches (
    id BIGINT PRIMARY KEY, 
    source_name TEXT, 
    items JSONB, 
    status TEXT,
    user_id UUID
)
8. purchase_orders (
    id BIGINT PRIMARY KEY,
    supplier_id BIGINT,
    items JSONB,
    total_amount NUMERIC,
    status TEXT,
    user_id UUID
)

RULES FOR AI:
- READ: You can SELECT from any table to answer questions
- WRITE: NEVER directly INSERT/UPDATE/DELETE core tables
- WRITE EXCEPTION: Create drafts for user approval using JSON format
- Security: Always filter by user_id (handled by RLS automatically)
"""

# Agent State - tracks conversation context
class AgentState(TypedDict):
    messages: list
    language: str
    user_token: str
    category: str
    model: str
    role: str

from functools import lru_cache

@lru_cache(maxsize=4)
def get_llm(model_name: str = "llama-4-scout-17b-16e-instruct-maas"):
    """
    Get or create a cached LLM instance.
    - Gemini models -> Vertex AI native
    - llama-4/maas -> Vertex AI Model Garden
    - Everything else -> Local Ollama
    """
    try:
        # Determine model type
        is_gemini = "gemini" in model_name.lower()
        is_cloud_model = is_gemini or "llama-4" in model_name.lower() or "maas" in model_name.lower()
        
        if not is_cloud_model:
            print(f"DEBUG: Using Local LLM (Ollama) -> {model_name}")
            return ChatOllama(
                model=model_name,
                base_url="http://127.0.0.1:11434",
                temperature=0.1,
                num_predict=256,
            )

        # Load service account credentials
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "service_account.json")
        
        if not os.path.exists(creds_path):
             potential_paths = [
                 "backend/service_account.json", 
                 "../backend/service_account.json",
                 os.path.join(os.path.dirname(__file__), "../../backend/service_account.json")
             ]
             for path in potential_paths:
                 if os.path.exists(path):
                     creds_path = path
                     break

        if not os.path.exists(creds_path):
            project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
            if not project_id:
                try:
                    import google.auth
                    _, project_id = google.auth.default()
                except Exception as e:
                    print(f"WARN: Could not fetch default GCP project: {e}")
            if not project_id:
                raise ValueError("GCP Project ID not found.")
            creds = None
        else:
            creds = service_account.Credentials.from_service_account_file(creds_path)
            project_id = creds.project_id
        
        # For Gemini: use model name directly (Vertex native, supports vision)
        if is_gemini:
            actual_model_name = model_name
            print(f"DEBUG: Using Vertex AI Gemini (vision) -> {actual_model_name}")
        # For Llama/MaaS: use Model Garden publisher prefix
        elif "llama-4" in model_name.lower() and not model_name.startswith("publishers/"):
            actual_model_name = f"publishers/meta/models/{model_name}"
            print(f"DEBUG: Using Vertex AI Model Garden -> {actual_model_name}")
        else:
            actual_model_name = model_name
        
        return ChatVertexAI(
            model_name=actual_model_name,
            project=project_id,
            location="us-east5",
            credentials=creds,
            temperature=0.7,
            max_tokens=2048
        )
    except Exception as e:
        print(f"ERROR initializing LLM ({model_name}): {e}")
        raise e

# No global llm anymore
# llm = init_llama_llm()


async def generate_sql_query(user_query: str, user_id: str, history_context: str = "", model: str = "llama-4-scout-17b-16e-instruct-maas", role: str = "owner") -> str:
    """
    Generate a SQL query from natural language using Llama
    """
    prompt = f"""
    You are a SQL expert for a PostgreSQL database.
    
    SCHEMA:
    {DATABASE_SCHEMA}
    
    USER QUERY: "{user_query}"
    USER_ID: "{user_id}"
    CURRENT DATE: {datetime.now().strftime('%A, %B %d, %Y')}
    
    RECENT CONVERSATION HISTORY (Use this to resolve pronouns like 'they', 'it', 'them', and time references like 'yesterday'):
    {history_context if history_context else "(No recent history)"}
    
    INSTRUCTIONS:
    1. Generate a valid PostgreSQL SELECT query.
    2. ALWAYS filter by `user_id = '{user_id}'` for every table accessed.
    3. Return ONLY the SQL query. No markdown, no explanations.
    4. Cast UUIDs properly if needed, but usually 'string' works in Postgres text-to-uuid.
    5. Handle case-insensitive string matching using ILIKE for names.
    6. If asking for "sales", join sales and sale_items and products if needed.
    7. Use LIMIT to prevent large result sets (default LIMIT 50 for lists).
    {f"8. SECURITY: The user is a CUSTOMER. You MUST NOT select `cost_price`. NEVER select exact `stock_quantity`, instead use a CASE statement to return 'In Stock' if > 0 else 'Out of Stock'." if role == 'customer' else ""}
    
    OPENCLAW SKILLS & RULES:
    {OPENCLAW_SKILLS}
    
    Example 1: "Show me rice sales"
    SQL: SELECT p.name, si.quantity, si.total_price FROM sale_items si JOIN products p ON si.product_id = p.id JOIN sales s ON si.sale_id = s.id WHERE p.name ILIKE '%rice%' AND s.user_id = '{user_id}' LIMIT 50
    
    Example 2: "List all customers" OR "Show all customers"
    SQL: SELECT name, phone, credit_balance FROM customers WHERE user_id = '{user_id}' ORDER BY name LIMIT 50
    
    Example 3: "Customers with pending dues"
    SQL: SELECT name, phone, credit_balance FROM customers WHERE user_id = '{user_id}' AND credit_balance > 0 ORDER BY credit_balance DESC LIMIT 50
    
    Example 4: "Show products"
    SQL: SELECT name, selling_price, stock_quantity FROM products WHERE user_id = '{user_id}' ORDER BY name LIMIT 50
    """
    
    # Use Flash for SQL gen as it's faster
    llm = get_llm(model)
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    sql = response.content.replace("```sql", "").replace("```", "").strip()
    # Remove trailing semicolon if present, as it can cause RPC errors
    if sql.endswith(";"):
        sql = sql[:-1]
    return sql

async def generate_sql_local(user_query: str, model: str = "phi3:mini") -> str:
    """
    Enhanced SQL generation for Local AI (SQLite).
    Supports products, customers, and sales queries.
    """
    logger.info(f"DEBUG: Entering generate_sql_local with model={model}")
    prompt = f"""
    SYSTEM: You are a SQLite expert. 
    Output the SLQ SELECT query ONLY. No markdown, no explanations.

    TABLES:
    1. products (id, name, selling_price, stock_quantity, category)
    2. customers (id, name, phone, credit_balance)

    SCHEMA NOTES:
    - Products: use name, selling_price, stock_quantity
    - Customers: use name, phone, credit_balance

    TASK: Convert user request to SQLite.
    QUERY: "{user_query}"
    
    OPENCLAW SKILLS & RULES:
    {OPENCLAW_SKILLS}

    EXAMPLES:
    "Show products" -> SELECT name, selling_price FROM products LIMIT 20
    "Price of Rice" -> SELECT name, selling_price FROM products WHERE name LIKE '%Rice%'
    "List customers" -> SELECT name, phone FROM customers LIMIT 10
    "Who owes money?" -> SELECT name, credit_balance FROM customers WHERE credit_balance > 0 ORDER BY credit_balance DESC
    "Check stock for maggi" -> SELECT name, stock_quantity FROM products WHERE name LIKE '%maggi%'

    SQL:
    """
    try:
        print(f"DEBUG: Generating SQL for query: {user_query}")
        llm = get_llm(model)
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        
        print(f"DEBUG LOCAL SQL RAW: {response.content}")

        sql = response.content.replace("```sql", "").replace("```", "").strip()
        
        # Extract just the SELECT statement if chatty
        import re
        match = re.search(r"SELECT.*", sql, re.IGNORECASE | re.DOTALL)
        if match:
            sql = match.group(0)
            
        # Clean up any trailing text
        sql = sql.split(';')[0]
            
        return sql
    except Exception as e:
        print(f"ERROR Local SQL Gen: {e}")
        return "SELECT name, selling_price FROM products LIMIT 5"

async def execute_sql(sql: str) -> str:
    """
    Execute SQL using the Supabase RPC function
    """
    if not supabase:
        return "Error: Database connection not configured."
        
    try:
        print(f"DEBUG: Executing SQL: {sql}")
        response = supabase.rpc("exec_sql_read_only", {"query": sql}).execute()
        return str(response.data)
    except Exception as e:
        print(f"ERROR: SQL Execution failed: {e}")
        return f"Error executing query: {str(e)}"

def execute_sql_local(sql: str) -> str:
    """
    Execute SQL against Local SQLite DB
    """
    if not local_db:
        return "Error: Local Database not available."
    
    try:
        print(f"DEBUG: Executing Local SQL: {sql}")
        conn = local_db.get_db_connection()
        c = conn.cursor()
        c.execute(sql)
        rows = c.fetchall()
        conn.close()
        
        # Convert to list of dicts
        result = [dict(row) for row in rows]
        return str(result)
    except Exception as e:
        print(f"ERROR: Local SQL Execution failed: {e}")
        return f"Error executing local query: {str(e)}"

async def get_chat_history(user_id: str, limit: int = 10) -> list:
    """
    Retrieve recent chat history for the user (last 12 hours, up to limit messages)
    
    Args:
        user_id: UUID of the user
        limit: Maximum number of messages to retrieve (default 10)
        
    Returns:
        List of message dicts with 'role' and 'message' keys
    """
    try:
        time_threshold = (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()
        
        response = supabase.table("chat_history")\
            .select("role, message, created_at")\
            .eq("user_id", user_id)\
            .gte("created_at", time_threshold)\
            .order("created_at", desc=False)\
            .limit(limit)\
            .execute()
        
        return response.data if response.data else []
    except Exception as e:
        print(f"ERROR: Failed to retrieve chat history: {e}")
        return []


async def perform_history_cleanup():
    """
    Call the database function to clean up old chat history.
    Should be called periodically (e.g., hourly).
    """
    try:
        if not supabase:
            print("WARNING: Supabase not configured, skipping cleanup.")
            return
            
        # Call the PostgreSQL function directly via RPC
        # Note: If RPC not created, this might fail, so we wrap in try/except
        # But we created it in migration 007.
        response = supabase.rpc("cleanup_old_chat_history", {}).execute()
        print("INFO: Chat history cleanup executed.")
    except Exception as e:
        print(f"ERROR: Failed to execute chat history cleanup: {e}")


async def save_chat_message(user_id: str, role: str, message: str):
    """
    Save a chat message to the history
    
    Args:
        user_id: UUID of the user
        role: 'user' or 'assistant'
        message: The message content
    """
    try:
        supabase.table("chat_history").insert({
            "user_id": user_id,
            "role": role,
            "message": message
        }).execute()
    except Exception as e:
        print(f"ERROR: Failed to save chat message: {e}")


def categorize_query(msg_lower: str) -> str:
    """
    Categorize user query into GREETING, CAPABILITY, IDENTITY, or CHAT
    
    Args:
        msg_lower: Lowercase user message
        
    Returns:
        Category string: "GREETING", "CAPABILITY", "IDENTITY", "BUSINESS", or "CHAT"
    """
    import re
    
    # Tokenize message for word-boundary matching
    clean_msg = re.sub(r'[^\w\s]', '', msg_lower)
    words = set(clean_msg.split())

    # Greeting patterns
    greeting_keywords = [
        "hello", "hi", "hey", "namaste", "namaskar", "good morning", 
        "good afternoon", "good evening", "good night", "hola",
        "thanks", "thank you", "shukriya", "dhanyavaad", "bye", "goodbye"
    ]
    
    # Capability inquiry patterns
    capability_keywords = [
        "what can you do", "what do you do", "kya kar sakte ho", "help me",
        "capabilities", "features", "kya help kar sakte", "so what can you",
        "tell me about", "introduce yourself", "apne baare mein batao"
    ]
    
    # Business query patterns
    business_keywords = [
        "price", "cost", "selling", "margin", "tax", "stock", "quantity", "inventory",
        "customer", "client", "buyer", "sale", "sell", "sold", "bill", "invoice", "receipt",
        "draft", "order", "purchase", "revenue", "profit", "loss", "expense", "total", "amount",
        "kitna", "batao", "dikhao", "check", "verify", "find", "search", "lookup", "fetch",
        "list", "report", "summary", "count", "number", "how many", "status", "due", "pending",
        "paid", "payment", "transaction", "history", "record", "entry", "data", "info", "details",
        "add", "update", "create", "make", "delete", "remove", "edit", "change", "save",
        "who bought", "what did", "product", "item", "good", "service", "sku", "code",
        "spend", "spent", "credit", "balance", "money", "cash", "upi", "card", "bank",
        "products", "items", "bills", "invoices", "orders", "customers"
    ]

    identity_keywords = [
        "what is your name", "who are you", "your name", "tumhara naam", 
        "aapka naam", "who am i talking to", "identity", "intro", "introduction"
    ]
    
    # Action intent patterns (High priority for create/update)
    action_keywords = [
        "create", "add", "new", "make a", "draft", "register", "record", 
        "pay", "paid", "receive", "received", "recive", "recieve", "recived", "recieved",
        "payment", "bill", "invoice", "due", "dues", "baki", "udhar", "liya", "diya", "mila",
        "restock", "restocked"
    ]

    # Context keywords for query categorization
    contextual_pronouns = ["this", "that", "it", "them", "him", "her"]

    # Image context always routes to action agent for multimodal draft creation
    if '[image context:' in msg_lower or '[excel bulk data:' in msg_lower:
        return "ACTION"
    
    if any(cp in words for cp in contextual_pronouns):
        return "BUSINESS"
    if any(k in words for k in action_keywords):
        return "ACTION"
    if any(msg_lower.startswith(k) or msg_lower == k for k in greeting_keywords):
        return "GREETING"
    if any(k in msg_lower for k in identity_keywords):
        return "IDENTITY"
    if any(k in msg_lower for k in capability_keywords):
        return "CAPABILITY"
    if any(k in msg_lower for k in business_keywords):
        return "BUSINESS"
    
    return "CHAT"
async def extract_action_params(user_query: str, history_context: str = "", model: str = "llama-4-scout-17b-16e-instruct-maas") -> str:
    """
    Extract structured JSON parameters for an action.
    Uses Gemini Flash (vision model) when an image URL is detected,
    falls back to Llama for text-only requests.
    """
    import re, json, ast

    # Detect image context
    img_match = re.search(r'\[IMAGE CONTEXT:\s*(https?://[^\s\]]+)\]', user_query)
    img_url = None
    clean_query = user_query
    if img_match:
        img_url = img_match.group(1).strip()
        clean_query = user_query.replace(img_match.group(0), "").strip()

    bulk_product_example = '''Example BULK IMAGE: "add this product image to inventory"
JSON: {"type": "bulk_product_draft", "items": [{"name": "Basmati Rice (1kg)", "category": "Grocery", "selling_price": 120, "cost_price": 95, "stock_quantity": 50, "unit": "kg"}, {"name": "Tata Salt", "category": "Grocery", "selling_price": 25, "cost_price": 18, "stock_quantity": 100, "unit": "pcs"}]}'''

    prompt = f"""You are an AI data extractor for a shop management system.

USER QUERY: "{clean_query}"
HISTORY: "{history_context}"

YOUR JOB: Extract parameters to create a DRAFT for the requested action.
If an image is provided, scan it using OCR. Extract ALL products visible in the image with their name, category, cost price (CP), selling price (SP/MRP), and stock quantity. Map table column headers intelligently.
Return STRICT JSON only. No markdown, no explanation.

OPENCLAW SKILLS & RULES:
{OPENCLAW_SKILLS}

Example 1 - Bill: {{"type":"invoice_draft","customer_name":"Amit","items":[{{"product_name":"Rice","quantity":2,"price":0,"tax_percent":0,"hsn_code":""}}]}}
Example 2 - Restock: {{"type":"restock_draft","product_name":"Rice","quantity_to_add":50}}
Example 3 - New Customer: {{"type":"customer_draft","name":"Rahul","phone":"9876543210","address":"New Delhi"}}
{bulk_product_example}

If query is vague, return {{"type":"unknown","error":"Missing details"}}"""

    try:
        if img_url:
            # ── IMAGE PATH: Use Gemini Flash (vision-capable Vertex AI model) ──
            # llama-4-scout is TEXT ONLY and cannot process images.
            # Gemini Flash supports multimodal input natively via Vertex AI.
            print(f"DEBUG: Image detected. Using Gemini Flash for OCR. URL: {img_url[:60]}...")
            vision_llm = get_llm("gemini-2.0-flash")
            message_content = [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": img_url}}
            ]
            response = await vision_llm.ainvoke([HumanMessage(content=message_content)])
        else:
            # ── TEXT PATH: Use the user-selected model (Llama or local) ──
            llm = get_llm(model)
            response = await llm.ainvoke([HumanMessage(content=prompt)])

        content = response.content
        print(f"DEBUG: extract_action_params RAW RESPONSE: {content[:200]}")

        # Extract JSON block from response
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        json_str = json_match.group(0) if json_match else content.replace("```json", "").replace("```", "").strip()

        # Attempt 1: Direct JSON parse
        try:
            json.loads(json_str)
            return json_str
        except json.JSONDecodeError:
            pass

        # Attempt 2: AST literal eval (handles Python dict with single quotes)
        try:
            if json_str.strip().startswith("{"):
                py_dict = ast.literal_eval(json_str)
                return json.dumps(py_dict)
        except Exception as ast_err:
            print(f"DEBUG: AST eval failed: {ast_err}")

        return json_str

    except Exception as e:
        print(f"ERROR extracting params: {e}")
        import traceback; traceback.print_exc()
        return "{}"

async def get_user_profile(user_id: str) -> str:
    """
    Fetch user's business name from profiles table
    """
    try:
        if not supabase:
            return "your business"
        response = supabase.table("profiles").select("business_name").eq("id", user_id).execute()
        if response.data and len(response.data) > 0:
            return response.data[0].get("business_name", "your business")
        return "your business"
    except Exception as e:
        print(f"ERROR: Failed to fetch profile: {e}")
        return "your business"

def fast_parse_action(user_query: str) -> str:
    """
    Regex-based fast parser for common action patterns.
    Skips the LLM entirely for well-structured commands.
    Returns JSON string or None if no pattern matched.
    """
    import json
    q = user_query.strip()
    ql = q.lower()

    # --- PATTERN 1: Payment (Priority) ---
    # "amit paid 500" / "received 200 from rahul" / "Received payment of 500 from Farooq"
    payment_pattern1 = re.search(
        r'([\w\s]+?)\s+(?:paid|gave|returned)\s+(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d+)?)',
        ql
    )
    if payment_pattern1:
        name = payment_pattern1.group(1).strip().title()
        amount = float(payment_pattern1.group(2))
        if name.lower() not in ['i', 'he', 'she', 'they', 'we', 'add', 'create', 'new', 'make', 'received', 'got']:
            return json.dumps({
                "type": "payment_draft",
                "customer_name": name,
                "amount": amount,
                "payment_type": "payment",
                "mode": "Cash"
            })

    # Enhanced pattern for "received X from Y" or "received payment of X from Y"
    payment_pattern2 = re.search(
        r'(?:received|recieved|recived|recive|recieve|got|liya|mila)\s+(?:payment|dues|due|of|rs\.?|₹)*\s*(\d+(?:\.\d+)?)\s*(?:payment|dues|due|of)?\s*(?:from|se)\s+([\w\s]+)',
        ql
    )
    if payment_pattern2:
        amount = float(payment_pattern2.group(1))
        name = payment_pattern2.group(2).strip().title()
        return json.dumps({
            "type": "payment_draft",
            "customer_name": name,
            "amount": amount,
            "payment_type": "payment",
            "mode": "Cash"
        })

    # "add 500 due to rahul" / "rahul ko 500 udhar"
    payment_pattern3 = re.search(
        r'(?:add|gave|de diya|plus)\s+(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d+)?)\s+(?:dues|due|credit|udhar|baki)?\s*(?:to|for|on|ko)\s+([\w\s]+)',
        ql
    )
    if not payment_pattern3:
        payment_pattern3 = re.search(
            r'([\w\s]+?)\s+(?:ko|pe|for)?\s*(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d+)?)\s+(?:dues|due|credit|udhar|baki)',
            ql
        )

    if payment_pattern3:
        try:
            val = float(payment_pattern3.group(1).replace(',', ''))
            amount = val
            name = payment_pattern3.group(2).strip().title()
        except:
            name = payment_pattern3.group(1).strip().title()
            amount = float(payment_pattern3.group(2).replace(',', ''))
            
        if name.lower() not in ['i', 'he', 'she', 'they', 'we', 'add', 'create', 'received']:
            return json.dumps({
                "type": "payment_draft",
                "customer_name": name,
                "amount": amount,
                "payment_type": "due",
                "mode": "Cash"
            })

    # --- PATTERN 2: Restock ---
    # "restock 50 rice" / "received 30 kg atta" / "restock 1.5 kg rice"
    # Added check to avoid payment keywords in product name
    restock_pattern = re.search(
        r'(?:restock|restocked|received|got|aa\s*gaya|maal\s*aaya|added?\s+more?)\s+(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d+)?)\s+(?:kg|g|litre|liter|ltr|l|ml|pcs|packets?|dozen|box|set|pieces?)?\s*(?:of\s+)?([a-z][a-z\s]+)',
        ql
    )
    restock_pattern2 = re.search(
        r'(?:restock|restocked|received|got)\s+([a-z][a-z\s]+)\s+(\d+(?:\.\d+)?)',
        ql
    )
    if restock_pattern:
        val = float(restock_pattern.group(1))
        # if int, convert to int for cleaner json
        qty = int(val) if val.is_integer() else val
        prod = restock_pattern.group(2).strip().title()
        if not any(x in prod.lower() for x in ['payment', 'due', 'from', 'se', 'to']):
            return json.dumps({
                "type": "restock_draft",
                "product_name": prod,
                "quantity_to_add": qty
            })
    elif restock_pattern2:
        prod = restock_pattern2.group(1).strip().title()
        val = float(restock_pattern2.group(2))
        qty = int(val) if val.is_integer() else val
        if not any(x in prod.lower() for x in ['payment', 'due', 'from', 'se', 'to']):
            return json.dumps({
                "type": "restock_draft",
                "product_name": prod,
                "quantity_to_add": qty
            })

    # --- PATTERN 1: Add Product ---
    # "add product potato price 50 qty 20"
    # "add 20 banana price 20"
    # "add product banana cp 30 sp 40"

    # Helper: extract unit from query
    def extract_unit(text):
        unit_map = {
            'kg': 'kg', 'kilo': 'kg', 'kilos': 'kg',
            'gram': 'g', 'grams': 'g', 'gm': 'g',
            'litre': 'litre', 'liter': 'litre', 'liters': 'litre', 'litres': 'litre', 'leater': 'litre', 'ltr': 'litre',
            'ml': 'ml',
            'packet': 'packet', 'packets': 'packet',
            'dozen': 'dozen', 'dozens': 'dozen', 'darzan': 'dozen', 'darjan': 'dozen',
            'box': 'box', 'boxes': 'box',
            'piece': 'pcs', 'pieces': 'pcs', 'pcs': 'pcs', 'pics': 'pcs', 'pix': 'pcs', 'peaces': 'pcs', 'peace': 'pcs',
            'set': 'set', 'sets': 'set',
            'metre': 'metre', 'meter': 'metre', 'mtr': 'metre'
        }
        for kw, unit in unit_map.items():
            if re.search(r'\b' + kw + r'\b', text):
                return unit
        return 'pcs'
    
    # Check for CP and SP explicitly first
    # Updated regex to handle optional leading commas/spaces safely
    product_pattern_cpsp = re.search(
        r'(?:add|new|create)\s+(?:a\s+)?(?:new\s+)?(?:product|item\s+)?(?:[,:\s]+)?([a-z0-9\s\.,&/]+?)\s*[,\s]\s*cp\s+(\d+(?:\.\d+)?)\s+sp\s+(\d+(?:\.\d+)?)',
        ql
    )
    product_pattern_general = re.search(
        r'(?:add|new|create)\s+(?:a\s+)?(?:new\s+)?(?:product|item\s+)?(?:[,:\s]+)?(?:(\d+)\s+)?([a-z0-9\s\.,&/]+?)\s*[,\s]\s*(?:price|rate|mrp|rs|₹|sp)\s+(\d+(?:\.\d+)?)',
        ql
    )
    
    if product_pattern_cpsp:
        name = product_pattern_cpsp.group(1).strip().title()
        cost_price = float(product_pattern_cpsp.group(2))
        selling_price = float(product_pattern_cpsp.group(3))
        stock_quantity = 0
        stock_match = re.search(r'(?:stock|qty|quantity)\s+(\d+)', ql)
        if stock_match:
            stock_quantity = int(stock_match.group(1))

        return json.dumps({
            "type": "product_draft",
            "name": name,
            "selling_price": selling_price,
            "cost_price": cost_price,
            "stock_quantity": stock_quantity,
            "unit": extract_unit(ql),
            "category": "General"
        })
        
    elif product_pattern_general:
        qty_prefix = product_pattern_general.group(1)
        name = product_pattern_general.group(2).strip().title()
        selling_price = float(product_pattern_general.group(3))
        
        stock_quantity = int(qty_prefix) if qty_prefix else 0
        if not qty_prefix:
            stock_match = re.search(r'(?:stock|qty|quantity)\s+(\d+)', ql)
            if stock_match:
                stock_quantity = int(stock_match.group(1))
        
        # Optional: Extract Cost Price (CP)
        cp_match = re.search(r'(?:cp|cost|buying|buy)\s+(?:price|rate)?\s*(?:rs\.?\s*|₹\s*)?(\d+(\.\d+)?)', ql)
        cost_price = float(cp_match.group(1)) if cp_match else 0.0

        return json.dumps({
            "type": "product_draft",
            "name": name,
            "selling_price": selling_price,
            "cost_price": cost_price,
            "stock_quantity": stock_quantity,
            "unit": extract_unit(ql),
            "category": "General"
        })

    # --- PATTERN 2: Add Customer ---
    # "add customer, kakeel. contact 6901739135" OR "customer rahul 9876543210"
    # Flexible punctuation handling
    if "address" in ql or "from" in ql.replace("from mobile", ""):
        # Let the LLM handle complex address extraction
        pass
    else:
        customer_pattern_with_ext = re.search(
            r'(?:add|new|create|register)\s+(?:a\s+)?(?:new\s+)?customer[:,\.\s]+\s*([\w\s]+?)(?:[,\.\s]+)(?:contact|phone|number|mobile|no\.?|ph)\s+([\d\s]+)',
            ql
        )
        customer_pattern_simple = re.search(
            r'(?:add|new|create|register)\s+(?:a\s+)?(?:new\s+)?customer[:,\.\s]+\s*([\w\s]+)',
            ql
        )
        
        if customer_pattern_with_ext:
            name = customer_pattern_with_ext.group(1).strip().strip(',').strip('.').strip().title()
            phone = customer_pattern_with_ext.group(2).strip()
            # Clean phone from spaces
            phone = "".join(phone.split())
            return json.dumps({
                "type": "customer_draft",
                "name": name,
                "phone": phone,
                "address": ""
            })
        elif customer_pattern_simple:
            name = customer_pattern_simple.group(1).strip().strip(',').strip('.').strip().title()
            # Check if name contains "contact" etc. if so, regex probably over-captured or missed
            if any(x in name.lower() for x in ["contact", "phone", "mobile", "number", "ph "]):
                 # try a specialized split
                 for kw in ["contact", "phone", "mobile", "number", "ph "]:
                     if f" {kw}" in f" {name.lower()}":
                         parts = name.lower().split(kw.strip())
                         real_name = parts[0].strip().strip(',').strip('.').strip(':').strip().title()
                         # extract digits from second part
                         ph_match = re.search(r'(\d+)', parts[1])
                         ph = ph_match.group(1) if ph_match else ""
                         return json.dumps({
                            "type": "customer_draft",
                            "name": real_name,
                            "phone": ph,
                            "address": ""
                        })

            return json.dumps({
                "type": "customer_draft",
                "name": name,
                "phone": "",
                "address": ""
            })


    # --- PATTERN 4: Invoice / Bill ---
    # "bill for amit 2 rice and 1 oil" / "create bill for X ..."
    invoice_pattern = re.search(
        r'(?:bill|invoice|sale)\s+(?:for|to|of)\s+([\w]+)',
        ql
    )
    if invoice_pattern:
        customer = invoice_pattern.group(1).strip().title()
        # Extract items: "2 rice", "1 oil", etc.
        items_raw = re.findall(r'(\d+)\s+([a-z][a-z\s]+)', ql)
        items = []
        skip_words = {'for', 'to', 'and', 'with', 'rs', 'rupees'}
        
        for qty_str, prod_raw in items_raw:
            prod = prod_raw.strip()
            # Split by keywords to avoid capturing trailing junk
            for split_word in ['and', 'with', 'for']:
                if f' {split_word} ' in prod:
                    prod = prod.split(f' {split_word} ')[0]
                    
            if prod.lower() not in skip_words and prod.lower() != customer.lower() and not prod.isdigit():
                items.append({
                    "product_name": prod.title(),
                    "quantity": int(qty_str),
                    "price": 0,
                    "tax_percent": 0,
                    "hsn_code": ""
                })
        if items:
            return json.dumps({
                "type": "invoice_draft",
                "customer_name": customer,
                "items": items
            })

    # --- PATTERN 5: Dues / Credit specific ---
    # "add 500 due to amit" -> Give Credit (Red) - User says "due" or "credit" or "udhar"
    add_due_pattern = re.search(
        r'(?:add|give)\s+(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d+)?)\s*(?:due|credit|udhar)?\s*(?:to|for)\s+([a-z\s]+)',
        ql
    )
    if add_due_pattern:
         amount = float(add_due_pattern.group(1))
         name = add_due_pattern.group(2).strip().replace(" due", "").title()
         # filter out filler words that get caught in [a-z\s]+
         if name.lower() not in ['me', 'him', 'her', 'them', 'us']:
             return json.dumps({
                "type": "payment_draft",
                "customer_name": name,
                "amount": amount,
                "payment_type": "credit",  # add dues (red)
                "mode": "Cash"
            })

    # "deduct 500 from amit due" OR "deduct 500 due from amit" -> Receive Payment (Green)
    # Pattern A: "deduct [amount] from [name]" (name may or may not follow with 'due')
    deduct_due_pattern = re.search(
        r'(?:deduct|reduce|cut|remove|clear)\s+(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d+)?)\s+(?:from|of)\s+([\w\s]+?)(?:\s+due|\s+credit|\s+udhar|$)',
        ql
    )
    # Pattern B: "deduct [amount] due/udhar from [name]"
    deduct_due_pattern2 = re.search(
        r'(?:deduct|reduce|cut|remove|clear)\s+(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d+)?)\s+(?:due|udhar|credit)\s+(?:from|of)\s+([\w\s]+)',
        ql
    )
    # Merge: whichever pattern matched
    _dp = deduct_due_pattern or deduct_due_pattern2
    if _dp:
         amount = float(_dp.group(1))
         name = _dp.group(2).strip().title()
         return json.dumps({
            "type": "payment_draft",
            "customer_name": name,
            "amount": amount,
            "payment_type": "payment",  # deduct dues (green)
            "mode": "Cash"
        })

    return None  # No pattern matched


async def extract_action_params_local(user_query: str, history_context: str = "", model: str = "phi3:mini") -> str:
    """
    Enhanced extraction for Local AI supporting all 4 Dukan Sathi draft scenarios.
    Uses fast regex parser first, falls back to LLM only if needed.
    """
    # FAST PATH: Try regex parser first (instant, no LLM call)
    fast_result = fast_parse_action(user_query)
    if fast_result:
        print(f"DEBUG: FAST PARSE SUCCESS: {fast_result}")
        return fast_result

    # SLOW PATH: Fall back to LLM for complex/ambiguous queries
    print(f"DEBUG: Fast parse missed, falling back to LLM for: {user_query}")
    prompt = f"""You are a JSON extractor. You must output ONLY valid JSON. 
DO NOT INCLUDE ANY TEXT, APOLOGIES, OR CHAT. JUST THE JSON OBJECT.

Task: Extract data from the user query into a structured DRAFT JSON.

OPENCLAW SKILLS & RULES:
{OPENCLAW_SKILLS}

Now, parse this query:
query: "{user_query}"
output:"""
    try:
        llm = get_llm(model)
        # Using invoke instead of ainvoke for local models can sometimes be more stable if ainvoke causes hangs, 
        # but sticking to ainvoke as it's the standard langchain async path unless issues arise.
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        
        print(f"DEBUG LOCAL EXTRACT RAW: {response.content}")

        content = response.content.strip()
        
        # Strip code blocks
        if content.startswith("```json"):
             content = content.split("```json")[1].split("```")[0].strip()
        elif content.startswith("```"):
             content = content.split("```")[1].split("```")[0].strip()
        
        # Robust Brace Counting Extractor if still hallucinating text
        json_str = "{}"
        start_idx = content.find('{')
        
        if start_idx != -1:
            brace_count = 0
            for i in range(start_idx, len(content)):
                char = content[i]
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                
                if brace_count == 0:
                    json_str = content[start_idx:i+1]
                    break
        else:
             print("DEBUG: Local AI failed to output a JSON object entirely.")
             return "{}"

        # Cleanup python style dicts
        json_str = json_str.replace("'", '"')
        
        # Remove trailing commas (common local model error: {"a": 1,})
        json_str = re.sub(r',\s*\}', '}', json_str)
        json_str = re.sub(r',\s*\]', ']', json_str)
        
        return json_str
    except Exception as e:
        print(f"ERROR Local Extraction: {e}")
        return "{}"

# --- SECURITY GUARDRAIL ---

async def safety_guard_node(state: AgentState):
    """
    Security Guardrail Agent: Checks for obvious SQL injection patterns.
    Image/Excel context is always bypassed (safe business operation).
    """
    messages = state['messages']
    last_msg = messages[-1].content if isinstance(messages[-1].content, str) else str(messages[-1].content)
    
    # BYPASS: attachments are always safe operations — never run LLM checks on them
    if '[image context:' in last_msg.lower() or '[excel bulk data:' in last_msg.lower():
        print("DEBUG: Safety Guard BYPASSED — image/excel attachment is always safe.")
        return {"category": state.get("category")}

    # Fast heuristic: block obvious destructive SQL only
    dangerous_keywords = ["drop table", "delete from", "truncate", "alter table", "update pg_", "copy from"]
    if any(kw in last_msg.lower() for kw in dangerous_keywords):
        print("DEBUG: Safety Guard caught malicious SQL keyword.")
        return {
            "messages": [AIMessage(content="I cannot perform that action for security reasons.")],
            "category": "BLOCKED"
        }

    # All other requests pass through — LLM safety check removed (too many false positives)
    return {"category": state.get("category")}

# --- NODES ---

async def router_node(state: AgentState):
    """
    Router Node: Decides whether to go to Action Agent or Chat Agent
    """
    messages = state['messages']
    last_msg = messages[-1].content.lower().strip()
    
    # Check if already blocked by safety guard
    if state.get("category") == "BLOCKED":
        return {"category": "BLOCKED"}
        
    category = categorize_query(last_msg)
    print(f"DEBUG: Router Decision -> {category}")
    
    return {"category": category}

async def action_node(state: AgentState):
    """
    Action Agent: Handles Draft Creation
    """
    messages = state['messages']
    last_msg = messages[-1].content
    user_token = state.get('user_token', '')
    selected_model = state.get("model", "llama-4-scout-17b-16e-instruct-maas")
    
    # User ID Resolution
    user_id = user_token if user_token and len(user_token) < 50 else "unknown_user"
    if not user_id or "default" in user_id.lower() or "test" in user_id.lower() or user_id == "unknown_user":
        user_id = "00000000-0000-0000-0000-000000000000"
    
    # History for context
    chat_history = await get_chat_history(user_id, limit=5)
    history_text = "\n".join([f"{msg['role'].capitalize()}: {msg['message']}" for msg in chat_history])
    
    print("DEBUG: Executing Action Node")
    
    # If message contains image context, skip fast_parse to hit LLM OCR path
    has_image_context = '[image context:' in last_msg.lower() or '[excel bulk data:' in last_msg.lower()
    
    # FAST PATH: Try regex parser first (instant, works for both cloud and local)
    # Skip fast path for image/excel bulk payloads — LLM handles OCR extraction
    action_json_str = None if has_image_context else fast_parse_action(last_msg)
    if action_json_str:
        print(f"DEBUG: FAST PARSE SUCCESS (action_node): {action_json_str}")
    else:
        # SLOW PATH: Fall back to LLM extraction (always for image/excel)
        if "llama-4" in selected_model or "maas" in selected_model:
            action_json_str = await extract_action_params(last_msg, history_text, model=selected_model)
        else:
            action_json_str = await extract_action_params_local(last_msg, history_text, model=selected_model)
        
    print(f"DEBUG: Extracted JSON: {action_json_str}")

    # Setup Logger
    import logging
    logger = logging.getLogger("agent_graph")
    
    # HYDRATE WITH REAL DATA (PRICING)
    import json
    import re
    updated_json_str = action_json_str
    try:
        action_data = json.loads(action_json_str)
        
        if action_data.get("type") == "invoice_draft" and "items" in action_data:
            updated_items = []
            total_amount = 0
            
            # Logic to hydrate items with database values


            async def fetch_product_details(item):
                """Helper to fetch details for a single item"""
                prod_name = item.get("product_name", "")
                qty = item.get("quantity", 0)
                user_id_local = user_id # Capture from closure
                
                # Default values
                price = 0
                tax_percent = 0
                hsn_code = ""
                official_name = prod_name
                
                # Two flags: one for LLM source, one for data source
                is_cloud_llm = "llama-4" in selected_model or "maas" in selected_model
                use_local_data = not is_cloud_llm  # SQLite if local model
                if supabase and prod_name and is_cloud_llm and not use_local_data:
                    try:
                        # FUZZY MATCH: Use pg_trgm RPC for typo-tolerant matching
                        # Falls back to ilike if RPC not yet created
                        safe_name = re.sub(r'[^\w\s]', '', prod_name).strip()
                        res = None
                        
                        if safe_name:
                             try:
                                 # Primary: Fuzzy RPC (tolerates typos from voice input)
                                 rpc_res = supabase.rpc('fuzzy_match_product', {
                                     'query': safe_name,
                                     'uid': user_id_local
                                 }).execute()
                                 if rpc_res and rpc_res.data and len(rpc_res.data) > 0:
                                     res = rpc_res
                             except Exception as fuzz_err:
                                 logger.warning(f"WARN: fuzzy_match_product RPC failed, falling back to ilike: {fuzz_err}")
                             
                             # Fallback: ilike (exact case-insensitive)
                             if not res or not res.data:
                                 try:
                                     res = supabase.table("products").select("selling_price, id, name, tax_percent, hsn_code").ilike("name", f"%{safe_name}%").eq("user_id", user_id_local).limit(1).execute()
                                 except Exception as fallback_err:
                                     logger.error(f"ERROR: fallback ilike failed for {safe_name}: {fallback_err}")
                                     res = None

                             if res and res.data and len(res.data) > 0:
                                db_prod = res.data[0]
                                price = float(db_prod.get("selling_price") or 0)
                                tax_percent = float(db_prod.get("tax_percent") or 0)
                                hsn_code = db_prod.get("hsn_code", "")
                                official_name = db_prod.get("name", prod_name)
                                logger.info(f"DEBUG: Found {official_name}: Price={price}, Tax={tax_percent}%")
                             else:
                                logger.info(f"DEBUG: Product not found: {safe_name}")
                        else:
                             logger.info("DEBUG: Skipped search for empty/unsafe product name")
                             
                    except Exception as db_err:
                        logger.error(f"ERROR: DB Lookup failed for {prod_name}: {db_err}")

                elif local_db and prod_name and use_local_data:
                    # LOCAL DB LOOKUP
                    try:
                        safe_name = re.sub(r'[^\w\s]', '', prod_name)
                        results = local_db.search_products_local(safe_name, user_id)
                        if results:
                            db_prod = results[0] # Take first match
                            price = float(db_prod.get("selling_price", 0))
                            tax_percent = float(db_prod.get("tax_percent", 0))
                            official_name = db_prod.get("name", prod_name)
                            logger.info(f"DEBUG: [LocalDB] Found {official_name}: Price={price}")
                    except Exception as local_err:
                        logger.error(f"ERROR: Local DB Lookup failed: {local_err}")
                
                # Update item
                item["product_id"] = db_prod.get("id") if db_prod else None
                item["price"] = price
                item["tax_percent"] = tax_percent
                item["hsn_code"] = hsn_code
                item["product_name"] = official_name
                item["total"] = price * qty # Basic line total
                return item

            # Execute all item lookups in parallel
            tasks = [fetch_product_details(item) for item in action_data["items"]]
            updated_items = await asyncio.gather(*tasks)
            
            # Calculate total
            for item in updated_items:
                total_amount += item["total"]
            
            # Update main object
            action_data["items"] = updated_items
            action_data["total_amount"] = total_amount
            updated_json_str = json.dumps(action_data)
            logger.info(f"DEBUG: Hydrated JSON (Parallel): {updated_json_str}")

        elif action_data.get("type") == "bulk_product_draft" and "items" in action_data:
            updated_items = []
            
            async def fetch_bulk_product_details(item):
                prod_name = item.get("name", "")
                user_id_local = user_id
                
                # Assume Add New by default
                item["action"] = "add"
                item["existing_id"] = None
                
                is_cloud_llm = "llama-4" in selected_model or "maas" in selected_model
                use_local_data = not is_cloud_llm
                
                if supabase and prod_name and is_cloud_llm and not use_local_data:
                    try:
                        safe_name = re.sub(r'[^\w\s]', '', prod_name).strip()
                        if safe_name:
                            # Use exact ilike match to avoid aggressive restock overrides
                            res = supabase.table("products").select("id, name, selling_price, cost_price, stock_quantity").ilike("name", f"%{safe_name}%").eq("user_id", user_id_local).limit(1).execute()
                            if res and res.data and len(res.data) > 0:
                                db_prod = res.data[0]
                                item["action"] = "restock"
                                item["existing_id"] = db_prod.get("id")
                                item["name"] = db_prod.get("name", prod_name) # Use official name
                                logger.info(f"DEBUG: Found existing product for bulk import: {item['name']} -> RESTOCK")
                    except Exception as db_err:
                        logger.error(f"ERROR: DB Lookup failed for {prod_name} in bulk import: {db_err}")
                
                elif local_db and prod_name and use_local_data:
                    try:
                        safe_name = re.sub(r'[^\w\s]', '', prod_name)
                        results = local_db.search_products_local(safe_name, user_id)
                        if results:
                            db_prod = results[0]
                            item["action"] = "restock"
                            item["existing_id"] = db_prod.get("id")
                            item["name"] = db_prod.get("name", prod_name)
                    except Exception as local_err:
                        logger.error(f"ERROR: Local DB Lookup failed in bulk import: {local_err}")
                        
                return item
                
            tasks = [fetch_bulk_product_details(item) for item in action_data["items"]]
            updated_items = await asyncio.gather(*tasks)
            action_data["items"] = updated_items
            updated_json_str = json.dumps(action_data)
            logger.info(f"DEBUG: Hydrated Bulk JSON: {updated_json_str}")

    except Exception as e:
        logger.error(f"ERROR hydrating action JSON: {e}")
        # Fallback to original if parsing fails
        updated_json_str = action_json_str
    
    # Generate Response - Use hardcoded templates (skip LLM call for ALL models)
    import json as _json
    try:
        draft_type = _json.loads(updated_json_str).get("type", "")
    except:
        draft_type = ""
    
    confirmation_templates = {
        "invoice_draft": "Sure, I've prepared the invoice draft. Please review and approve.",
        "product_draft": "Sure, I've prepared the product draft. Please review and approve.",
        "customer_draft": "Sure, I've prepared the customer details. Please review and approve.",
        "payment_draft": "Sure, I've prepared the payment record. Please review and approve.",
        "restock_draft": "Sure, I've prepared the restock draft. Please review and approve.",
        "bulk_product_draft": "Sure Boss, I've extracted the product list. Please review and approve.",
    }
    confirmation_text = confirmation_templates.get(draft_type, "Sure, I've prepared the draft. Please review and approve.")
    
    class _FakeResponse:
        def __init__(self, c): self.content = c
    response = _FakeResponse(confirmation_text)
    print(f"DEBUG: Used hardcoded confirmation (type={draft_type})")
    
    # Save to history 
    await save_chat_message(user_id, "user", last_msg)
    await save_chat_message(user_id, "assistant", response.content)
    
    # Construct Structured Response for Frontend/Backend
    # Construct Structured Response for Frontend/Backend
    try:
        print(f"DEBUG UPDATED JSON RAW: {updated_json_str}")
        draft_obj = json.loads(updated_json_str)
        print(f"DEBUG PARSED DRAFT OBJ: {draft_obj}")
        
        # Identify draft type for frontend component
        if "type" in draft_obj:
            if "invoice" in draft_obj["type"]: 
                draft_obj["draft_type"] = "invoice"
            elif "product" in draft_obj["type"]:
                draft_obj["draft_type"] = "product"
            elif "customer" in draft_obj["type"]:
                draft_obj["draft_type"] = "customer"
            elif "payment" in draft_obj["type"]:
                draft_obj["draft_type"] = "payment"
            elif "restock" in draft_obj["type"]:
                draft_obj["draft_type"] = "restock"
            elif "bulk_product" in draft_obj["type"]:
                draft_obj["draft_type"] = "bulk_product"
            else:
                draft_obj["draft_type"] = "generic"
    except Exception as e:
        print(f"ERROR JSON Parse Error in Action Node: {e} | Content: {updated_json_str}")
        import traceback
        traceback.print_exc()
        draft_obj = {}

    # --- ROLE BASED SANDBOX: CUSTOMER BOT ---
    # Customers can only create invoice drafts (orders). Block everything else.
    if state.get("role") == "customer" and draft_obj.get("type") and draft_obj.get("type") != "invoice_draft":
        logger.warning(f"SECURITY BLOCK: Customer attempted to execute {draft_obj.get('type')}")
        await save_chat_message(user_id, "user", last_msg)
        apology_msg = "Sorry, as a store assistant, I can only help you place new orders. I cannot modify stock, change prices, or view other customer details."
        await save_chat_message(user_id, "assistant", apology_msg)
        return {"messages": [AIMessage(content=apology_msg)]}

    # Save Draft to Local DB when using local AI
    is_cloud_llm = "llama-4" in selected_model or "maas" in selected_model
    use_local_data = not is_cloud_llm
    if draft_obj and local_db and use_local_data:
        try:
             # Use the new generic action draft saver
             local_db.save_action_draft_local(draft_obj, user_id)
             print(f"DEBUG: Saved {draft_obj.get('type')} to Local DB")
        except Exception as e:
             print(f"ERROR saving local draft: {e}")

    # Validate Draft - If empty, apologize instead of lying
    final_text = response.content
    
    print(f"DEBUG DRAFT OBJ BEFORE CHECK: {draft_obj}")
    
    # --- DRAFT FIELD VALIDATION ---
    # Ensure all required fields are present and non-empty before showing draft
    def validate_draft_json(d):
        """
        Validate that a draft JSON has all required fields filled.
        Returns (is_valid: bool, error_msg: str)
        """
        dtype = d.get("type", "")
        
        if dtype == "invoice_draft":
            items = d.get("items", [])
            if not items:
                return False, "No items found in the invoice. Please specify products and quantities."
            for item in items:
                pname = item.get("product_name", "")
                qty = item.get("quantity", 0)
                if not pname or not str(pname).strip():
                    return False, "One or more items are missing a product name."
                if not qty or qty <= 0:
                    return False, f"Product '{pname}' has an invalid quantity."
                # Ensure price field exists (can be 0, system will look it up)
                if "price" not in item:
                    item["price"] = 0
            return True, ""
        
        elif dtype == "payment_draft":
            cname = d.get("customer_name", "")
            amount = d.get("amount", 0)
            ptype = d.get("payment_type", "")
            if not cname or not str(cname).strip():
                return False, "Customer name is missing for the payment."
            if not amount or float(amount) <= 0:
                return False, "Payment amount is missing or zero."
            if ptype not in ("payment", "due", "credit"):
                return False, f"Invalid payment_type '{ptype}'. Must be 'payment' or 'due'."
            return True, ""
        
        elif dtype == "customer_draft":
            cname = d.get("name", "")
            if not cname or not str(cname).strip():
                return False, "Customer name is missing."
            return True, ""
        
        elif dtype == "product_draft":
            pname = d.get("name", "")
            sp = d.get("selling_price", None)
            if not pname or not str(pname).strip():
                return False, "Product name is missing."
            if sp is None:
                return False, "Selling price is missing for the product."
            return True, ""
        
        elif dtype == "restock_draft":
            pname = d.get("product_name", "")
            qty = d.get("quantity_to_add", 0)
            if not pname or not str(pname).strip():
                return False, "Product name is missing for restock."
            if not qty or qty <= 0:
                return False, "Restock quantity is missing or zero."
            return True, ""
            
        elif dtype == "bulk_product_draft":
            items = d.get("items", [])
            if not items:
                return False, "No items found in the list. Please upload a clear image or list."
            for item in items:
                pname = item.get("name", "")
                if not pname or not str(pname).strip():
                    return False, "One or more items in the bulk list are missing a product name."
            return True, ""
        
        elif dtype == "unknown" or not dtype:
            return False, "Could not determine the action type."
        
        return True, ""  # Unknown but non-empty type, allow through
    
    if not draft_obj or "type" not in draft_obj or draft_obj.get("type") == "unknown":
        print("WARN Draft generation failed or was unknown type.")
        final_text = "Sorry, I couldn't understand the details for that draft. Could you please repeat with more specific information?"
        draft_obj = {}
    else:
        # Run field validation
        is_valid, validation_error = validate_draft_json(draft_obj)
        if not is_valid:
            print(f"WARN Draft validation failed: {validation_error}")
            final_text = f"I couldn't create the draft — {validation_error} Please try again with the missing details."
            draft_obj = {}

    final_payload = {
        "text": final_text,
        "draft": draft_obj
    }
    
    return {"messages": [AIMessage(content=json.dumps(final_payload))]}

async def chat_node(state: AgentState):
    """
    Chat Agent: Handles Q&A, SQL Data Retrieval, and Greetings
    """
    messages = state['messages']
    last_msg = messages[-1].content
    user_token = state.get('user_token', '')
    selected_model = state.get("model", "llama-4-scout-17b-16e-instruct-maas")
    role = state.get("role", "owner")
    
    # User ID Resolution
    user_id = user_token if user_token and len(user_token) < 50 else "unknown_user"
    if not user_id or "default" in user_id.lower() or "test" in user_id.lower() or user_id == "unknown_user":
        user_id = "00000000-0000-0000-0000-000000000000"
        
    business_name = await get_user_profile(user_id)
    
    # History for context
    chat_history = await get_chat_history(user_id, limit=10)
    history_text = "\n".join([f"{msg['role'].capitalize()}: {msg['message']}" for msg in chat_history])
    
    msg_lower = last_msg.lower().strip()
    category = categorize_query(msg_lower)
    
    logger.info(f"DEBUG CHAT NODE: category={category}, model={selected_model}")

    # Detect language for response (English or Hinglish only)
    detected_lang = detect_language(last_msg)
    print(f"DEBUG: Detected language: {detected_lang}")

    # is_cloud_llm: True = use Vertex AI / Llama-4 for generation
    # use_local_data: True = read data from SQLite (local model)
    is_cloud_llm = "llama-4" in selected_model or "maas" in selected_model
    use_local_data = not is_cloud_llm
    
    # LOCAL MODEL FAST PATH: Hardcoded responses for predictable categories
    # Only skip LLM for simple queries when actually using a local/offline model
    if not is_cloud_llm and category in ("GREETING", "IDENTITY", "CAPABILITY"):
        import random
        
        local_responses = {
            "GREETING": [
                "Namaste, how can I help you today?",
                "Hello, what can I do for you?",
                "Namaste, ready to assist you!",
            ],
            "IDENTITY": [
                f"Namaste! I am the AI assistant for {business_name}.",
                f"Hello! I am the AI assistant for {business_name}."
            ],
            "CAPABILITY": [
                "I can help you with: Making Invoices, Tracking Inventory, Managing Customers, Recording Payments, and Answering business questions.",
            ],
        }
        
        hardcoded_text = random.choice(local_responses[category])
        print(f"DEBUG: Used hardcoded local response for {category}")
        
        if True:
            await save_chat_message(user_id, "user", last_msg)
            await save_chat_message(user_id, "assistant", hardcoded_text)
        
        return {"messages": [AIMessage(content=hardcoded_text)]}
    
    # CLOUD MODEL or CHAT/BUSINESS: Use LLM
    
    # Build local DB context snapshot when reading from SQLite
    local_db_context = ""
    # Only load the entire DB context if the query is strictly business-related to save tokens
    if use_local_data and local_db and category == "BUSINESS":
        try:
            local_products = local_db.get_products_local(user_id)
            local_customers = local_db.get_customers_local(user_id)
            local_sales = local_db.get_invoices_local()
            
            # Summarize Stats (Only for owner)
            total_rev = sum(s.get('total_amount', 0) for s in local_sales)
            total_dues = sum(c.get('credit_balance', 0) for c in local_customers)
            low_stock = [p.get('name') for p in local_products if p.get('stock_quantity', 0) <= 5]
            
            if role == "customer":
                # Clean product lines - no price/stock details, just availability
                prod_lines = [
                    f"- {p.get('name','?')} | ₹{p.get('selling_price','?')} | Status: {'In Stock' if p.get('stock_quantity', 0) > 0 else 'Out of Stock'}"
                    for p in local_products[:15]
                ]
                cust_lines = [] # Hide ledger
                
                local_db_context = "\n\n[OFFLINE STORE DATA]\n"
                if prod_lines:
                    local_db_context += "AVAILABLE ITEMS:\n" + "\n".join(prod_lines)
            else:
                prod_lines = [
                    f"- {p.get('name','?')} | ₹{p.get('selling_price','?')} | Stock: {p.get('stock_quantity','?')}"
                    for p in local_products[:15]
                ]
                cust_lines = [
                    f"- {c.get('name','?')} | Due: ₹{c.get('credit_balance', 0)}"
                    for c in local_customers[:20]
                ]
                
                local_db_context = f"\n\n[OFFLINE DATA]\n"
                local_db_context += f"- Revenue Today: ₹{total_rev}\n"
                local_db_context += f"- Total Dues: ₹{total_dues}\n"
                local_db_context += f"- Total Sales: {len(local_sales)}\n"
                local_db_context += f"- Customers: {', '.join([c.get('name') for c in local_customers]) if local_customers else 'None'}\n"
                if low_stock:
                    local_db_context += f"- Low Stock: {', '.join(low_stock)}\n"
                
                if prod_lines:
                    local_db_context += "\nINVENTORY:\n" + "\n".join(prod_lines)
                if cust_lines:
                    local_db_context += "\n\nLEDGER:\n" + "\n".join(cust_lines)

        except Exception as e:
            print(f"WARN: Could not load local DB context: {e}")

    PERSONA_LOCK = (
        f"PERSONA: Professional shop manager and assistant for {business_name}. "
        f"IMPORTANT: You are talking to the SHOP OWNER/BOSS. Do NOT assume the user is "
        f"one of the customers listed in the ledger. Address the user as 'Boss' or 'Sir'. "
        f"DATE: {datetime.now().strftime('%d %b %Y')}. "
        f"{VOICE_RULES} "
        f"Respond in {'Hinglish (Hindi written in English text)' if detected_lang == 'hinglish' else 'clear English'}."
    )
    if role == "customer":
        PERSONA_LOCK = (
            f"PERSONA: Welcoming customer-facing assistant for {business_name}. "
            f"No profit/cost prices. Say available/out instead of stock numbers. "
            f"DATE: {datetime.now().strftime('%d %b %Y')}. {VOICE_RULES}"
        )

    if category == "GREETING":
        input_prompt = (
            f"SYSTEM: {PERSONA_LOCK}\n"
            f"GOAL: Give a warm greeting in 1 sentence."
        )
    elif category == "CAPABILITY":
        input_prompt = (
            f"SYSTEM: {PERSONA_LOCK}\n"
            f"GOAL: In 1-2 sentences list what you can do: Bill, Inventory, Customers, Dues, Payments."
        )
    elif category == "IDENTITY":
        input_prompt = (
            f"SYSTEM: {PERSONA_LOCK}\n"
            f"GOAL: In 1 sentence say you are the AI assistant for {business_name}."
        )
    elif category == "CHAT":
        input_prompt = (
            f"SYSTEM: {PERSONA_LOCK}\n"
            f"USER: \"{last_msg}\"\n"
            f"GOAL: Natural helpful reply. MAX 2 sentences."
        )
    else:  # BUSINESS / Fallback
        # Data Retrieval
        if is_cloud_llm and not use_local_data:
            sql_query = await generate_sql_query(last_msg, user_id, history_context=history_text, model=selected_model, role=role)
            specialist_data = await execute_sql(sql_query)
        else:
            specialist_data = local_db_context if local_db_context else "No local data available."

        if role == "customer":
            input_prompt = (
                f"SYSTEM: {PERSONA_LOCK}\n"
                f"DATA SNAPSHOT: {specialist_data}\n"
                f"USER: \"{last_msg}\"\n"
                f"GOAL: Answer using DATA SNAPSHOT. Only tell the customer if items are in-stock or out-of-stock, NEVER disclose exact stock count or cost price. Help them place orders. MAX 2 sentences."
            )
        else:
            input_prompt = (
                f"SYSTEM: {PERSONA_LOCK}\n"
                f"DATA SNAPSHOT (GROUND TRUTH): {specialist_data}\n"
                f"USER: \"{last_msg}\"\n"
                f"GOAL: Answer using DATA SNAPSHOT. If quantities or amounts in SNAPSHOT contradict conversation history, TRUST THE SNAPSHOT. MAX 2 sentences."
            )

    llm = get_llm(selected_model)

    # For local/offline models, prepend a strict direct-answer prefix
    if not is_cloud_llm:
        input_prompt = (
            f"SYSTEM: Shop assistant. DIRECT ANSWER ONLY. NO ROLES. {VOICE_RULES}\n"
            + input_prompt
        )

    # Check for multimodal image context
    import re
    match = re.search(r'\[IMAGE CONTEXT:\s*(https?://[^\s\]]+)]', input_prompt)
    message_content = input_prompt
    if match:
        img_url = match.group(1).strip()
        clean_prompt = input_prompt.replace(match.group(0), "").strip()
        message_content = [
            {"type": "text", "text": clean_prompt},
            {"type": "image_url", "image_url": {"url": img_url}}
        ]

    response = await llm.ainvoke([HumanMessage(content=message_content)])
    
    # Save to history
    await save_chat_message(user_id, "user", last_msg)
    await save_chat_message(user_id, "assistant", response.content)
    
    return {"messages": [response]}

# --- GRAPH ---

def route_conditional(state: AgentState):
    """
    Conditional Edge Logic
    """
    # We re-run categorization here or pull from state if we stored it
    # Ideally router_node should write to a key in state, but TypedDict needs that key.
    # For simplicity, let's re-eval or just check the last message.
    # But wait, router_node returns a dict, handled by LangGraph as state update?
    # Actually, simpler pattern: Router IS the conditional edge function.
    
    messages = state['messages']
    last_msg = messages[-1].content.lower().strip()
    
    if state.get("category") == "BLOCKED":
        return "blocked"
        
    # 1. Context Awareness: Check if Bot asked for details in previous message
    if len(messages) >= 2:
        last_bot_msg = messages[-2].content.lower() if hasattr(messages[-2], 'content') else ""
        
        # If bot ended with a question about items/details, FORCE ACTION
        # e.g. "what items?", "tell me product details", "provide customer name"
        context_triggers = ["what items", "provide details", "which product", "customer name"]
        if any(trigger in last_bot_msg for trigger in context_triggers):
            print(f"DEBUG: Router -> Context Override (Bot asked '{last_bot_msg[-20:]}...') -> ACTION")
            return "action_agent"

    # 2. Standard Keyword Categorization
    category = categorize_query(last_msg)
    
    if category == "ACTION":
        return "action_agent"
    else:
        return "chat_agent"

# Redefine AgentState to include internal keys if needed, but 'messages' is enough for now.
# We will use a standard compiled graph.

workflow = StateGraph(AgentState)

# Add Nodes
workflow.add_node("safety_guard", safety_guard_node)
workflow.add_node("action_agent", action_node)
workflow.add_node("chat_agent", chat_node)

# Set Entry Point -> Safety Guard First
workflow.set_entry_point("safety_guard")

# Edges
workflow.add_conditional_edges(
    "safety_guard",
    route_conditional,
    {
        "action_agent": "action_agent",
        "chat_agent": "chat_agent",
        "blocked": END  # If guard blocked it, we can just end (or map it to a blocked node if we wanted, but returning custom message from guarded or routed node is also fine. Wait, route_conditional needs to handle BLOCKED)
    }
)
workflow.add_edge("action_agent", END)
workflow.add_edge("chat_agent", END)

# Compile
app = workflow.compile()

# ─── Memory Store with TTL ──────────────────────────────────────────────────
# Keyed by session_id → {"messages": [...], "last_active": datetime}
MEMORY_STORE: dict = {}
MEMORY_TTL_HOURS = 2      # Evict sessions idle for > 2 hours
MEMORY_MAX_SESSIONS = 200  # Hard cap — evict oldest if exceeded


def _evict_stale_sessions():
    """Remove sessions that have been idle past TTL, then cap total count."""
    now = datetime.now(timezone.utc)
    stale = [
        sid for sid, s in MEMORY_STORE.items()
        if (now - s["last_active"]).total_seconds() > MEMORY_TTL_HOURS * 3600
    ]
    for sid in stale:
        del MEMORY_STORE[sid]
    # Hard cap: evict oldest by last_active
    while len(MEMORY_STORE) >= MEMORY_MAX_SESSIONS:
        oldest = min(MEMORY_STORE, key=lambda s: MEMORY_STORE[s]["last_active"])
        del MEMORY_STORE[oldest]

async def process_user_input(
    text: str,
    user_token: str,
    model: str = "llama-4-scout-17b-16e-instruct-maas",
    role: str = "owner",
) -> str:
    """
    Main entry point for Sathi AI.
    """
    global MEMORY_STORE

    session_id = hashlib.sha256(user_token.encode()).hexdigest()[:16]
    now = datetime.now(timezone.utc)

    # Evict stale / overflow sessions on each call
    _evict_stale_sessions()

    if session_id not in MEMORY_STORE:
        MEMORY_STORE[session_id] = {"messages": [], "last_active": now}

    session = MEMORY_STORE[session_id]
    memory = session["messages"]
    memory.append(HumanMessage(content=text))

    # Sliding window: keep only last 15 messages
    if len(memory) > 15:
        memory = memory[-15:]

    session["last_active"] = now

    inputs = {
        "messages": memory,
        "language": "hi-EN",
        "user_token": user_token,
        "model": model,
        "role": role,
    }

    try:
        print(f"DEBUG: Invoking Agent Graph for session {session_id}...")
        result = await app.ainvoke(inputs)

        if result and "messages" in result and len(result["messages"]) > 0:
            ai_response = result["messages"][-1].content
        else:
            ai_response = "Sorry, I am having trouble thinking right now."

        memory.append(AIMessage(content=ai_response))
        session["last_active"] = datetime.now(timezone.utc)
        return ai_response

    except Exception as e:
        logger.error(f"CRITICAL ERROR in process_user_input: {e}", exc_info=True)
        return "Sorry, my brain is offline."


def clear_user_memory(user_token: str):
    """Clear conversation history for a user (e.g., on logout)."""
    session_id = hashlib.sha256(user_token.encode()).hexdigest()[:16]
    if session_id in MEMORY_STORE:
        del MEMORY_STORE[session_id]
        print(f"INFO: Cleared memory for session {session_id}")
