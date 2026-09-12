-- ==============================================================================
-- MIGRATION: 20260913000001_employee_operations_governance.sql
-- Description: Server-authoritative attendance, bank detail approval enforcement,
--              background automation, and complete Employee 360 data models
--              (Work reports, Goals, Documents, Salary Hikes) with strict RLS.
-- Schema Authority: PostgreSQL 15+ / Supabase Auth
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND EMPLOYEE 360 DATA TABLES
-- ------------------------------------------------------------------------------

-- 1.1 Weekly & Monthly Work Reports
CREATE TABLE IF NOT EXISTS public.employee_work_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN ('weekly', 'monthly')),
    period TEXT NOT NULL, -- e.g. '2026-W37' or '2026-09'
    summary TEXT NOT NULL,
    achievements TEXT,
    blockers_or_incidents TEXT,
    management_notes TEXT,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'approved')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_employee_report_period UNIQUE (employee_id, report_type, period)
);

CREATE INDEX IF NOT EXISTS idx_employee_work_reports_employee ON public.employee_work_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_work_reports_period ON public.employee_work_reports(period DESC);

-- 1.2 Goals and Key Results
CREATE TABLE IF NOT EXISTS public.employee_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'achieved', 'behind', 'cancelled')),
    management_notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_employee_goals_employee ON public.employee_goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_goals_status ON public.employee_goals(status);

-- 1.3 Employee Contracts & Governance Documents
CREATE TABLE IF NOT EXISTS public.employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('contract', 'nda', 'policy', 'other')),
    file_path TEXT NOT NULL,
    file_size BIGINT,
    acknowledgement_required BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON public.employee_documents(employee_id);

-- 1.4 Salary-Hike History
CREATE TABLE IF NOT EXISTS public.employee_salary_hikes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    previous_salary NUMERIC(12,2) NOT NULL CHECK (previous_salary >= 0),
    new_salary NUMERIC(12,2) NOT NULL CHECK (new_salary >= 0),
    effective_date DATE NOT NULL,
    reason TEXT NOT NULL,
    approved_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_employee_salary_hikes_employee ON public.employee_salary_hikes(employee_id);

-- ------------------------------------------------------------------------------
-- 2. SERVER-AUTHORITATIVE ATTENDANCE RPCS
-- ------------------------------------------------------------------------------

