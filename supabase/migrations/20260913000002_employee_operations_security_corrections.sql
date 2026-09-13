-- ==============================================================================
-- MIGRATION: 20260913000002_employee_operations_security_corrections.sql
-- Description: Forward-only security corrections:
--              1. Direct attendance insert/update policies dropped for employees.
--              2. Server-authoritative attendance RPCs with storage verification,
--                 user folder isolation, and night shift / working-day resolution.
--              3. Narrow SECURITY DEFINER RPCs for asset & document acknowledgement
--                 and payroll/performance concerns, replacing unsafe UPDATE policies.
--              4. Execution grants: authenticated for user RPCs, service_role for cron.
--              5. Strict active internal role requirement and client role denial.
-- Schema Authority: PostgreSQL 15+ / Supabase Auth
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DROP UNSAFE DIRECT WRITE POLICIES
-- ------------------------------------------------------------------------------

-- 1.1 Drop direct attendance write policies for non-management
DROP POLICY IF EXISTS "Employee can insert own attendance" ON public.employee_attendance;
DROP POLICY IF EXISTS "Employee can update own check-out attendance" ON public.employee_attendance;
DROP POLICY IF EXISTS "Employee can update own attendance" ON public.employee_attendance;
DROP POLICY IF EXISTS "Employee can submit own attendance" ON public.employee_attendance;

-- 1.2 Drop unsafe whole-row UPDATE policies on governance tables
DROP POLICY IF EXISTS "Employee can acknowledge own assets" ON public.company_assets;
DROP POLICY IF EXISTS "Employee can acknowledge own documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Employee can raise payroll concern" ON public.employee_payroll_records;
DROP POLICY IF EXISTS "Employee can raise performance concern" ON public.employee_performance_records;

-- ------------------------------------------------------------------------------
-- 2. HARDENED SERVER-AUTHORITATIVE ATTENDANCE RPCS
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
    v_caller_role TEXT;
    v_caller_status TEXT;
    v_emp_record RECORD;
    v_active_shift RECORD;
    v_pkt_now TIMESTAMPTZ;
    v_pkt_time TIME;
    v_work_date DATE;
    v_sched_start TIMESTAMPTZ;
    v_sched_end TIMESTAMPTZ;
    v_diff_minutes INTEGER;
    v_status TEXT;
    v_minutes_late INTEGER := 0;
    v_late_deduction NUMERIC(10,2) := 0.00;
    v_inserted_attendance RECORD;
    v_is_working_day BOOLEAN := false;
    v_sched_record RECORD;
    v_day_of_week INTEGER;
