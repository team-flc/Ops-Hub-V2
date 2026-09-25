-- ==============================================================================
-- MIGRATION: 20260922000003_team_member_service_templates_access.sql
-- Description: Allow Team Members to view active templates, create new templates,
--              and edit their own templates while preserving Owner/Manager governance.
-- ==============================================================================

-- 1. Update service_templates RLS Select Policy for all staff (Owner, Manager, Team Member)
DROP POLICY IF EXISTS "service_templates_select_policy" ON public.service_templates;
CREATE POLICY "service_templates_select_policy" ON public.service_templates
    FOR SELECT USING (
        public.is_owner() 
        OR (EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = (SELECT auth.uid())
              AND p.status = 'active' 
              AND p.role IN ('owner', 'operational_manager', 'team_member')
        ) AND status = 'Active')
    );

-- 2. Update service_template_tasks RLS Select Policy
DROP POLICY IF EXISTS "service_template_tasks_select_policy" ON public.service_template_tasks;
CREATE POLICY "service_template_tasks_select_policy" ON public.service_template_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.service_templates st
            WHERE st.id = service_template_tasks.template_id
              AND (
                  public.is_owner() 
                  OR (EXISTS (
                      SELECT 1 FROM public.profiles p 
                      WHERE p.id = (SELECT auth.uid())
                        AND p.status = 'active' 
                        AND p.role IN ('owner', 'operational_manager', 'team_member')
                  ) AND st.status = 'Active')
              )
        )
    );

-- 3. Update single-task task_templates RLS Select Policy
DROP POLICY IF EXISTS task_templates_select ON public.task_templates;
CREATE POLICY task_templates_select ON public.task_templates
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.status = 'active'
          AND (
              p.role = 'owner'
              OR (p.role IN ('operational_manager', 'team_member') AND task_templates.status = 'Active')
          )
    )
);

