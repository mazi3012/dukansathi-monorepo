/**
 * File: 014_receive_payment_rpc.sql
 * Purpose: Create clean RPCs for receiving payment and adding credit
 * These replace the ambiguous update_customer_credit approach.
 * Run this in your Supabase SQL Editor.
 */

-- Function to record a payment received from a customer (reduces dues)
CREATE OR REPLACE FUNCTION receive_payment(
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

    UPDATE customers
    SET
        credit_balance = GREATEST(COALESCE(credit_balance, 0) - p_amount, 0),
        updated_at = NOW()
    WHERE id = p_customer_id AND user_id = auth.uid()
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
    WHERE id = p_customer_id AND user_id = auth.uid()
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

COMMENT ON FUNCTION receive_payment IS 'Deducts amount from customer credit_balance (payment received)';
COMMENT ON FUNCTION add_customer_credit IS 'Adds amount to customer credit_balance (udhar/credit given)';