BEGIN
    -- 1. Authenticate Caller
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authenticated session required.';
    END IF;

    -- Verify active internal profile
    SELECT role, status INTO v_caller_role, v_caller_status 
    FROM public.profiles WHERE id = v_user_id;

    IF v_caller_role IS NULL OR v_caller_role = 'client' OR v_caller_status <> 'active' THEN
        RAISE EXCEPTION 'Forbidden: active internal employee profile required.';
    END IF;

    -- Verify employee record setup
    SELECT * INTO v_emp_record FROM public.employee_records WHERE id = v_user_id;
    IF v_emp_record.id IS NULL OR v_emp_record.setup_completed_at IS NULL THEN
        RAISE EXCEPTION 'Employee setup is pending. Management must complete employment, shift, and payroll configuration before attendance can be recorded.';
    END IF;

    -- 2. Validate Screenshot Evidence
    IF p_screenshot_path IS NULL OR trim(p_screenshot_path) = '' THEN
        RAISE EXCEPTION 'Attendance proof screenshot is required to complete check-in.';
    END IF;

    -- Evidence must reside in caller's private folder and contain no directory traversal
    IF NOT (p_screenshot_path LIKE (v_user_id::text || '/%')) OR p_screenshot_path LIKE '%..%' THEN
        RAISE EXCEPTION 'Invalid evidence path: must reside in authenticated employee directory.';
    END IF;

    -- Validate evidence type
    IF p_evidence_type NOT IN ('screen_capture', 'manual_upload') THEN
        RAISE EXCEPTION 'Unsupported evidence type: %', p_evidence_type;
    END IF;

    -- Optional storage verification if storage.objects exists
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'storage' AND table_name = 'objects'
        ) THEN
            IF NOT EXISTS (
                SELECT 1 FROM storage.objects 
                WHERE bucket_id = 'employee-attendance-evidence' 
                  AND name = p_screenshot_path
            ) THEN
                RAISE EXCEPTION 'Evidence file not found in storage bucket.';
            END IF;
        END IF;
    EXCEPTION
        WHEN undefined_table THEN
            -- In testing environments without storage schema, continue
            NULL;
    END;

    -- 3. Determine Shift, Timezone & Work Date (Asia/Karachi PKT UTC+5)
    v_pkt_now := timezone('Asia/Karachi', now());
    v_pkt_time := v_pkt_now::time;

    IF v_emp_record.shift_id IS NOT NULL THEN
        SELECT * INTO v_active_shift FROM public.work_shifts WHERE id = v_emp_record.shift_id;
    ELSE
        SELECT * INTO v_active_shift FROM public.work_shifts ORDER BY created_at LIMIT 1;
    END IF;

    -- Night Shift & Midnight Crossing Resolution (e.g. 20:00 - 05:00)
    IF v_active_shift.crosses_midnight OR v_active_shift.end_time < v_active_shift.start_time THEN
        -- If current PKT time is between midnight and shift end (e.g. 00:00 - 05:00), anchor to yesterday
        IF v_pkt_time <= v_active_shift.end_time THEN
            v_work_date := (v_pkt_now - interval '1 day')::date;
            v_sched_start := (v_work_date || ' ' || COALESCE(v_emp_record.custom_check_in_time, v_active_shift.start_time))::timestamp AT TIME ZONE 'Asia/Karachi';
            v_sched_end := ((v_work_date + interval '1 day')::date || ' ' || COALESCE(v_emp_record.custom_check_out_time, v_active_shift.end_time))::timestamp AT TIME ZONE 'Asia/Karachi';
        -- If current PKT time is near or after shift start (e.g. >= 18:00), anchor to today
        ELSIF v_pkt_time >= (v_active_shift.start_time - interval '2 hours')::time THEN
            v_work_date := v_pkt_now::date;
            v_sched_start := (v_work_date || ' ' || COALESCE(v_emp_record.custom_check_in_time, v_active_shift.start_time))::timestamp AT TIME ZONE 'Asia/Karachi';
            v_sched_end := ((v_work_date + interval '1 day')::date || ' ' || COALESCE(v_emp_record.custom_check_out_time, v_active_shift.end_time))::timestamp AT TIME ZONE 'Asia/Karachi';
        ELSE
            RAISE EXCEPTION 'No active shift window found for check-in at this time (Current PKT: %).', to_char(v_pkt_now, 'HH24:MI');
        END IF;
    ELSE
        -- Standard Daytime Shift (e.g. 11:00 - 20:00)
        v_work_date := v_pkt_now::date;
        v_sched_start := (v_work_date || ' ' || COALESCE(v_emp_record.custom_check_in_time, v_active_shift.start_time, '11:00:00'::time))::timestamp AT TIME ZONE 'Asia/Karachi';
        v_sched_end := (v_work_date || ' ' || COALESCE(v_emp_record.custom_check_out_time, v_active_shift.end_time, '20:00:00'::time))::timestamp AT TIME ZONE 'Asia/Karachi';
    END IF;

    -- 4. Check Effective Working-Day Schedule
    v_day_of_week := EXTRACT(DOW FROM v_work_date); -- 0 = Sunday, 1 = Monday ... 6 = Saturday
    SELECT * INTO v_sched_record 
    FROM public.company_work_schedules
    WHERE effective_from <= v_work_date 
      AND (effective_to IS NULL OR effective_to >= v_work_date)
    ORDER BY effective_from DESC LIMIT 1;

    IF v_sched_record.id IS NOT NULL THEN
        IF v_sched_record.working_days @> ARRAY[v_day_of_week] OR (v_day_of_week = 0 AND v_sched_record.working_days @> ARRAY[7]) THEN
            v_is_working_day := true;
        END IF;
    ELSE
        -- Default Monday to Saturday policy (Sunday = 0 is non-working)
        IF v_day_of_week <> 0 THEN
            v_is_working_day := true;
        END IF;
    END IF;

    IF NOT v_is_working_day THEN
        RAISE EXCEPTION 'Check-in not permitted: % is a designated non-working day under company policy.', to_char(v_work_date, 'YYYY-MM-DD');
    END IF;

    -- 5. Prevent Duplicate Check-In
    IF EXISTS (
        SELECT 1 FROM public.employee_attendance 
        WHERE employee_id = v_user_id AND work_date = v_work_date AND check_in_time IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'You have already checked in for this scheduled shift.';
    END IF;

    -- 6. Calculate Late Arrival & Flat PKR 500 Penalty
    IF now() > v_sched_start THEN
        v_diff_minutes := CEIL(EXTRACT(EPOCH FROM (now() - v_sched_start)) / 60.0);
        IF v_diff_minutes > 0 THEN
            v_status := 'late';
            v_minutes_late := v_diff_minutes;
            v_late_deduction := 500.00;
        ELSE
            v_status := 'on_time';
        END IF;
    ELSE
        v_status := 'on_time';
    END IF;

    -- 7. Insert Attendance Record
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

    -- 8. Idempotently Resolve 60m Missing Checkin Task
    UPDATE public.employee_management_tasks
    SET status = 'resolved',
        resolution_notes = 'Employee checked in at ' || to_char(v_pkt_now, 'HH24:MI PKT') || ' (' || v_status || ')',
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
    v_caller_role TEXT;
    v_att RECORD;
    v_is_early BOOLEAN := false;
    v_updated_att RECORD;
BEGIN
    -- 1. Authenticate Caller
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authenticated session required.';
    END IF;

    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_user_id;
    IF v_caller_role IS NULL OR v_caller_role = 'client' THEN
        RAISE EXCEPTION 'Forbidden: active internal employee profile required.';
    END IF;

    -- 2. Fetch & Validate Attendance Record
    SELECT * INTO v_att FROM public.employee_attendance WHERE id = p_attendance_id;
    IF v_att.id IS NULL OR v_att.employee_id <> v_user_id THEN
        RAISE EXCEPTION 'Attendance record not found or access denied.';
    END IF;

    IF v_att.check_out_time IS NOT NULL THEN
        RAISE EXCEPTION 'You have already checked out for this shift.';
    END IF;

    -- 3. Validate Screenshot Evidence
    IF p_screenshot_path IS NULL OR trim(p_screenshot_path) = '' THEN
        RAISE EXCEPTION 'Attendance proof screenshot is required to complete checkout.';
    END IF;

    IF NOT (p_screenshot_path LIKE (v_user_id::text || '/%')) OR p_screenshot_path LIKE '%..%' THEN
        RAISE EXCEPTION 'Invalid evidence path: must reside in authenticated employee directory.';
    END IF;

    -- 4. Evaluate Early Checkout (> 5 mins before scheduled end)
    IF now() < (v_att.scheduled_check_out - interval '5 minutes') THEN
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

    -- 5. Update Attendance Record
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
-- 3. SCHEDULE-AWARE & NIGHT-SHIFT BACKGROUND AUTOMATION RPC
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_cron_process_attendance_automation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pkt_now TIMESTAMPTZ;
    v_pkt_time TIME;
    v_work_date DATE;
    v_days_in_month INTEGER;
    v_count_missing_60m INTEGER := 0;
    v_count_absent INTEGER := 0;
    v_count_missing_checkout INTEGER := 0;
    v_rec RECORD;
    v_target_work_date DATE;
    v_sched_start TIMESTAMPTZ;
    v_sched_end TIMESTAMPTZ;
    v_att RECORD;
    v_absence_cut NUMERIC(10,2);
    v_is_working_day BOOLEAN;
    v_sched_record RECORD;
    v_day_of_week INTEGER;
BEGIN
    v_pkt_now := timezone('Asia/Karachi', now());
    v_pkt_time := v_pkt_now::time;
    v_work_date := v_pkt_now::date;

    FOR v_rec IN 
        SELECT 
            er.id AS employee_id,
            er.salary,
            COALESCE(er.custom_check_in_time, ws.start_time, '11:00:00'::time) AS start_time,
            COALESCE(er.custom_check_out_time, ws.end_time, '20:00:00'::time) AS end_time,
            COALESCE(ws.crosses_midnight, false) OR (COALESCE(er.custom_check_out_time, ws.end_time, '20:00:00'::time) < COALESCE(er.custom_check_in_time, ws.start_time, '11:00:00'::time)) AS crosses_midnight,
            p.full_name
        FROM public.employee_records er
        JOIN public.profiles p ON p.id = er.id
        LEFT JOIN public.work_shifts ws ON ws.id = er.shift_id
        WHERE er.setup_completed_at IS NOT NULL
          AND er.employment_status = 'active'
          AND p.status = 'active'
          AND p.role IN ('owner', 'operational_manager', 'team_member')
    LOOP
        -- Determine anchored work date and shift window
        IF v_rec.crosses_midnight THEN
            -- Night Shift (e.g. 20:00 - 05:00)
            IF v_pkt_time <= v_rec.end_time THEN
                -- Midnight to Shift End: Anchored to yesterday
                v_target_work_date := (v_pkt_now - interval '1 day')::date;
                v_sched_start := (v_target_work_date || ' ' || v_rec.start_time)::timestamp AT TIME ZONE 'Asia/Karachi';
                v_sched_end := (v_work_date || ' ' || v_rec.end_time)::timestamp AT TIME ZONE 'Asia/Karachi';
            ELSE
                -- Shift Start onward: Anchored to today
                v_target_work_date := v_work_date;
                v_sched_start := (v_target_work_date || ' ' || v_rec.start_time)::timestamp AT TIME ZONE 'Asia/Karachi';
                v_sched_end := ((v_target_work_date + interval '1 day')::date || ' ' || v_rec.end_time)::timestamp AT TIME ZONE 'Asia/Karachi';
            END IF;
        ELSE
            -- Daytime Shift
            v_target_work_date := v_work_date;
            v_sched_start := (v_target_work_date || ' ' || v_rec.start_time)::timestamp AT TIME ZONE 'Asia/Karachi';
            v_sched_end := (v_target_work_date || ' ' || v_rec.end_time)::timestamp AT TIME ZONE 'Asia/Karachi';
        END IF;

        -- Check if target work date is a working day under effective schedule
        v_day_of_week := EXTRACT(DOW FROM v_target_work_date);
        v_is_working_day := false;

        SELECT * INTO v_sched_record 
        FROM public.company_work_schedules
        WHERE effective_from <= v_target_work_date 
          AND (effective_to IS NULL OR effective_to >= v_target_work_date)
        ORDER BY effective_from DESC LIMIT 1;

        IF v_sched_record.id IS NOT NULL THEN
            IF v_sched_record.working_days @> ARRAY[v_day_of_week] OR (v_day_of_week = 0 AND v_sched_record.working_days @> ARRAY[7]) THEN
                v_is_working_day := true;
            END IF;
        ELSE
            IF v_day_of_week <> 0 THEN
                v_is_working_day := true;
            END IF;
        END IF;

        -- Never create attendance deductions or absence tasks on non-working days
        IF NOT v_is_working_day THEN
            CONTINUE;
        END IF;

        -- Fetch attendance for anchored work date
        SELECT * INTO v_att 
        FROM public.employee_attendance 
        WHERE employee_id = v_rec.employee_id AND work_date = v_target_work_date;

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
                v_target_work_date::text,
                'missing_checkin_60m_' || v_rec.employee_id || '_' || v_target_work_date::text
            ) ON CONFLICT (idempotency_key) DO NOTHING;

            IF FOUND THEN
                v_count_missing_60m := v_count_missing_60m + 1;
            END IF;
        END IF;

        -- 2. Shift End Unapproved Absence
        IF v_att.id IS NULL AND now() >= v_sched_end THEN
            v_days_in_month := EXTRACT(DAY FROM (date_trunc('month', v_target_work_date) + interval '1 month - 1 day'));
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
                v_target_work_date,
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

        -- 3. Shift End Missing Check-Out Task (at scheduled shift end)
        IF v_att.id IS NOT NULL AND v_att.check_in_time IS NOT NULL AND v_att.check_out_time IS NULL AND now() >= v_sched_end THEN
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
                v_target_work_date::text,
                'missing_checkout_' || v_rec.employee_id || '_' || v_target_work_date::text
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
        'missing_checkouts_flagged', v_count_missing_checkout,
        'executed_at', now()
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. NARROW SECURITY DEFINER RPCS REPLACING UNSAFE WHOLE-ROW UPDATES
-- ------------------------------------------------------------------------------

