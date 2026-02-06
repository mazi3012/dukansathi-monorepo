-- Migration: 012_auto_update_customer_balance.sql
-- Purpose: Automatically update customer total_spend and credit_balance when a sale is created
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION update_customer_stats_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if a customer is linked
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE customers
    SET 
      total_spend = COALESCE(total_spend, 0) + NEW.total_amount,
      credit_balance = COALESCE(credit_balance, 0) + NEW.balance_due,
      last_visit = NOW()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists to avoid duplication errors
DROP TRIGGER IF EXISTS update_customer_stats_trigger ON sales;

-- Create the trigger
CREATE TRIGGER update_customer_stats_trigger
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stats_on_sale();
