-- ==============================================================================
-- MIGRATION: 20261002000001_add_reviews_and_proposal_contract_to_client_links.sql
-- Description:
--   Update client_links check constraint to safely accept 'reviews',
--   'proposal_contract', and 'contract'.
-- Safe Additive Migration: Preserves all existing data, columns, and constraints.
-- ==============================================================================

DO $$
BEGIN
  ALTER TABLE public.client_links DROP CONSTRAINT IF EXISTS client_links_link_type_check;

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
      'reviews',
      'proposal_contract',
      'contract',
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
      'poc_whatsapp',
      'case_studies',
      'requirement_docs',
      'requirement_documents',
      'gohighlevel',
      'ghl_account'
    ));
END $$;
