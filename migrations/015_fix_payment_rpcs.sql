/**
 * File: 015_fix_payment_rpcs.sql
 * Purpose: Fix payment RPCs for backend Service Key usage
 * Replaces auth.uid() with p_user_id to allow Telegram/FastAPI backends 
 * to safely execute these functions.
 */

-- Drop old functions that relied on auth.uid()
DROP FUNCTION IF EXISTS receive_payment(BIGINT, NUMERIC);
DROP FUNCTION IF EXISTS add_customer_credit(BIGINT, NUMERIC);

-- Function to record a payment received from a customer (reduces dues)
CREATE OR REPLACE FUNCTION receive_payment(
    p_user_id UUID,
    p_customer_id BIGINT,
    p_amount NUMERIC
) RETURNS NUMERIC
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    new_balance NUMERIC;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be positive';
    END IF;

    -- GREATEST ensures it never drops below 0 (negative dues)
    UPDATE customers
    SET
        credit_balance = GREATEST(COALESCE(credit_balance, 0) - p_amount, 0),
        updated_at = NOW()
    WHERE id = p_customer_id AND user_id = p_user_id
    RETURNING credit_balance INTO new_balance;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    RETURN new_balance;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to record payment: %', SQLERRM;
END;
$$;

-- Function to add credit/udhar to a customer (increases dues)
CREATE OR REPLACE FUNCTION add_customer_credit(
    p_user_id UUID,
    p_customer_id BIGINT,
    p_amount NUMERIC
) RETURNS NUMERIC
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    new_balance NUMERIC;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Credit amount must be positive';
    END IF;

    UPDATE customers
    SET
        credit_balance = COALESCE(credit_balance, 0) + p_amount,
        updated_at = NOW()
    WHERE id = p_customer_id AND user_id = p_user_id
    RETURNING credit_balance INTO new_balance;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    RETURN new_balance;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to add credit: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION receive_payment IS 'Deducts amount from customer credit_balance (payment received) - Safe for Service Key';
COMMENT ON FUNCTION add_customer_credit IS 'Adds amount to customer credit_balance (udhar/credit given) - Safe for Service Key';
