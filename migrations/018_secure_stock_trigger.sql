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
  -- Verify the product belongs to the user making the sale before deducting stock
  -- This prevents cross-tenant stock manipulation (IDOR)
  UPDATE products
  SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity),
      updated_at = NOW()
  WHERE id = NEW.product_id 
    AND user_id = auth.uid();
  
  -- If the update affected 0 rows, either the product doesn't exist,
  -- or it belongs to someone else. We raise an exception to abort the sale.
  IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found or access denied', NEW.product_id;
  END IF;
  
  -- Same protection for serial numbers
  IF NEW.product_serial_id IS NOT NULL THEN
    UPDATE product_serials
    SET status = 'sold',
        sale_id = NEW.sale_id
    WHERE id = NEW.product_serial_id
      AND user_id = auth.uid();
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
