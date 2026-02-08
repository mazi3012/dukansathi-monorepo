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
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from google.oauth2 import service_account
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client, Client
import asyncio
from functools import lru_cache

load_dotenv()

# Initialize Supabase Client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
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
        # Load service account credentials
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "service_account.json")
        
        if not os.path.exists(creds_path):
            creds = None
            project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
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
        print(f"ERROR initializing Gemini ({model_name}): {e}")
        # Return a fallback or re-raise
        raise e

# No global llm anymore
# llm = init_gemini_llm()


async def generate_sql_query(user_query: str, user_id: str, history_context: str = "") -> str:
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
    
    Example:
    Query: "Show me rice sales"
    SQL: SELECT p.name, si.quantity, si.total_price FROM sale_items si JOIN products p ON si.product_id = p.id JOIN sales s ON si.sale_id = s.id WHERE p.name ILIKE '%rice%' AND s.user_id = '{user_id}'
    """
    
    # Use Flash for SQL gen as it's faster
    llm = get_llm("gemini-2.0-flash-001")
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    sql = response.content.replace("```sql", "").replace("```", "").strip()
    # Remove trailing semicolon if present, as it can cause RPC errors
    if sql.endswith(";"):
        sql = sql[:-1]
    return sql

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
        "spend", "spent", "credit", "balance", "money", "cash", "upi", "card", "bank"
    ]

    # Identity inquiry patterns
    identity_keywords = [
        "what is your name", "who are you", "your name", "tumhara naam", 
        "aapka naam", "who am i talking to", "identity", "intro", "introduction"
    ]
    
    # Action intent patterns (High priority for create/update)
    action_keywords = ["create", "add", "new", "make a", "draft", "register", "record", "pay", "paid", "receive", "received", "payment"]
    
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
    if any(k in words for k in business_keywords):
        return "BUSINESS"
    
    # Job/Career inquiries (often mistaken for business)
    if "hiring" in msg_lower or "job" in msg_lower or "vacancy" in msg_lower or "career" in msg_lower:
        return "CHAT"

    # Default to CHAT for general conversation
    return "CHAT"


async def extract_action_params(user_query: str, history_context: str = "") -> str:
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
    llm = get_llm("gemini-2.0-flash-001")
    response = await llm.ainvoke([HumanMessage(content=prompt)])
        json_str = response.content.replace("```json", "").replace("```", "").strip()
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
    
    # User ID Resolution
    user_id = user_token if user_token and len(user_token) < 50 else "unknown_user"
    if not user_id or "default" in user_id.lower() or "test" in user_id.lower() or user_id == "unknown_user":
        user_id = "00000000-0000-0000-0000-000000000000"
    
    # History for context
    chat_history = await get_chat_history(user_id, limit=5)
    history_text = "\\n".join([f"{msg['role'].capitalize()}: {msg['message']}" for msg in chat_history])
    
    print("DEBUG: Executing Action Node")
    
    # Extract Parameters
    action_json_str = await extract_action_params(last_msg, history_text)
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
            
            for item in action_data["items"]:
                prod_name = item.get("product_name", "")
                qty = item.get("quantity", 0)
                
                # Default values
                item["price"] = 0
                item["total"] = 0
                return item

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
                
                if supabase and prod_name:
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
                                price = float(db_prod.get("selling_price", 0))
                                tax_percent = float(db_prod.get("tax_percent", 0))
                                hsn_code = db_prod.get("hsn_code", "")
                                official_name = db_prod.get("name", prod_name)
                                
                                logger.info(f"DEBUG: Found {official_name}: Price={price}, Tax={tax_percent}%")
                             else:
                                logger.info(f"DEBUG: Product not found: {safe_name}")
                        else:
                             logger.info("DEBUG: Skipped search for empty/unsafe product name")
                             
                    except Exception as db_err:
                        logger.error(f"ERROR: DB Lookup failed for {prod_name}: {db_err}")
                
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
    
    # Generate Response
    prompt = f"""
    You are Sathi AI. The user asked to perform an action.
    
    ACTION JSON GENERATED: {updated_json_str}
    USER REQUEST: "{last_msg}"
    
    RULES:
    1. Confirm you have prepared the draft.
    2. Ask them to review and approve it.
    3. Be short and concise.
    4. Append the literal JSON string at the very end hidden in this tag: $$ACTION_JSON$$ {updated_json_str} $$END_JSON$$
    
    Example:
    "Sure Boss, I have prepared the invoice. Please review and approve."
    $$ACTION_JSON$$ {{...}} $$END_JSON$$
    """
    
    # Use Flash for SQL gen as it's faster
    llm = get_llm("gemini-2.0-flash-001")
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    
    # Save to history
    await save_chat_message(user_id, "user", last_msg)
    await save_chat_message(user_id, "assistant", response.content)
    
    return {"messages": [response]}

async def chat_node(state: AgentState):
    """
    Chat Agent: Handles Q&A, SQL Data Retrieval, and Greetings
    """
    messages = state['messages']
    last_msg = messages[-1].content
    user_token = state.get('user_token', '')
    
    # User ID Resolution
    user_id = user_token if user_token and len(user_token) < 50 else "unknown_user"
    if not user_id or "default" in user_id.lower() or "test" in user_id.lower() or user_id == "unknown_user":
        user_id = "00000000-0000-0000-0000-000000000000"
        
    business_name = await get_user_profile(user_id)
    
    # History for context
    chat_history = await get_chat_history(user_id, limit=10)
    history_text = "\n".join([f"{msg['role'].capitalize()}: {msg['message']}" for msg in chat_history])
    
    msg_lower = last_msg.lower().strip()
    category = categorize_query(msg_lower) # Re-eval locally just for sub-logic if needed, or pass from router
    
    input_prompt = ""
    
    if category == "GREETING":
         input_prompt = f"""
            You are Sathi AI, the personal AI assistant for {business_name}.
            User said: "{last_msg}"
            HISTORY: {history_text}
            RULES: Warm greeting in user's language/Hinglish. Use "Boss". No symbols/commas. 
            IMPORTANT: Output ONLY the spoken response. Do NOT output "User:" or "Assistant:".
            """
    elif category == "CAPABILITY":
         input_prompt = f"""
            You are Sathi AI, the personal AI assistant for {business_name}.
            User asked about capabilities.
            RULES: 
            1. Say: "Boss, I can help you with:"
            2. List: Making Invoices, Tracking Inventory, Managing Customers, Adding/Updating Dues, and Answering business questions.
            3. Keep it short. Use "Boss". No symbols/commas.
            """
    elif category == "IDENTITY":
         input_prompt = f"""
            You are Sathi AI, the personal AI assistant for {business_name}.
            User asked: "{last_msg}"
            RULES: 
            1. State clearly "I am Sathi AI, your helpful assistant Boss."
            2. Keep it short. Use "Boss". No symbols/commas.
            """
    elif category == "CHAT":
        input_prompt = f"""
            You are Sathi AI, the personal AI assistant for {business_name}.
            User said: "{last_msg}"
            HISTORY: {history_text}
            RULES: 
            1. Respond naturally to the user's chat. Be helpful, polite, and professional.
            2. Match the user's language (Hindi/English/Hinglish).
            3. Use "Boss" occasionally to maintain persona.
            4. Do NOT make up database data. If they ask something you don't know, say so.
            5. If they seem to want to do business (like "add item"), guide them to be specific.
            6. Keep it concise. No symbols/commas.
            """
    else: # BUSINESS / Fallback
        # Data Retrieval
        sql_query = await generate_sql_query(last_msg, user_id, history_context=history_text)
        specialist_data = await execute_sql(sql_query)
        
        input_prompt = f"""
        You are Sathi AI, assistant for {business_name}.
        DATA: {specialist_data}
        USER: "{last_msg}"
        HISTORY: {history_text}
        RULES: Answer using Data. If empty, say 'No data found'. Match language. Use "Boss". No symbols/commas. REMEMBER: YOU ARE SATHI AI.
        IMPORTANT: Output ONLY the spoken response. Do NOT output "User:" or "Assistant:".
        """

    # Use the selected model from state, or default to Flash
    selected_model = state.get("model", "gemini-2.0-flash-001")
    llm = get_llm(selected_model)
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
    
    # Create session key from token (last 10 chars for simplicity)
    session_id = user_token[-10:] if len(user_token) >= 10 else user_token
    
    # Initialize memory for new sessions
    if session_id not in MEMORY_STORE:
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
        "user_token": user_token
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
        print(f"CRITICAL ERROR in process_user_input: {e}")
        import traceback
        traceback.print_exc()
        return "Sorry Boss, my brain is offline."


def clear_user_memory(user_token: str):
    """
    Clear conversation history for a user (e.g., on logout)
    
    Args:
        user_token: User's session token
    """
    session_id = user_token[-10:] if len(user_token) >= 10 else user_token
    if session_id in MEMORY_STORE:
        del MEMORY_STORE[session_id]
        print(f"INFO: Cleared memory for session {session_id}")
