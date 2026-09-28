-- ==============================================================================
-- MIGRATION: 20260928000001_fix_client_creation_rls_and_tx.sql
-- PURPOSE: Fix Client Workspace Creation RLS Invisibility & Provide Atomic TX RPC
-- ==============================================================================
-- Root Cause:
-- 1. When Supabase executes supabase.from('clients').insert(...).select().single(),
--    PostgreSQL evaluates the table's SELECT policy (clients_select) for RETURNING *.
-- 2. Previously, clients_select used app_private.can_access_client(auth.uid(), id),
--    which ran a subquery: SELECT 1 FROM public.clients c WHERE c.id = target_client_id.
--    In PostgreSQL RLS evaluation, newly inserted tuples are NOT visible to separate
--    subqueries against the same table relation snapshot during INSERT ... RETURNING.
-- 3. For Owners, p.role = 'owner' returned TRUE without querying clients.
--    For Operational Managers, p.role = 'owner' was FALSE, and the subquery could not
--    find the in-flight row, throwing:
--    "new row violates row-level security policy for table 'clients'".
-- 4. Furthermore, if created_by was NULL, assigning another manager locked out the creator.
--
-- Solution:
-- 1. Redefine clients_select to inspect candidate tuple attributes directly
--    (operational_manager_id = auth.uid() OR created_by = auth.uid()) without circular subqueries.
-- 2. Add default auth.uid() and BEFORE INSERT trigger to ensure created_by is never NULL.
-- 3. Provide atomic create_client_tx RPC to eliminate partial-write risks.
-- ==============================================================================

