"""
File: agent_graph.py
Purpose: Moltbot - Gemini-powered AI agent for Dukan Sathi
Author: Dukan Sathi Team
Created: 2026-02-05

This is the brain of Dukan Sathi. It uses:
- Google Gemini 2.0 Flash via Vertex AI for natural language understanding
- LangGraph for conversation flow management
- SQL generation for database queries
- Draft workflow for invoice/inventory approvals

Why Gemini instead of Claude:
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
    logger.error("CRITICAL: Supabase credentials missing. Cannot initialize client.")
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")

supabase: Client = create_client(url, key)

# Context keywords for query categorization
contextual_pronouns = ["this", "that", "it", "them", "him", "her"]
action_keywords = ["create", "add", "new", "make a", "draft", "register"]
business_keywords = ["price", "cost", "stock", "inventory", "sale", "customer", "profit", "loss", "revenue", "bill", "invoice"]


# Database schema for AI context - this helps Gemini understand our data structure
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
    """
    State object passed between nodes in the conversation graph
    
    messages: Full conversation history
    language: User's preferred language (hi-EN for Hinglish)
    user_token: Supabase auth token for RLS
    category: Intent category (ACTION/CHAT) - used by Router
    """
    messages: list
    language: str
    user_token: str
    category: str
    model: str

from functools import lru_cache

@lru_cache(maxsize=4)
def get_llm(model_name: str = "gemini-2.0-flash-001"):
    """
    Get or create a cached Gemini LLM instance.
    Attributes are cached so we don't re-auth on every token.
    """
    try:
        # Check if model is a Local Model (Ollama)
        if "gemini" not in model_name:
            print(f"DEBUG: Using Local LLM (Ollama) -> {model_name}")
            return ChatOllama(
                model=model_name,
                base_url="http://127.0.0.1:11434",
                temperature=0.1,
                num_predict=256,
            )

        # Load service account credentials
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "service_account.json")
        
        # Try to find credentials if default path doesn't exist
        if not os.path.exists(creds_path):
             # Check backend folder relative to CWD or script
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
            creds = None
            project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
            if not project_id:
                raise ValueError("GCP Project ID not found. Set GOOGLE_CLOUD_PROJECT or provide service_account.json.")
        else:
            creds = service_account.Credentials.from_service_account_file(creds_path)
            project_id = creds.project_id
        
        # Create Gemini client
        return ChatVertexAI(
            model_name=model_name,
            project=project_id,
            location="us-central1",
            credentials=creds,
            temperature=0.7 
        )
    except Exception as e:
        print(f"ERROR initializing LLM ({model_name}): {e}")
        # Return a fallback or re-raise
        raise e

# No global llm anymore
# llm = init_gemini_llm()


async def generate_sql_query(user_query: str, user_id: str, history_context: str = "", model: str = "gemini-2.0-flash-001") -> str:
    """
    Generate a SQL query from natural language using Gemini
    """
    prompt = f"""
    You are a SQL expert for a PostgreSQL database.
    
    SCHEMA:
    {DATABASE_SCHEMA}
    
    USER QUERY: "{user_query}"
    USER_ID: "{user_id}"
    
    RECENT CONVERSATION HISTORY (Use this to resolve pronouns like 'they', 'it', 'them'):
    {history_context if history_context else "(No recent history)"}
    
    INSTRUCTIONS:
    1. Generate a valid PostgreSQL SELECT query.
    2. ALWAYS filter by `user_id = '{user_id}'` for every table accessed.
    3. Return ONLY the SQL query. No markdown, no explanations.
    4. Cast UUIDs properly if needed, but usually 'string' works in Postgres text-to-uuid.
    5. Handle case-insensitive string matching using ILIKE for names.
    6. If asking for "sales", join sales and sale_items and products if needed.
    7. Use LIMIT to prevent large result sets (default LIMIT 50 for lists).
    
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
    SYSTEM: You are a SQLite expert for Dukan Sathi. 
    Output the SLQ SELECT query ONLY. No markdown, no explanations.

    TABLES:
    1. products (id, name, selling_price, stock_quantity, category)
    2. customers (id, name, phone, credit_balance)

    SCHEMA NOTES:
    - Products: use name, selling_price, stock_quantity
    - Customers: use name, phone, credit_balance

    TASK: Convert user request to SQLite.
    QUERY: "{user_query}"

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
    # Remove punctuation and split
    clean_msg = re.sub(r'[^\w\s]', '', msg_lower)
    words = set(clean_msg.split())
    
    # Remove punctuation and split
    clean_msg = re.sub(r'[^\w\s]', '', msg_lower)
    words = set(clean_msg.split())
    
    # DEBUG: Log words
    print(f"DEBUG CATEGORY words: {words}")
    
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
        "customer", "client", "buyer", "sale", "sell", "sold", "bill", "invoice", "receipt",
        "draft", "order", "purchase", "revenue", "profit", "loss", "expense", "total", "amount",
        "kitna", "batao", "dikhao", "check", "verify", "find", "search", "lookup", "fetch",
        "list", "report", "summary", "count", "number", "how many", "status", "due", "pending",
        "paid", "payment", "transaction", "history", "record", "entry", "data", "info", "details",
        "add", "update", "create", "make", "delete", "remove", "edit", "change", "save",
        "who bought", "what did", "product", "item", "good", "service", "sku", "code",
        "spend", "spent", "credit", "balance", "money", "cash", "upi", "card", "bank",
        "products", "items", "bills", "invoices", "orders" 
    ]

    # Identity inquiry patterns
    identity_keywords = [
        "what is your name", "who are you", "your name", "tumhara naam", 
        "aapka naam", "who am i talking to", "identity", "intro", "introduction"
    ]
    
    # Action intent patterns (High priority for create/update)
    action_keywords = ["create", "add", "new", "make a", "draft", "register", "record", "pay", "paid", "receive", "received", "payment", "bill", "invoice"]
    
    # Check for contextual pronouns first (high priority for follow-ups)
    # Use strict word matching
    if any(cp in words for cp in contextual_pronouns):
        return "BUSINESS"
        
    # Check for Action intents - check if ANY action keyword is in the message (substring allows "creating")
    # But for "add", we want strictness. Let's use word matching for all for consistency.
    if any(k in words for k in action_keywords):
        return "ACTION"
    
    # Check for exact greeting matches
    if any(msg_lower.startswith(k) or msg_lower == k for k in greeting_keywords):
        return "GREETING"
    
    # Check for identity inquiries
    if any(k in msg_lower for k in identity_keywords):
        return "IDENTITY"
    
    # Check for capability inquiries
    if any(k in msg_lower for k in capability_keywords):
        return "CAPABILITY"
    
    # Check for business queries
    print(f"DEBUG: Checking business keywords against {words}")
    if any(k in words for k in business_keywords):
        print("DEBUG: Found business keyword")
        return "BUSINESS"
    
    # Job/Career inquiries (often mistaken for business)
    if "hiring" in msg_lower or "job" in msg_lower or "vacancy" in msg_lower or "career" in msg_lower:
        return "CHAT"

    # Default to CHAT for general conversation
    return "CHAT"


