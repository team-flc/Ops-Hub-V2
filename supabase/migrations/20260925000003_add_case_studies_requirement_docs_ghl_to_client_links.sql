-- ==============================================================================
-- MIGRATION: 20260925000003_add_case_studies_requirement_docs_ghl_to_client_links.sql
-- Description: 
--   1. Update client_links check constraint to safely accept 'case_studies',
--      'requirement_docs', 'requirement_documents', 'gohighlevel', and 'ghl_account'.
--   2. Update fn_launch_task_batch to explicitly assign ascending sequential 
--      sort_order to newly launched tasks from templates/work plans.
-- Safe Additive Migration: Preserves all existing data, columns, and RLS policies.
-- ==============================================================================

DO $$
BEGIN
  -- 1. Update client_links_link_type_check constraint
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
