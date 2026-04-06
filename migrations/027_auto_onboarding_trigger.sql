-- Trigger to handle new user signup: Create profile and add welcome credits
-- applied manually via Supabase during task execution

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 1. Create a minimal profile in public.profiles
  INSERT INTO public.profiles (id, email, subscription_tier, onboarding_completed, subscription_status)
  VALUES (new.id, new.email, 'free', false, 'active')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Add Welcome Credits (20) to the credit ledger
  INSERT INTO public.credit_ledger (user_id, amount, action_type, description)
  VALUES (new.id, 20, 'welcome_bonus', 'Welcome bonus: 20 free credits for Dukan Sathi AI!');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function AFTER a new user is inserted into auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
