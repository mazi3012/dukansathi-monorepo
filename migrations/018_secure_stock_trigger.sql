/**
 * File: 018_secure_stock_trigger.sql
 * Purpose: Secure the update_stock_on_sale trigger against cross-tenant IDOR
 * 
 * Vulnerability: The original trigger blindly decreased stock for NEW.product_id
 * without verifying that the product actually belonged to auth.uid(). An attacker
 * could create a sale item with a product_id belonging to a competitor, silently
 * depleting their stock.
 */

-- Drop the old insecure trigger and function
DROP TRIGGER IF EXISTS update_stock_after_sale ON sale_items;
DROP FUNCTION IF EXISTS update_stock_on_sale();

-- Create the secured function
CREATE OR REPLACE FUNCTION update_stock_on_sale()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only validate and decrement stock if product_id is provided
  -- (product_id may be NULL if product wasn't found during enrichment, which is acceptable)
  IF NEW.product_id IS NOT NULL THEN
    UPDATE products
    SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity),
        updated_at = NOW()
    WHERE id = NEW.product_id 
      AND user_id = NEW.user_id;
    
    -- If update affected 0 rows, the product doesn't exist or belongs to someone else
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found or access denied', NEW.product_id;
    END IF;
  END IF;
  
  -- Same protection for serial numbers
  IF NEW.product_serial_id IS NOT NULL THEN
    UPDATE product_serials
    SET status = 'sold',
        sale_id = NEW.sale_id
    WHERE id = NEW.product_serial_id
      AND user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach the secure trigger
CREATE TRIGGER update_stock_after_sale
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_sale();

COMMENT ON FUNCTION update_stock_on_sale IS 'Securely decreases stock only for products owned by the authenticated user';