-- 2.1 Server-Authoritative Check-In RPC
CREATE OR REPLACE FUNCTION public.fn_employee_check_in(
    p_screenshot_path TEXT,
    p_evidence_type TEXT DEFAULT 'screen_capture',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_emp_record RECORD;
    v_active_shift RECORD;
    v_pkt_now TIMESTAMPTZ;
    v_work_date DATE;
    v_check_in_time TIME;
    v_check_out_time TIME;
    v_sched_start TIMESTAMPTZ;
    v_sched_end TIMESTAMPTZ;
    v_diff_minutes INTEGER;
    v_status TEXT;
    v_minutes_late INTEGER := 0;
    v_late_deduction NUMERIC(10,2) := 0.00;
    v_inserted_attendance RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authenticated session required.';
    END IF;

    -- 1. Enforce setup completion
    SELECT * INTO v_emp_record FROM public.employee_records WHERE id = v_user_id;
    IF v_emp_record.id IS NULL OR v_emp_record.setup_completed_at IS NULL THEN
        RAISE EXCEPTION 'Employee setup is pending. Management must complete employment, shift, and payroll configuration before attendance can be recorded.';
    END IF;

    -- 2. Derive Server-Authoritative PKT Date & Time (UTC+5)
    v_pkt_now := timezone('Asia/Karachi', now());
    v_work_date := v_pkt_now::date;

    -- 3. Check for existing check-in on this work date
    IF EXISTS (
        SELECT 1 FROM public.employee_attendance 
        WHERE employee_id = v_user_id AND work_date = v_work_date AND check_in_time IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'You have already checked in for this scheduled shift.';
    END IF;

    -- 4. Determine Shift and Scheduled Window
    IF v_emp_record.shift_id IS NOT NULL THEN
        SELECT * INTO v_active_shift FROM public.work_shifts WHERE id = v_emp_record.shift_id;
    ELSE
        SELECT * INTO v_active_shift FROM public.work_shifts ORDER BY created_at LIMIT 1;
    END IF;

    v_check_in_time := COALESCE(v_emp_record.custom_check_in_time, v_active_shift.start_time, '11:00:00'::time);
    v_check_out_time := COALESCE(v_emp_record.custom_check_out_time, v_active_shift.end_time, '20:00:00'::time);

    v_sched_start := (v_work_date || ' ' || v_check_in_time)::timestamp AT TIME ZONE 'Asia/Karachi';
    v_sched_end := (v_work_date || ' ' || v_check_out_time)::timestamp AT TIME ZONE 'Asia/Karachi';
    IF v_active_shift.crosses_midnight OR v_check_out_time < v_check_in_time THEN
        v_sched_end := v_sched_end + interval '1 day';
    END IF;

    -- 5. Calculate Server-Authoritative Late Minutes & Flat PKR 500 Penalty
    IF now() > v_sched_start THEN
        v_diff_minutes := CEIL(EXTRACT(EPOCH FROM (now() - v_sched_start)) / 60.0);
        IF v_diff_minutes > 0 THEN
            v_status := 'late';
            v_minutes_late := v_diff_minutes;
            v_late_deduction := 500.00; -- Flat PKR 500 per late arrival from 1 min onward, no monthly cap
        ELSE
            v_status := 'on_time';
        END IF;
    ELSE
        v_status := 'on_time';
    END IF;

    -- 6. Insert Attendance Record
    INSERT INTO public.employee_attendance (
        employee_id,
        work_date,
        shift_id,
        scheduled_check_in,
        scheduled_check_out,
        check_in_time,
        status,
        minutes_late,
        late_deduction,
        absence_deduction,
        check_in_screenshot_path,
        check_in_evidence_type,
        check_in_metadata,
        updated_at
    ) VALUES (
        v_user_id,
        v_work_date,
        v_active_shift.id,
        v_sched_start,
        v_sched_end,
        now(),
        v_status,
        v_minutes_late,
        v_late_deduction,
        0.00,
        p_screenshot_path,
        p_evidence_type,
        p_metadata,
        timezone('utc'::text, now())
    )
    ON CONFLICT (employee_id, work_date) DO UPDATE SET
        check_in_time = EXCLUDED.check_in_time,
        status = EXCLUDED.status,
        minutes_late = EXCLUDED.minutes_late,
        late_deduction = EXCLUDED.late_deduction,
        check_in_screenshot_path = EXCLUDED.check_in_screenshot_path,
        check_in_evidence_type = EXCLUDED.check_in_evidence_type,
        check_in_metadata = EXCLUDED.check_in_metadata,
        updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_inserted_attendance;

    -- 7. Automatically resolve open 60-minute missing check-in management tasks
    UPDATE public.employee_management_tasks
    SET status = 'resolved',
        resolution_notes = 'Employee checked in late at ' || to_char(v_pkt_now, 'HH24:MI PKT') || ' (' || v_status || ')',
        resolved_at = timezone('utc'::text, now())
    WHERE employee_id = v_user_id 
      AND task_type = 'missing_checkin_60m'
      AND reference_id = v_work_date::text;

    RETURN to_jsonb(v_inserted_attendance);
END;
$$;

-- 2.2 Server-Authoritative Check-Out RPC
CREATE OR REPLACE FUNCTION public.fn_employee_check_out(
    p_attendance_id UUID,
    p_screenshot_path TEXT,
    p_evidence_type TEXT DEFAULT 'screen_capture',
    p_early_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_att RECORD;
    v_total_hours NUMERIC(5,2);
    v_is_early BOOLEAN := false;
    v_updated_att RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authenticated session required.';
    END IF;

    SELECT * INTO v_att FROM public.employee_attendance WHERE id = p_attendance_id;
    IF v_att.id IS NULL OR v_att.employee_id <> v_user_id THEN
        RAISE EXCEPTION 'Attendance record not found or access denied.';
    END IF;

    IF v_att.check_out_time IS NOT NULL THEN
        RAISE EXCEPTION 'You have already checked out for this shift.';
    END IF;

    v_total_hours := ROUND(EXTRACT(EPOCH FROM (now() - v_att.check_in_time)) / 3600.0, 2);

    IF now() < v_att.scheduled_check_out THEN
        v_is_early := true;
        INSERT INTO public.employee_management_tasks (
            task_type,
            employee_id,
            title,
            description,
            status,
            priority,
            reference_id,
            idempotency_key
        ) VALUES (
            'early_checkout_review',
            v_user_id,
            'Early Check-out Review Required',
            COALESCE(p_early_reason, 'Employee checked out before scheduled shift end.'),
            'open',
            'normal',
            v_att.work_date::text,
            'early_checkout_' || v_user_id || '_' || v_att.work_date::text
        ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    UPDATE public.employee_attendance
    SET check_out_time = now(),
        check_out_screenshot_path = p_screenshot_path,
        check_out_evidence_type = p_evidence_type,
        check_out_metadata = p_metadata,
        early_checkout_reason = p_early_reason,
        early_checkout_status = CASE WHEN v_is_early THEN 'pending_review' ELSE 'approved' END,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_attendance_id
    RETURNING * INTO v_updated_att;

    RETURN to_jsonb(v_updated_att);
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. BACKGROUND ATTENDANCE AUTOMATION RPC
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_cron_process_attendance_automation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pkt_now TIMESTAMPTZ;
    v_work_date DATE;
    v_days_in_month INTEGER;
    v_count_missing_60m INTEGER := 0;
    v_count_absent INTEGER := 0;
    v_count_missing_checkout INTEGER := 0;
    v_rec RECORD;
    v_sched_start TIMESTAMPTZ;
    v_sched_end TIMESTAMPTZ;
    v_att RECORD;
    v_absence_cut NUMERIC(10,2);
BEGIN
    v_pkt_now := timezone('Asia/Karachi', now());
    v_work_date := v_pkt_now::date;
    v_days_in_month := EXTRACT(DAY FROM (date_trunc('month', v_work_date) + interval '1 month - 1 day'));

    FOR v_rec IN 
        SELECT 
            er.id AS employee_id,
            er.salary,
            COALESCE(er.custom_check_in_time, ws.start_time, '11:00:00'::time) AS start_time,
            COALESCE(er.custom_check_out_time, ws.end_time, '20:00:00'::time) AS end_time,
            COALESCE(ws.crosses_midnight, false) AS crosses_midnight,
            p.full_name
        FROM public.employee_records er
        JOIN public.profiles p ON p.id = er.id
        LEFT JOIN public.work_shifts ws ON ws.id = er.shift_id
        WHERE er.setup_completed_at IS NOT NULL
          AND er.employment_status = 'active'
          AND p.status = 'active'
    LOOP
        v_sched_start := (v_work_date || ' ' || v_rec.start_time)::timestamp AT TIME ZONE 'Asia/Karachi';
        v_sched_end := (v_work_date || ' ' || v_rec.end_time)::timestamp AT TIME ZONE 'Asia/Karachi';
        IF v_rec.crosses_midnight OR v_rec.end_time < v_rec.start_time THEN
            v_sched_end := v_sched_end + interval '1 day';
        END IF;

        SELECT * INTO v_att 
        FROM public.employee_attendance 
        WHERE employee_id = v_rec.employee_id AND work_date = v_work_date;

        -- 1. 60-Minute Missing Check-in Alert
        IF v_att.id IS NULL AND now() >= (v_sched_start + interval '60 minutes') AND now() < v_sched_end THEN
            INSERT INTO public.employee_management_tasks (
                task_type,
                employee_id,
                title,
                description,
                status,
                priority,
                reference_id,
                idempotency_key
            ) VALUES (
                'missing_checkin_60m',
                v_rec.employee_id,
                '60m Missing Check-in Alert: ' || v_rec.full_name,
                'Employee has not checked in 60+ minutes past scheduled shift start (' || to_char(v_sched_start, 'HH24:MI PKT') || ').',
                'open',
                'high',
                v_work_date::text,
                'missing_checkin_60m_' || v_rec.employee_id || '_' || v_work_date::text
            ) ON CONFLICT (idempotency_key) DO NOTHING;

            IF FOUND THEN
                v_count_missing_60m := v_count_missing_60m + 1;
            END IF;
        END IF;

        -- 2. Shift End Unapproved Absence
        IF v_att.id IS NULL AND now() >= v_sched_end THEN
            v_absence_cut := ROUND((v_rec.salary / v_days_in_month), 2);

            INSERT INTO public.employee_attendance (
                employee_id,
                work_date,
                scheduled_check_in,
                scheduled_check_out,
                status,
                absence_deduction,
                minutes_late,
                late_deduction
            ) VALUES (
                v_rec.employee_id,
                v_work_date,
                v_sched_start,
                v_sched_end,
                'absent',
                v_absence_cut,
                0,
                0.00
            ) ON CONFLICT (employee_id, work_date) DO NOTHING;

            IF FOUND THEN
                v_count_absent := v_count_absent + 1;
            END IF;
        END IF;

        -- 3. Shift End Missing Check-Out Warning & Task
        IF v_att.id IS NOT NULL AND v_att.check_in_time IS NOT NULL AND v_att.check_out_time IS NULL AND now() >= (v_sched_end + interval '30 minutes') THEN
            INSERT INTO public.employee_management_tasks (
                task_type,
                employee_id,
                title,
                description,
                status,
                priority,
                reference_id,
                idempotency_key
            ) VALUES (
                'missing_checkout',
                v_rec.employee_id,
                'Missing Check-out Review: ' || v_rec.full_name,
                'Employee checked in at ' || to_char(v_att.check_in_time, 'HH24:MI PKT') || ' but did not record checkout after shift end (' || to_char(v_sched_end, 'HH24:MI PKT') || ').',
                'open',
                'normal',
                v_work_date::text,
                'missing_checkout_' || v_rec.employee_id || '_' || v_work_date::text
            ) ON CONFLICT (idempotency_key) DO NOTHING;

            IF FOUND THEN
                v_count_missing_checkout := v_count_missing_checkout + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'work_date', v_work_date,
        'missing_60m_tasks_created', v_count_missing_60m,
        'absences_marked', v_count_absent,
        'missing_checkouts_flagged', v_count_missing_checkout
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. STRICT RLS POLICIES FOR NEW & GOVERNED TABLES
-- ------------------------------------------------------------------------------

ALTER TABLE public.employee_work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salary_hikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employee can read own work reports" ON public.employee_work_reports;
CREATE POLICY "Employee can read own work reports"
    ON public.employee_work_reports FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Employee can submit own work reports" ON public.employee_work_reports;
CREATE POLICY "Employee can submit own work reports"
    ON public.employee_work_reports FOR INSERT TO authenticated
    WITH CHECK (employee_id = auth.uid() AND status = 'submitted');

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

DROP POLICY IF EXISTS "Employee can read own goals" ON public.employee_goals;
CREATE POLICY "Employee can read own goals"
    ON public.employee_goals FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Management can manage goals" ON public.employee_goals;
CREATE POLICY "Management can manage goals"
    ON public.employee_goals FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

DROP POLICY IF EXISTS "Employee can read own documents" ON public.employee_documents;
CREATE POLICY "Employee can read own documents"
    ON public.employee_documents FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Employee can acknowledge own documents" ON public.employee_documents;
CREATE POLICY "Employee can acknowledge own documents"
    ON public.employee_documents FOR UPDATE TO authenticated
    USING (employee_id = auth.uid())
    WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "Management can manage employee documents" ON public.employee_documents;
CREATE POLICY "Management can manage employee documents"
    ON public.employee_documents FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

DROP POLICY IF EXISTS "Employee can read own salary hikes" ON public.employee_salary_hikes;
CREATE POLICY "Employee can read own salary hikes"
    ON public.employee_salary_hikes FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Management can manage salary hikes" ON public.employee_salary_hikes;
CREATE POLICY "Management can manage salary hikes"
    ON public.employee_salary_hikes FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

DROP POLICY IF EXISTS "Employee can insert own bank details" ON public.employee_bank_details;
DROP POLICY IF EXISTS "Employee can update own bank details" ON public.employee_bank_details;
DROP POLICY IF EXISTS "Employee can read own bank details" ON public.employee_bank_details;
CREATE POLICY "Employee can read own bank details"
    ON public.employee_bank_details FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Management can manage bank details" ON public.employee_bank_details;
CREATE POLICY "Management can manage bank details"
    ON public.employee_bank_details FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));
