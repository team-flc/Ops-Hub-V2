-- ==============================================================================
-- FORWARD MIGRATION: Phase 2B Dynamic LinkedIn Profiles & Lead Gen Tracking
-- Location: supabase/migrations/20260901_phase2b_client_linkedin_access.sql
-- Database: PostgreSQL / Supabase (jcaptlqenwmpfchjyipw)
-- Target: Repeatable LinkedIn profiles, Sales Navigator tracking & RLS
-- ==============================================================================

-- 1. Add required_linkedin_profile_count to public.clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS required_linkedin_profile_count INT NOT NULL DEFAULT 3 CHECK (required_linkedin_profile_count >= 1);

-- 2. Create public.client_linkedin_profiles Table
CREATE TABLE IF NOT EXISTS public.client_linkedin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_label TEXT NOT NULL,
  profile_url TEXT NOT NULL,
  sales_navigator_active BOOLEAN NOT NULL DEFAULT false,
  sales_navigator_activated_on DATE,
  sort_order INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT chk_sales_nav_date CHECK (
    sales_navigator_active = false OR (sales_navigator_active = true AND sales_navigator_activated_on IS NOT NULL)
  )
);

-- Unique index to prevent duplicate active profile URLs for the same client
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_linkedin_unique_active_url 
  ON public.client_linkedin_profiles(client_id, LOWER(profile_url)) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_client_linkedin_client ON public.client_linkedin_profiles(client_id, status);

-- 3. Add linkedin_profile_id column to public.client_audit_log if not present
ALTER TABLE public.client_audit_log
  ADD COLUMN IF NOT EXISTS linkedin_profile_id UUID REFERENCES public.client_linkedin_profiles(id) ON DELETE SET NULL;

-- 4. Enable Row Level Security (RLS) on client_linkedin_profiles
ALTER TABLE public.client_linkedin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_linkedin_profiles_select" ON public.client_linkedin_profiles;
DROP POLICY IF EXISTS "client_linkedin_profiles_insert_update" ON public.client_linkedin_profiles;
DROP POLICY IF EXISTS "client_linkedin_profiles_delete" ON public.client_linkedin_profiles;

-- SELECT: Accessible by any staff authorized on the client
CREATE POLICY "client_linkedin_profiles_select"
  ON public.client_linkedin_profiles
  FOR SELECT
  TO authenticated
  USING (app_private.can_access_client((SELECT auth.uid()), client_id));

-- INSERT / UPDATE: Permitted staff (including assigned Team Members) can add/update profiles
CREATE POLICY "client_linkedin_profiles_insert_update"
  ON public.client_linkedin_profiles
  FOR ALL
  TO authenticated
  USING (app_private.can_access_client((SELECT auth.uid()), client_id))
  WITH CHECK (app_private.can_access_client((SELECT auth.uid()), client_id));

-- DELETE: Owner & Assigned Operational Manager (Profiles are usually archived via status)
CREATE POLICY "client_linkedin_profiles_delete"
  ON public.client_linkedin_profiles
  FOR DELETE
  TO authenticated
  USING (app_private.can_manage_client((SELECT auth.uid()), client_id));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
