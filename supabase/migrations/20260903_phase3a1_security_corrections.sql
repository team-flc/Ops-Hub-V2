-- ==============================================================================
-- FLC OPS HUB V2 — PHASE 3A.1 SECURITY CORRECTIONS & HARDENING MIGRATION
-- Migration: 20260903_phase3a1_security_corrections.sql
-- Description: Enforce Private Storage (signed delivery), server-authoritative
--              audit immutability, scoped audit access, and strict RLS safeguards.
-- Status: PREPARED FOR REVIEW — NOT APPLIED TO PRODUCTION
-- ==============================================================================

-- 1. HARDEN STORAGE BUCKETS (CONVERT TO PRIVATE)
UPDATE storage.buckets
SET public = false
WHERE id IN ('profile-avatars', 'client-logos');

-- If buckets do not exist yet, create them with public = false
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('profile-avatars', 'profile-avatars', false),
  ('client-logos', 'client-logos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. DROP PERMISSIVE / PUBLIC STORAGE POLICIES
DROP POLICY IF EXISTS "Public Avatar Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Client Logo Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Upload Policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Update/Delete Policy" ON storage.objects;
DROP POLICY IF EXISTS "Client Logo Upload Policy" ON storage.objects;
DROP POLICY IF EXISTS "Client Logo Update/Delete Policy" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Avatar Read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Logo Read" ON storage.objects;

-- 3. RE-CREATE AUTHORIZED PRIVATE STORAGE POLICIES FOR PROFILE-AVATARS
-- Read: Authenticated staff can read avatars via signed URL / authorized download
CREATE POLICY "Private Avatar Read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'profile-avatars');

-- Insert: Staff can upload avatar to their own folder, or owner/manager can upload for any staff
CREATE POLICY "Private Avatar Upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars' AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager')
      ) OR
      (storage.foldername(name))[1] = auth.uid()::text OR
      name LIKE auth.uid()::text || '/%'
    )
  );

-- Update/Delete: User can update/delete their own avatar, or owner/manager can manage any
CREATE POLICY "Private Avatar Modify"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-avatars' AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager')
      ) OR
      (storage.foldername(name))[1] = auth.uid()::text OR
      name LIKE auth.uid()::text || '/%'
    )
  );

CREATE POLICY "Private Avatar Delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-avatars' AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager')
      ) OR
      (storage.foldername(name))[1] = auth.uid()::text OR
      name LIKE auth.uid()::text || '/%'
    )
  );

-- 4. RE-CREATE AUTHORIZED PRIVATE STORAGE POLICIES FOR CLIENT-LOGOS
-- Read: Authenticated staff with access to the client, or owner/manager
CREATE POLICY "Private Logo Read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-logos' AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager')
      ) OR
      EXISTS (
        SELECT 1 FROM public.client_team_access
        WHERE profile_id = auth.uid() 
          AND client_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Upload: Owner, operational_manager, or team member with explicit client access
CREATE POLICY "Private Logo Upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-logos' AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager')
      ) OR
      EXISTS (
        SELECT 1 FROM public.client_team_access
        WHERE profile_id = auth.uid() 
          AND client_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Modify: Owner, operational manager, or authorized team member
CREATE POLICY "Private Logo Modify"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'client-logos' AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager')
      ) OR
      EXISTS (
        SELECT 1 FROM public.client_team_access
        WHERE profile_id = auth.uid() 
          AND client_id::text = (storage.foldername(name))[1]
      )
    )
  );

CREATE POLICY "Private Logo Delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-logos' AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager')
      ) OR
      EXISTS (
        SELECT 1 FROM public.client_team_access
        WHERE profile_id = auth.uid() 
          AND client_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- 5. SERVER-AUTHORITATIVE AUDIT IMMUTABILITY
-- Revoke direct arbitrary INSERT permissions from client roles (anon, authenticated)
-- Only service_role or server-side security definer functions / Edge Functions can insert
REVOKE INSERT, UPDATE, DELETE ON public.system_audit_events FROM anon, authenticated;

DROP POLICY IF EXISTS "system_audit_events_insert" ON public.system_audit_events;
DROP POLICY IF EXISTS "system_audit_events_select" ON public.system_audit_events;

-- Re-create strictly scoped SELECT policy:
-- Owner: Full access
-- Operational Manager: Only events within their operational scope (self or managed clients)
-- Team Member: Zero access (fail closed)
CREATE POLICY "system_audit_events_scoped_select"
  ON public.system_audit_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    ) OR (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'operational_manager'
      ) AND (
        actor_id = auth.uid() OR
        client_id IN (
          SELECT id FROM public.clients WHERE operational_manager_id = auth.uid()
        )
      )
    )
  );

-- 6. IMMUTABLE APPEND-ONLY SAFEGUARD
-- Ensure NO UPDATE or DELETE is EVER allowed on system_audit_events
CREATE OR REPLACE FUNCTION public.prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Security violation: system_audit_events records are append-only and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_audit_tampering ON public.system_audit_events;
CREATE TRIGGER trg_prevent_audit_tampering
  BEFORE UPDATE OR DELETE ON public.system_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_tampering();

-- 7. CLIENT PAUSE & ARCHIVE DATABASE SAFEGUARD
-- Prevent creating tasks for paused or archived clients directly
CREATE OR REPLACE FUNCTION public.validate_task_client_status()
RETURNS TRIGGER AS $$
DECLARE
  c_status TEXT;
BEGIN
  SELECT status INTO c_status FROM public.clients WHERE id = NEW.client_id;
  IF c_status = 'Paused' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Cannot create tasks for a paused client.';
    ELSIF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id OR OLD.title IS DISTINCT FROM NEW.title OR OLD.due_date IS DISTINCT FROM NEW.due_date) THEN
      RAISE EXCEPTION 'Cannot modify tasks for a paused client.';
    END IF;
  END IF;
  IF c_status = 'Archived' THEN
    RAISE EXCEPTION 'Cannot create or modify tasks for an archived client.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_task_client_status ON public.client_tasks;
CREATE TRIGGER trg_validate_task_client_status
  BEFORE INSERT OR UPDATE ON public.client_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_client_status();
