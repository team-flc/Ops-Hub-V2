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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_audit_tampering ON public.system_audit_events;
CREATE TRIGGER trg_prevent_audit_tampering
  BEFORE UPDATE OR DELETE ON public.system_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_tampering();

-- 7. CLIENT PAUSE TRACKING & TASK DATABASE SAFEGUARD
-- Ensure pause metadata columns exist for authoritative tracking
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS paused_by UUID REFERENCES public.profiles(id);

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
    ELSIF TG_OP = 'UPDATE' AND (
      OLD.status IS DISTINCT FROM NEW.status OR 
      OLD.assignee_id IS DISTINCT FROM NEW.assignee_id OR 
      OLD.title IS DISTINCT FROM NEW.title OR 
      OLD.due_date IS DISTINCT FROM NEW.due_date
    ) THEN
      RAISE EXCEPTION 'Cannot modify tasks for a paused client.';
    END IF;
  END IF;
  IF c_status = 'Archived' THEN
    RAISE EXCEPTION 'Cannot create or modify tasks for an archived client.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_task_client_status ON public.client_tasks;
CREATE TRIGGER trg_validate_task_client_status
  BEFORE INSERT OR UPDATE ON public.client_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_client_status();

-- 8. TRANSACTIONAL CLIENT ACCESS SYNCHRONIZATION RPC
-- Atomic synchronization of profile_client_access and client_team_access with row locking
-- and open-task validation before revocation. Runs inside a single PostgreSQL ACID transaction.
CREATE OR REPLACE FUNCTION public.sync_member_client_access_tx(
  p_profile_id UUID,
  p_new_client_ids UUID[],
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_removed_client_ids UUID[];
  v_open_tasks_count INTEGER := 0;
  v_first_violating_client TEXT;
BEGIN
  -- 1. Row-level lock on the target profile to serialize concurrent access modifications
  PERFORM 1 FROM public.profiles WHERE id = p_profile_id FOR UPDATE;

  -- 2. Identify clients currently assigned that are being revoked
  SELECT COALESCE(array_agg(client_id), ARRAY[]::UUID[])
  INTO v_removed_client_ids
  FROM public.profile_client_access
  WHERE profile_id = p_profile_id
    AND (p_new_client_ids IS NULL OR client_id <> ALL(p_new_client_ids));

  -- 3. If clients are being removed, verify zero open assigned tasks under those clients
  IF array_length(v_removed_client_ids, 1) > 0 THEN
    SELECT count(*), min(c.company_name)
    INTO v_open_tasks_count, v_first_violating_client
    FROM public.client_tasks t
    JOIN public.clients c ON c.id = t.client_id
    WHERE t.assignee_id = p_profile_id
      AND t.client_id = ANY(v_removed_client_ids)
      AND t.status IN ('Assigned', 'In Progress', 'Blocked', 'Team Review')
      AND t.archived_at IS NULL;

    IF v_open_tasks_count > 0 THEN
      RAISE EXCEPTION 'Cannot revoke client access: team member has % open assigned task(s) on % being removed. Reassign all open tasks before revoking client access.',
        v_open_tasks_count, COALESCE(v_first_violating_client, 'clients');
    END IF;
  END IF;

  -- 4. Atomically sync both access tables in a single transaction
  DELETE FROM public.profile_client_access WHERE profile_id = p_profile_id;
  DELETE FROM public.client_team_access WHERE profile_id = p_profile_id;

  IF p_new_client_ids IS NOT NULL AND array_length(p_new_client_ids, 1) > 0 THEN
    INSERT INTO public.profile_client_access (profile_id, client_id, granted_by)
    SELECT p_profile_id, cid, p_actor_id
    FROM unnest(p_new_client_ids) AS cid;

    INSERT INTO public.client_team_access (profile_id, client_id)
    SELECT p_profile_id, cid
    FROM unnest(p_new_client_ids) AS cid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'assigned_clients_count', COALESCE(array_length(p_new_client_ids, 1), 0),
    'revoked_clients_count', COALESCE(array_length(v_removed_client_ids, 1), 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_member_client_access_tx(UUID, UUID[], UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_member_client_access_tx(UUID, UUID[], UUID) TO service_role;

-- 9. SERVER-AUTHORITATIVE CLIENT MUTATION AUDIT TRIGGER
-- Ensures every client creation, status change (pause/resume), or modification is
-- automatically and immutably logged to system_audit_events on the database server.
CREATE OR REPLACE FUNCTION public.audit_client_mutations()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_reason TEXT := NULL;
  v_actor_id UUID;
  v_actor_name TEXT := 'System';
  v_actor_role TEXT := 'system';
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NOT NULL THEN
    SELECT full_name, role INTO v_actor_name, v_actor_role
    FROM public.profiles WHERE id = v_actor_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'client_created';
    v_reason := 'New client workspace provisioned';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'Paused' THEN
        v_action := 'client_paused';
        v_reason := COALESCE(NEW.pause_reason, 'Client paused by manager/owner');
      ELSIF OLD.status = 'Paused' THEN
        v_action := 'client_resumed';
        v_reason := 'Client resumed to active operations';
      ELSIF NEW.status = 'Archived' THEN
        v_action := 'client_archived';
        v_reason := COALESCE(NEW.archive_reason, 'Client archived');
      ELSE
        v_action := 'client_status_changed';
        v_reason := 'Status updated to ' || NEW.status;
      END IF;
    ELSE
      v_action := 'client_updated';
    END IF;
  ELSE
    v_action := 'client_deleted';
  END IF;

  INSERT INTO public.system_audit_events (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    entity_name,
    client_id,
    client_name,
    previous_state,
    new_state,
    reason,
    created_at
  ) VALUES (
    v_actor_id,
    COALESCE(v_actor_name, 'System'),
    COALESCE(v_actor_role, 'system'),
    v_action,
    'client',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.company_name, OLD.company_name),
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.company_name, OLD.company_name),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_reason,
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_audit_client_mutations ON public.clients;
CREATE TRIGGER trg_audit_client_mutations
  AFTER INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_client_mutations();
