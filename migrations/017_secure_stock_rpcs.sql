/**
 * File: 017_secure_stock_rpcs.sql
 * Purpose: Fix security vulnerabilities in increment_stock and decrement_stock RPCs
 * 
 * Vulnerability 1: The original RPCs didn't verify auth.uid() = user_id, 
 * allowing any logged-in user to modify any other user's stock.
 * 
 * Vulnerability 2: increment_stock didn't enforce a positive quantity,
 * allowing an attacker to pass a negative number and artificially reduce stock.
 */

-- Drop old insecure functions
DROP FUNCTION IF EXISTS increment_stock(BIGINT, INT);
DROP FUNCTION IF EXISTS decrement_stock(BIGINT, INT);

-- 1. Secure increment_stock RPC
CREATE OR REPLACE FUNCTION increment_stock(
    p_id BIGINT, 
    qty INT
)
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

-- 2. Secure decrement_stock RPC 
CREATE OR REPLACE FUNCTION decrement_stock(
    p_id BIGINT, 
    qty INT
)
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

COMMENT ON FUNCTION increment_stock IS 'Securely increments stock for a product owned by the authenticated user';
COMMENT ON FUNCTION decrement_stock IS 'Securely decrements stock for a product owned by the authenticated user';
