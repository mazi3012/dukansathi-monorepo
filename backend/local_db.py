import sqlite3
import json
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "dukansathi_offline.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the local SQLite database with necessary tables."""
    conn = get_db_connection()
    c = conn.cursor()
    
    # Products Table
    c.execute('''CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        name TEXT,
        selling_price REAL,
        cost_price REAL,
        stock_quantity INTEGER,
        category TEXT,
        tax_percent REAL,
        user_id TEXT
    )''')
    
    # Customers Table
    c.execute('''CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY,
        name TEXT,
        phone TEXT,
        credit_balance REAL,
        user_id TEXT
    )''')
    
    # Draft Invoices Table (Legacy/Specific)
    c.execute('''CREATE TABLE IF NOT EXISTS draft_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT,
        items TEXT, -- JSON stored as text
        total_amount REAL,
        status TEXT DEFAULT 'draft',
        user_id TEXT,
        is_synced INTEGER DEFAULT 0
    )''')

    # Generic Draft Actions Table (New)
    c.execute('''CREATE TABLE IF NOT EXISTS draft_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT, -- invoice_draft, product_draft, customer_draft, payment_draft
        data TEXT, -- Full JSON payload
        status TEXT DEFAULT 'pending',
        user_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_synced INTEGER DEFAULT 0
    )''')

    conn.commit()
    conn.close()
    logger.info(f"Local Database initialized at {DB_PATH}")

def sync_products_from_cloud(products_data):
    """Sync products from Supabase to Local DB."""
    if not products_data:
        return
    
    conn = get_db_connection()
    c = conn.cursor()
    
    # Upsert logic (simplified: replace)
    for p in products_data:
        c.execute('''INSERT OR REPLACE INTO products 
                     (id, name, selling_price, cost_price, stock_quantity, category, tax_percent, user_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                  (p.get('id'), p.get('name'), p.get('selling_price'), p.get('cost_price'), 
                   p.get('stock_quantity'), p.get('category'), p.get('tax_percent'), p.get('user_id')))
    
    conn.commit()
    conn.close()
    logger.info(f"Synced {len(products_data)} products to local DB.")

def search_products_local(query, user_id):
    """Search products locally (Offline Mode)."""
    conn = get_db_connection()
    c = conn.cursor()
    
    # Simple LIKE search
    search_term = f"%{query}%"
    c.execute('''SELECT * FROM products 
                 WHERE name LIKE ? AND user_id = ?
                 LIMIT 10''', (search_term, user_id))
    
    rows = c.fetchall()
    conn.close()
    
    # Convert rows to dicts
    return [dict(row) for row in rows]

def save_draft_local(draft_data, user_id):
    """Save a draft invoice locally (Legacy)."""
    conn = get_db_connection()
    c = conn.cursor()
    
    items_json = json.dumps(draft_data.get('items', []))
    
    c.execute('''INSERT INTO draft_invoices 
                 (customer_name, items, total_amount, user_id, is_synced)
                 VALUES (?, ?, ?, ?, 0)''',
              (draft_data.get('customer_name'), items_json, draft_data.get('total_amount', 0), user_id))
    
    draft_id = c.lastrowid
    conn.commit()
    conn.close()
    logger.info(f"Saved local draft ID {draft_id}")
    return draft_id

def save_action_draft_local(draft_data, user_id):
    """Save any type of action draft locally (New)."""
    conn = get_db_connection()
    c = conn.cursor()
    
    draft_type = draft_data.get('type', 'unknown')
    data_json = json.dumps(draft_data)
    
    c.execute('''INSERT INTO draft_actions 
                 (type, data, user_id, is_synced)
                 VALUES (?, ?, ?, 0)''',
              (draft_type, data_json, user_id))
    
    draft_id = c.lastrowid
    conn.commit()
    conn.close()
    logger.info(f"Saved local action draft ID {draft_id} of type {draft_type}")
    return draft_id

def save_customer_local(customer_data, user_id):
    """Save a new customer to local DB."""
    conn = get_db_connection()
    c = conn.cursor()
    
    try:
        c.execute('''INSERT INTO customers 
                     (name, phone, credit_balance, user_id)
                     VALUES (?, ?, ?, ?)''',
                  (customer_data.get('name'), customer_data.get('phone'), 
                   customer_data.get('credit_balance', 0), user_id))
        conn.commit()
        customer_id = c.lastrowid
        logger.info(f"Saved local customer ID {customer_id}")
        return customer_id
    except Exception as e:
        logger.error(f"Error saving local customer: {e}")
        return None
    finally:
        conn.close()

def save_product_local(product_data, user_id):
    """Save a new product to local DB."""
    conn = get_db_connection()
    c = conn.cursor()
    
    try:
        # Check if product exists first
        c.execute("SELECT id FROM products WHERE name = ? AND user_id = ?", (product_data.get('name'), user_id))
        existing = c.fetchone()
        
        if existing:
            # Update existing
            c.execute('''UPDATE products SET 
                         selling_price = ?, stock_quantity = ?, category = ?
                         WHERE id = ?''',
                      (product_data.get('selling_price'), product_data.get('stock_quantity'), 
                       product_data.get('category'), existing['id']))
            product_id = existing['id']
        else:
            # Insert new
            c.execute('''INSERT INTO products 
                         (name, selling_price, cost_price, stock_quantity, category, user_id)
                         VALUES (?, ?, ?, ?, ?, ?)''',
                      (product_data.get('name'), product_data.get('selling_price'), 
                       product_data.get('cost_price', 0), product_data.get('stock_quantity'), 
                       product_data.get('category'), user_id))
            product_id = c.lastrowid
            
        conn.commit()
        logger.info(f"Saved local product ID {product_id}")
        return product_id
    except Exception as e:
        logger.error(f"Error saving local product: {e}")
        return None
    finally:
        conn.close()

def get_customers_local(user_id):
    """Get all customers for a user from local DB."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM customers WHERE user_id = ? ORDER BY name", (user_id,))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_products_local(user_id):
    """Get all products for a user from local DB."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM products WHERE user_id = ? ORDER BY name", (user_id,))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

if __name__ == "__main__":
    init_db()
