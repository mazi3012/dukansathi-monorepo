/**
 * File: 001_profiles.sql
 * Purpose: Create user profiles table with business information and GST settings
 * Author: Dukan Sathi Team
 * Created: 2026-02-05
 * 
 * This migration creates the profiles table which stores business owner information,
 * GST registration details, voice preferences, and subscription tier.
 */

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  business_name TEXT,
  owner_name TEXT,
  whatsapp_number TEXT,
  business_category TEXT CHECK (business_category IN ('kirana', 'medical', 'hardware')),
  business_address TEXT,
  
  -- GST Information
  gstin TEXT, -- GST Identification Number
  is_gst_registered BOOLEAN DEFAULT false,
  state_code TEXT, -- For CGST/SGST calculation (e.g., '27' for Maharashtra)
  
  -- AI Customization
  gpt_instructions TEXT, -- Custom instructions for AI behavior
  
  -- Voice Settings
  voice_id TEXT DEFAULT 'hi-IN-MadhurNeural', -- Default Hindi voice
  voice_speed TEXT DEFAULT '+0%',
  language_pref TEXT DEFAULT 'hi-IN', -- Default language preference
  
  -- Subscription
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'ultra')),
  
  -- Onboarding Status
  onboarding_completed BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_profiles_business_category ON profiles(business_category);
CREATE INDEX idx_profiles_is_gst_registered ON profiles(is_gst_registered);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view/edit their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE profiles IS 'User business profiles with GST and voice settings';
