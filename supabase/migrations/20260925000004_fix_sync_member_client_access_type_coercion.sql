-- =============================================================================
-- Migration: 20260925000004_fix_sync_member_client_access_type_coercion.sql
-- Description:
--   1. Fix COALESCE type coercion mismatch (uuid[] vs text[]) in sync_member_client_access_tx RPC.
--   2. Synchronize canonical client_team_access (UUID) and profile_client_access (TEXT).
--   3. Enforce strict transactional atomicity: never return success if either access table fails.
--      Removed silent error-swallowing behavior (no exception swallowing).
--   4. Verify row count parity across both tables for 0, 1, and multiple clients.
--   5. Restrict EXECUTE to service_role; revoke from PUBLIC, anon, and authenticated so
--      ordinary users cannot call RPC directly to bypass manager-scope & open-task guards.
-- =============================================================================

-- Drop obsolete foreign key constraint referencing legacy empty clients_vendors table
ALTER TABLE public.profile_client_access DROP CONSTRAINT IF EXISTS profile_client_access_client_id_fkey;

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
  v_unique_client_ids UUID[];
  v_removed_client_ids UUID[];
  v_open_tasks_count INTEGER := 0;
  v_first_violating_client TEXT;
  v_cta_count INTEGER := 0;
  v_pca_count INTEGER := 0;
  v_expected_count INTEGER := 0;
BEGIN
  -- 1. Row-level lock on the target profile to serialize concurrent access modifications
  PERFORM 1 FROM public.profiles WHERE id = p_profile_id FOR UPDATE;

  -- 2. Deduplicate input client IDs array if provided
  IF p_new_client_ids IS NOT NULL AND cardinality(p_new_client_ids) > 0 THEN
    SELECT COALESCE(array_agg(DISTINCT cid), ARRAY[]::UUID[])
    INTO v_unique_client_ids
    FROM unnest(p_new_client_ids) AS cid
    WHERE cid IS NOT NULL;
  ELSE
    v_unique_client_ids := ARRAY[]::UUID[];
  END IF;

  v_expected_count := COALESCE(cardinality(v_unique_client_ids), 0);

  -- 3. Identify clients currently assigned that are being revoked.
  -- Query canonical client_team_access (UUID) and union profile_client_access (casting valid UUIDs),
  -- ensuring both sides of COALESCE evaluate strictly as UUID[] to prevent type coercion failure.
  SELECT COALESCE(array_agg(DISTINCT cid), ARRAY[]::UUID[])
  INTO v_removed_client_ids
  FROM (
    SELECT client_id AS cid
    FROM public.client_team_access
    WHERE profile_id = p_profile_id
      AND (v_expected_count = 0 OR client_id <> ALL(v_unique_client_ids))
    UNION
    SELECT client_id::UUID AS cid
    FROM public.profile_client_access
    WHERE profile_id = p_profile_id
      AND client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND (v_expected_count = 0 OR client_id::UUID <> ALL(v_unique_client_ids))
  ) sub;

  -- 4. If clients are being removed, verify zero open assigned tasks under those clients
  IF cardinality(v_removed_client_ids) > 0 THEN
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

  -- 5. Atomically sync both access tables in a single transaction
  DELETE FROM public.client_team_access WHERE profile_id = p_profile_id;
  DELETE FROM public.profile_client_access WHERE profile_id = p_profile_id;

  IF v_expected_count > 0 THEN
    -- Canonical client_team_access insert
    INSERT INTO public.client_team_access (profile_id, client_id, granted_by)
    SELECT p_profile_id, cid, p_actor_id
    FROM unnest(v_unique_client_ids) AS cid
    ON CONFLICT (client_id, profile_id) DO NOTHING;

    -- Backwards-compatible profile_client_access insert
    -- NOTE: Intentionally executed without silent error catching.
    -- Any failure (FK, constraint, trigger) must abort the entire transaction.
    INSERT INTO public.profile_client_access (profile_id, client_id, granted_by)
    SELECT p_profile_id, cid::text, p_actor_id
    FROM unnest(v_unique_client_ids) AS cid
    ON CONFLICT (profile_id, client_id) DO NOTHING;

    -- Verify both access tables were updated and match the expected count
    SELECT count(*) INTO v_cta_count FROM public.client_team_access WHERE profile_id = p_profile_id;
    SELECT count(*) INTO v_pca_count FROM public.profile_client_access WHERE profile_id = p_profile_id;

    IF v_cta_count <> v_expected_count OR v_pca_count <> v_expected_count THEN
      RAISE EXCEPTION 'Client access synchronization mismatch: expected % records, but client_team_access has % and profile_client_access has %.',
        v_expected_count, v_cta_count, v_pca_count;
    END IF;
  ELSE
    -- When clearing all access (0 clients), verify both tables have 0 rows remaining
    SELECT count(*) INTO v_cta_count FROM public.client_team_access WHERE profile_id = p_profile_id;
    SELECT count(*) INTO v_pca_count FROM public.profile_client_access WHERE profile_id = p_profile_id;

    IF v_cta_count <> 0 OR v_pca_count <> 0 THEN
      RAISE EXCEPTION 'Failed to clear client access: client_team_access has % rows and profile_client_access has % rows remaining.',
        v_cta_count, v_pca_count;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'assigned_clients_count', v_expected_count,
    'revoked_clients_count', COALESCE(cardinality(v_removed_client_ids), 0)
  );
