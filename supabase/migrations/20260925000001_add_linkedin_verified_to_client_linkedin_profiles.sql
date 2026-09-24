-- ==============================================================================
-- FORWARD MIGRATION: Add linkedin_verified to client_linkedin_profiles
-- Database: PostgreSQL / Supabase
-- Target: Record whether specific account has LinkedIn verification badge
-- Defaults to false for existing records, completely independent of Sales Nav
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'client_linkedin_profiles' 
      AND column_name = 'linkedin_verified'
  ) THEN
    ALTER TABLE public.client_linkedin_profiles 
      ADD COLUMN linkedin_verified BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
