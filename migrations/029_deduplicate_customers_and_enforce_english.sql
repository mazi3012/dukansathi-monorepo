/**
 * File: 029_deduplicate_customers_and_enforce_english.sql
 * Purpose: Deduplicate existing customer records that were created in native scripts 
 *          (Hindi, Bangla) and merge them into their English equivalents. 
 *          Updates all associated sales and drafts and recalculates credit balances.
 * Author: Dukan Sathi AI
 * Created: 2026-04-09
 */

DO $$
DECLARE
    -- Cursor for iterating over users and their duplicate customers
    v_user_id UUID;
    v_target_id BIGINT;
    v_source_id BIGINT;
    v_eng_name TEXT;
    
    -- Variables for merging
    v_dup RECORD;
    v_pri RECORD;

BEGIN
    -- 1) Standardize current customer names based on known transliteration mappings
    -- Update "হামজা" to "Hamza", "अमित" to "Amit", etc.
    UPDATE customers SET name = btrim(name);

    -- Bangla Mappings
    UPDATE customers SET name = 'Hamza' WHERE name = 'হামজা';
    UPDATE customers SET name = 'Amit' WHERE name = 'অমিত';
    UPDATE customers SET name = 'Rahul' WHERE name = 'রাহুল';
    UPDATE customers SET name = 'Rohan' WHERE name = 'রোহন';
    UPDATE customers SET name = 'Priya' WHERE name = 'প্রিয়া';
    UPDATE customers SET name = 'Rahim' WHERE name = 'রহিম';
    UPDATE customers SET name = 'Suresh' WHERE name = 'সুরেশ';
    UPDATE customers SET name = 'Vikram' WHERE name = 'বিক্রম';

    -- Hindi Mappings
    UPDATE customers SET name = 'Hamza' WHERE name = 'हमजा';
    UPDATE customers SET name = 'Amit' WHERE name = 'अमित';
    UPDATE customers SET name = 'Rahul' WHERE name = 'राहुल';
    UPDATE customers SET name = 'Rohan' WHERE name = 'रोहन';
    UPDATE customers SET name = 'Priya' WHERE name = 'प्रिया';
    UPDATE customers SET name = 'Rahim' WHERE name = 'रहीम';
    UPDATE customers SET name = 'Suresh' WHERE name = 'सुरेश';
    UPDATE customers SET name = 'Vikram' WHERE name = 'विक्रम';
    
    -- General Capitalization to ensure consistency
    UPDATE customers SET name = initcap(name) WHERE name != initcap(name);

    -- 2) Merge Duplicate Customers per User ID
    -- We want to find groups of customers with the SAME name per user.
    -- We will keep the one with the earliest created_at (id is MIN(id)) as PRIMARY,
    -- and merge all others into it.

    FOR v_dup IN 
        SELECT user_id, lower(name) as normalized_name, array_agg(id ORDER BY id ASC) as ids
        FROM customers
        GROUP BY user_id, lower(name)
        HAVING COUNT(*) > 1
    LOOP
        v_user_id := v_dup.user_id;
        v_target_id := v_dup.ids[1]; -- The primary (oldest) customer ID
        
        -- Loop through duplicates (starting from index 2)
        FOR i IN 2 .. array_length(v_dup.ids, 1) LOOP
            v_source_id := v_dup.ids[i];
            
            -- Merge Sales
            UPDATE sales 
            SET customer_id = v_target_id 
            WHERE customer_id = v_source_id;
            
            -- Merge Drafts (if customer_id exists in jsonb payload or table schema)
            -- Note: Drafts table does not use relational customer_id, it is inside jsonb 'data'
            UPDATE drafts 
            SET data = jsonb_set(data, '{customer_id}', to_jsonb(v_target_id))
            WHERE type IN ('invoice_draft', 'payment_draft') 
              AND data->>'customer_id' = v_source_id::TEXT;
            
            -- Update Primary Customer's balance and spend
            UPDATE customers
            SET 
                credit_balance = credit_balance + (SELECT credit_balance FROM customers WHERE id = v_source_id),
                total_spend = total_spend + (SELECT total_spend FROM customers WHERE id = v_source_id),
                phone = COALESCE(customers.phone, (SELECT phone FROM customers WHERE id = v_source_id)),
                address = COALESCE(customers.address, (SELECT address FROM customers WHERE id = v_source_id))
            WHERE id = v_target_id;
            
            -- Delete the source duplicate
            DELETE FROM customers WHERE id = v_source_id;
        END LOOP;
        
    END LOOP;

END $$;
