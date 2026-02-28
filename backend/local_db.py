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

    # Local Sales Table (Offline Invoices)
    c.execute('''CREATE TABLE IF NOT EXISTS local_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT,
        items TEXT, -- JSON stored as text
        total_amount REAL,
        payment_method TEXT DEFAULT 'cash',
        payment_status TEXT DEFAULT 'paid',
        amount_paid REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_synced INTEGER DEFAULT 0
    )''')

    # Local Payments Table (Offline Due / Payment Records)
    c.execute('''CREATE TABLE IF NOT EXISTS local_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT,
        amount REAL,
        payment_type TEXT DEFAULT 'payment',  -- 'payment' (green) or 'credit' (red/due)
        mode TEXT DEFAULT 'cash',
        note TEXT,
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

def _normalize_product_name(name):
    """
    Normalize a product name for fuzzy comparison.
    Handles plurals, hyphens, spaces, and common STT typo patterns.
    """
    if not name:
        return ""
    n = name.lower().strip()
    # Remove hyphens, extra spaces, dots
    n = n.replace("-", " ").replace(".", " ")
    n = " ".join(n.split())  # collapse multiple spaces
    # Strip trailing 's' for simple plural handling (pens -> pen, chips stays chips)
    # But keep words like 'lass', 'mass', 'gas' etc. by only stripping if len > 3
    words = n.split()
    normalized_words = []
    for w in words:
        if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        # Also strip 'es' ending (boxes -> box)
        if len(w) > 4 and w.endswith("es") and not w.endswith("ses"):
            w = w[:-2]
        normalized_words.append(w)
    return " ".join(normalized_words)


def _bigram_similarity(a, b):
    """
    Calculate bigram (character 2-gram) similarity between two strings.
    Returns a score between 0.0 and 1.0.
    This is a lightweight alternative to Levenshtein for SQLite.
    """
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    
    def bigrams(s):
        return set(s[i:i+2] for i in range(len(s) - 1)) if len(s) > 1 else {s}
    
    bg_a = bigrams(a)
    bg_b = bigrams(b)
    
    if not bg_a or not bg_b:
        return 0.0
    
    intersection = bg_a & bg_b
    return (2.0 * len(intersection)) / (len(bg_a) + len(bg_b))


def search_products_local(query, user_id="local_guest"):
    """
    Fuzzy search products locally (Offline Mode).
    Handles typos (maggie/maggi), plurals (pen/pens), 
    hyphens (coca cola/coca-cola), and case differences.
    """
    conn = get_db_connection()
    c = conn.cursor()
    
    normalized_query = _normalize_product_name(query)
    
    # STEP 1: Try exact LIKE match first (fast path)
    search_term = f"%{query}%"
    c.execute('''SELECT * FROM products 
                 WHERE name LIKE ?
                 LIMIT 10''', (search_term,))
    rows = c.fetchall()
    
    if rows:
        conn.close()
        return [dict(row) for row in rows]
    
    # STEP 2: Try normalized LIKE match (handles plurals, hyphens)
    search_term_normalized = f"%{normalized_query}%"
    c.execute('''SELECT * FROM products 
                 WHERE LOWER(REPLACE(REPLACE(name, '-', ' '), '.', ' ')) LIKE ?
                 LIMIT 10''', (search_term_normalized,))
    rows = c.fetchall()
    
    if rows:
        conn.close()
        return [dict(row) for row in rows]
    
    # STEP 3: Fuzzy bigram matching against all products (handles maggie/maggi type typos)
    c.execute('''SELECT * FROM products''')
    all_products = c.fetchall()
    conn.close()
    
    scored_results = []
    for product in all_products:
        product_dict = dict(product)
        product_name = product_dict.get("name", "")
        normalized_product = _normalize_product_name(product_name)
        
        # Compare with full query
        score = _bigram_similarity(normalized_query, normalized_product)
        
        # Also compare each query word against each product word for partial matches
        query_words = normalized_query.split()
        product_words = normalized_product.split()
        for qw in query_words:
            for pw in product_words:
                word_score = _bigram_similarity(qw, pw)
                score = max(score, word_score)
        
        if score >= 0.5:  # Threshold: 50% similarity
            scored_results.append((score, product_dict))
    
    # Sort by similarity score descending
    scored_results.sort(key=lambda x: x[0], reverse=True)
    
    return [item[1] for item in scored_results[:10]]

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

def get_customers_local(user_id="local_guest"):
    """Get all customers from local DB (no user_id filter in local/guest mode)."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM customers ORDER BY name")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_customer_by_id_local(customer_id):
    """Get a customer by ID locally."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def get_customer_by_name_local(name):
    """Find a customer by name locally (case-insensitive) with fuzzy fallback."""
    conn = get_db_connection()
    c = conn.cursor()
    
    # STEP 1: Exact LIKE match
    c.execute("SELECT * FROM customers WHERE name LIKE ? LIMIT 1", (f"%{name}%",))
    row = c.fetchone()
    
    if row:
        conn.close()
        return dict(row)
    
    # STEP 2: Fuzzy fallback using bigram similarity
    c.execute("SELECT * FROM customers")
    all_customers = c.fetchall()
    conn.close()
    
    normalized_query = _normalize_product_name(name)  # reuse normalizer
    best_match = None
    best_score = 0.0
    
    for customer in all_customers:
        customer_dict = dict(customer)
        customer_name = customer_dict.get("name", "")
        normalized_name = _normalize_product_name(customer_name)
        
        score = _bigram_similarity(normalized_query, normalized_name)
        if score > best_score and score >= 0.55:  # slightly higher threshold for names
            best_score = score
            best_match = customer_dict
    
    return best_match

def update_customer_balance_local(customer_name, amount, payment_type):
    """Update customer credit_balance locally based on payment_type."""
    conn = get_db_connection()
    c = conn.cursor()
    try:
        # 1. Find the customer
        c.execute("SELECT id, credit_balance FROM customers WHERE name LIKE ? LIMIT 1", (f"%{customer_name}%",))
        row = c.fetchone()
        
        if not row:
            logger.warning(f"Customer '{customer_name}' not found for balance update.")
            return None
        
        customer_id = row['id']
        old_balance = row['credit_balance'] or 0
        
        # 2. Calculate new balance
        # payment = received money (decreases due/credit)
        # credit = gave items on credit (increases due/credit)
        if payment_type == 'payment':
            new_balance = old_balance - amount
        else: # credit
            new_balance = old_balance + amount
            
        # 3. Update the record
        c.execute("UPDATE customers SET credit_balance = ? WHERE id = ?", (new_balance, customer_id))
        conn.commit()
        logger.info(f"Updated balance for {customer_name}: {old_balance} -> {new_balance}")
        return new_balance
    except Exception as e:
        logger.error(f"Error updating customer balance: {e}")
        return None
    finally:
        conn.close()

def get_products_local(user_id="local_guest"):
    """Get all products from local DB (no user_id filter in local/guest mode)."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM products ORDER BY name")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def save_invoice_local(invoice_data):
    """Save a completed offline invoice and update customer balance if it's a credit sale."""
    conn = get_db_connection()
    c = conn.cursor()
    try:
        customer_name = invoice_data.get('customer_name', 'Walk-in Customer')
        total_amount = float(invoice_data.get('total_amount', 0))
        amount_paid = float(invoice_data.get('amount_paid', 0))
        
        items_json = json.dumps(invoice_data.get('items', []))
        c.execute('''INSERT INTO local_sales 
                     (customer_name, items, total_amount, payment_method, payment_status, amount_paid)
                     VALUES (?, ?, ?, ?, ?, ?)''',
                  (
                      customer_name,
                      items_json,
                      total_amount,
                      invoice_data.get('payment_method', 'cash'),
                      invoice_data.get('payment_status', 'paid'),
                      amount_paid,
                  ))
        conn.commit()
        sale_id = c.lastrowid
        logger.info(f"Saved local invoice ID {sale_id}")
        
        # --- NEW: Decrement Inventory Stock ---
        items = invoice_data.get('items', [])
        for item in items:
            product_id = item.get('product_id') or item.get('id')
            product_name = item.get('product_name') or item.get('name')
            qty = float(item.get('quantity', 1))
            
            # If we don't have a product_id, try fuzzy matching to find it
            if not product_id and product_name:
                matches = search_products_local(product_name)
                if matches:
                    product_id = matches[0]['id']
            
            if product_id:
                c.execute("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?", (qty, product_id))
                logger.info(f"Decremented stock for product {product_id} by {qty}")
            else:
                logger.warning(f"Could not find product '{product_name}' to decrement stock.")
        
        conn.commit()
        
        # Update Customer Balance if it's a credit sale and we have a customer name
        if customer_name != 'Walk-in Customer':
            due_amount = total_amount - amount_paid
            if due_amount > 0:
                # Add to due balance
                update_customer_balance_local(customer_name, due_amount, 'credit')
            elif due_amount < 0:
                # This would be an overpayment, maybe subtract from balance
                update_customer_balance_local(customer_name, abs(due_amount), 'payment')
                
        return sale_id
    except Exception as e:
        logger.error(f"Error saving local invoice: {e}")
        return None
    finally:
        conn.close()

def get_invoices_local(customer_name=None):
    """Get all offline invoices, optionally filtered by customer_name."""
    conn = get_db_connection()
    c = conn.cursor()
    if customer_name:
        c.execute("SELECT * FROM local_sales WHERE customer_name LIKE ? ORDER BY created_at DESC", (f"%{customer_name}%",))
    else:
        c.execute("SELECT * FROM local_sales ORDER BY created_at DESC")
    rows = c.fetchall()
    conn.close()
    result = []
    for row in rows:
        d = dict(row)
        try:
            d['items'] = json.loads(d.get('items', '[]'))
        except Exception:
            d['items'] = []
        result.append(d)
    return result

def save_payment_local(payment_data):
    """Save an offline payment or due record to local_payments table and update customer balance."""
    conn = get_db_connection()
    c = conn.cursor()
    try:
        customer_name = payment_data.get('customer_name', '')
        amount = float(payment_data.get('amount', 0))
        payment_type = payment_data.get('payment_type', 'payment')
        
        c.execute('''INSERT INTO local_payments
                     (customer_name, amount, payment_type, mode, note)
                     VALUES (?, ?, ?, ?, ?)''',
                  (
                      customer_name,
                      amount,
                      payment_type,
                      payment_data.get('mode', 'cash'),
                      payment_data.get('note', ''),
                  ))
        conn.commit()
        payment_id = c.lastrowid
        logger.info(f"Saved local payment ID {payment_id} ({payment_type})")
        
        # Update Customer Balance
        new_balance = update_customer_balance_local(customer_name, amount, payment_type)
        
        return {"payment_id": payment_id, "new_balance": new_balance}
    except Exception as e:
        logger.error(f"Error saving local payment: {e}")
        return None
    finally:
        conn.close()

def get_payments_local(customer_name=None):
    """Get all offline payment records, optionally filtered by name."""
    conn = get_db_connection()
    c = conn.cursor()
    if customer_name:
        c.execute("SELECT * FROM local_payments WHERE customer_name LIKE ? ORDER BY created_at DESC", (f"%{customer_name}%",))
    else:
        c.execute("SELECT * FROM local_payments ORDER BY created_at DESC")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]
    
def restock_product_local(data):
    """Increase stock quantity for a product in local SQLite DB."""
    conn = get_db_connection()
    c = conn.cursor()
    try:
        product_id = data.get('product_id') or data.get('id')
        product_name = data.get('product_name') or data.get('name')
        qty = float(data.get('quantity_to_add', 0))
        
        if not product_id and product_name:
            matches = search_products_local(product_name)
            if matches:
                product_id = matches[0]['id']
                
        if product_id:
            c.execute("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", (qty, product_id))
            conn.commit()
            
            # Fetch updated product to return
            c.execute("SELECT * FROM products WHERE id = ?", (product_id,))
            row = c.fetchone()
            return dict(row) if row else None
        return None
    except Exception as e:
        logger.error(f"Error restocking local product: {e}")
        return None
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
