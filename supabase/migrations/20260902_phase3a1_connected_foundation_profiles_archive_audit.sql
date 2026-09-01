-- ==============================================================================
-- FLC OPS HUB V2 — PHASE 3A.1 DATABASE MIGRATION
-- Migration: 20260902_phase3a1_connected_foundation_profiles_archive_audit.sql
-- Description: Connected System Foundation, Profiles, Logos, Archive Center & Global Audit Log
-- ==============================================================================

-- 1. ADDITIVE COLUMNS ON PROFILES
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bio') THEN
    ALTER TABLE public.profiles ADD COLUMN bio TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'linkedin_url') THEN
    ALTER TABLE public.profiles ADD COLUMN linkedin_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'contact_email') THEN
    ALTER TABLE public.profiles ADD COLUMN contact_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'backup_phone') THEN
    ALTER TABLE public.profiles ADD COLUMN backup_phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'archived_at') THEN
    ALTER TABLE public.profiles ADD COLUMN archived_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'archived_by') THEN
    ALTER TABLE public.profiles ADD COLUMN archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'archive_reason') THEN
    ALTER TABLE public.profiles ADD COLUMN archive_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'previous_status') THEN
    ALTER TABLE public.profiles ADD COLUMN previous_status TEXT;
  END IF;
END $$;

-- 2. ADDITIVE COLUMNS ON CLIENTS
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'logo_url') THEN
    ALTER TABLE public.clients ADD COLUMN logo_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'business_bio') THEN
    ALTER TABLE public.clients ADD COLUMN business_bio TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'industry') THEN
    ALTER TABLE public.clients ADD COLUMN industry TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'previous_status') THEN
    ALTER TABLE public.clients ADD COLUMN previous_status TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'archived_by') THEN
    ALTER TABLE public.clients ADD COLUMN archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'archive_reason') THEN
    ALTER TABLE public.clients ADD COLUMN archive_reason TEXT;
  END IF;
END $$;

-- 3. ADDITIVE COLUMNS ON CLIENT TASKS (IF NOT ALREADY PRESENT)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'archived_at') THEN
    ALTER TABLE public.client_tasks ADD COLUMN archived_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'archived_by') THEN
    ALTER TABLE public.client_tasks ADD COLUMN archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'archive_reason') THEN
    ALTER TABLE public.client_tasks ADD COLUMN archive_reason TEXT;
  END IF;
END $$;

-- 4. GLOBAL IMMUTABLE AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.system_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  previous_state JSONB,
  new_state JSONB,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexing for high-performance audit querying and filtering
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.system_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_client_id ON public.system_audit_events (client_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_id ON public.system_audit_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON public.system_audit_events (entity_type, entity_id);

-- Enable RLS on audit events
ALTER TABLE public.system_audit_events ENABLE ROW LEVEL SECURITY;

-- Security helper for viewing audit events
CREATE OR REPLACE FUNCTION app_private.can_view_audit_event(
  p_client_id UUID,
  p_actor_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_caller_role := app_private.get_caller_role();

  -- Owner sees all events company-wide
  IF v_caller_role = 'owner' THEN
    RETURN TRUE;
  END IF;

  -- Operational Manager sees events where they are the actor, or related to their managed clients, or their reporting team members
  IF v_caller_role = 'operational_manager' THEN
    IF p_actor_id = v_caller_id THEN
      RETURN TRUE;
    END IF;
    IF p_client_id IS NOT NULL AND app_private.can_manage_client(p_client_id) THEN
      RETURN TRUE;
    END IF;
    IF p_actor_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = p_actor_id AND reporting_manager_id = v_caller_id
    ) THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- Team member sees only events where they are the actor
  IF v_caller_role = 'team_member' THEN
    RETURN p_actor_id = v_caller_id;
  END IF;

  RETURN FALSE;
END;
$$;

-- RLS Policies on system_audit_events
DROP POLICY IF EXISTS "audit_select_policy" ON public.system_audit_events;
CREATE POLICY "audit_select_policy" ON public.system_audit_events
  FOR SELECT
  TO authenticated
  USING (
    app_private.can_view_audit_event(client_id, actor_id)
  );

DROP POLICY IF EXISTS "audit_insert_policy" ON public.system_audit_events;
CREATE POLICY "audit_insert_policy" ON public.system_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid() OR app_private.get_caller_role() IN ('owner', 'operational_manager')
  );

-- STRICT IMMUTABILITY: No UPDATE or DELETE allowed on audit events for application users
DROP POLICY IF EXISTS "audit_no_update" ON public.system_audit_events;
DROP POLICY IF EXISTS "audit_no_delete" ON public.system_audit_events;

-- 5. STORAGE BUCKETS SETUP (Additive)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('profile-avatars', 'profile-avatars', true),
  ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for profile-avatars
DROP POLICY IF EXISTS "avatar_public_read" ON storage.objects;
CREATE POLICY "avatar_public_read" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS "avatar_auth_insert" ON storage.objects;
CREATE POLICY "avatar_auth_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars' AND 
    (storage.foldername(name))[1] = 'avatars'
  );

DROP POLICY IF EXISTS "avatar_auth_update" ON storage.objects;
CREATE POLICY "avatar_auth_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-avatars' AND 
    (storage.foldername(name))[1] = 'avatars'
  );

-- Storage Policies for client-logos
DROP POLICY IF EXISTS "logo_public_read" ON storage.objects;
CREATE POLICY "logo_public_read" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'client-logos');

DROP POLICY IF EXISTS "logo_auth_insert" ON storage.objects;
CREATE POLICY "logo_auth_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-logos' AND 
    (storage.foldername(name))[1] = 'logos'
  );

DROP POLICY IF EXISTS "logo_auth_update" ON storage.objects;
CREATE POLICY "logo_auth_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'client-logos' AND 
    (storage.foldername(name))[1] = 'logos'
  );