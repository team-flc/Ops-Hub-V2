-- ==============================================================================
-- MIGRATION: 20260913000004_employee_operations_release_gate.sql
-- Description:
--   1. Corrected fn_employee_get_current_attendance:
--      - Require active profile, active employment, and completed setup.
--      - Use custom employee check-in/out times before standard shift times.
--      - Do not fallback to arbitrary shift when unconfigured (return NULL / Setup Pending).
--      - First return latest unclosed attendance record from current/recent overnight shift window,
--        allowing late checkout after 05:00 AM.
--      - Local timestamp without time zone calendar calculations and now() for instants.
--   2. company_work_schedules RLS:
--      - Active internal employees have read-only access.
--      - Owner and Operational Manager have full management access.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDENED CURRENT ATTENDANCE RETRIEVAL RPC
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
    v_pkt_now TIMESTAMP;
    v_pkt_time TIME;
    v_start_time TIME;
    v_end_time TIME;
    v_crosses_midnight BOOLEAN;
    v_target_work_date DATE;
    v_open_att RECORD;
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

    -- Verify active employee record with completed setup
    SELECT * INTO v_emp_record FROM public.employee_records 
    WHERE id = v_user_id AND employment_status = 'active';

    IF v_emp_record.id IS NULL OR v_emp_record.setup_completed_at IS NULL THEN
        RETURN NULL;
    END IF;

    -- Resolve shift without silent arbitrary fallback
    IF v_emp_record.shift_id IS NOT NULL THEN
        SELECT * INTO v_active_shift FROM public.work_shifts WHERE id = v_emp_record.shift_id;
    END IF;

    IF v_active_shift.id IS NULL AND v_emp_record.custom_check_in_time IS NULL THEN
        RETURN NULL;
    END IF;

    -- Calculate Pakistan-local timestamp without time zone for calendar calculations
    v_pkt_now := (now() AT TIME ZONE 'Asia/Karachi');
    v_pkt_time := v_pkt_now::time;

    v_start_time := COALESCE(v_emp_record.custom_check_in_time, v_active_shift.start_time, '11:00:00'::time);
    v_end_time := COALESCE(v_emp_record.custom_check_out_time, v_active_shift.end_time, '20:00:00'::time);
    v_crosses_midnight := COALESCE(v_active_shift.crosses_midnight, false) OR (v_end_time < v_start_time);

    -- Priority 1: Check for an unclosed attendance record from the current/recent shift window
    -- (This allows an unclosed 8:00 PM - 5:00 AM attendance record to remain available at 5:01 AM+ for late checkout)
    SELECT * INTO v_open_att FROM public.employee_attendance
    WHERE employee_id = v_user_id 
      AND check_in_time IS NOT NULL 
      AND check_out_time IS NULL
      AND work_date >= (v_pkt_now::date - interval '2 days')::date
    ORDER BY work_date DESC, check_in_time DESC
    LIMIT 1;

    IF v_open_att.id IS NOT NULL THEN
        RETURN to_jsonb(v_open_att);
    END IF;

    -- Priority 2: Resolve current shift work date
    IF v_crosses_midnight THEN
        IF v_pkt_time <= v_end_time THEN
            -- Midnight to Shift End: Anchored to yesterday's shift start date
            v_target_work_date := (v_pkt_now::date - interval '1 day')::date;
        ELSE
            -- Shift start onward: Anchored to today
            v_target_work_date := v_pkt_now::date;
        END IF;
    ELSE
        -- Daytime shift
        v_target_work_date := v_pkt_now::date;
    END IF;

    -- Fetch attendance for resolved target date
    SELECT * INTO v_att FROM public.employee_attendance 
    WHERE employee_id = v_user_id AND work_date = v_target_work_date;

    IF v_att.id IS NOT NULL THEN
        RETURN to_jsonb(v_att);
    END IF;

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_employee_get_current_attendance FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_employee_get_current_attendance TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. COMPANY WORK SCHEDULES RLS POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.company_work_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active employees can read work schedules" ON public.company_work_schedules;
CREATE POLICY "Active employees can read work schedules"
    ON public.company_work_schedules FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND role IN ('owner', 'operational_manager', 'team_member') 
          AND status = 'active'
          AND role <> 'client'
    ));

DROP POLICY IF EXISTS "Management can manage work schedules" ON public.company_work_schedules;
CREATE POLICY "Management can manage work schedules"
    ON public.company_work_schedules FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND role IN ('owner', 'operational_manager') 
          AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND role IN ('owner', 'operational_manager') 
          AND status = 'active'
    ));
