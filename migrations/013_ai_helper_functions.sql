/**
 * File: 013_ai_helper_functions.sql
 * Purpose: Create RPC functions for AI agent to directly manage customers and payments
 * Author: Dukan Sathi Team
 * Created: 2026-02-10
 */

-- Function to add a new customer
CREATE OR REPLACE FUNCTION add_customer(
    p_name TEXT,
    p_phone TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL
) RETURNS BIGINT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    new_customer_id BIGINT;
BEGIN
    -- Insert customer
    INSERT INTO customers (user_id, name, phone, address, credit_balance, total_spend)
    VALUES (auth.uid(), p_name, p_phone, p_address, 0, 0)
    RETURNING id INTO new_customer_id;
    
    RETURN new_customer_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to add customer: %', SQLERRM;
END;
$$;

-- Function to update customer credit balance
CREATE OR REPLACE FUNCTION update_customer_credit(
    p_customer_id BIGINT,
    p_amount NUMERIC,
    p_operation TEXT -- 'add' or 'subtract' or 'set'
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validate operation
    IF p_operation NOT IN ('add', 'subtract', 'set') THEN
        RAISE EXCEPTION 'Invalid operation. Use add, subtract, or set';
    END IF;

    -- Validate amount is positive
    IF p_amount < 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
    END IF;

    -- Update credit balance
    IF p_operation = 'add' THEN
        UPDATE customers 
        SET credit_balance = credit_balance + p_amount,
            updated_at = NOW()
        WHERE id = p_customer_id AND user_id = auth.uid();
    ELSIF p_operation = 'subtract' THEN
        -- Prevent negative balance
        UPDATE customers 
        SET credit_balance = GREATEST(credit_balance - p_amount, 0),
            updated_at = NOW()
        WHERE id = p_customer_id AND user_id = auth.uid();
    ELSIF p_operation = 'set' THEN
        UPDATE customers 
        SET credit_balance = p_amount,
            updated_at = NOW()
        WHERE id = p_customer_id AND user_id = auth.uid();
    END IF;
    
    RETURN FOUND;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to update credit: %', SQLERRM;
END;
$$;

-- Function to get customer by name (for AI lookups)
CREATE OR REPLACE FUNCTION find_customer_by_name(
    p_name TEXT
) RETURNS TABLE(
    id BIGINT,
    name TEXT,
    phone TEXT,
    credit_balance NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.name, c.phone, c.credit_balance
    FROM customers c
    WHERE c.user_id = auth.uid()
    AND c.name ILIKE '%' || p_name || '%'
    ORDER BY 
        CASE 
            WHEN c.name ILIKE p_name THEN 1  -- Exact match first
            WHEN c.name ILIKE p_name || '%' THEN 2  -- Starts with
            ELSE 3  -- Contains
        END,
        c.name
    LIMIT 5;
END;
$$;

COMMENT ON FUNCTION add_customer IS 'AI-callable function to add new customers';
COMMENT ON FUNCTION update_customer_credit IS 'AI-callable function to manage customer credit/dues';
COMMENT ON FUNCTION find_customer_by_name IS 'AI helper to search customers by name with ranking';
