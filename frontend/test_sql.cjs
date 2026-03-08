const initSqlJs = require('sql.js');
const fs = require('fs');

const SCHEMA_SQL = `
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
    cgst_percent NUMERIC DEFAULT 0,
    sgst_percent NUMERIC DEFAULT 0,
    igst_percent NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 5,
    unit TEXT DEFAULT 'pcs',
    supplier_id BIGINT,
    expiry_date TEXT,
    batch_number TEXT,
    warranty_months INTEGER DEFAULT 0,
    has_serial_tracking BOOLEAN DEFAULT 0,
    is_gst_applicable BOOLEAN DEFAULT 0,
    tax_type TEXT CHECK(tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive',
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_synced BOOLEAN DEFAULT 1 -- 1 if matching cloud, 0 if local-only change
);
`;

async function test() {
    try {
        const SQL = await initSqlJs();
        const db = new SQL.Database();
        db.run(SCHEMA_SQL);
        db.run('INSERT INTO products (id, name, selling_price, cgst_percent) VALUES (1, "test", 100, 9)');
        const res = db.exec('SELECT * FROM products');
        console.log("Success! Columns:", res[0].columns);
    } catch (err) {
        console.error("SQL Error:", err);
    }
}
test();