-- 4. Update fn_manage_service_template RPC to support team member creation and author editing
CREATE OR REPLACE FUNCTION public.fn_manage_service_template(
    p_action TEXT,
    p_template_id UUID DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_service_label TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_tasks JSONB DEFAULT '[]'::jsonb,
    p_sort_order INTEGER DEFAULT 0,
    p_archive_reason TEXT DEFAULT NULL,
    p_expected_version INTEGER DEFAULT NULL
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
    v_template RECORD;
    v_target_id UUID;
    v_new_version INTEGER;
    v_task_count INTEGER;
    v_task_elem JSONB;
    v_idx INTEGER;
    v_title TEXT;
    v_dept_id UUID;
    v_priority TEXT;
    v_approval TEXT;
    v_offset INTEGER;
    v_duration INTEGER;
    v_def_id UUID;
    v_task_array JSONB := '[]'::jsonb;
    v_copied_task RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Unauthorized: Missing active authentication session.');
    END IF;

    SELECT role, status INTO v_caller_role, v_caller_status
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_caller_role IS NULL OR v_caller_status != 'active' THEN
        RETURN jsonb_build_object('error', 'Forbidden: User profile is suspended or does not exist.');
    END IF;

    IF v_caller_role NOT IN ('owner', 'operational_manager', 'team_member') THEN
        RETURN jsonb_build_object('error', 'Forbidden: Clients cannot manage service templates.');
    END IF;

    -- =========================================================================
    -- ACTION: CREATE
    -- =========================================================================
    IF p_action = 'create' THEN
        IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
            RETURN jsonb_build_object('error', 'Validation Error: Template name is required.');
        END IF;
        IF length(p_name) > 150 THEN
            RETURN jsonb_build_object('error', 'Validation Error: Template name cannot exceed 150 characters.');
        END IF;

        IF p_service_label IS NULL OR length(trim(p_service_label)) = 0 THEN
            RETURN jsonb_build_object('error', 'Validation Error: Service category label is required.');
        END IF;
        IF length(p_service_label) > 100 THEN
            RETURN jsonb_build_object('error', 'Validation Error: Service category label cannot exceed 100 characters.');
        END IF;

        IF jsonb_typeof(p_tasks) != 'array' THEN
            RETURN jsonb_build_object('error', 'Validation Error: Tasks payload must be a JSON array.');
        END IF;

        v_task_count := jsonb_array_length(p_tasks);
        IF v_task_count < 1 THEN
            RETURN jsonb_build_object('error', 'Validation Error: A Service Template must contain at least 1 child task.');
        END IF;
        IF v_task_count > 100 THEN
            RETURN jsonb_build_object('error', 'Validation Error: A Service Template cannot contain more than 100 child tasks.');
        END IF;

        FOR v_idx IN 0..(v_task_count - 1) LOOP
            v_task_elem := p_tasks->v_idx;
            v_title := trim(COALESCE(v_task_elem->>'title', ''));
            IF length(v_title) = 0 THEN
                RETURN jsonb_build_object('error', format('Validation Error: Task #%s must have a non-empty title.', v_idx + 1));
            END IF;
            IF length(v_title) > 200 THEN
                RETURN jsonb_build_object('error', format('Validation Error: Task #%s title cannot exceed 200 characters.', v_idx + 1));
            END IF;

            BEGIN
                v_dept_id := (v_task_elem->>'department_id')::UUID;
            EXCEPTION WHEN OTHERS THEN
                RETURN jsonb_build_object('error', format('Validation Error: Task #%s has an invalid department UUID.', v_idx + 1));
            END;

            IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = v_dept_id AND status = 'active') THEN
                RETURN jsonb_build_object('error', format('Validation Error: Task #%s references an inactive or non-existent department.', v_idx + 1));
            END IF;

            v_priority := COALESCE(v_task_elem->>'priority', 'Normal');
            IF v_priority NOT IN ('Low', 'Normal', 'High', 'Urgent') THEN
                RETURN jsonb_build_object('error', format('Validation Error: Task #%s has invalid priority "%s".', v_idx + 1, v_priority));
            END IF;

            v_approval := COALESCE(v_task_elem->>'approval_mode', 'Internal Only');
            IF v_approval NOT IN ('Internal Only', 'Client Approval Required') THEN
                RETURN jsonb_build_object('error', format('Validation Error: Task #%s has invalid approval mode "%s".', v_idx + 1, v_approval));
            END IF;

            v_offset := COALESCE((v_task_elem->>'planned_offset_days')::INTEGER, 0);
            IF v_offset < 0 OR v_offset > 90 THEN
                RETURN jsonb_build_object('error', format('Validation Error: Task #%s planned offset days must be between 0 and 90.', v_idx + 1));
            END IF;

            v_duration := COALESCE((v_task_elem->>'duration_business_days')::INTEGER, 1);
            IF v_duration < 1 OR v_duration > 90 THEN
                RETURN jsonb_build_object('error', format('Validation Error: Task #%s duration business days must be between 1 and 90.', v_idx + 1));
            END IF;
        END LOOP;

        v_target_id := gen_random_uuid();
        INSERT INTO public.service_templates (
            id, name, service_label, description, status, version, sort_order, created_by, updated_by
        ) VALUES (
            v_target_id, trim(p_name), trim(p_service_label), NULLIF(trim(p_description), ''), 'Active', 1, p_sort_order, v_caller_id, v_caller_id
        );

        FOR v_idx IN 0..(v_task_count - 1) LOOP
            v_task_elem := p_tasks->v_idx;
            v_title := trim(v_task_elem->>'title');
            v_dept_id := (v_task_elem->>'department_id')::UUID;
            v_priority := COALESCE(v_task_elem->>'priority', 'Normal');
            v_approval := COALESCE(v_task_elem->>'approval_mode', 'Internal Only');
            v_offset := COALESCE((v_task_elem->>'planned_offset_days')::INTEGER, 0);
            v_duration := COALESCE((v_task_elem->>'duration_business_days')::INTEGER, 1);

            BEGIN
                v_def_id := COALESCE((v_task_elem->>'definition_id')::UUID, gen_random_uuid());
            EXCEPTION WHEN OTHERS THEN
                v_def_id := gen_random_uuid();
            END;

            INSERT INTO public.service_template_tasks (
                id, template_id, definition_id, title, description, department_id,
                priority, approval_mode, planned_offset_days, duration_business_days, display_order
            ) VALUES (
                gen_random_uuid(), v_target_id, v_def_id, v_title, NULLIF(trim(v_task_elem->>'description'), ''),
                v_dept_id, v_priority, v_approval, v_offset, v_duration, v_idx
            );

            v_task_array := v_task_array || jsonb_build_object(
                'definition_id', v_def_id, 'title', v_title, 'description', NULLIF(trim(v_task_elem->>'description'), ''),
                'department_id', v_dept_id, 'priority', v_priority, 'approval_mode', v_approval,
                'planned_offset_days', v_offset, 'duration_business_days', v_duration, 'display_order', v_idx
            );
        END LOOP;

        INSERT INTO public.service_template_versions (
            id, template_id, version, snapshot, created_by
        ) VALUES (
            gen_random_uuid(), v_target_id, 1,
            jsonb_build_object('id', v_target_id, 'name', trim(p_name), 'service_label', trim(p_service_label), 'tasks', v_task_array),
            v_caller_id
        );

        RETURN jsonb_build_object('success', true, 'template_id', v_target_id, 'version', 1);

    -- =========================================================================
    -- ACTION: UPDATE
    -- =========================================================================
    ELSIF p_action = 'update' THEN
        IF p_template_id IS NULL THEN
            RETURN jsonb_build_object('error', 'Validation Error: template_id is required for update.');
        END IF;

        IF p_expected_version IS NULL THEN
            RETURN jsonb_build_object('error', 'Validation Error: expected_version is required for update.');
        END IF;

        SELECT * INTO v_template FROM public.service_templates WHERE id = p_template_id FOR UPDATE;
        IF v_template.id IS NULL THEN
            RETURN jsonb_build_object('error', 'Not Found: Service template does not exist.');
        END IF;
        IF v_template.status = 'Archived' THEN
            RETURN jsonb_build_object('error', 'Forbidden: Cannot edit an archived service template. Restore it first.');
        END IF;

        -- Author / Role permission check
        IF v_caller_role NOT IN ('owner', 'operational_manager') AND v_template.created_by != v_caller_id THEN
            RETURN jsonb_build_object('error', 'Forbidden: You can only edit service templates created by yourself.');
        END IF;

        IF v_template.version != p_expected_version THEN
            RETURN jsonb_build_object('error', 'Conflict: Template was modified in another session. Please reload.');
        END IF;

        IF p_name IS NOT NULL AND length(trim(p_name)) = 0 THEN
            RETURN jsonb_build_object('error', 'Validation Error: Template name cannot be blank.');
        END IF;
        IF p_name IS NOT NULL AND length(p_name) > 150 THEN
            RETURN jsonb_build_object('error', 'Validation Error: Template name cannot exceed 150 characters.');
        END IF;

        IF p_service_label IS NOT NULL AND length(trim(p_service_label)) = 0 THEN
            RETURN jsonb_build_object('error', 'Validation Error: Service category label cannot be blank.');
        END IF;
        IF p_service_label IS NOT NULL AND length(p_service_label) > 100 THEN
            RETURN jsonb_build_object('error', 'Validation Error: Service category label cannot exceed 100 characters.');
        END IF;

        IF p_tasks IS NOT NULL AND jsonb_typeof(p_tasks) = 'array' AND jsonb_array_length(p_tasks) > 0 THEN
            v_task_count := jsonb_array_length(p_tasks);
            IF v_task_count > 100 THEN
                RETURN jsonb_build_object('error', 'Validation Error: A Service Template cannot contain more than 100 child tasks.');
            END IF;

            FOR v_idx IN 0..(v_task_count - 1) LOOP
                v_task_elem := p_tasks->v_idx;
                v_title := trim(COALESCE(v_task_elem->>'title', ''));
                IF length(v_title) = 0 THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Task #%s must have a non-empty title.', v_idx + 1));
                END IF;
                IF length(v_title) > 200 THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Task #%s title cannot exceed 200 characters.', v_idx + 1));
                END IF;

                BEGIN
                    v_dept_id := (v_task_elem->>'department_id')::UUID;
                EXCEPTION WHEN OTHERS THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Task #%s has an invalid department UUID.', v_idx + 1));
                END;

                IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = v_dept_id AND status = 'active') THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Task #%s references an inactive or non-existent department.', v_idx + 1));
                END IF;

                v_priority := COALESCE(v_task_elem->>'priority', 'Normal');
                IF v_priority NOT IN ('Low', 'Normal', 'High', 'Urgent') THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Task #%s has invalid priority "%s".', v_idx + 1, v_priority));
                END IF;

                v_approval := COALESCE(v_task_elem->>'approval_mode', 'Internal Only');
                IF v_approval NOT IN ('Internal Only', 'Client Approval Required') THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Task #%s has invalid approval mode "%s".', v_idx + 1, v_approval));
                END IF;

                v_offset := COALESCE((v_task_elem->>'planned_offset_days')::INTEGER, 0);
                IF v_offset < 0 OR v_offset > 90 THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Task #%s planned offset days must be between 0 and 90.', v_idx + 1));
                END IF;

                v_duration := COALESCE((v_task_elem->>'duration_business_days')::INTEGER, 1);
                IF v_duration < 1 OR v_duration > 90 THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Task #%s duration business days must be between 1 and 90.', v_idx + 1));
                END IF;
            END LOOP;
        END IF;

        v_new_version := v_template.version + 1;

        UPDATE public.service_templates
        SET name = COALESCE(trim(p_name), name),
            service_label = COALESCE(trim(p_service_label), service_label),
            description = CASE WHEN p_description IS NOT NULL THEN NULLIF(trim(p_description), '') ELSE description END,
            sort_order = COALESCE(p_sort_order, sort_order),
            version = v_new_version,
            updated_by = v_caller_id,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_template_id;

        IF p_tasks IS NOT NULL AND jsonb_typeof(p_tasks) = 'array' AND jsonb_array_length(p_tasks) > 0 THEN
            DELETE FROM public.service_template_tasks WHERE template_id = p_template_id;

            FOR v_idx IN 0..(v_task_count - 1) LOOP
                v_task_elem := p_tasks->v_idx;
                v_title := trim(v_task_elem->>'title');
                v_dept_id := (v_task_elem->>'department_id')::UUID;
                v_priority := COALESCE(v_task_elem->>'priority', 'Normal');
                v_approval := COALESCE(v_task_elem->>'approval_mode', 'Internal Only');
                v_offset := COALESCE((v_task_elem->>'planned_offset_days')::INTEGER, 0);
                v_duration := COALESCE((v_task_elem->>'duration_business_days')::INTEGER, 1);

                BEGIN
                    v_def_id := COALESCE((v_task_elem->>'definition_id')::UUID, gen_random_uuid());
                EXCEPTION WHEN OTHERS THEN
                    v_def_id := gen_random_uuid();
                END;

                INSERT INTO public.service_template_tasks (
                    id, template_id, definition_id, title, description, department_id,
                    priority, approval_mode, planned_offset_days, duration_business_days, display_order
                ) VALUES (
                    gen_random_uuid(), p_template_id, v_def_id, v_title, NULLIF(trim(v_task_elem->>'description'), ''),
                    v_dept_id, v_priority, v_approval, v_offset, v_duration, v_idx
                );

                v_task_array := v_task_array || jsonb_build_object(
                    'definition_id', v_def_id, 'title', v_title, 'description', NULLIF(trim(v_task_elem->>'description'), ''),
                    'department_id', v_dept_id, 'priority', v_priority, 'approval_mode', v_approval,
                    'planned_offset_days', v_offset, 'duration_business_days', v_duration, 'display_order', v_idx
                );
            END LOOP;

            INSERT INTO public.service_template_versions (
                id, template_id, version, snapshot, created_by
            ) VALUES (
                gen_random_uuid(), p_template_id, v_new_version,
                jsonb_build_object('id', p_template_id, 'name', COALESCE(trim(p_name), v_template.name), 'service_label', COALESCE(trim(p_service_label), v_template.service_label), 'tasks', v_task_array),
                v_caller_id
            );
        END IF;

        RETURN jsonb_build_object('success', true, 'template_id', p_template_id, 'version', v_new_version);

    -- =========================================================================
    -- ACTION: DUPLICATE
    -- =========================================================================
    ELSIF p_action = 'duplicate' THEN
        IF p_template_id IS NULL THEN
            RETURN jsonb_build_object('error', 'Validation Error: template_id is required for duplicate.');
        END IF;

        SELECT * INTO v_template FROM public.service_templates WHERE id = p_template_id;
        IF v_template.id IS NULL THEN
            RETURN jsonb_build_object('error', 'Not Found: Service template does not exist.');
        END IF;

        v_target_id := gen_random_uuid();
        INSERT INTO public.service_templates (
            id, name, service_label, description, status, version, sort_order, created_by, updated_by
        ) VALUES (
            v_target_id, v_template.name || ' (Copy)', v_template.service_label, v_template.description, 'Active', 1, v_template.sort_order, v_caller_id, v_caller_id
        );

        FOR v_copied_task IN 
            SELECT * FROM public.service_template_tasks 
            WHERE template_id = p_template_id 
            ORDER BY display_order ASC 
        LOOP
            v_def_id := gen_random_uuid();
            INSERT INTO public.service_template_tasks (
                id, template_id, definition_id, title, description, department_id,
                priority, approval_mode, planned_offset_days, duration_business_days, display_order
            ) VALUES (
                gen_random_uuid(), v_target_id, v_def_id, v_copied_task.title, v_copied_task.description,
                v_copied_task.department_id, v_copied_task.priority, v_copied_task.approval_mode,
                v_copied_task.planned_offset_days, v_copied_task.duration_business_days, v_copied_task.display_order
            );

            v_task_array := v_task_array || jsonb_build_object(
                'definition_id', v_def_id, 'title', v_copied_task.title, 'description', v_copied_task.description,
                'department_id', v_copied_task.department_id, 'priority', v_copied_task.priority,
                'approval_mode', v_copied_task.approval_mode, 'planned_offset_days', v_copied_task.planned_offset_days,
                'duration_business_days', v_copied_task.duration_business_days, 'display_order', v_copied_task.display_order
            );
        END LOOP;

        INSERT INTO public.service_template_versions (
            id, template_id, version, snapshot, created_by
        ) VALUES (
            gen_random_uuid(), v_target_id, 1,
            jsonb_build_object('id', v_target_id, 'name', v_template.name || ' (Copy)', 'service_label', v_template.service_label, 'tasks', v_task_array),
            v_caller_id
        );

        RETURN jsonb_build_object('success', true, 'template_id', v_target_id, 'version', 1);

    -- =========================================================================
    -- ACTION: ARCHIVE (Owner Only)
    -- =========================================================================
    ELSIF p_action = 'archive' THEN
        IF v_caller_role != 'owner' THEN
            RETURN jsonb_build_object('error', 'Forbidden: Only Owners can archive service templates.');
        END IF;

        IF p_template_id IS NULL THEN
            RETURN jsonb_build_object('error', 'Validation Error: template_id is required for archive.');
        END IF;

        IF p_archive_reason IS NULL OR length(trim(p_archive_reason)) = 0 THEN
            RETURN jsonb_build_object('error', 'Validation Error: An archive reason is required.');
        END IF;

        SELECT * INTO v_template FROM public.service_templates WHERE id = p_template_id FOR UPDATE;
        IF v_template.id IS NULL THEN
            RETURN jsonb_build_object('error', 'Not Found: Service template does not exist.');
        END IF;

        UPDATE public.service_templates
        SET status = 'Archived',
            archived_at = timezone('utc'::text, now()),
            archived_by = v_caller_id,
            archive_reason = trim(p_archive_reason),
            updated_by = v_caller_id,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_template_id;

        RETURN jsonb_build_object('success', true, 'template_id', p_template_id, 'status', 'Archived');

    -- =========================================================================
    -- ACTION: RESTORE (Owner Only)
    -- =========================================================================
    ELSIF p_action = 'restore' THEN
        IF v_caller_role != 'owner' THEN
            RETURN jsonb_build_object('error', 'Forbidden: Only Owners can restore service templates.');
        END IF;

        IF p_template_id IS NULL THEN
            RETURN jsonb_build_object('error', 'Validation Error: template_id is required for restore.');
        END IF;

        SELECT * INTO v_template FROM public.service_templates WHERE id = p_template_id FOR UPDATE;
        IF v_template.id IS NULL THEN
            RETURN jsonb_build_object('error', 'Not Found: Service template does not exist.');
        END IF;

        UPDATE public.service_templates
        SET status = 'Active',
            archived_at = NULL,
            archived_by = NULL,
            archive_reason = NULL,
            updated_by = v_caller_id,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_template_id;

        RETURN jsonb_build_object('success', true, 'template_id', p_template_id, 'status', 'Active');

    ELSE
        RETURN jsonb_build_object('error', format('Unknown action "%s". Supported actions: create, update, duplicate, archive, restore.', p_action));
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_manage_service_template TO authenticated;

