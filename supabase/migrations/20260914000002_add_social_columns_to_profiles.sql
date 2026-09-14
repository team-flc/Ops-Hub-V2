-- ==============================================================================
-- MIGRATION: Add facebook_url and instagram_url to public.profiles
-- Location: supabase/migrations/20260914000002_add_social_columns_to_profiles.sql
-- Database: PostgreSQL / Supabase (jcaptlqenwmpfchjyipw)
-- ==============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_url TEXT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
