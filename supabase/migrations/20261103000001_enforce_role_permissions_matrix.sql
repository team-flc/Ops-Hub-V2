-- ==============================================================================
-- MIGRATION: 20261103000001_enforce_role_permissions_matrix.sql
-- PURPOSE: Enforce strict role & designation governance for Add Client and Add Task
--
-- MATRIX:
-- 1. Interns see neither Add Client nor Add Task anywhere.
-- 2. Add Client: ONLY Owner/Founder, Manager, and Team Leads.
-- 3. Add Task: ONLY decision makers (Team Lead, Team Manager, Owner/Founder, CFO).
-- ==============================================================================

-- 1. Hardened create_client_tx RPC with strict role & designation validation
CREATE OR REPLACE FUNCTION public.create_client_tx(
  p_client_data JSONB,
  p_links JSONB DEFAULT '[]'::jsonb,
  p_linkedin_profiles JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_designation TEXT;
  v_is_active BOOLEAN;
  v_client_id UUID;
  v_company_name TEXT;
  v_client_name TEXT;
  v_package TEXT;
  v_operational_manager_id UUID;
  v_assigned_manager_role TEXT;
  v_is_assigned_manager_active BOOLEAN;
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
  v_is_allowed BOOLEAN := FALSE;
BEGIN
  -- 1. Identify caller strictly from auth.uid()
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a client workspace.';
  END IF;

  SELECT p.role, (p.status = 'active'), COALESCE(d.name, '')
  INTO v_caller_role, v_is_active, v_caller_designation
  FROM public.profiles p
  LEFT JOIN public.designations d ON d.id = p.designation_id
  WHERE p.id = v_caller_id;

  IF v_caller_role IS NULL OR NOT v_is_active THEN
    RAISE EXCEPTION 'Caller profile not found or inactive.';
  END IF;

  -- Interns must NOT create clients under any circumstances
  IF LOWER(v_caller_designation) LIKE '%intern%' OR LOWER(v_caller_role) LIKE '%intern%' THEN
    RAISE EXCEPTION 'Access denied. Interns cannot create clients.';
  END IF;

  -- Add Client is permitted ONLY for Owner/Founder, Manager, and Team Leads
  IF v_caller_role IN ('owner', 'operational_manager') THEN
    v_is_allowed := TRUE;
  ELSIF LOWER(v_caller_designation) LIKE '%team lead%' 
     OR LOWER(v_caller_designation) LIKE '%lead%' 
     OR LOWER(v_caller_designation) LIKE '%manager%' 
     OR LOWER(v_caller_designation) LIKE '%founder%' 
     OR LOWER(v_caller_designation) LIKE '%owner%' THEN
    v_is_allowed := TRUE;
  END IF;

  IF NOT v_is_allowed THEN
    RAISE EXCEPTION 'Access denied. Only Owner, Manager, or Team Lead can create clients.';
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

  -- Verify assigned operational manager is active staff
  SELECT role, (status = 'active')
  INTO v_assigned_manager_role, v_is_assigned_manager_active
  FROM public.profiles
  WHERE id = v_operational_manager_id;

  IF v_assigned_manager_role IS NULL OR NOT v_is_assigned_manager_active THEN
    RAISE EXCEPTION 'Assigned Operational Manager profile is invalid or inactive.';
  END IF;

  -- 3. Atomic Insert into public.clients
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
  )
  VALUES (
    v_company_name,
    v_client_name,
    v_package,
    v_operational_manager_id,
    v_activation_date,
    v_status,
    v_pause_reason,
    v_required_linkedin_profile_count,
    v_source_client_id,
    v_caller_id,
    v_created_at,
    v_created_at
  )
  RETURNING id INTO v_client_id;

  -- 4. Audit Log Entry
  INSERT INTO public.audit_logs (
    entity_type,
    entity_id,
    action,
    actor_id,
    actor_email,
    payload,
    created_at
  )
  VALUES (
    'client',
    v_client_id,
    'client_created',
    v_caller_id,
    (SELECT email FROM auth.users WHERE id = v_caller_id),
    jsonb_build_object(
      'company_name', v_company_name,
      'client_name', v_client_name,
      'status', v_status,
      'operational_manager_id', v_operational_manager_id
    ),
    v_created_at
  );

  RETURN jsonb_build_object(
    'success', true,
    'client_id', v_client_id
  );
END;
$$;

-- 2. Update can_manage_client to enforce decision maker privileges and block interns
CREATE OR REPLACE FUNCTION app_private.can_manage_client(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_designation TEXT;
BEGIN
  SELECT p.role, COALESCE(d.name, '')
  INTO v_role, v_designation
  FROM public.profiles p
  LEFT JOIN public.designations d ON d.id = p.designation_id
  WHERE p.id = (SELECT auth.uid()) AND p.status = 'active';

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Interns can NEVER manage client tasks
  IF LOWER(v_designation) LIKE '%intern%' OR LOWER(v_role) LIKE '%intern%' THEN
    RETURN FALSE;
  END IF;

  -- Owner / Founder always has permission
  IF v_role = 'owner' THEN
    RETURN TRUE;
  END IF;

  -- Operational Manager of client
  IF v_role = 'operational_manager' AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = target_client_id 
      AND (c.operational_manager_id = (SELECT auth.uid()) OR c.created_by = (SELECT auth.uid()))
  ) THEN
    RETURN TRUE;
  END IF;

  -- Decision makers: Team Lead, Team Manager, CFO
  IF LOWER(v_designation) LIKE '%team lead%' 
     OR LOWER(v_designation) LIKE '%lead%' 
     OR LOWER(v_designation) LIKE '%team manager%' 
     OR LOWER(v_designation) LIKE '%manager%' 
     OR LOWER(v_designation) LIKE '%cfo%' 
     OR LOWER(v_designation) LIKE '%founder%' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