-- ==============================================================================
-- 5. Update fn_manage_task_template_mutation RPC to support staff creation/author editing
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fn_manage_task_template_mutation(
    p_actor_id UUID,
    p_action TEXT,
    p_idempotency_key TEXT,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_profile RECORD;
    v_existing_claim RECORD;
    v_claim_id UUID;
    v_claim_inserted BOOLEAN;

    -- Mutation Results
    v_template RECORD;
    v_old_template RECORD;
    v_source_template RECORD;
    v_entity_id UUID;
    v_entity_name TEXT;
    v_previous_state JSONB;
    v_new_state JSONB;
    v_audit_action TEXT;
    v_department_name TEXT;

    -- Extracted Payload Variables
    v_template_id UUID;
    v_name TEXT;
    v_description TEXT;
    v_department_id UUID;
    v_default_task_title TEXT;
    v_task_details TEXT;
    v_default_priority TEXT;
    v_default_approval_mode TEXT;
    v_suggested_duration_days INTEGER;
    v_sort_order INTEGER;
    v_expected_version INTEGER;
    v_archive_reason TEXT;
BEGIN
    -- 1. Validate Actor Profile & Staff Authorization
    SELECT id, full_name, role, status
    INTO v_actor_profile
    FROM public.profiles
    WHERE id = p_actor_id;

    IF v_actor_profile.id IS NULL OR v_actor_profile.status != 'active' OR v_actor_profile.role NOT IN ('owner', 'operational_manager', 'team_member') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Forbidden: Only active Staff members can manage task templates.',
            'code', '403_FORBIDDEN'
        );
    END IF;

    IF p_action IN ('archive', 'restore') AND v_actor_profile.role != 'owner' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Forbidden: Only the Executive Owner can archive or restore task templates.',
            'code', '403_FORBIDDEN'
        );
    END IF;

    -- Validate Idempotency Key Parameter
    IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Missing required parameter: idempotency_key.',
            'code', '400_BAD_REQUEST'
        );
    END IF;

    -- 2. Race-Safe Idempotency Claim
    v_claim_inserted := FALSE;

    INSERT INTO public.template_mutation_requests (
        actor_id,
        action,
        idempotency_key,
        status
    ) VALUES (
        p_actor_id,
        p_action,
        p_idempotency_key,
        'processing'
    )
    ON CONFLICT (actor_id, action, idempotency_key) DO NOTHING
    RETURNING id INTO v_claim_id;

    IF v_claim_id IS NOT NULL THEN
        v_claim_inserted := TRUE;
    END IF;

    IF NOT v_claim_inserted THEN
        SELECT id, status, response_payload
        INTO v_existing_claim
        FROM public.template_mutation_requests
        WHERE actor_id = p_actor_id
          AND action = p_action
          AND idempotency_key = p_idempotency_key
        FOR UPDATE;

        IF v_existing_claim.status = 'completed' AND v_existing_claim.response_payload IS NOT NULL THEN
            RETURN jsonb_set(v_existing_claim.response_payload, '{is_replay}', 'true'::jsonb);
        ELSIF v_existing_claim.status = 'processing' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Conflict: Mutation already in progress for this request. Please wait.',
                'code', '409_CONCURRENT'
            );
        ELSIF v_existing_claim.status = 'failed' THEN
            UPDATE public.template_mutation_requests
            SET status = 'processing',
                response_payload = NULL,
                completed_at = NULL,
                created_at = timezone('utc'::text, now())
            WHERE id = v_existing_claim.id;
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Conflict: Request in unexpected state.',
                'code', '409_CONFLICT'
            );
        END IF;
    END IF;

    -- 3. Execute Mutation Action
    IF p_action = 'create' THEN
        v_name := trim(p_payload->>'name');
        v_description := p_payload->>'description';
        v_department_id := (p_payload->>'department_id')::UUID;
        v_default_task_title := trim(p_payload->>'default_task_title');
        v_task_details := p_payload->>'task_details';
        v_default_priority := COALESCE(p_payload->>'default_priority', 'Normal');
        v_default_approval_mode := COALESCE(p_payload->>'default_approval_mode', 'Internal Only');
        v_suggested_duration_days := COALESCE((p_payload->>'suggested_duration_days')::INTEGER, 3);
        v_sort_order := COALESCE((p_payload->>'sort_order')::INTEGER, 0);

        IF v_name IS NULL OR length(v_name) = 0 THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Template name is required.', 'code', '400_BAD_REQUEST');
        END IF;

        IF v_default_task_title IS NULL OR length(v_default_task_title) = 0 THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Default task title is required.', 'code', '400_BAD_REQUEST');
        END IF;

        IF v_department_id IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Responsible department is required.', 'code', '400_BAD_REQUEST');
        END IF;

        SELECT name INTO v_department_name FROM public.departments WHERE id = v_department_id;
        IF v_department_name IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Referenced department does not exist.', 'code', '400_BAD_REQUEST');
        END IF;

        INSERT INTO public.task_templates (
            name, description, department_id, default_task_title, task_details,
            default_priority, default_approval_mode, suggested_duration_days,
            sort_order, status, version, created_by, updated_by
        ) VALUES (
            v_name, v_description, v_department_id, v_default_task_title, v_task_details,
            v_default_priority, v_default_approval_mode, v_suggested_duration_days,
            v_sort_order, 'Active', 1, p_actor_id, p_actor_id
        ) RETURNING * INTO v_template;

        v_entity_id := v_template.id;
        v_entity_name := v_template.name;
        v_previous_state := NULL;
        v_new_state := to_jsonb(v_template);
        v_audit_action := 'template_created';

    ELSIF p_action = 'update' THEN
        v_template_id := (p_payload->>'template_id')::UUID;
        IF v_template_id IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Missing required parameter: template_id.', 'code', '400_BAD_REQUEST');
        END IF;

        IF NOT (p_payload ? 'expected_version') OR (p_payload->>'expected_version') IS NULL OR length(trim(p_payload->>'expected_version')) = 0 THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Missing required parameter: expected_version (atomic version locking required).', 'code', '400_BAD_REQUEST');
        END IF;

        v_expected_version := (p_payload->>'expected_version')::INTEGER;

        SELECT * INTO v_old_template FROM public.task_templates WHERE id = v_template_id FOR UPDATE;
        IF v_old_template.id IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Template not found.', 'code', '404_NOT_FOUND');
        END IF;

        IF v_actor_profile.role NOT IN ('owner', 'operational_manager') AND v_old_template.created_by != p_actor_id THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Forbidden: You can only edit task templates created by yourself.', 'code', '403_FORBIDDEN');
        END IF;

        IF v_old_template.version != v_expected_version THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Stale update rejected: Expected version ' || v_expected_version || ', but template is at version ' || v_old_template.version || '. Please refresh and retry.',
                'code', '409_VERSION_CONFLICT'
            );
        END IF;

        v_name := COALESCE(NULLIF(trim(p_payload->>'name'), ''), v_old_template.name);
        v_default_task_title := COALESCE(NULLIF(trim(p_payload->>'default_task_title'), ''), v_old_template.default_task_title);
        v_department_id := COALESCE((p_payload->>'department_id')::UUID, v_old_template.department_id);
        v_description := CASE WHEN p_payload ? 'description' THEN p_payload->>'description' ELSE v_old_template.description END;
        v_task_details := CASE WHEN p_payload ? 'task_details' THEN p_payload->>'task_details' ELSE v_old_template.task_details END;
        v_default_priority := COALESCE(p_payload->>'default_priority', v_old_template.default_priority);
        v_default_approval_mode := COALESCE(p_payload->>'default_approval_mode', v_old_template.default_approval_mode);
        v_suggested_duration_days := COALESCE((p_payload->>'suggested_duration_days')::INTEGER, v_old_template.suggested_duration_days);
        v_sort_order := COALESCE((p_payload->>'sort_order')::INTEGER, v_old_template.sort_order);

        UPDATE public.task_templates
        SET name = v_name,
            description = v_description,
            department_id = v_department_id,
            default_task_title = v_default_task_title,
            task_details = v_task_details,
            default_priority = v_default_priority,
            default_approval_mode = v_default_approval_mode,
            suggested_duration_days = v_suggested_duration_days,
            sort_order = v_sort_order,
            version = v_old_template.version + 1,
            updated_by = p_actor_id,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_template_id
          AND version = v_old_template.version
        RETURNING * INTO v_template;

        IF v_template.id IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Conflict: Concurrent update detected. Please retry.', 'code', '409_CONCURRENT_UPDATE');
        END IF;

        v_entity_id := v_template.id;
        v_entity_name := v_template.name;
        v_previous_state := to_jsonb(v_old_template);
        v_new_state := to_jsonb(v_template);
        v_audit_action := 'template_updated';

    ELSIF p_action = 'duplicate' THEN
        v_template_id := (p_payload->>'template_id')::UUID;
        IF v_template_id IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Missing required parameter: template_id.', 'code', '400_BAD_REQUEST');
        END IF;

        SELECT * INTO v_source_template FROM public.task_templates WHERE id = v_template_id;
        IF v_source_template.id IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Source template not found.', 'code', '404_NOT_FOUND');
        END IF;

        INSERT INTO public.task_templates (
            name, description, department_id, default_task_title, task_details,
            default_priority, default_approval_mode, suggested_duration_days,
            sort_order, status, version, seed_key, created_by, updated_by
        ) VALUES (
            v_source_template.name || ' (Copy)',
            v_source_template.description,
            v_source_template.department_id,
            v_source_template.default_task_title,
            v_source_template.task_details,
            v_source_template.default_priority,
            v_source_template.default_approval_mode,
            v_source_template.suggested_duration_days,
            v_source_template.sort_order + 1,
            'Active', 1, NULL, p_actor_id, p_actor_id
        ) RETURNING * INTO v_template;

        v_entity_id := v_template.id;
        v_entity_name := v_template.name;
        v_previous_state := NULL;
        v_new_state := to_jsonb(v_template);
        v_audit_action := 'template_duplicated';

    ELSIF p_action = 'archive' THEN
        v_template_id := (p_payload->>'template_id')::UUID;
        v_archive_reason := trim(p_payload->>'archive_reason');

        IF v_template_id IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Missing required parameter: template_id.', 'code', '400_BAD_REQUEST');
        END IF;

        IF v_archive_reason IS NULL OR length(v_archive_reason) = 0 THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'A mandatory non-empty reason is required to archive a template.', 'code', '400_BAD_REQUEST');
        END IF;

        SELECT * INTO v_old_template FROM public.task_templates WHERE id = v_template_id FOR UPDATE;
        IF v_old_template.id IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Template not found.', 'code', '404_NOT_FOUND');
        END IF;

        IF v_old_template.status != 'Active' THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Conflict: Template is already archived or is not in Active status.',
                'code', '409_STATUS_CONFLICT'
            );
        END IF;

        UPDATE public.task_templates
        SET status = 'Archived',
            archive_reason = v_archive_reason,
            archived_at = timezone('utc'::text, now()),
            archived_by = p_actor_id,
            updated_by = p_actor_id,
            version = v_old_template.version + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_template_id
          AND status = 'Active'
        RETURNING * INTO v_template;

        v_entity_id := v_template.id;
        v_entity_name := v_template.name;
        v_previous_state := to_jsonb(v_old_template);
        v_new_state := to_jsonb(v_template);
        v_audit_action := 'template_archived';

    ELSIF p_action = 'restore' THEN
        v_template_id := (p_payload->>'template_id')::UUID;
        IF v_template_id IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Missing required parameter: template_id.', 'code', '400_BAD_REQUEST');
        END IF;

        SELECT * INTO v_old_template FROM public.task_templates WHERE id = v_template_id FOR UPDATE;
        IF v_old_template.id IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Template not found.', 'code', '404_NOT_FOUND');
        END IF;

        IF v_old_template.status != 'Archived' THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Conflict: Template is already Active or is not in Archived status.',
                'code', '409_STATUS_CONFLICT'
            );
        END IF;

        UPDATE public.task_templates
        SET status = 'Active',
            archive_reason = NULL,
            archived_at = NULL,
            archived_by = NULL,
            updated_by = p_actor_id,
            version = v_old_template.version + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_template_id
          AND status = 'Archived'
        RETURNING * INTO v_template;

        v_entity_id := v_template.id;
        v_entity_name := v_template.name;
        v_previous_state := to_jsonb(v_old_template);
        v_new_state := to_jsonb(v_template);
        v_audit_action := 'template_restored';

    ELSE
        UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('success', false, 'error', 'Unsupported action: ' || p_action, 'code', '400_BAD_REQUEST');
    END IF;

    -- 4. Audit Log Entry
    BEGIN
        INSERT INTO public.audit_logs (
            actor_id,
            actor_name,
            action,
            entity_type,
            entity_id,
            details,
            created_at
        ) VALUES (
            p_actor_id,
            v_actor_profile.full_name,
            v_audit_action,
            'task_template',
            v_entity_id,
            jsonb_build_object(
                'name', v_entity_name,
                'action', p_action,
                'previous_state', v_previous_state,
                'new_state', v_new_state
            ),
            timezone('utc'::text, now())
        );
    EXCEPTION WHEN OTHERS THEN
        -- Non-fatal
    END;

    -- 5. Mark Idempotency Claim Completed
    UPDATE public.template_mutation_requests
    SET status = 'completed',
        resource_id = v_entity_id,
        response_payload = jsonb_build_object(
            'success', true,
            'template', to_jsonb(v_template),
            'action', p_action
        ),
        completed_at = timezone('utc'::text, now())
    WHERE actor_id = p_actor_id
      AND action = p_action
      AND idempotency_key = p_idempotency_key;

    RETURN jsonb_build_object(
        'success', true,
        'template', to_jsonb(v_template),
        'action', p_action
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_manage_task_template_mutation TO authenticated;