END;
$$;

-- Restrict function execution strictly to service_role
-- Revoke from PUBLIC, anon, and authenticated so ordinary users cannot call RPC directly
REVOKE ALL ON FUNCTION public.sync_member_client_access_tx(UUID, UUID[], UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_member_client_access_tx(UUID, UUID[], UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_member_client_access_tx(UUID, UUID[], UUID) TO service_role;

-- =============================================================================
-- Comprehensive Transactional RPC: update_team_member_tx
-- Executes profile details update, department sync, and client access sync in a
-- single ACID database transaction. Eliminates any partial-write risk without
-- relying on compensating network rollbacks.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_team_member_tx(
  p_profile_id UUID,
  p_actor_id UUID,
  p_profile_data JSONB DEFAULT '{}'::jsonb,
  p_department_ids UUID[] DEFAULT NULL,
  p_client_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res JSONB;
BEGIN
  -- 1. Row-level lock on target profile
  PERFORM 1 FROM public.profiles WHERE id = p_profile_id FOR UPDATE;

  -- 2. Atomically update profile details
  IF p_profile_data IS NOT NULL AND p_profile_data <> '{}'::jsonb THEN
    UPDATE public.profiles
    SET
      full_name = CASE WHEN p_profile_data ? 'full_name' THEN p_profile_data->>'full_name' ELSE full_name END,
      phone = CASE WHEN p_profile_data ? 'phone' THEN p_profile_data->>'phone' ELSE phone END,
      backup_phone = CASE WHEN p_profile_data ? 'backup_phone' THEN p_profile_data->>'backup_phone' ELSE backup_phone END,
      contact_email = CASE WHEN p_profile_data ? 'contact_email' THEN p_profile_data->>'contact_email' ELSE contact_email END,
      linkedin_url = CASE WHEN p_profile_data ? 'linkedin_url' THEN p_profile_data->>'linkedin_url' ELSE linkedin_url END,
      bio = CASE WHEN p_profile_data ? 'bio' THEN p_profile_data->>'bio' ELSE bio END,
      avatar_url = CASE WHEN p_profile_data ? 'avatar_url' THEN p_profile_data->>'avatar_url' ELSE avatar_url END,
      cnic = CASE WHEN p_profile_data ? 'cnic' THEN p_profile_data->>'cnic' ELSE cnic END,
      designation_id = CASE
        WHEN p_profile_data ? 'designation_id' AND p_profile_data->>'designation_id' IS NOT NULL
        THEN (p_profile_data->>'designation_id')::UUID
        ELSE designation_id
      END,
      reporting_manager_id = CASE
        WHEN p_profile_data ? 'reporting_manager_id' AND p_profile_data->>'reporting_manager_id' IS NOT NULL
        THEN (p_profile_data->>'reporting_manager_id')::UUID
        ELSE reporting_manager_id
      END,
      start_date = CASE
        WHEN p_profile_data ? 'start_date' AND p_profile_data->>'start_date' IS NOT NULL
        THEN (p_profile_data->>'start_date')::DATE
        ELSE start_date
      END,
      role = CASE WHEN p_profile_data ? 'role' THEN p_profile_data->>'role' ELSE role END,
      updated_at = NOW()
    WHERE id = p_profile_id;
  END IF;

  -- 3. Atomically synchronize departments
  IF p_department_ids IS NOT NULL THEN
    DELETE FROM public.profile_departments WHERE profile_id = p_profile_id;
    IF cardinality(p_department_ids) > 0 THEN
      INSERT INTO public.profile_departments (profile_id, department_id, created_by)
      SELECT p_profile_id, dept_id, p_actor_id
      FROM unnest(p_department_ids) AS dept_id;
    END IF;
  END IF;

  -- 4. Atomically synchronize client access tables via sync_member_client_access_tx
  -- If client access update fails (open tasks block, parity error), entire transaction rolls back automatically
  IF p_client_ids IS NOT NULL THEN
    v_res := public.sync_member_client_access_tx(p_profile_id, p_client_ids, p_actor_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'client_sync', v_res
  );
END;
$$;

-- Restrict update_team_member_tx strictly to service_role
REVOKE ALL ON FUNCTION public.update_team_member_tx(UUID, UUID, JSONB, UUID[], UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_team_member_tx(UUID, UUID, JSONB, UUID[], UUID[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_team_member_tx(UUID, UUID, JSONB, UUID[], UUID[]) TO service_role;
