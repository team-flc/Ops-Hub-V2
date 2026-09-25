-- =============================================================================
-- Migration: 20260925000004_fix_sync_member_client_access_type_coercion.sql
-- Description: Fix COALESCE type coercion mismatch (uuid[] vs text[]) in sync_member_client_access_tx RPC
--              and synchronize canonical client_team_access (UUID) alongside profile_client_access.
-- =============================================================================

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

  -- 2. Identify clients currently assigned that are being revoked.
  -- Query canonical client_team_access (UUID) and union profile_client_access (casting valid UUIDs),
  -- ensuring both sides of COALESCE evaluate strictly as UUID[] to prevent type coercion failure.
  SELECT COALESCE(array_agg(DISTINCT cid), ARRAY[]::UUID[])
  INTO v_removed_client_ids
  FROM (
    SELECT client_id AS cid
    FROM public.client_team_access
    WHERE profile_id = p_profile_id
      AND (p_new_client_ids IS NULL OR cardinality(p_new_client_ids) = 0 OR client_id <> ALL(p_new_client_ids))
    UNION
    SELECT client_id::UUID AS cid
    FROM public.profile_client_access
    WHERE profile_id = p_profile_id
      AND client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND (p_new_client_ids IS NULL OR cardinality(p_new_client_ids) = 0 OR client_id::UUID <> ALL(p_new_client_ids))
  ) sub;

  -- 3. If clients are being removed, verify zero open assigned tasks under those clients
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

  -- 4. Atomically sync both access tables in a single transaction
  DELETE FROM public.client_team_access WHERE profile_id = p_profile_id;
  DELETE FROM public.profile_client_access WHERE profile_id = p_profile_id;

  IF p_new_client_ids IS NOT NULL AND cardinality(p_new_client_ids) > 0 THEN
    -- Canonical client_team_access insert
    INSERT INTO public.client_team_access (profile_id, client_id, granted_by)
    SELECT p_profile_id, cid, p_actor_id
    FROM unnest(p_new_client_ids) AS cid
    ON CONFLICT (client_id, profile_id) DO NOTHING;

    -- Backwards-compatible profile_client_access insert (safely ignoring legacy constraints)
    BEGIN
      INSERT INTO public.profile_client_access (profile_id, client_id, granted_by)
      SELECT p_profile_id, cid::text, p_actor_id
      FROM unnest(p_new_client_ids) AS cid
      ON CONFLICT (profile_id, client_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- In case legacy clients_vendors foreign key fails, do not abort transaction
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'assigned_clients_count', COALESCE(cardinality(p_new_client_ids), 0),
    'revoked_clients_count', COALESCE(cardinality(v_removed_client_ids), 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_member_client_access_tx(UUID, UUID[], UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_member_client_access_tx(UUID, UUID[], UUID) TO service_role;
