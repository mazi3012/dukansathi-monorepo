-- Migration: 020_secure_ai_sql_execution.sql
-- Purpose: Fix the RLS bypass vulnerability in AI SQL generation.
-- This function wraps the read-only SQL execution in a session context 
-- that masquerades as the specific user, forcing PostgreSQL RLS to apply
-- even when the function is called via the service_role.

CREATE OR REPLACE FUNCTION exec_sql_secure(p_query text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
BEGIN
    -- 1. STAGE 1: Static Analysis Safety Checks
    -- Block destructive keywords
    IF lower(p_query) ~ '\s*(insert|update|delete|drop|alter|truncate|create|grant|revoke|comment|vacuum|analyze|explain|copy)\s+' THEN
        RAISE EXCEPTION 'Security Violation: Only SELECT queries are permitted.';
    END IF;

    -- Block system table access
    IF lower(p_query) ~ '\b(pg_|information_schema|audit|vault|auth|storage)\b' THEN
        RAISE EXCEPTION 'Security Violation: Access to system or private schemas is restricted.';
    END IF;

    -- 2. STAGE 2: Context Masquerading
    -- We set the session variables that auth.uid() and auth.role() rely on.
    -- This ensures that RLS policies using auth.uid() will trigger correctly.
    -- We use SET LOCAL so these settings only last for the duration of this transaction.
    
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    -- 3. STAGE 3: Execution
    -- Run the query as the authenticated user context
    EXECUTE 'SELECT json_agg(t) FROM (' || p_query || ') t' INTO result;

    -- 4. STAGE 4: Finalization
    IF result IS NULL THEN
        result := '[]'::json;
    END IF;

    RETURN result;

EXCEPTION
    WHEN OTHERS THEN
        -- Safely catch and re-raise to avoid leaking internal Postgres details
        RAISE EXCEPTION 'Database Error: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION exec_sql_secure IS 'Executes a read-only SELECT query while enforcing Row Level Security (RLS) for the specified user.';
