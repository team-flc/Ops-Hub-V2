-- ==============================================================================
-- MIGRATION: Fix bytea input syntax in fn_launch_task_batch
-- Location: supabase/migrations/20260909000003_fix_fn_launch_task_batch_bytea.sql
-- Fix: Replace v_canonical_string::bytea with convert_to(v_canonical_string, 'UTF8')
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_launch_task_batch(
    p_request_id TEXT,
    p_client_id UUID,
    p_launch_type TEXT,
    p_source_id UUID,
    p_target_week INTEGER DEFAULT NULL,
    p_tasks JSONB DEFAULT '[]'::jsonb,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_status TEXT;
    v_client RECORD;
    v_existing_batch RECORD;
    v_payload_hash TEXT;
    v_canonical_string TEXT;
    v_task_count INTEGER;
    v_batch_id UUID;
    v_created_task_ids UUID[] := '{}';
    v_task_idx INTEGER;
    v_task_elem JSONB;
    v_new_task_id UUID;
    v_dept_id UUID;
    v_priority TEXT;
    v_approval TEXT;
    v_plan RECORD;
    v_template RECORD;
    v_template_version RECORD;
    v_planned_date DATE;
    v_due_date DATE;
    v_day_of_week INTEGER;
    v_plan_week INTEGER;
    v_task_week INTEGER;
    v_week_start DATE;
    v_week_end DATE;
    v_source_tpl_id UUID;
    v_source_tpl_ver INTEGER;
    v_occ_id UUID;
    v_details TEXT;
    v_task_title TEXT;
    v_expected_revision INTEGER;
    v_affected_rows INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Unauthorized: Missing active authentication session.');
    END IF;

    -- Strict Request ID Validation
    IF p_request_id IS NULL OR length(trim(p_request_id)) = 0 OR length(p_request_id) > 128 THEN
        RETURN jsonb_build_object('error', 'Validation Error: p_request_id must be a non-empty string with max length 128.');
    END IF;

    SELECT role, status INTO v_caller_role, v_caller_status
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_caller_role IS NULL OR v_caller_status != 'active' THEN
        RETURN jsonb_build_object('error', 'Forbidden: User profile is suspended or does not exist.');
    END IF;

    IF v_caller_role NOT IN ('owner', 'operational_manager') THEN
        RETURN jsonb_build_object('error', 'Forbidden: Only Owners and Operational Managers can launch operational task batches.');
    END IF;

    SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;
    IF v_client.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Validation Error: Target client does not exist.');
    END IF;
    IF v_client.status = 'Archived' THEN
        RETURN jsonb_build_object('error', 'Forbidden: Cannot launch tasks for an Archived client.');
    END IF;
    IF v_client.status = 'Paused' THEN
        RETURN jsonb_build_object('error', 'Forbidden: Cannot launch tasks for a Paused client.');
    END IF;

    IF v_caller_role = 'operational_manager' THEN
        IF NOT (
            v_client.operational_manager_id = v_caller_id 
            OR EXISTS (
                SELECT 1 FROM public.client_team_access 
                WHERE client_id = p_client_id AND profile_id = v_caller_id
            )
        ) THEN
            RETURN jsonb_build_object('error', 'Forbidden: Operational Manager is not assigned to this client.');
        END IF;
    END IF;

    -- Canonical SHA-256 Payload Hash using PostgreSQL built-in convert_to and sha256
    v_canonical_string := v_caller_id::TEXT || ':' || 
        p_client_id::TEXT || ':' || 
        p_launch_type || ':' || 
        COALESCE(p_source_id::TEXT, '') || ':' || 
        COALESCE(p_target_week::TEXT, '') || ':' || 
        p_tasks::TEXT || ':' ||
        p_metadata::TEXT;

    v_payload_hash := encode(sha256(convert_to(v_canonical_string, 'UTF8')), 'hex');

    -- Check Existing Launch Batch for Idempotency Replay
    SELECT * INTO v_existing_batch 
    FROM public.task_launch_batches
    WHERE client_id = p_client_id AND request_id = p_request_id;

    IF v_existing_batch.id IS NOT NULL THEN
        IF v_existing_batch.payload_hash != v_payload_hash THEN
            RETURN jsonb_build_object(
                'error', 'Conflict: A launch request with this ID already exists with different payload parameters.'
            );
        END IF;

        IF v_existing_batch.task_count = 0 OR cardinality(v_existing_batch.task_ids) != v_existing_batch.task_count THEN
            RETURN jsonb_build_object(
                'error', 'Conflict: Previous launch request was incomplete or failed.'
            );
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'idempotent_replay', true,
            'batch_id', v_existing_batch.id,
            'task_count', v_existing_batch.task_count,
            'task_ids', v_existing_batch.task_ids,
            'message', 'Request previously executed. Returning existing batch snapshot.'
        );
    END IF;

    IF jsonb_typeof(p_tasks) != 'array' THEN
        RETURN jsonb_build_object('error', 'Validation Error: p_tasks must be a JSON array.');
    END IF;

    v_task_count := jsonb_array_length(p_tasks);
    IF v_task_count < 1 THEN
        RETURN jsonb_build_object('error', 'Validation Error: Batch must contain at least 1 task.');
    END IF;
    IF v_task_count > 100 THEN
        RETURN jsonb_build_object('error', 'Validation Error: Batch task count cannot exceed 100.');
    END IF;

    -- Validate Launch Authority by Type
    IF p_launch_type = 'service_template' THEN
        IF p_target_week IS NULL OR p_target_week < 1 OR p_target_week > 4 THEN
            RETURN jsonb_build_object('error', 'Validation Error: Service template launch requires a target_week between 1 and 4.');
        END IF;

        SELECT * INTO v_template FROM public.service_templates WHERE id = p_source_id;
        IF v_template.id IS NULL THEN
            RETURN jsonb_build_object('error', 'Not Found: Source service template does not exist.');
        END IF;
        IF v_template.status != 'Active' THEN
            RETURN jsonb_build_object('error', 'Forbidden: Cannot launch tasks from an Archived service template.');
        END IF;

    ELSIF p_launch_type = 'work_plan' THEN
        IF p_source_id IS NULL THEN
            RETURN jsonb_build_object('error', 'Validation Error: Work plan launch requires a valid source plan ID.');
        END IF;

        SELECT * INTO v_plan FROM public.client_work_plans WHERE id = p_source_id FOR UPDATE;
        IF v_plan.id IS NULL THEN
            RETURN jsonb_build_object('error', 'Not Found: Source work plan does not exist.');
        END IF;

        IF v_plan.client_id != p_client_id THEN
            RETURN jsonb_build_object('error', 'Forbidden: Work plan does not belong to the specified client.');
        END IF;

        IF v_plan.status != 'Draft' THEN
            RETURN jsonb_build_object('error', format('Conflict: Work plan is already in "%s" status.', v_plan.status));
        END IF;

        v_expected_revision := (p_metadata->>'expected_revision')::INTEGER;
        IF v_expected_revision IS NOT NULL AND v_plan.revision != v_expected_revision THEN
            RETURN jsonb_build_object('error', 'Conflict: Work plan was modified by another session. Please reload.');
        END IF;
    ELSE
        RETURN jsonb_build_object('error', format('Validation Error: Unknown launch type "%s".', p_launch_type));
    END IF;

    v_batch_id := gen_random_uuid();

    -- Concurrency Lock: Insert Batch Record First
    INSERT INTO public.task_launch_batches (
        id, request_id, actor_id, client_id, launch_type, source_template_id, source_plan_id,
        target_week, task_count, task_ids, payload_hash, metadata
    ) VALUES (
        v_batch_id, p_request_id, v_caller_id, p_client_id, p_launch_type,
        CASE WHEN p_launch_type = 'service_template' THEN p_source_id ELSE NULL END,
        CASE WHEN p_launch_type = 'work_plan' THEN p_source_id ELSE NULL END,
        p_target_week, v_task_count, '{}', v_payload_hash, p_metadata
    ) ON CONFLICT (client_id, request_id) DO NOTHING;

    GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
    IF v_affected_rows = 0 THEN
        -- Concurrency collision: Another worker inserted this request concurrently
        SELECT * INTO v_existing_batch 
        FROM public.task_launch_batches
        WHERE client_id = p_client_id AND request_id = p_request_id;

        IF v_existing_batch.payload_hash != v_payload_hash THEN
            RETURN jsonb_build_object(
                'error', 'Conflict: A launch request with this ID already exists with different payload parameters.'
            );
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'idempotent_replay', true,
            'batch_id', v_existing_batch.id,
            'task_count', v_existing_batch.task_count,
            'task_ids', v_existing_batch.task_ids,
            'message', 'Concurrent request completed. Returning existing batch snapshot.'
        );
    END IF;

    -- Process Each Task Payload with Strict Validation
    FOR v_task_idx IN 0..(v_task_count - 1) LOOP
        v_task_elem := p_tasks->v_task_idx;
        v_new_task_id := gen_random_uuid();
        
        v_task_title := trim(COALESCE(v_task_elem->>'title', ''));
        IF length(v_task_title) = 0 THEN
            RAISE EXCEPTION 'Task #% title cannot be empty.', v_task_idx + 1;
        END IF;
        IF length(v_task_title) > 200 THEN
            RAISE EXCEPTION 'Task #% title cannot exceed 200 characters.', v_task_idx + 1;
        END IF;

        BEGIN
            v_dept_id := (v_task_elem->>'department_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Task #% has an invalid department UUID.', v_task_idx + 1;
        END;

        IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = v_dept_id AND status = 'active') THEN
            RAISE EXCEPTION 'Task #% department is invalid or inactive.', v_task_idx + 1;
        END IF;

        v_priority := COALESCE(v_task_elem->>'priority', 'Normal');
        IF v_priority NOT IN ('Low', 'Normal', 'High', 'Urgent') THEN
            RAISE EXCEPTION 'Task #% has invalid priority "%".', v_task_idx + 1, v_priority;
        END IF;

        v_approval := COALESCE(v_task_elem->>'approval_mode', 'Internal Only');
        IF v_approval NOT IN ('Internal Only', 'Client Approval Required') THEN
            RAISE EXCEPTION 'Task #% has invalid approval mode "%".', v_task_idx + 1, v_approval;
        END IF;

        -- Strict Date Validation
        IF v_task_elem->>'planned_date' IS NOT NULL AND length(trim(v_task_elem->>'planned_date')) > 0 THEN
            BEGIN
                v_planned_date := (v_task_elem->>'planned_date')::DATE;
            EXCEPTION WHEN OTHERS THEN
                RAISE EXCEPTION 'Task #% has invalid planned_date format.', v_task_idx + 1;
            END;

            v_day_of_week := EXTRACT(DOW FROM v_planned_date);
            IF v_day_of_week = 0 OR v_day_of_week = 6 THEN
                RAISE EXCEPTION 'Task #% planned_date cannot fall on a weekend (Saturday or Sunday).', v_task_idx + 1;
            END IF;
        ELSE
            v_planned_date := NULL;
        END IF;

        IF v_task_elem->>'due_date' IS NOT NULL AND length(trim(v_task_elem->>'due_date')) > 0 THEN
            BEGIN
                v_due_date := (v_task_elem->>'due_date')::DATE;
            EXCEPTION WHEN OTHERS THEN
                RAISE EXCEPTION 'Task #% has invalid due_date format.', v_task_idx + 1;
            END;

            v_day_of_week := EXTRACT(DOW FROM v_due_date);
            IF v_day_of_week = 0 OR v_day_of_week = 6 THEN
                RAISE EXCEPTION 'Task #% due_date cannot fall on a weekend (Saturday or Sunday).', v_task_idx + 1;
            END IF;
        ELSE
            v_due_date := NULL;
        END IF;

        IF v_planned_date IS NOT NULL AND v_due_date IS NOT NULL AND v_due_date < v_planned_date THEN
            RAISE EXCEPTION 'Task #% due_date cannot be earlier than planned_date.', v_task_idx + 1;
        END IF;

        -- Plan Week and Date Range Validation for Work Plans
        IF p_launch_type = 'work_plan' THEN
            v_plan_week := (v_task_elem->>'plan_week')::INTEGER;
            IF v_plan_week IS NULL OR v_plan_week < 1 OR v_plan_week > 13 THEN
                RAISE EXCEPTION 'Task #% must specify a valid plan_week between 1 and 13.', v_task_idx + 1;
            END IF;

            IF v_plan_week <= 12 THEN
                v_week_start := v_plan.start_date + ((v_plan_week - 1) * 7);
                v_week_end := v_week_start + 6;
            ELSE
                v_week_start := v_plan.start_date + 84;
                v_week_end := v_plan.start_date + 89;
            END IF;

            IF v_planned_date IS NOT NULL THEN
                IF v_planned_date < v_plan.start_date OR v_planned_date > v_plan.end_date THEN
                    RAISE EXCEPTION 'Task #% planned_date falls outside the 90-day plan date range.', v_task_idx + 1;
                END IF;
            END IF;

            IF v_due_date IS NOT NULL THEN
                IF v_due_date < v_plan.start_date OR v_due_date > v_plan.end_date THEN
                    RAISE EXCEPTION 'Task #% due_date falls outside the 90-day plan date range.', v_task_idx + 1;
                END IF;
            END IF;

            -- Deterministic legacy week_number mapping: ((plan_week - 1) % 4) + 1
            v_task_week := ((v_plan_week - 1) % 4) + 1;

            BEGIN
                v_source_tpl_id := (v_task_elem->>'source_template_id')::UUID;
            EXCEPTION WHEN OTHERS THEN
                v_source_tpl_id := NULL;
            END;

            v_source_tpl_ver := COALESCE((v_task_elem->>'source_template_version')::INTEGER, 1);

            BEGIN
                v_occ_id := (v_task_elem->>'occurrence_id')::UUID;
            EXCEPTION WHEN OTHERS THEN
                v_occ_id := NULL;
            END;

        ELSE
            -- Service Template launch
            v_plan_week := NULL;
            v_task_week := p_target_week;
            
            BEGIN
                v_source_tpl_id := (v_task_elem->>'source_template_id')::UUID;
            EXCEPTION WHEN OTHERS THEN
                v_source_tpl_id := NULL;
            END;
            -- Verified source template fallback (never become NULL if launched via service template)
            IF v_source_tpl_id IS NULL THEN
                v_source_tpl_id := p_source_id;
            END IF;

            v_source_tpl_ver := COALESCE((v_task_elem->>'source_template_version')::INTEGER, v_template.version, 1);
            v_occ_id := NULL;
        END IF;

        v_details := NULLIF(trim(COALESCE(v_task_elem->>'description', v_task_elem->>'details', '')), '');

        INSERT INTO public.client_tasks (
            id, client_id, week_number, title, details, department_id, assignee_id,
            priority, planned_start, due_date, status, approval_mode, created_by,
            source_template_id, source_template_version, plan_id, plan_week, occurrence_id, launch_batch_id
        ) VALUES (
            v_new_task_id, p_client_id, v_task_week, v_task_title, v_details, v_dept_id, NULL,
            v_priority, v_planned_date, v_due_date, 'Draft', v_approval, v_caller_id,
            v_source_tpl_id, v_source_tpl_ver,
            CASE WHEN p_launch_type = 'work_plan' THEN p_source_id ELSE NULL END,
            v_plan_week, v_occ_id, v_batch_id
        );

        INSERT INTO public.client_task_events (
            id, task_id, client_id, actor_id, event_type, previous_state, new_state, notes, created_at
        ) VALUES (
            gen_random_uuid(), v_new_task_id, p_client_id, v_caller_id, 'created', NULL,
            jsonb_build_object(
                'status', 'Draft', 'assignee_id', NULL, 'priority', v_priority, 'approval_mode', v_approval,
                'launch_batch_id', v_batch_id, 'launch_type', p_launch_type
            ),
            format('Task created via %s batch launch.', replace(p_launch_type, '_', ' ')),
            timezone('utc'::text, now())
        );

        v_created_task_ids := array_append(v_created_task_ids, v_new_task_id);
    END LOOP;

    UPDATE public.task_launch_batches
    SET task_ids = v_created_task_ids
    WHERE id = v_batch_id;

    IF p_launch_type = 'work_plan' THEN
        UPDATE public.client_work_plans
        SET status = 'Launched',
            launched_at = timezone('utc'::text, now()),
            launched_by = v_caller_id,
            launch_batch_id = v_batch_id,
            launch_snapshot = jsonb_build_object('batch_id', v_batch_id, 'task_count', v_task_count, 'task_ids', v_created_task_ids),
            updated_by = v_caller_id,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_source_id AND status = 'Draft' AND revision = v_plan.revision;

        GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
        IF v_affected_rows != 1 THEN
            RAISE EXCEPTION 'Work Plan revision conflict or plan already launched.';
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', false,
        'batch_id', v_batch_id,
        'task_count', v_task_count,
        'task_ids', v_created_task_ids
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_launch_task_batch(TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_launch_task_batch(TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_launch_task_batch(TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB) TO authenticated;
