-- Migration: Create exec_sql_read_only function for AI
-- Purpose: Allow the AI agent to execute READ-ONLY SQL queries safely
-- Security: This function should only be callable by the service role or authenticated users with checks

CREATE OR REPLACE FUNCTION exec_sql_read_only(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of creator (postgres)
AS $$
DECLARE
    result json;
BEGIN
    -- Basic safety check: prevent modification statements
    -- This is a simple heuristic; strictly ideally we'd use a read-only user role
    IF lower(query) ~ '\s*(insert|update|delete|drop|alter|truncate|create|grant|revoke)\s+' THEN
        RAISE EXCEPTION 'Only SELECT queries are allowed in this function.';
    END IF;

    -- Execute the query and return result as JSON
    EXECUTE 'SELECT json_agg(t) FROM (' || query || ') t' INTO result;
    
    -- Return empty array if null
    IF result Is NULL THEN
        result := '[]'::json;
    END IF;
    
    RETURN result;
END;
$$;
