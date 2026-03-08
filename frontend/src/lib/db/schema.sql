-- file:///e:/dukanv22/frontend/src/lib/db/schema.sql

-- Core tables for local-first shop management
-- Every table has 'is_synced' and 'updated_at' for the sync engine

CREATE TABLE IF NOT EXISTS products (
    id BIGINT PRIMARY KEY, -- Matches Supabase BigInt
    user_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    barcode TEXT,
    category TEXT,
    cost_price NUMERIC DEFAULT 0,
    selling_price NUMERIC NOT NULL,
    mrp NUMERIC,
    hsn_code TEXT,
    tax_percent NUMERIC DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 5,
    unit TEXT DEFAULT 'pcs',
    is_gst_applicable BOOLEAN DEFAULT FALSE,
    tax_type TEXT CHECK(tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive',
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_synced BOOLEAN DEFAULT TRUE -- TRUE if matching cloud, FALSE if local-only change
);

CREATE TABLE IF NOT EXISTS customers (
    id BIGINT PRIMARY KEY,
    user_id UUID,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    credit_balance NUMERIC DEFAULT 0.00,
    gstin TEXT,
    state TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_synced BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sales (
    id BIGINT PRIMARY KEY,
    user_id UUID,
    customer_id BIGINT REFERENCES customers(id),
    invoice_number TEXT,
    invoice_type TEXT DEFAULT 'regular',
    total_amount NUMERIC NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    payment_status TEXT DEFAULT 'paid',
    amount_paid NUMERIC DEFAULT 0.00,
    balance_due NUMERIC DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_synced BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sale_items (
    id BIGINT PRIMARY KEY,
    user_id UUID,
    sale_id BIGINT REFERENCES sales(id),
    product_id BIGINT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_synced BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS customer_ledger (
    id BIGINT PRIMARY KEY,
    user_id UUID,
    customer_id BIGINT REFERENCES customers(id),
    amount NUMERIC NOT NULL,
    type TEXT CHECK(type IN ('credit', 'payment')),
    mode TEXT DEFAULT 'Cash',
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_synced BOOLEAN DEFAULT TRUE
);

-- Sync Metadata
CREATE TABLE IF NOT EXISTS sync_metadata (
    table_name TEXT PRIMARY KEY,
    last_pulled_at TIMESTAMP WITH TIME ZONE,
    last_pushed_at TIMESTAMP WITH TIME ZONE
);