async def extract_action_params(user_query: str, history_context: str = "", model: str = "gemini-2.0-flash-001") -> str:
    """
    Extract structured JSON parameters for an action using Gemini
    """
    prompt = f"""
    You are an AI data extractor for a shop management system.
    
    USER QUERY: "{user_query}"
    HISTORY: "{history_context}"
    
    YOUR JOB: Extract parameters to create a DRAFT for the requested action.
    
    OUTPUT FORMAT: Return STRICT JSON only. No markdown.
    
    SCENARIO 1: Create Invoice / Bill / Sale
    Required keys: 
    - "type": "invoice_draft"
    - "customer_name": string or null
    - "items": Array of objects, each MUST have:
        - "product_name": string (Exact product name from query)
        - "quantity": number (Default 1)
        - "price": number (Default 0, do NOT use null)
        - "tax_percent": 0
        - "hsn_code": ""
    
    IMPORTANT: For invoices, always set "price": 0 unless the user explicitly attempts to override it. The system will look up the real price from the database.
    
    SCENARIO 2: Add Product / Inventory
    Required keys: "type": "product_draft", "name", "selling_price", "cost_price", "stock_quantity", "category"
    
    SCENARIO 3: Add Customer
    Required keys: "type": "customer_draft", "name", "phone", "address"

    SCENARIO 4: Update Dues / Record Payment
    Required keys: "type": "payment_draft", "customer_name", "amount", "mode" (Default 'Cash')
    
    Example 1: "Make a bill for Amit 2kg Rice and 1 Oil"
    JSON: {{ "type": "invoice_draft", "customer_name": "Amit", "items": [{{ "product_name": "Rice", "quantity": 2, "price": 0, "tax_percent": 0, "hsn_code": "" }}, {{ "product_name": "Oil", "quantity": 1, "price": 0, "tax_percent": 0, "hsn_code": "" }}] }}
    
    Example 2: "Add new product Sunsilk Shampoo price 150 stock 10"
    JSON: {{ "type": "product_draft", "name": "Sunsilk Shampoo", "selling_price": 150, "stock_quantity": 10, "category": "General" }}

    Example 3: "Amit paid 500 rupees"
    JSON: {{ "type": "payment_draft", "customer_name": "Amit", "amount": 500, "mode": "Cash" }}
    
    If query is vague, return {{ "type": "unknown", "error": "Missing details" }}
    """
    
    try:
        # Use Flash for SQL gen as it's faster
        llm = get_llm(model)
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        
        # DEBUG: Print raw response
        print(f"DEBUG: extract_action_params RAW RESPONSE: {response.content}")

        # Robust JSON extraction using regex
        content = response.content
        match = re.search(r'\{.*\}', content, re.DOTALL)
        json_str = match.group(0) if match else content.replace("```json", "").replace("```", "").strip()
        
        # ATTEMPT 1: Direct JSON Parse
        try:
            # Check if valid JSON
            import json
            json.loads(json_str)
            return json_str
        except:
            pass
            
        # ATTEMPT 2: AST Literal Eval (Handles single quotes like Python dicts)
        try:
            import ast
            # Only if it looks like a dict
            if json_str.strip().startswith("{"):
                print("DEBUG: JSON Parse failed, trying ast.literal_eval for single quotes...")
                py_dict = ast.literal_eval(json_str)
                return json.dumps(py_dict)
        except Exception as ast_err:
            print(f"DEBUG: AST eval failed: {ast_err}")

        return json_str
    except Exception as e:
        print(f"ERROR extracting params: {e}")
        return "{}"

