-- ==============================================================================
-- MIGRATION: 20260913000007_add_brand_identity_and_workspace_links.sql
-- Description: Update client_links check constraint to safely accept all 13
--              workspace and communication link types, including brand_identity.
-- Safe Additive Migration: Preserves all existing data, columns, and RLS policies.
-- ==============================================================================

DO $$
BEGIN
  -- Drop existing check constraint if present
  ALTER TABLE public.client_links DROP CONSTRAINT IF EXISTS client_links_link_type_check;

  -- Add updated check constraint with all 13 supported link types
  ALTER TABLE public.client_links ADD CONSTRAINT client_links_link_type_check
    CHECK (link_type IN (
      'website',
      'flc_landing_page',
      'brand_identity',
      'google_drive',
      'static_creatives',
      'videos',
      'grid',
      'vsl',
      'linkedin_company_page',
      'facebook',
      'instagram',
      'slack_channel',
      'whatsapp_group'
    ));
END $$;
