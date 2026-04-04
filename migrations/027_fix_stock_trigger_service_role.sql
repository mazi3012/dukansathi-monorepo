/**
 * File: 027_fix_stock_trigger_service_role.sql
 * Purpose: Fix update_stock_on_sale trigger for service_role compatibility (Telegram bot)
 * Author: Dukan Sathi Team
 * Created: 2026-04-04
 *
 * Issue: The original trigger used auth.uid() which returns NULL when service_role is used
 * (like in the Telegram bot). This caused all product lookups to fail with P0001.
 * 
 * Fix: Use NEW.user_id (from sale_items insert) instead of auth.uid() for IDOR protection.
 * This works for both authenticated users AND service_role access.
 */

CREATE OR REPLACE FUNCTION update_stock_on_sale()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verify the product belongs to the user making the sale before deducting stock
  -- This prevents cross-tenant stock manipulation (IDOR)
  -- Use NEW.user_id instead of auth.uid() for service_role compatibility (Telegram bot)
  UPDATE products
  SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity),
      updated_at = NOW()
  WHERE id = NEW.product_id 
    AND user_id = NEW.user_id;
  
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
      AND user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_stock_on_sale IS 'Securely decreases stock only for products owned by the sale user. Works with both auth and service_role.';