async def get_user_profile(user_id: str) -> str:
    """
    Fetch user's business name from profiles table
    """
    try:
        if not supabase:
            return "Dukan Sathi"
        response = supabase.table("profiles").select("business_name").eq("id", user_id).execute()
        if response.data and len(response.data) > 0:
            return response.data[0].get("business_name", "Dukan Sathi")
        return "Dukan Sathi"
    except Exception as e:
        print(f"ERROR: Failed to fetch profile: {e}")
        return "Dukan Sathi"

def fast_parse_action(user_query: str) -> str:
    """
    Regex-based fast parser for common action patterns.
    Skips the LLM entirely for well-structured commands.
    Returns JSON string or None if no pattern matched.
    """
    import json
    q = user_query.strip()
    ql = q.lower()

    # --- PATTERN 1: Add Product ---
    # "add product potato price 50 qty 20" / "new product X price Y quantity Z"
    # Expanded to support CP: "price 20 cp 15 stock 50"
    product_pattern = re.search(
        r'(?:add|new|create)\s+(?:a\s+)?(?:new\s+)?(?:product|item)\s+(.+?)\s+(?:price|rate|mrp|rs|₹)\s+(\d+(?:\.\d+)?)',
        ql
    )
    if product_pattern:
        name = product_pattern.group(1).strip().title()
        selling_price = float(product_pattern.group(2))
        
        # Optional: Extract Stock
        stock_match = re.search(r'(?:stock|qty|quantity)\s+(\d+)', ql)
        stock_quantity = int(stock_match.group(1)) if stock_match else 0
        
        # Optional: Extract Cost Price (CP)
        cp_match = re.search(r'(?:cp|cost|buying|buy)\s+(?:price|rate)?\s*(?:rs\.?\s*|₹\s*)?(\d+(\.\d+)?)', ql)
        cost_price = float(cp_match.group(1)) if cp_match else 0.0

        return json.dumps({
            "type": "product_draft",
            "name": name,
            "selling_price": selling_price,
            "cost_price": cost_price,
            "stock_quantity": stock_quantity,
            "category": "General"
        })

    # --- PATTERN 2: Add Customer ---
    # "add customer rahul contact 3434343423" / "new customer X phone Y"
    customer_pattern = re.search(
        r'(?:add|new|create|register)\s+(?:a\s+)?(?:new\s+)?customer\s+([\w\s]+?)\s+(?:contact|phone|number|mobile|no)\s+([\d]+)',
        ql
    )
    if customer_pattern:
        name = customer_pattern.group(1).strip().title()
        phone = customer_pattern.group(2).strip()
        return json.dumps({
            "type": "customer_draft",
            "name": name,
            "phone": phone,
            "address": ""
        })

    # --- PATTERN 3: Payment ---
    # "amit paid 500" / "received 200 from rahul"
    payment_pattern1 = re.search(
        r'([\w\s]+?)\s+(?:paid|gave|returned)\s+(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d+)?)',
        ql
    )
    if payment_pattern1:
        name = payment_pattern1.group(1).strip().title()
        amount = float(payment_pattern1.group(2))
        # Filter out action keywords that might be captured as name
        if name.lower() not in ['i', 'he', 'she', 'they', 'we', 'add', 'create', 'new', 'make']:
            return json.dumps({
                "type": "payment_draft",
                "customer_name": name,
                "amount": amount,
                "mode": "Cash"
            })

    payment_pattern2 = re.search(
        r'(?:received|got)\s+(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d+)?)\s+(?:from)\s+([\w\s]+)',
        ql
    )
    if payment_pattern2:
        amount = float(payment_pattern2.group(1))
        name = payment_pattern2.group(2).strip().title()
        return json.dumps({
            "type": "payment_draft",
            "customer_name": name,
            "amount": amount,
            "mode": "Cash"
        })

    # --- PATTERN 4: Invoice / Bill ---
    # "bill for amit 2 rice and 1 oil" / "create bill for X ..."
    invoice_pattern = re.search(
        r'(?:bill|invoice|sale)\s+(?:for|to)\s+([\w]+)',
        ql
    )
    if invoice_pattern:
        customer = invoice_pattern.group(1).strip().title()
        # Extract items: "2 rice", "1 oil", etc.
        items_raw = re.findall(r'(\d+)\s+([\w]+)', ql)
        items = []
        skip_words = {'for', 'to', 'and', 'with', 'rs', 'rupees', customer.lower()}
        for qty_str, prod in items_raw:
            if prod.lower() not in skip_words and not prod.isdigit():
                items.append({
                    "product_name": prod.title(),
                    "quantity": int(qty_str),
                    "price": 0
                })
        if items:
            return json.dumps({
                "type": "invoice_draft",
                "customer_name": customer,
                "items": items
            })

    # --- PATTERN 5: Dues / Credit specific ---
    # "add 500 due to amit" -> Give Credit (Red)
    add_due_pattern = re.search(
        r'(?:add|give)\s+(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d+)?)\s+(?:due|credit|udhar)\s+(?:to|for)\s+([\w\s]+)',
        ql
    )
    if add_due_pattern:
         amount = float(add_due_pattern.group(1))
         name = add_due_pattern.group(2).strip().title()
         # Give Credit = Add Due. Default to 'Credit' mode.
         # ActionCard logic: Positive amount defaults to 'credit' (Red)
         return json.dumps({
            "type": "payment_draft",
            "customer_name": name,
            "amount": amount,
            "mode": "Cash"
        })

    # "deduct 500 from amit due" -> Receive Payment (Green)
    deduct_due_pattern = re.search(
        r'(?:deduct|reduce|cut|remove|clear)\s+(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d+)?)\s+(?:from|of)\s+([\w\s]+?)(?:\s+due|\s+credit|\s+udhar|$)',
        ql
    )
    if deduct_due_pattern:
         amount = float(deduct_due_pattern.group(1))
         name = deduct_due_pattern.group(2).strip().title()
         # Deduct Due = Payment. Default to 'Payment' mode.
         # ActionCard logic: Negative amount defaults to 'payment' (Green)
         return json.dumps({
            "type": "payment_draft",
            "customer_name": name,
            "amount": -amount, 
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
    prompt = f"""Extract JSON. No text. No explanation.

User: Bill for Raj 2 Rice
JSON: {{ "type": "invoice_draft", "customer_name": "Raj", "items": [ {{ "product_name": "Rice", "quantity": 2 }} ] }}

User: Add milk price 50
JSON: {{ "type": "product_draft", "name": "milk", "selling_price": 50, "stock_quantity": 0, "category": "General" }}

User: New customer Amit 9988776655
JSON: {{ "type": "customer_draft", "name": "Amit", "phone": "9988776655", "address": "" }}

User: Amit paid 500
JSON: {{ "type": "payment_draft", "customer_name": "Amit", "amount": 500, "mode": "Cash" }}

User: {user_query}
JSON:"""
    try:
        llm = get_llm(model)
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        
        print(f"DEBUG LOCAL EXTRACT RAW: {response.content}")

        content = response.content
        
        # Robust Brace Counting Extractor
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
        
        # Cleanup markdown if present
        json_str = json_str.replace("```json", "").replace("```", "").replace("'", '"')
        
        # Remove trailing commas (common local model error)
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
        
        return json_str
    except Exception as e:
        print(f"ERROR Local Extraction: {e}")
        return "{}"

# --- NODES ---

async def router_node(state: AgentState):
    """
    Router Node: Decides whether to go to Action Agent or Chat Agent
    """
    messages = state['messages']
    last_msg = messages[-1].content.lower().strip()
    
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
    selected_model = state.get("model", "gemini-2.0-flash-001")
    
    # User ID Resolution
    user_id = user_token if user_token and len(user_token) < 50 else "unknown_user"
    if not user_id or "default" in user_id.lower() or "test" in user_id.lower() or user_id == "unknown_user":
        user_id = "00000000-0000-0000-0000-000000000000"
    
    # History for context
    chat_history = await get_chat_history(user_id, limit=5)
    history_text = "\n".join([f"{msg['role'].capitalize()}: {msg['message']}" for msg in chat_history])
    
    print("DEBUG: Executing Action Node")
    
    # FAST PATH: Try regex parser first (instant, works for both cloud and local)
    action_json_str = fast_parse_action(last_msg)
    if action_json_str:
        print(f"DEBUG: FAST PARSE SUCCESS (action_node): {action_json_str}")
    else:
        # SLOW PATH: Fall back to LLM extraction
        if "gemini" in selected_model:
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
                
                if supabase and prod_name and "gemini" in selected_model:
                    try:
                        # Sanitize product name for search safely
                        safe_name = re.sub(r'[^\w\s]', '', prod_name) # Remove special chars
                        
                        if safe_name:
                             # Strategy: Exact/Case-Insensitive Match ONLY to avoid 500 Errors
                             try:
                                 # Try 1: Case-insenstive exact match
                                 res = supabase.table("products").select("selling_price, id, name, tax_percent, hsn_code").ilike("name", safe_name).eq("user_id", user_id_local).limit(1).execute()
                                 
                                 # Try 2: If no data, maybe simple EQ? (Usually covered by ilike but just in case)
                                 if not res.data:
                                     res = supabase.table("products").select("selling_price, id, name, tax_percent, hsn_code").eq("name", safe_name).eq("user_id", user_id_local).limit(1).execute()
                             
                             except Exception as search_err:
                                 logger.error(f"DEBUG: Search query failed for {safe_name}: {search_err}")
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

                elif local_db and prod_name and "gemini" not in selected_model:
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
        "invoice_draft": "Sure Boss, I've prepared the invoice draft. Please review and approve.",
        "product_draft": "Sure Boss, I've prepared the product draft. Please review and approve.",
        "customer_draft": "Sure Boss, I've prepared the customer details. Please review and approve.",
        "payment_draft": "Sure Boss, I've prepared the payment record. Please review and approve.",
    }
    confirmation_text = confirmation_templates.get(draft_type, "Sure Boss, I've prepared the draft. Please review and approve.")
    
    class _FakeResponse:
        def __init__(self, c): self.content = c
    response = _FakeResponse(confirmation_text)
    print(f"DEBUG: Used hardcoded confirmation (type={draft_type})")
    
    # Save to history (Just the text)
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
            else:
                draft_obj["draft_type"] = "generic"
    except Exception as e:
        print(f"ERROR JSON Parse Error in Action Node: {e} | Content: {updated_json_str}")
        import traceback
        traceback.print_exc()
        draft_obj = {}

    # Save Draft to Local DB if Offline (All types supported)
    if draft_obj and local_db and "gemini" not in selected_model:
        try:
             # Use the new generic action draft saver
             local_db.save_action_draft_local(draft_obj, user_id)
             print(f"DEBUG: Saved {draft_obj.get('type')} to Local DB")
        except Exception as e:
             print(f"ERROR saving local draft: {e}")

    # Validate Draft - If empty, apologize instead of lying
    final_text = response.content
    
    print(f"DEBUG DRAFT OBJ BEFORE CHECK: {draft_obj}")
    
    if not draft_obj or "type" not in draft_obj or draft_obj.get("type") == "unknown":
        print("WARN Draft generation failed or was unknown type.")
        final_text = "Sorry Boss, I couldn't understand the details for that draft. Could you please repeat with more specific information?"
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
    selected_model = state.get("model", "gemini-2.0-flash-001")
    
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

    # Language-specific instructions — only English and Hinglish supported
    LANG_STRICT_RULE = "STRICT RULE: You MUST respond ONLY in English or Hinglish (Hindi words written in Roman/English letters). NEVER use Devanagari script or any other language/script."
    lang_instructions = ""
    if detected_lang == 'hinglish':
        lang_instructions = f"{LANG_STRICT_RULE} Respond in Hinglish (Hindi-English mix). Example: 'Main aapki madad karunga Boss'."
    else:
        lang_instructions = f"{LANG_STRICT_RULE} Respond in English. Be professional and clear."
    
    input_prompt = ""
    
    # LOCAL MODEL FAST PATH: Hardcoded responses for predictable categories
    if "gemini" not in selected_model and category in ("GREETING", "IDENTITY", "CAPABILITY"):
        import random
        
        local_responses = {
            "GREETING": [
                "Namaste Boss, how can I help you today?",
                "Hello Boss, what can I do for you?",
                "Namaste Boss, ready to assist you!",
            ],
            "IDENTITY": [
                "Namaste Boss! I am Sathi AI, your personal shop assistant.",
            ],
            "CAPABILITY": [
                "Boss, I can help you with: Making Invoices, Tracking Inventory, Managing Customers, Recording Payments, and Answering business questions.",
            ],
        }
        
        hardcoded_text = random.choice(local_responses[category])
        print(f"DEBUG: Used hardcoded local response for {category}")
        
        await save_chat_message(user_id, "user", last_msg)
        await save_chat_message(user_id, "assistant", hardcoded_text)
        
        return {"messages": [AIMessage(content=hardcoded_text)]}
    
    # CLOUD MODEL or CHAT/BUSINESS: Use LLM
    if category == "GREETING":
         input_prompt = f"""
            You are Sathi AI, the personal AI assistant for {business_name}.
            HISTORY: {history_text}
            RULES: Warm greeting. Use "Boss". No symbols/commas. 
            LANGUAGE: {lang_instructions}
            IMPORTANT: Output ONLY the spoken response. Do NOT output "User:" or "Assistant:".
            Start with "Namaste Boss" or similar if Hindi/Hinglish.
            KEEP IT SHORT (1-2 lines max).
            """
    elif category == "CAPABILITY":
         input_prompt = f"""
            You are Sathi AI, the personal AI assistant for {business_name}.
            User asked about capabilities.
            RULES: 
            1. Say: "Boss, I can help you with:"
            2. List: Making Invoices, Tracking Inventory, Managing Customers, Adding/Updating Dues, and Answering business questions.
            3. Keep it short (1-2 lines). Use "Boss". No symbols/commas.
            LANGUAGE: {lang_instructions}
            """
    elif category == "IDENTITY":
         input_prompt = f"""
            You are Sathi AI, the personal AI assistant for {business_name}.
            RULES: 
            1. State clearly "Namaste! Main Sathi AI hoon, your helpful assistant Boss."
            2. Keep it short (1 line only). Use "Boss". No symbols/commas.
            LANGUAGE: {lang_instructions}
            """
    elif category == "CHAT":
        input_prompt = f"""
            You are Sathi AI, the personal AI assistant for {business_name}.
            User said: "{last_msg}"
            HISTORY: {history_text}
            RULES: 
            1. Respond naturally to the user's chat. Be helpful, polite, and professional.
            2. Use "Boss" occasionally to maintain persona.
            3. Do NOT make up database data. If they ask something you don't know, say so.
            4. If they seem to want to do business (like "add item"), guide them to be specific.
            5. STRICTLY KEEP IT SHORT (1-2 lines max). No symbols/commas.
            6. ALWAYS maintain Sathi AI persona (Friendly, Helpful, "Boss").
            LANGUAGE: {lang_instructions}
            """
    else: # BUSINESS / Fallback
        # Data Retrieval
        if "gemini" in selected_model:
            sql_query = await generate_sql_query(last_msg, user_id, history_context=history_text, model=selected_model)
            specialist_data = await execute_sql(sql_query)
        else:
            # Use Local DB for Offline/Local Model
            sql_query = await generate_sql_local(last_msg, model=selected_model)
            specialist_data = execute_sql_local(sql_query)
            
        input_prompt = f"""
        You are Sathi AI, assistant for {business_name}.
        DATA: {specialist_data}
        USER: "{last_msg}"
        HISTORY: {history_text}
        RULES: Answer using Data. If empty, say 'No data found'. Use "Boss". No symbols/commas. REMEMBER: YOU ARE SATHI AI.
        STRICTLY KEEP IT SHORT (1-2 lines max).
        LANGUAGE: {lang_instructions}
        IMPORTANT: Output ONLY the spoken response. Do NOT output "User:" or "Assistant:".
        """

    # Invoke the model
    llm = get_llm(selected_model)
    
    # For Local Models: shorter prompts and stricter output constraints
    if "gemini" not in selected_model:
        input_prompt = f"SYSTEM: You are Sathi AI for {business_name}. Reply in 1-2 short lines ONLY. Use 'Boss'. No markdown. IMPORTANT: Reply ONLY in English or Hinglish (Roman script). NEVER use Devanagari/Hindi script or any other language.\n" + input_prompt

    response = await llm.ainvoke([HumanMessage(content=input_prompt)])
    
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
workflow.add_node("action_agent", action_node)
workflow.add_node("chat_agent", chat_node)

# Set Entry Point -> Router Logic
# We can use a special "router" node or just conditional entry.
# Let's use a conditional entry point for maximum efficiency.
workflow.set_conditional_entry_point(
    route_conditional,
    {
        "action_agent": "action_agent",
        "chat_agent": "chat_agent"
    }
)

# Edges
workflow.add_edge("action_agent", END)
workflow.add_edge("chat_agent", END)

# Compile
app = workflow.compile()

# Memory store for conversation history (keyed by user session)
MEMORY_STORE = {}

async def process_user_input(text: str, user_token: str, model: str = "gemini-2.0-flash-001") -> str:
    """
    Main entry point for Sathi AI - processes user input and returns response
    
    This function:
    1. Maintains conversation history per user
    2. Enforces sliding window (last 15 messages)
    3. Invokes the LangGraph agent
    4. Returns AI response
    
    Args:
        text: User's message (Hindi/English)
        user_token: Supabase auth token
        model: AI Model ID to use
        
    Returns:
        AI response text (may include draft JSON)
    """
    global MEMORY_STORE
    
    # Create session key from token (secure hash)
    session_id = hashlib.sha256(user_token.encode()).hexdigest()[:16]
    
    # Initialize memory for new sessions
    if session_id not in MEMORY_STORE:
        # Simple memory leak protection
        if len(MEMORY_STORE) > 100:
            # Remove oldest/arbitrary item
            MEMORY_STORE.pop(next(iter(MEMORY_STORE)))
        MEMORY_STORE[session_id] = []
    
    memory = MEMORY_STORE[session_id]
    
    # Add user message
    memory.append(HumanMessage(content=text))
    
    # Sliding window: keep only last 15 messages
    if len(memory) > 15:
        memory = memory[-15:]
        MEMORY_STORE[session_id] = memory
    
    # Invoke the agent graph
    inputs = {
        "messages": memory,
        "language": "hi-EN",  # Hinglish by default
        "user_token": user_token,
        "model": model
    }
    
    try:
        print(f"DEBUG: Invoking Agent Graph for session {session_id}...")
        result = await app.ainvoke(inputs)
        print(f"DEBUG: Graph Execution Complete. Result keys: {result.keys() if result else 'None'}")
        
        if result and "messages" in result and len(result["messages"]) > 0:
            # Extract AI response
            ai_response = result['messages'][-1].content
        else:
            print("ERROR: Graph returned no messages!")
            ai_response = "Sorry Boss, I am having trouble thinking right now."
            
        # Add AI response to memory
        memory.append(AIMessage(content=ai_response))
        MEMORY_STORE[session_id] = memory
        
        return ai_response
        
    except Exception as e:
        logger.error(f"CRITICAL ERROR in process_user_input: {e}", exc_info=True)
        return "Sorry Boss, my brain is offline."


def clear_user_memory(user_token: str):
    """
    Clear conversation history for a user (e.g., on logout)
    
    Args:
        user_token: User's session token
    """
    # Create session key from token (secure hash) - MUST MATCH process_user_input
    session_id = hashlib.sha256(user_token.encode()).hexdigest()[:16]
    if session_id in MEMORY_STORE:
        del MEMORY_STORE[session_id]
        print(f"INFO: Cleared memory for session {session_id}")
