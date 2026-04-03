/**
 * File: 025_add_location_and_bank_fields_to_profiles.sql
 * Purpose: Add missing location and bank detail fields from onboarding to profiles table
 * Author: Dukan Sathi Team
 * Created: 2026-04-16
 * 
 * This migration adds the location (city, pincode, state_name) and bank detail columns
 * that were missing from the original profiles schema but are being used in the 
 * onboarding form submission.
 */

-- Add location fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS pincode TEXT,
ADD COLUMN IF NOT EXISTS state_name TEXT;

-- Add bank detail fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_no TEXT,
ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- Add payment QR preference field
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS show_qr_on_invoice BOOLEAN DEFAULT true;

-- Create helpful index for state lookups
CREATE INDEX IF NOT EXISTS idx_profiles_state_name ON profiles(state_name);

COMMENT ON COLUMN profiles.city IS 'City where the business is located';
COMMENT ON COLUMN profiles.pincode IS '6-digit postal code of business location';
COMMENT ON COLUMN profiles.state_name IS 'State where the business is registered';
COMMENT ON COLUMN profiles.bank_name IS 'Name of the bank for payment receipts';
COMMENT ON COLUMN profiles.bank_account_no IS 'Bank account number (masked for security)';
COMMENT ON COLUMN profiles.bank_ifsc IS 'IFSC code of the bank branch';
COMMENT ON COLUMN profiles.upi_id IS 'UPI ID for digital payments';
COMMENT ON COLUMN profiles.show_qr_on_invoice IS 'Display QR code on invoices for payments';
