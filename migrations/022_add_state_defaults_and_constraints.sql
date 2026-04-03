-- Ensure state fields are explicit and safe for GST inter-state detection.

BEGIN;

-- Backfill existing null/blank values first.
UPDATE profiles
SET state_name = 'unknown'
WHERE state_name IS NULL OR btrim(state_name) = '';

UPDATE customers
SET state = 'unknown'
WHERE state IS NULL OR btrim(state) = '';

-- Enforce defaults and non-null constraints.
ALTER TABLE profiles
    ALTER COLUMN state_name SET DEFAULT 'unknown',
    ALTER COLUMN state_name SET NOT NULL;

ALTER TABLE customers
    ALTER COLUMN state SET DEFAULT 'unknown',
    ALTER COLUMN state SET NOT NULL;

-- Helpful index for customer state lookups in IGST detection paths.
CREATE INDEX IF NOT EXISTS idx_customers_user_state ON customers(user_id, state);

COMMIT;
