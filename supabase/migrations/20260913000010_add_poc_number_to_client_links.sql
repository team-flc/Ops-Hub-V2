-- ==============================================================================
-- MIGRATION: 20260913000010_add_poc_number_to_client_links.sql
-- Description: Update client_links check constraint to safely accept 'poc_number'
--              and 'poc_whatsapp' for direct WhatsApp Point-of-Contact linking.
-- Safe Additive Migration: Preserves all existing data, columns, and RLS policies.
-- ==============================================================================

DO $$
BEGIN
  -- Drop existing check constraint if present
  ALTER TABLE public.client_links DROP CONSTRAINT IF EXISTS client_links_link_type_check;

  -- Add updated check constraint with all supported link types
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
      'whatsapp_group',
      'poc_number',
      'poc_whatsapp'
    ));
END $$;
