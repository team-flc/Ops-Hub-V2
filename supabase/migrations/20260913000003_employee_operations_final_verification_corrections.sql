-- ==============================================================================
-- MIGRATION: 20260913000003_employee_operations_final_verification_corrections.sql
-- Description: 
--   1. Server-authoritative current-shift attendance lookup RPC (fn_employee_get_current_attendance).
--   2. Overnight shift resolution (00:00 - 05:00 PKT anchored to yesterday's shift instance).
--   3. Multi-layer active-employee RLS enforcement across all employee tables:
--      - Active internal profile (owner, operational_manager, team_member)
--      - Explicit client-role denial
--      - Active employee_records row with employment_status = 'active'
--   4. Function execution revokes from PUBLIC/anon and grants to authenticated.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SERVER-AUTHORITATIVE CURRENT SHIFT ATTENDANCE LOOKUP RPC
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_employee_get_current_attendance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_caller_role TEXT;
    v_caller_status TEXT;
    v_emp_record RECORD;
    v_active_shift RECORD;
    v_pkt_now TIMESTAMPTZ;
    v_pkt_time TIME;
    v_target_work_date DATE;
    v_att RECORD;
BEGIN
    -- 1. Authenticate caller
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Verify active internal profile
    SELECT role, status INTO v_caller_role, v_caller_status 
    FROM public.profiles WHERE id = v_user_id;

    IF v_caller_role IS NULL OR v_caller_role = 'client' OR v_caller_status <> 'active' THEN
        RETURN NULL;
    END IF;

    -- Verify employee record
    SELECT * INTO v_emp_record FROM public.employee_records 
    WHERE id = v_user_id AND employment_status = 'active';

    IF v_emp_record.id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Resolve shift
    IF v_emp_record.shift_id IS NOT NULL THEN
        SELECT * INTO v_active_shift FROM public.work_shifts WHERE id = v_emp_record.shift_id;
    ELSE
        SELECT * INTO v_active_shift FROM public.work_shifts ORDER BY created_at LIMIT 1;
    END IF;

    -- Calculate PKT timestamp
    v_pkt_now := timezone('Asia/Karachi', now());
    v_pkt_time := v_pkt_now::time;

    -- Overnight shift resolution (e.g. 20:00 - 05:00)
    IF v_active_shift.crosses_midnight OR v_active_shift.end_time < v_active_shift.start_time THEN
        -- If current PKT time is between midnight and shift end (e.g. 00:00 - 05:00), anchor to yesterday
        IF v_pkt_time <= v_active_shift.end_time THEN
            v_target_work_date := (v_pkt_now - interval '1 day')::date;
        ELSE
            v_target_work_date := v_pkt_now::date;
        END IF;
    ELSE
        -- Daytime shift
        v_target_work_date := v_pkt_now::date;
    END IF;

    -- Fetch attendance for resolved shift date
    SELECT * INTO v_att FROM public.employee_attendance 
    WHERE employee_id = v_user_id AND work_date = v_target_work_date;

    IF v_att.id IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN to_jsonb(v_att);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_employee_get_current_attendance FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_employee_get_current_attendance TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. HARDENED ACTIVE-EMPLOYEE RLS POLICIES
-- ------------------------------------------------------------------------------

-- 2.1 Attendance: Self-Read Only with Active Employee Record & Active Profile
DROP POLICY IF EXISTS "Employee can read own attendance" ON public.employee_attendance;
CREATE POLICY "Employee can read own attendance"
    ON public.employee_attendance FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
              AND role <> 'client'
        )
        AND EXISTS (
            SELECT 1 FROM public.employee_records
            WHERE id = auth.uid()
              AND employment_status = 'active'
        )
    );

-- 2.2 Payroll: Self-Read Only with Active Profile & Employee Record
DROP POLICY IF EXISTS "Employee can read own payroll" ON public.employee_payroll_records;
CREATE POLICY "Employee can read own payroll"
    ON public.employee_payroll_records FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
              AND role <> 'client'
        )
        AND EXISTS (
            SELECT 1 FROM public.employee_records
            WHERE id = auth.uid()
              AND employment_status = 'active'
        )
    );

