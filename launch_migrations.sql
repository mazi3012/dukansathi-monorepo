-- =====================================================================
-- Dukan Sathi - Launch Readiness SQL Migrations
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================================

-- 1. Enable pg_trgm for fuzzy text matching (tolerates typos from voice input)
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- 2. Customer Ledger Table (payment history per customer)
CREATE TABLE IF NOT EXISTS customer_ledger (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id  BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount       NUMERIC NOT NULL,
    type         TEXT NOT NULL CHECK (type IN ('credit', 'payment')),
    mode         TEXT DEFAULT 'Cash',
    note         TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE customer_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policy: each user sees only their own ledger rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customer_ledger'
      AND policyname = 'Users can manage their own ledger'
  ) THEN
    CREATE POLICY "Users can manage their own ledger"
      ON customer_ledger FOR ALL
      TO authenticated
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- 3. fuzzy_match_product RPC
--    Returns the single best-matching product for a given text query
--    Similarity threshold 0.15 is intentionally low for voice typo tolerance
CREATE OR REPLACE FUNCTION fuzzy_match_product(query TEXT, uid UUID)
RETURNS TABLE(
    id               BIGINT,
    name             TEXT,
    selling_price    NUMERIC,
    tax_percent      NUMERIC,
    stock_quantity   INTEGER,
    unit             TEXT,
    similarity_score REAL
)
LANGUAGE SQL STABLE AS $$
    SELECT
        p.id,
        p.name,
        p.selling_price,
        p.tax_percent,
        p.stock_quantity,
        p.unit,
        similarity(lower(p.name), lower(query)) AS similarity_score
    FROM products p
    WHERE p.user_id = uid
      AND similarity(lower(p.name), lower(query)) > 0.15
    ORDER BY similarity_score DESC
    LIMIT 1;
$$;


-- 4. fuzzy_match_customer RPC
--    Returns the single best-matching customer for a given text query
CREATE OR REPLACE FUNCTION fuzzy_match_customer(query TEXT, uid UUID)
RETURNS TABLE(
    id              BIGINT,
    name            TEXT,
    credit_balance  NUMERIC
)
LANGUAGE SQL STABLE AS $$
    SELECT
        c.id,
        c.name,
        c.credit_balance
    FROM customers c
    WHERE c.user_id = uid
      AND similarity(lower(c.name), lower(query)) > 0.2
    ORDER BY similarity(lower(c.name), lower(query)) DESC
    LIMIT 1;
$$;


-- 5. increment_stock RPC (Secure version)
CREATE OR REPLACE FUNCTION increment_stock(p_id BIGINT, qty INT)
RETURNS VOID 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    IF qty <= 0 THEN
        RAISE EXCEPTION 'Restock quantity must be positive';
    END IF;

    UPDATE products
    SET stock_quantity = stock_quantity + qty,
        updated_at = NOW()
    WHERE id = p_id AND user_id = auth.uid();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found or access denied';
    END IF;
END;
$$;


-- 6. decrement_stock RPC (Secure version)
CREATE OR REPLACE FUNCTION decrement_stock(p_id BIGINT, qty INT)
RETURNS VOID 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    IF qty <= 0 THEN
        RAISE EXCEPTION 'Decrement quantity must be positive';
    END IF;

    UPDATE products
    SET stock_quantity = GREATEST(0, stock_quantity - qty),
        updated_at = NOW()
    WHERE id = p_id AND user_id = auth.uid();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found or access denied';
    END IF;
END;
$$;


-- 7. update_stock_on_sale (Secure trigger)
CREATE OR REPLACE FUNCTION update_stock_on_sale()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verify the product belongs to the user making the sale before deducting stock
  UPDATE products
  SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity),
      updated_at = NOW()
  WHERE id = NEW.product_id 
    AND user_id = auth.uid();
  
  IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found or access denied', NEW.product_id;
  END IF;
  
  -- Same protection for serial numbers
  IF NEW.product_serial_id IS NOT NULL THEN
    UPDATE product_serials
    SET status = 'sold',
        sale_id = NEW.sale_id
    WHERE id = NEW.product_serial_id
      AND user_id = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to update stock when sale is created
DROP TRIGGER IF EXISTS update_stock_after_sale ON sale_items;
CREATE TRIGGER update_stock_after_sale
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_sale();


-- =====================================================================
-- Optional: Verify everything is created
-- =====================================================================
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'fuzzy_match_product',
    'fuzzy_match_customer',
    'increment_stock',
    'decrement_stock'
  );

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'customer_ledger';
