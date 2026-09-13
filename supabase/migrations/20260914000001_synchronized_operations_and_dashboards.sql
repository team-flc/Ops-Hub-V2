-- ==============================================================================
-- FLC OPS HUB V2 — SYNCHRONIZED TEAM OPERATIONS & ROLE DASHBOARDS
-- Migration: 20260914000001_synchronized_operations_and_dashboards.sql
-- Description:
--   1. Repair app_private.can_access_client and app_private.can_manage_client to
--      include client_team_access and profile_client_access for operational managers.
--   2. Add single-argument overloads for can_access_client(UUID) and can_manage_client(UUID).
--   3. Enable daily work reports on employee_work_reports (update CHECK constraint,
--      add tasks_summary JSONB, next_plan TEXT, missing_flag BOOLEAN).
--   4. Refine client_tasks RLS to guarantee internal staff can view, create, and update
--      tasks across all accessible clients without permission lockouts.
--   5. Ensure self-access RLS on employee_records, employee_bank_details, and employee_work_reports.
-- ==============================================================================

-- 1. REPAIR CAN_ACCESS_CLIENT & CAN_MANAGE_CLIENT
CREATE OR REPLACE FUNCTION app_private.can_access_client(caller_id UUID, target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = caller_id AND p.status = 'active' AND (
      p.role = 'owner'
      OR (
        p.role = 'operational_manager' AND (
          EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = target_client_id 
              AND (c.operational_manager_id = caller_id OR c.created_by = caller_id)
          )
          OR EXISTS (
            SELECT 1 FROM public.client_team_access cta
            WHERE cta.client_id = target_client_id AND cta.profile_id = caller_id
          )
          OR EXISTS (
            SELECT 1 FROM public.profile_client_access pca
            WHERE pca.client_id = target_client_id::text AND pca.profile_id = caller_id
          )
        )
      )
      OR (
        p.role = 'team_member' AND (
          EXISTS (
            SELECT 1 FROM public.client_team_access cta
            WHERE cta.client_id = target_client_id AND cta.profile_id = caller_id
          )
          OR EXISTS (
            SELECT 1 FROM public.profile_client_access pca
            WHERE pca.client_id = target_client_id::text AND pca.profile_id = caller_id
          )
        )
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.can_access_client(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.can_access_client(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT app_private.can_access_client((SELECT auth.uid()), target_client_id);
$$;

GRANT EXECUTE ON FUNCTION app_private.can_access_client(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.can_manage_client(caller_id UUID, target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = caller_id AND p.status = 'active' AND (
      p.role = 'owner'
      OR (
        p.role = 'operational_manager' AND (
          EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = target_client_id 
              AND (c.operational_manager_id = caller_id OR c.created_by = caller_id)
          )
          OR EXISTS (
            SELECT 1 FROM public.client_team_access cta
            WHERE cta.client_id = target_client_id AND cta.profile_id = caller_id
          )
          OR EXISTS (
            SELECT 1 FROM public.profile_client_access pca
            WHERE pca.client_id = target_client_id::text AND pca.profile_id = caller_id
          )
        )
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.can_manage_client(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.can_manage_client(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT app_private.can_manage_client((SELECT auth.uid()), target_client_id);
$$;

GRANT EXECUTE ON FUNCTION app_private.can_manage_client(UUID) TO authenticated;


-- 2. ENHANCE EMPLOYEE WORK REPORTS
ALTER TABLE public.employee_work_reports DROP CONSTRAINT IF EXISTS employee_work_reports_report_type_check;
ALTER TABLE public.employee_work_reports ADD CONSTRAINT employee_work_reports_report_type_check 
  CHECK (report_type IN ('daily', 'weekly', 'monthly'));

ALTER TABLE public.employee_work_reports ADD COLUMN IF NOT EXISTS tasks_summary JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.employee_work_reports ADD COLUMN IF NOT EXISTS next_plan TEXT;
ALTER TABLE public.employee_work_reports ADD COLUMN IF NOT EXISTS missing_flag BOOLEAN DEFAULT false;

-- Work Reports RLS: Ensure employees can insert/update their own reports
DROP POLICY IF EXISTS "Employee can read own work reports" ON public.employee_work_reports;
CREATE POLICY "Employee can read own work reports"
    ON public.employee_work_reports FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Employee can submit own work reports" ON public.employee_work_reports;
CREATE POLICY "Employee can submit own work reports"
    ON public.employee_work_reports FOR INSERT TO authenticated
    WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "Employee can update own work reports" ON public.employee_work_reports;
CREATE POLICY "Employee can update own work reports"
    ON public.employee_work_reports FOR UPDATE TO authenticated
    USING (employee_id = auth.uid())
    WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "Management can manage work reports" ON public.employee_work_reports;
CREATE POLICY "Management can manage work reports"
    ON public.employee_work_reports FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

-- 3. REINFORCE CLIENT TASKS RLS POLICIES
DROP POLICY IF EXISTS "client_tasks_select" ON public.client_tasks;
CREATE POLICY "client_tasks_select" ON public.client_tasks
FOR SELECT TO authenticated
USING (
    app_private.can_access_client(client_id)
    OR assignee_id = auth.uid()
    OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "client_tasks_insert" ON public.client_tasks;
CREATE POLICY "client_tasks_insert" ON public.client_tasks
FOR INSERT TO authenticated
WITH CHECK (
    app_private.can_access_client(client_id)
);

DROP POLICY IF EXISTS "client_tasks_update" ON public.client_tasks;
CREATE POLICY "client_tasks_update" ON public.client_tasks
FOR UPDATE TO authenticated
USING (
    app_private.can_access_client(client_id)
    OR assignee_id = auth.uid()
)
WITH CHECK (
    app_private.can_access_client(client_id)
    OR assignee_id = auth.uid()
);

-- 4. ENSURE SELF-ACCESS & MANAGEMENT ON BANK DETAILS & EMPLOYEE RECORDS
DROP POLICY IF EXISTS "Employee can read own bank details" ON public.employee_bank_details;
CREATE POLICY "Employee can read own bank details"
    ON public.employee_bank_details FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Employee can read own employee record" ON public.employee_records;
CREATE POLICY "Employee can read own employee record"
    ON public.employee_records FOR SELECT TO authenticated
    USING (id = auth.uid());
