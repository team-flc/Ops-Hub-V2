-- ==============================================================================
-- FORWARD MIGRATION: Team Member Client Links & Details Permissions RPC
-- Location: supabase/migrations/20260922000002_team_member_client_links_and_details.sql
-- Description: Allows team members to add new links and empty bio/industry fields
-- while preventing modification of existing management links or executive fields.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_save_client_details_and_links(
  p_client_id UUID,
  p_updates JSONB DEFAULT '{}'::jsonb,
  p_links JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_client public.clients%ROWTYPE;
  v_link_key TEXT;
  v_link_val TEXT;
  v_existing_url TEXT;
  v_new_bio TEXT;
  v_new_industry TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = v_caller_id AND status = 'active';

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Active staff profile required.';
  END IF;

  -- Verify client exists and caller has access
  SELECT * INTO v_client
  FROM public.clients
  WHERE id = p_client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found.';
  END IF;

  IF v_client.status = 'Archived' THEN
    RAISE EXCEPTION 'Cannot modify an archived client workspace.';
  END IF;

  IF NOT app_private.can_access_client(v_caller_id, p_client_id) THEN
    RAISE EXCEPTION 'Forbidden: You do not have access to this client workspace.';
  END IF;

  -- 1. Management / Owner Branch
  IF v_caller_role IN ('owner', 'operational_manager') THEN
    -- Update clients table if updates provided
    UPDATE public.clients
    SET
      company_name = COALESCE(NULLIF(TRIM(p_updates->>'companyName'), ''), company_name),
      client_name = COALESCE(NULLIF(TRIM(p_updates->>'clientName'), ''), client_name),
      business_bio = CASE WHEN p_updates ? 'businessBio' THEN NULLIF(TRIM(p_updates->>'businessBio'), '') ELSE business_bio END,
      industry = CASE WHEN p_updates ? 'industry' THEN NULLIF(TRIM(p_updates->>'industry'), '') ELSE industry END,
      logo_url = CASE WHEN p_updates ? 'logoUrl' THEN NULLIF(TRIM(p_updates->>'logoUrl'), '') ELSE logo_url END,
      package = COALESCE((p_updates->>'package')::text, package),
      operational_manager_id = COALESCE((p_updates->>'operationalManagerId')::uuid, operational_manager_id),
      activation_date = COALESCE((p_updates->>'activationDate')::date, activation_date),
      status = COALESCE((p_updates->>'status')::text, status),
      pause_reason = CASE WHEN (p_updates->>'status') = 'Paused' THEN COALESCE((p_updates->>'pauseReason')::text, 'Operational reason') ELSE pause_reason END,
      required_linkedin_profile_count = COALESCE((p_updates->>'requiredLinkedinProfileCount')::integer, required_linkedin_profile_count),
      updated_at = NOW()
    WHERE id = p_client_id;

    -- Update or delete links
    IF p_links IS NOT NULL AND p_links != '{}'::jsonb THEN
      FOR v_link_key, v_link_val IN SELECT * FROM jsonb_each_text(p_links)
      LOOP
        IF v_link_val IS NOT NULL AND TRIM(v_link_val) != '' THEN
          INSERT INTO public.client_links (client_id, link_type, url, created_by, updated_at)
          VALUES (p_client_id, v_link_key, TRIM(v_link_val), v_caller_id, NOW())
          ON CONFLICT (client_id, link_type)
          DO UPDATE SET
            url = EXCLUDED.url,
            updated_at = NOW();
        ELSE
          DELETE FROM public.client_links
          WHERE client_id = p_client_id AND link_type = v_link_key;
        END IF;
      END LOOP;
    END IF;

    -- Record Audit
    INSERT INTO public.client_audit_log (client_id, actor_id, action, safe_metadata)
    VALUES (p_client_id, v_caller_id, 'client_updated', jsonb_build_object('updated_by_role', v_caller_role));

    RETURN jsonb_build_object('success', true, 'client_id', p_client_id);
  END IF;

  -- 2. Team Member Branch
  IF v_caller_role = 'team_member' THEN
    -- Only allow setting empty bio or empty industry
    v_new_bio := NULLIF(TRIM(p_updates->>'businessBio'), '');
    v_new_industry := NULLIF(TRIM(p_updates->>'industry'), '');

    IF (v_client.business_bio IS NULL OR TRIM(v_client.business_bio) = '') AND v_new_bio IS NOT NULL THEN
      UPDATE public.clients SET business_bio = v_new_bio, updated_at = NOW() WHERE id = p_client_id;
    END IF;

    IF (v_client.industry IS NULL OR TRIM(v_client.industry) = '') AND v_new_industry IS NOT NULL THEN
      UPDATE public.clients SET industry = v_new_industry, updated_at = NOW() WHERE id = p_client_id;
    END IF;

    -- Process links: team member can ONLY add a link if previously empty/missing
    IF p_links IS NOT NULL AND p_links != '{}'::jsonb THEN
      FOR v_link_key, v_link_val IN SELECT * FROM jsonb_each_text(p_links)
      LOOP
        IF v_link_val IS NOT NULL AND TRIM(v_link_val) != '' THEN
          -- Check if an existing non-empty link exists
          SELECT url INTO v_existing_url
          FROM public.client_links
          WHERE client_id = p_client_id AND link_type = v_link_key;

          IF v_existing_url IS NULL OR TRIM(v_existing_url) = '' THEN
            -- Link was empty: allow team member to insert
            INSERT INTO public.client_links (client_id, link_type, url, created_by, updated_at)
            VALUES (p_client_id, v_link_key, TRIM(v_link_val), v_caller_id, NOW())
            ON CONFLICT (client_id, link_type)
            DO UPDATE SET
              url = EXCLUDED.url,
              updated_at = NOW();
          END IF;
          -- If existing link is already non-empty, team member change is ignored/protected.
        END IF;
      END LOOP;
    END IF;

    -- Record Audit
    INSERT INTO public.client_audit_log (client_id, actor_id, action, safe_metadata)
    VALUES (p_client_id, v_caller_id, 'client_links_added_by_team_member', jsonb_build_object('actor_role', 'team_member'));

    RETURN jsonb_build_object('success', true, 'client_id', p_client_id);
  END IF;

  RAISE EXCEPTION 'Unauthorized role for client update.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_save_client_details_and_links(UUID, JSONB, JSONB) TO authenticated;
