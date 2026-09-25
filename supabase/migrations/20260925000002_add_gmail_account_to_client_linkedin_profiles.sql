-- ==============================================================================
-- MIGRATION: 20260925000002_add_gmail_account_to_client_linkedin_profiles.sql
-- Description: Add has_gmail_account and gmail_address columns to
--              client_linkedin_profiles to track dedicated lead generation
--              Gmail accounts per profile without storing sensitive credentials.
-- ==============================================================================

ALTER TABLE public.client_linkedin_profiles
ADD COLUMN IF NOT EXISTS has_gmail_account boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS gmail_address text;

COMMENT ON COLUMN public.client_linkedin_profiles.has_gmail_account IS 'Indicates whether a dedicated Gmail account is assigned to this LinkedIn profile';
COMMENT ON COLUMN public.client_linkedin_profiles.gmail_address IS 'The email address of the dedicated Gmail account (no passwords or credentials stored)';