-- 2.3 Performance Records: Self-Read Only
DROP POLICY IF EXISTS "Employee can read own performance records" ON public.employee_performance_records;
CREATE POLICY "Employee can read own performance records"
    ON public.employee_performance_records FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
              AND role <> 'client'
        )
        AND EXISTS (
            SELECT 1 FROM public.employee_records
            WHERE id = auth.uid()
              AND employment_status = 'active'
        )
    );

-- 2.4 Company Assets: Self-Read Only for Assigned Items
DROP POLICY IF EXISTS "Employee can read own assigned assets" ON public.company_assets;
CREATE POLICY "Employee can read own assigned assets"
    ON public.company_assets FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
              AND role <> 'client'
        )
        AND EXISTS (
            SELECT 1 FROM public.employee_records
            WHERE id = auth.uid()
              AND employment_status = 'active'
        )
    );

-- 2.5 Documents: Self-Read Only
DROP POLICY IF EXISTS "Employee can read own documents" ON public.employee_documents;
CREATE POLICY "Employee can read own documents"
    ON public.employee_documents FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
              AND role <> 'client'
        )
        AND EXISTS (
            SELECT 1 FROM public.employee_records
            WHERE id = auth.uid()
              AND employment_status = 'active'
        )
    );

-- 2.6 Work Reports: Self-Read and Self-Insert Only
DROP POLICY IF EXISTS "Employee can read own work reports" ON public.employee_work_reports;
CREATE POLICY "Employee can read own work reports"
    ON public.employee_work_reports FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
              AND role <> 'client'
        )
        AND EXISTS (
            SELECT 1 FROM public.employee_records
            WHERE id = auth.uid()
              AND employment_status = 'active'
        )
    );

DROP POLICY IF EXISTS "Employee can submit own work reports" ON public.employee_work_reports;
CREATE POLICY "Employee can submit own work reports"
    ON public.employee_work_reports FOR INSERT TO authenticated
    WITH CHECK (
        employee_id = auth.uid() 
        AND status = 'submitted'
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
              AND role <> 'client'
        )
        AND EXISTS (
            SELECT 1 FROM public.employee_records
            WHERE id = auth.uid()
              AND employment_status = 'active'
        )
    );

-- 2.7 Goals: Self-Read Only
DROP POLICY IF EXISTS "Employee can read own goals" ON public.employee_goals;
CREATE POLICY "Employee can read own goals"
    ON public.employee_goals FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
              AND role <> 'client'
        )
        AND EXISTS (
            SELECT 1 FROM public.employee_records
            WHERE id = auth.uid()
              AND employment_status = 'active'
        )
    );

-- 2.8 Bank Details: Self-Read Only
DROP POLICY IF EXISTS "Employee can read own bank details" ON public.employee_bank_details;
CREATE POLICY "Employee can read own bank details"
    ON public.employee_bank_details FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
              AND role <> 'client'
        )
        AND EXISTS (
            SELECT 1 FROM public.employee_records
            WHERE id = auth.uid()
              AND employment_status = 'active'
        )
    );

-- 2.9 Profile Change Requests: Self-Read and Self-Insert
DROP POLICY IF EXISTS "Employee can read own change requests" ON public.employee_profile_change_requests;
CREATE POLICY "Employee can read own change requests"
    ON public.employee_profile_change_requests FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
              AND role <> 'client'
        )
        AND EXISTS (
            SELECT 1 FROM public.employee_records
            WHERE id = auth.uid()
              AND employment_status = 'active'
        )
    );

DROP POLICY IF EXISTS "Employee can create own change requests" ON public.employee_profile_change_requests;
CREATE POLICY "Employee can create own change requests"
    ON public.employee_profile_change_requests FOR INSERT TO authenticated
    WITH CHECK (
        employee_id = auth.uid()
        AND status = 'pending'
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
              AND role <> 'client'
        )
        AND EXISTS (
            SELECT 1 FROM public.employee_records
            WHERE id = auth.uid()
              AND employment_status = 'active'
        )
    );

-- 2.10 Salary Hikes: Self-Read Only
DROP POLICY IF EXISTS "Employee can read own salary hikes" ON public.employee_salary_hikes;
CREATE POLICY "Employee can read own salary hikes"
    ON public.employee_salary_hikes FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
              AND role <> 'client'
        )
        AND EXISTS (
            SELECT 1 FROM public.employee_records
            WHERE id = auth.uid()
              AND employment_status = 'active'
        )
    );
