-- ==============================================================================
-- MIGRATION: 20260922000001_add_master_business_doc_and_testimonials_to_client_links.sql
-- Description: Update client_links check constraint to safely accept 'master_business_doc',
--              'master_business_document', and 'testimonials' for client workspace links.
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
      'important_docs',
      'important_documents',
      'master_business_doc',
      'master_business_document',
      'static_creatives',
      'videos',
      'grid',
      'vsl',
      'testimonials',
      'social_media_management',
      'linkedin_management',
      'seo_management',
      'email_marketing_management',
      'paid_ads_management',
      'linkedin_company_page',
      'facebook',
      'instagram',
      'slack_channel',
      'whatsapp_group',
      'poc_number',
      'poc_whatsapp'
    ));
END $$;