ALTER TABLE public.employee_management_tasks
    DROP CONSTRAINT IF EXISTS employee_management_tasks_task_type_check;

ALTER TABLE public.employee_management_tasks
    ADD CONSTRAINT employee_management_tasks_task_type_check
    CHECK (task_type IN (
        'missing_checkin_60m',
        'early_checkout_review',
        'missing_checkout',
        'employee_concern',
        'payroll_concern',
        'performance_concern',
        'profile_change_request',
        'payroll_approval',
        'asset_review'
    ));

ALTER TABLE public.company_assets
    DROP CONSTRAINT IF EXISTS company_assets_status_check;

ALTER TABLE public.company_assets
    ADD CONSTRAINT company_assets_status_check
    CHECK (status IN ('assigned', 'acknowledged', 'receipt_pending', 'received', 'returned', 'damaged', 'lost'));

-- 4.1 Asset Acknowledgement RPC
CREATE OR REPLACE FUNCTION public.fn_employee_acknowledge_asset(
    p_asset_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_updated RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authenticated session required.';
    END IF;

    UPDATE public.company_assets
    SET acknowledged_at = timezone('utc'::text, now()),
        acknowledged_by = v_user_id,
        status = 'acknowledged',
        updated_at = timezone('utc'::text, now())
    WHERE id = p_asset_id 
      AND employee_id = v_user_id
    RETURNING * INTO v_updated;

    IF v_updated.id IS NULL THEN
        RAISE EXCEPTION 'Asset record not found or access denied.';
    END IF;

    INSERT INTO public.system_audit_events (
        actor_id, action, entity_type, entity_id, new_state
    ) VALUES (
        v_user_id, 'asset_acknowledged', 'company_assets', p_asset_id,
        jsonb_build_object('asset_id', p_asset_id, 'status', 'acknowledged')
    );

    RETURN to_jsonb(v_updated);
END;
$$;

-- 4.2 Document Acknowledgement RPC
CREATE OR REPLACE FUNCTION public.fn_employee_acknowledge_document(
    p_document_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_updated RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authenticated session required.';
    END IF;

    UPDATE public.employee_documents
    SET acknowledged_at = timezone('utc'::text, now()),
        acknowledged_by = v_user_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_document_id 
      AND employee_id = v_user_id
    RETURNING * INTO v_updated;

    IF v_updated.id IS NULL THEN
        RAISE EXCEPTION 'Document record not found or access denied.';
    END IF;

    INSERT INTO public.system_audit_events (
        actor_id, action, entity_type, entity_id, new_state
    ) VALUES (
        v_user_id, 'document_acknowledged', 'employee_documents', p_document_id,
        jsonb_build_object('document_id', p_document_id, 'acknowledged_at', now())
    );

    RETURN to_jsonb(v_updated);
END;
$$;

-- 4.3 Raise Payroll Concern RPC
CREATE OR REPLACE FUNCTION public.fn_employee_raise_payroll_concern(
    p_payroll_id UUID,
    p_concern_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_updated RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authenticated session required.';
    END IF;

    IF p_concern_notes IS NULL OR trim(p_concern_notes) = '' THEN
        RAISE EXCEPTION 'Concern description is required.';
    END IF;

    UPDATE public.employee_payroll_records
    SET concern_notes = p_concern_notes,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_payroll_id 
      AND employee_id = v_user_id
    RETURNING * INTO v_updated;

    IF v_updated.id IS NULL THEN
        RAISE EXCEPTION 'Payroll record not found or access denied.';
    END IF;

    -- Create management inquiry task
    INSERT INTO public.employee_management_tasks (
        task_type, employee_id, title, description, status, priority, reference_id
    ) VALUES (
        'payroll_concern', v_user_id, 'Payroll Inquiry: ' || v_updated.payroll_period,
        p_concern_notes, 'open', 'high', p_payroll_id::text
    );

    RETURN to_jsonb(v_updated);
END;
$$;

-- 4.4 Raise Performance Concern RPC
CREATE OR REPLACE FUNCTION public.fn_employee_raise_performance_concern(
    p_record_id UUID,
    p_concern_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_updated RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authenticated session required.';
    END IF;

    IF p_concern_notes IS NULL OR trim(p_concern_notes) = '' THEN
        RAISE EXCEPTION 'Concern description is required.';
    END IF;

    SELECT * INTO v_updated FROM public.employee_performance_records 
    WHERE id = p_record_id AND employee_id = v_user_id;

    IF v_updated.id IS NULL THEN
        RAISE EXCEPTION 'Performance record not found or access denied.';
    END IF;

    -- Create management review task without altering performance record
    INSERT INTO public.employee_management_tasks (
        task_type, employee_id, title, description, status, priority, reference_id
    ) VALUES (
        'performance_concern', v_user_id, 'Performance Evaluation Inquiry: ' || v_updated.title,
        p_concern_notes, 'open', 'normal', p_record_id::text
    );

    RETURN to_jsonb(v_updated);
END;
$$;

-- 4.5 Reusable Working Day Verification Helper
CREATE OR REPLACE FUNCTION public.fn_is_company_working_day(p_date DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_day_of_week INT;
    v_sched_record RECORD;
BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_date); -- 0 = Sunday, 1 = Monday ... 6 = Saturday
    SELECT * INTO v_sched_record
    FROM public.company_work_schedules
    WHERE effective_from <= p_date
      AND (effective_to IS NULL OR effective_to >= p_date)
    ORDER BY effective_from DESC LIMIT 1;

    IF v_sched_record.id IS NOT NULL THEN
        IF v_sched_record.working_days @> ARRAY[v_day_of_week] OR (v_day_of_week = 0 AND v_sched_record.working_days @> ARRAY[7]) THEN
            RETURN true;
        END IF;
        RETURN false;
    ELSE
        -- Default Monday to Saturday policy (Sunday = 0 is non-working)
        RETURN v_day_of_week <> 0;
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. FUNCTION EXECUTION GRANTS & REVOCATIONS
-- ------------------------------------------------------------------------------

-- Revoke all execution rights from PUBLIC and anonymous callers
REVOKE ALL ON FUNCTION public.fn_employee_check_in FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_employee_check_out FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_cron_process_attendance_automation FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_employee_acknowledge_asset FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_employee_acknowledge_document FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_employee_raise_payroll_concern FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_employee_raise_performance_concern FROM PUBLIC, anon;

-- Grant user RPCs strictly to authenticated internal users
GRANT EXECUTE ON FUNCTION public.fn_employee_check_in TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_employee_check_out TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_employee_acknowledge_asset TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_employee_acknowledge_document TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_employee_raise_payroll_concern TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_employee_raise_performance_concern TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_is_company_working_day TO PUBLIC, authenticated, anon, service_role;

-- Grant cron automation RPC strictly to service_role
GRANT EXECUTE ON FUNCTION public.fn_cron_process_attendance_automation TO service_role;

-- ------------------------------------------------------------------------------
-- 6. STRICT HARDENED RLS POLICIES FOR ALL EMPLOYEE OPERATIONS TABLES
-- ------------------------------------------------------------------------------

-- 6.1 Employee Attendance: Self-Read Only for Authenticated Internal Staff
DROP POLICY IF EXISTS "Employee can read own attendance" ON public.employee_attendance;
CREATE POLICY "Employee can read own attendance"
    ON public.employee_attendance FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid() AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "Management can manage attendance" ON public.employee_attendance;
CREATE POLICY "Management can manage attendance"
    ON public.employee_attendance FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

-- 6.2 Employee Work Reports
DROP POLICY IF EXISTS "Employee can read own work reports" ON public.employee_work_reports;
CREATE POLICY "Employee can read own work reports"
    ON public.employee_work_reports FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid() AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "Employee can submit own work reports" ON public.employee_work_reports;
CREATE POLICY "Employee can submit own work reports"
    ON public.employee_work_reports FOR INSERT TO authenticated
    WITH CHECK (
        employee_id = auth.uid() AND status = 'submitted' AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
        )
    );

-- 6.3 Employee Goals
DROP POLICY IF EXISTS "Employee can read own goals" ON public.employee_goals;
CREATE POLICY "Employee can read own goals"
    ON public.employee_goals FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid() AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
        )
    );

-- 6.4 Employee Documents
DROP POLICY IF EXISTS "Employee can read own documents" ON public.employee_documents;
CREATE POLICY "Employee can read own documents"
    ON public.employee_documents FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid() AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
        )
    );

-- 6.5 Employee Salary Hikes
DROP POLICY IF EXISTS "Employee can read own salary hikes" ON public.employee_salary_hikes;
CREATE POLICY "Employee can read own salary hikes"
    ON public.employee_salary_hikes FOR SELECT TO authenticated
    USING (
        employee_id = auth.uid() AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role IN ('owner', 'operational_manager', 'team_member') 
              AND status = 'active'
        )
    );
