/**
 * File: 026_fix_get_or_create_customer_ambiguous_id.sql
 * Purpose: Fix ambiguous "id" reference in get_or_create_customer RPC
 * Author: Dukan Sathi Team
 * Created: 2026-04-04
 *
 * In PL/pgSQL, output columns from RETURNS TABLE are visible as variables.
 * The previous function used `WHERE id = customer_id`, which can conflict with
 * the output column variable `id` and raise 42702 (ambiguous column reference).
 */

CREATE OR REPLACE FUNCTION get_or_create_customer(
    p_user_id UUID,
    p_name TEXT,
    p_phone TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL
) RETURNS TABLE(
    id BIGINT,
    created BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    normalized_name TEXT;
    customer_id BIGINT;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'p_user_id is required';
    END IF;

    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION 'p_name is required';
    END IF;

    normalized_name := lower(btrim(p_name));

    -- Serialize same customer-name writes for a user within a transaction.
    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || normalized_name));

    SELECT c.id
    INTO customer_id
    FROM customers c
    WHERE c.user_id = p_user_id
      AND lower(btrim(c.name)) = normalized_name
    ORDER BY c.id ASC
    LIMIT 1;

    IF customer_id IS NOT NULL THEN
        UPDATE customers
        SET
            phone = COALESCE(NULLIF(btrim(p_phone), ''), phone),
            address = COALESCE(NULLIF(btrim(p_address), ''), address),
            state = COALESCE(NULLIF(btrim(p_state), ''), state),
            updated_at = NOW()
        WHERE customers.id = customer_id;

        RETURN QUERY SELECT customer_id, FALSE;
        RETURN;
    END IF;

    INSERT INTO customers (user_id, name, phone, address, state, credit_balance, total_spend)
    VALUES (
        p_user_id,
        btrim(p_name),
        NULLIF(btrim(p_phone), ''),
        NULLIF(btrim(p_address), ''),
        NULLIF(btrim(p_state), ''),
        0,
        0
    )
    RETURNING customers.id INTO customer_id;

    RETURN QUERY SELECT customer_id, TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_customer(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION get_or_create_customer(UUID, TEXT, TEXT, TEXT, TEXT)
IS 'Atomically returns existing customer by normalized name per user, or creates one safely.';