-- 1. Role Helper Functions
CREATE OR REPLACE FUNCTION app_private.is_operational_manager(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
      AND role = 'operational_manager'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION app_private.is_team_member(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
      AND role = 'team_member'
      AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.is_operational_manager(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_operational_manager(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION app_private.is_team_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_team_member(UUID) TO service_role;

-- 2. Ensure created_by Default & Trigger on public.clients
ALTER TABLE public.clients ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.trg_fn_clients_set_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_set_created_by ON public.clients;
CREATE TRIGGER trg_clients_set_created_by
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_clients_set_created_by();

-- 3. Direct Tuple-Evaluating Policy for clients_select (No Circular Subqueries)
DROP POLICY IF EXISTS "clients_select" ON public.clients;

CREATE POLICY "clients_select"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    app_private.is_owner((SELECT auth.uid()))
    OR (
      app_private.is_operational_manager((SELECT auth.uid()))
      AND (
        operational_manager_id = (SELECT auth.uid())
        OR created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.client_team_access cta
          WHERE cta.client_id = clients.id AND cta.profile_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.profile_client_access pca
          WHERE pca.client_id = clients.id::text AND pca.profile_id = (SELECT auth.uid())
        )
      )
    )
    OR (
      app_private.is_team_member((SELECT auth.uid()))
      AND (
        EXISTS (
          SELECT 1 FROM public.client_team_access cta
          WHERE cta.client_id = clients.id AND cta.profile_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.profile_client_access pca
          WHERE pca.client_id = clients.id::text AND pca.profile_id = (SELECT auth.uid())
        )
      )
    )
  );

-- 4. Re-assert clients_insert Policy
DROP POLICY IF EXISTS "clients_insert" ON public.clients;

CREATE POLICY "clients_insert"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (app_private.is_manager_or_owner((SELECT auth.uid())));

-- 5. Atomic Transaction RPC: create_client_tx
CREATE OR REPLACE FUNCTION public.create_client_tx(
  p_client_data JSONB,
  p_links JSONB DEFAULT '[]'::jsonb,
  p_linkedin_profiles JSONB DEFAULT '[]'::jsonb,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_is_active BOOLEAN;
  v_client_id UUID;
  v_company_name TEXT;
  v_client_name TEXT;
  v_package TEXT;
  v_operational_manager_id UUID;
  v_activation_date DATE;
  v_status TEXT;
  v_pause_reason TEXT;
  v_required_linkedin_profile_count INTEGER;
  v_source_client_id UUID;
  v_link RECORD;
  v_profile RECORD;
  v_created_at TIMESTAMPTZ := NOW();
  v_links_result JSONB := '{}'::jsonb;
  v_profiles_result JSONB := '[]'::jsonb;
  v_new_profile RECORD;
BEGIN
  -- 1. Identify and verify caller
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    IF p_actor_id IS NOT NULL THEN
      v_caller_id := p_actor_id;
    ELSE
      RAISE EXCEPTION 'Authentication required to create a client workspace.';
    END IF;
  END IF;

  SELECT role, (status = 'active')
  INTO v_caller_role, v_is_active
  FROM public.profiles
  WHERE id = v_caller_id;

  IF v_caller_role IS NULL OR NOT v_is_active THEN
    RAISE EXCEPTION 'Caller profile not found or inactive.';
  END IF;

  IF v_caller_role NOT IN ('owner', 'operational_manager') THEN
    RAISE EXCEPTION 'Access denied. Only Owners and Operational Managers can create clients.';
  END IF;

  -- 2. Extract and validate client fields
  v_company_name := TRIM(p_client_data->>'company_name');
  v_client_name := TRIM(p_client_data->>'client_name');
  v_package := TRIM(p_client_data->>'package');
  v_operational_manager_id := (p_client_data->>'operational_manager_id')::UUID;
  v_activation_date := (p_client_data->>'activation_date')::DATE;
  v_status := COALESCE(NULLIF(TRIM(p_client_data->>'status'), ''), 'Onboarding');
  v_pause_reason := NULLIF(TRIM(p_client_data->>'pause_reason'), '');
  v_required_linkedin_profile_count := GREATEST(1, COALESCE((p_client_data->>'required_linkedin_profile_count')::INTEGER, 3));
  v_source_client_id := NULLIF(p_client_data->>'source_client_id', '')::UUID;

  IF v_company_name IS NULL OR v_company_name = '' THEN
    RAISE EXCEPTION 'Company Name is required.';
  END IF;
  IF v_client_name IS NULL OR v_client_name = '' THEN
    RAISE EXCEPTION 'Client/Owner Name is required.';
  END IF;
  IF v_package IS NULL OR v_package = '' THEN
    RAISE EXCEPTION 'Package selection is required.';
  END IF;
  IF v_operational_manager_id IS NULL THEN
    RAISE EXCEPTION 'Operational Manager is required.';
  END IF;
  IF v_activation_date IS NULL THEN
    RAISE EXCEPTION 'Activation Date is required.';
  END IF;

  -- 3. Insert Client Record
  INSERT INTO public.clients (
    company_name,
    client_name,
    package,
    operational_manager_id,
    activation_date,
    status,
    pause_reason,
    required_linkedin_profile_count,
    source_client_id,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    v_company_name,
    v_client_name,
    v_package,
    v_operational_manager_id,
    v_activation_date,
    v_status,
    CASE WHEN v_status = 'Paused' THEN COALESCE(v_pause_reason, 'Operational reason') ELSE NULL END,
    v_required_linkedin_profile_count,
    v_source_client_id,
    v_caller_id,
    v_created_at,
    v_created_at
  )
  RETURNING id INTO v_client_id;

  -- 4. Insert Links
  IF p_links IS NOT NULL AND jsonb_array_length(p_links) > 0 THEN
    FOR v_link IN SELECT * FROM jsonb_to_recordset(p_links) AS x(link_type TEXT, url TEXT) LOOP
      IF v_link.url IS NOT NULL AND TRIM(v_link.url) <> '' THEN
        INSERT INTO public.client_links (
          client_id,
          link_type,
          url,
          created_by,
          created_at,
          updated_at
        ) VALUES (
          v_client_id,
          v_link.link_type,
          TRIM(v_link.url),
          v_caller_id,
          v_created_at,
          v_created_at
        );
        v_links_result := jsonb_set(v_links_result, ARRAY[v_link.link_type], to_jsonb(TRIM(v_link.url)));
      END IF;
    END LOOP;
  END IF;

  -- 5. Insert LinkedIn Profiles
  IF p_linkedin_profiles IS NOT NULL AND jsonb_array_length(p_linkedin_profiles) > 0 THEN
    FOR v_profile IN SELECT * FROM jsonb_to_recordset(p_linkedin_profiles) AS x(
      profile_label TEXT,
      profile_url TEXT,
      sales_navigator_active BOOLEAN,
      sales_navigator_activated_on DATE,
      linkedin_verified BOOLEAN,
      has_gmail_account BOOLEAN,
      gmail_address TEXT,
      sort_order INTEGER
    ) LOOP
      IF v_profile.profile_url IS NOT NULL AND TRIM(v_profile.profile_url) <> '' THEN
        INSERT INTO public.client_linkedin_profiles (
          client_id,
          profile_label,
          profile_url,
          sales_navigator_active,
          sales_navigator_activated_on,
          linkedin_verified,
          has_gmail_account,
          gmail_address,
          sort_order,
          status,
          created_by,
          created_at,
          updated_at
        ) VALUES (
          v_client_id,
          COALESCE(NULLIF(TRIM(v_profile.profile_label), ''), 'LinkedIn ID'),
          TRIM(v_profile.profile_url),
          COALESCE(v_profile.sales_navigator_active, false),
          CASE WHEN v_profile.sales_navigator_active THEN v_profile.sales_navigator_activated_on ELSE NULL END,
          COALESCE(v_profile.linkedin_verified, false),
          COALESCE(v_profile.has_gmail_account, false),
          CASE WHEN v_profile.has_gmail_account THEN NULLIF(TRIM(v_profile.gmail_address), '') ELSE NULL END,
          COALESCE(v_profile.sort_order, 0),
          'active',
          v_caller_id,
          v_created_at,
          v_created_at
        )
        RETURNING * INTO v_new_profile;

        v_profiles_result := v_profiles_result || jsonb_build_array(jsonb_build_object(
          'id', v_new_profile.id,
          'clientId', v_new_profile.client_id,
          'profileLabel', v_new_profile.profile_label,
          'profileUrl', v_new_profile.profile_url,
          'salesNavigatorActive', v_new_profile.sales_navigator_active,
          'salesNavigatorActivatedOn', v_new_profile.sales_navigator_activated_on,
          'linkedinVerified', v_new_profile.linkedin_verified,
          'hasGmailAccount', v_new_profile.has_gmail_account,
          'gmailAddress', v_new_profile.gmail_address,
          'sortOrder', v_new_profile.sort_order,
          'status', v_new_profile.status,
          'createdBy', v_new_profile.created_by,
          'createdAt', v_new_profile.created_at,
          'updatedAt', v_new_profile.updated_at
        ));
      END IF;
    END LOOP;
  END IF;

  -- 6. Insert Audit Log
  INSERT INTO public.client_audit_log (
    client_id,
    actor_id,
    action,
    safe_metadata
  ) VALUES (
    v_client_id,
    v_caller_id,
    'client_created',
    jsonb_build_object(
      'companyName', v_company_name,
      'package', v_package,
      'managerId', v_operational_manager_id,
      'requiredLinkedinProfileCount', v_required_linkedin_profile_count,
      'linkedinProfilesCount', jsonb_array_length(v_profiles_result)
    )
  );

  -- 7. Return complete object
  RETURN jsonb_build_object(
    'id', v_client_id,
    'companyName', v_company_name,
    'clientName', v_client_name,
    'package', v_package,
    'operationalManagerId', v_operational_manager_id,
    'activationDate', v_activation_date,
    'status', v_status,
    'pauseReason', v_pause_reason,
    'requiredLinkedinProfileCount', v_required_linkedin_profile_count,
    'sourceClientId', v_source_client_id,
    'links', v_links_result,
    'linkedinProfiles', v_profiles_result,
    'createdBy', v_caller_id,
    'createdAt', v_created_at,
    'updatedAt', v_created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_client_tx(JSONB, JSONB, JSONB, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_client_tx(JSONB, JSONB, JSONB, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_client_tx(JSONB, JSONB, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_client_tx(JSONB, JSONB, JSONB, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
