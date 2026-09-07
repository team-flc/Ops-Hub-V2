-- ==============================================================================
-- MIGRATION: 20260909000001_phase3d_service_templates_work_plans.sql
-- Phase: 3D — Multi-Task Service Templates, 90-Day Work Plans, Phase 3C Backfill & Authoritative RPC Engine
-- Database: PostgreSQL / Supabase (Ops Hub V2 Schema)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD PHASE 3D COMPANION PROVENANCE COLUMNS TO REAL OPERATIONAL TASKS TABLE
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- 1.1 Source Template Reference
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'source_template_id'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN source_template_id UUID;
    END IF;

    -- 1.2 Source Template Version
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'source_template_version'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN source_template_version INTEGER;
    END IF;

    -- 1.3 Work Plan Reference
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'plan_id'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN plan_id UUID;
    END IF;

    -- 1.4 Work Plan Week Number (Weeks 1..13)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'plan_week'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN plan_week INTEGER CHECK (plan_week BETWEEN 1 AND 13);
    END IF;

    -- 1.5 Work Plan Template Occurrence Reference
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'occurrence_id'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN occurrence_id UUID;
    END IF;

    -- 1.6 Launch Batch Reference
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'launch_batch_id'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN launch_batch_id UUID;
    END IF;
END $$;

-- Performance indexes for task provenance
CREATE INDEX IF NOT EXISTS idx_client_tasks_plan_provenance
ON public.client_tasks(plan_id, plan_week)
WHERE plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_tasks_source_template
ON public.client_tasks(source_template_id)
WHERE source_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_tasks_launch_batch
ON public.client_tasks(launch_batch_id)
WHERE launch_batch_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. SERVICE TEMPLATES CORE SCHEMA
-- ------------------------------------------------------------------------------

-- 2.1 Service Templates Master Table
CREATE TABLE IF NOT EXISTS public.service_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    service_label TEXT NOT NULL DEFAULT 'General Service',
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    sort_order INTEGER NOT NULL DEFAULT 0,
    legacy_task_template_id UUID REFERENCES public.task_templates(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    archive_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT chk_service_templates_name CHECK (length(trim(name)) > 0 AND length(name) <= 200),
    CONSTRAINT chk_service_templates_label CHECK (length(trim(service_label)) > 0 AND length(service_label) <= 100)
);

CREATE INDEX IF NOT EXISTS idx_service_templates_status_sort
ON public.service_templates(status, sort_order ASC, name ASC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_templates_legacy_id
ON public.service_templates(legacy_task_template_id)
WHERE legacy_task_template_id IS NOT NULL;

-- 2.2 Service Template Child Tasks (1–100 Ordered Tasks per Template)
CREATE TABLE IF NOT EXISTS public.service_template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.service_templates(id) ON DELETE CASCADE,
    definition_id UUID NOT NULL DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    approval_mode TEXT NOT NULL DEFAULT 'Internal Only' CHECK (approval_mode IN ('Internal Only', 'Client Approval Required')),
    planned_offset_days INTEGER NOT NULL DEFAULT 0 CHECK (planned_offset_days >= 0 AND planned_offset_days <= 89),
    duration_business_days INTEGER NOT NULL DEFAULT 1 CHECK (duration_business_days >= 1 AND duration_business_days <= 90),
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0 AND display_order <= 99),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT chk_service_template_tasks_title CHECK (length(trim(title)) > 0 AND length(title) <= 200),
    CONSTRAINT uq_service_template_task_order UNIQUE(template_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_service_template_tasks_lookup
ON public.service_template_tasks(template_id, display_order ASC);

-- 2.3 Service Template Versions (Immutable Snapshots)
CREATE TABLE IF NOT EXISTS public.service_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.service_templates(id) ON DELETE CASCADE,
    version INTEGER NOT NULL CHECK (version >= 1),
    snapshot JSONB NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_service_template_version UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_service_template_versions_lookup
ON public.service_template_versions(template_id, version DESC);

-- ------------------------------------------------------------------------------
-- 3. EXACT 90-CALENDAR-DAY WORK PLANS SCHEMA
-- ------------------------------------------------------------------------------

-- 3.1 Client Work Plans Master Table
CREATE TABLE IF NOT EXISTS public.client_work_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Launched', 'Archived')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    plan_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    launch_snapshot JSONB,
    launched_at TIMESTAMPTZ,
    launched_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    launch_batch_id UUID,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT chk_plan_90_days CHECK (end_date = start_date + 89),
    CONSTRAINT chk_client_work_plans_name CHECK (length(trim(name)) > 0 AND length(name) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_client_work_plans_client_status
ON public.client_work_plans(client_id, status);

-- 3.2 Client Work Plan Normalized Weeks (13 Weeks)
CREATE TABLE IF NOT EXISTS public.client_work_plan_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_plan_id UUID NOT NULL REFERENCES public.client_work_plans(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 13),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_work_plan_week UNIQUE(work_plan_id, week_number)
);

-- 3.3 Client Work Plan Template Occurrences
CREATE TABLE IF NOT EXISTS public.client_work_plan_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_plan_id UUID NOT NULL REFERENCES public.client_work_plans(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 13),
    template_id UUID REFERENCES public.service_templates(id) ON DELETE SET NULL,
    template_version INTEGER NOT NULL DEFAULT 1,
    custom_label TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_work_plan_occurrences_lookup
ON public.client_work_plan_occurrences(work_plan_id, week_number);

-- ------------------------------------------------------------------------------
-- 4. DATABASE-BACKED LAUNCH IDEMPOTENCY REGISTRY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_launch_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    launch_type TEXT NOT NULL CHECK (launch_type IN ('service_template', 'work_plan')),
    source_template_id UUID REFERENCES public.service_templates(id) ON DELETE SET NULL,
    source_plan_id UUID REFERENCES public.client_work_plans(id) ON DELETE SET NULL,
    target_week INTEGER,
    task_count INTEGER NOT NULL CHECK (task_count >= 1 AND task_count <= 100),
    task_ids UUID[] NOT NULL DEFAULT '{}',
    payload_hash TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_launch_batch_client_request UNIQUE (client_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_task_launch_batches_client_req
ON public.task_launch_batches(client_id, request_id);

-- Add Foreign Key Constraints to companion columns
DO $$
BEGIN
    ALTER TABLE public.client_tasks DROP CONSTRAINT IF EXISTS fk_client_tasks_source_template;
    ALTER TABLE public.client_tasks ADD CONSTRAINT fk_client_tasks_source_template
        FOREIGN KEY (source_template_id) REFERENCES public.service_templates(id) ON DELETE SET NULL;

    ALTER TABLE public.client_tasks DROP CONSTRAINT IF EXISTS fk_client_tasks_plan_id;
    ALTER TABLE public.client_tasks ADD CONSTRAINT fk_client_tasks_plan_id
        FOREIGN KEY (plan_id) REFERENCES public.client_work_plans(id) ON DELETE SET NULL;

    ALTER TABLE public.client_tasks DROP CONSTRAINT IF EXISTS fk_client_tasks_launch_batch;
    ALTER TABLE public.client_tasks ADD CONSTRAINT fk_client_tasks_launch_batch
        FOREIGN KEY (launch_batch_id) REFERENCES public.task_launch_batches(id) ON DELETE SET NULL;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Foreign keys added or already existing.';
END $$;

-- ------------------------------------------------------------------------------
-- 5. REAL PHASE 3C IDEMPOTENT, NON-DESTRUCTIVE BACKFILL
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    tpl RECORD;
    dept_name TEXT;
    v_backfilled_count INTEGER := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_templates') THEN
        FOR tpl IN SELECT * FROM public.task_templates ORDER BY sort_order ASC, created_at ASC LOOP
            -- Non-destructive: Skip if this legacy template has already been backfilled
            IF NOT EXISTS (
                SELECT 1 FROM public.service_templates
                WHERE id = tpl.id OR legacy_task_template_id = tpl.id
            ) THEN
                -- Look up department name for service label
                SELECT name INTO dept_name FROM public.departments WHERE id = tpl.department_id;

                -- Insert into service_templates preserving UUID and legacy reference
                INSERT INTO public.service_templates (
                    id,
                    name,
                    service_label,
                    description,
                    status,
                    version,
                    sort_order,
                    legacy_task_template_id,
                    created_by,
                    updated_by,
                    archived_at,
                    archived_by,
                    archive_reason,
                    created_at,
                    updated_at
                ) VALUES (
                    tpl.id,
                    tpl.name,
                    COALESCE(dept_name, 'General Service'),
                    tpl.description,
                    tpl.status,
                    tpl.version,
                    tpl.sort_order,
                    tpl.id,
                    tpl.created_by,
                    tpl.updated_by,
                    tpl.archived_at,
                    tpl.archived_by,
                    tpl.archive_reason,
                    tpl.created_at,
                    tpl.updated_at
                );

                -- Insert primary child task definition
                INSERT INTO public.service_template_tasks (
                    template_id,
                    definition_id,
                    title,
                    description,
                    department_id,
                    priority,
                    approval_mode,
                    planned_offset_days,
                    duration_business_days,
                    display_order,
                    created_at,
                    updated_at
                ) VALUES (
                    tpl.id,
                    tpl.id,
                    tpl.default_task_title,
                    tpl.task_details,
                    tpl.department_id,
                    tpl.default_priority,
                    tpl.default_approval_mode,
                    0,
                    tpl.suggested_duration_days,
                    0,
                    tpl.created_at,
                    tpl.updated_at
                );

                -- Create version 1 snapshot
                INSERT INTO public.service_template_versions (
                    template_id,
                    version,
                    snapshot,
                    created_by,
                    created_at
                ) VALUES (
                    tpl.id,
                    tpl.version,
                    jsonb_build_object(
                        'id', tpl.id,
                        'name', tpl.name,
                        'service_label', COALESCE(dept_name, 'General Service'),
                        'version', tpl.version,
                        'tasks', jsonb_build_array(
                            jsonb_build_object(
                                'title', tpl.default_task_title,
                                'description', tpl.task_details,
                                'department_id', tpl.department_id,
                                'priority', tpl.default_priority,
                                'approval_mode', tpl.default_approval_mode,
                                'duration_business_days', tpl.suggested_duration_days,
                                'planned_offset_days', 0,
                                'display_order', 0
                            )
                        )
                    ),
                    tpl.created_by,
                    tpl.created_at
                );

                v_backfilled_count := v_backfilled_count + 1;
            END IF;
        END LOOP;

        RAISE NOTICE 'Phase 3C non-destructive backfill completed: % new templates migrated.', v_backfilled_count;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. AUTHORITATIVE SERVICE TEMPLATE MUTATION RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_manage_service_template(
    p_action TEXT,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_actor RECORD;
    v_template_id UUID;
    v_name TEXT;
    v_service_label TEXT;
    v_description TEXT;
    v_tasks JSONB;
    v_task_count INTEGER;
    v_expected_version INTEGER;
    v_current RECORD;
    v_next_version INTEGER;
    v_created_tpl RECORD;
    v_task_item JSONB;
    v_task_title TEXT;
    v_task_dept UUID;
    v_task_priority TEXT;
    v_task_approval TEXT;
    v_task_offset INTEGER;
    v_task_duration INTEGER;
    v_idx INTEGER;
    v_cloned RECORD;
BEGIN
    -- 1. Authentication & Active Profile Check
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Missing authenticated user context');
    END IF;

    SELECT * INTO v_actor
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_actor.id IS NULL OR v_actor.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Inactive or invalid caller profile');
    END IF;

    IF v_actor.role NOT IN ('owner', 'operational_manager') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Insufficient permissions to manage service templates');
    END IF;

    -- 2. Dispatch Action
    IF p_action = 'create' THEN
        v_name := trim(p_payload->>'name');
        IF v_name IS NULL OR length(v_name) = 0 OR length(v_name) > 200 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Template name is required and must be under 200 characters');
        END IF;

        v_service_label := trim(COALESCE(p_payload->>'service_label', p_payload->>'serviceLabel', 'General Service'));
        IF length(v_service_label) = 0 OR length(v_service_label) > 100 THEN
            v_service_label := 'General Service';
        END IF;

        v_description := trim(p_payload->>'description');
        v_tasks := p_payload->'tasks';

        IF v_tasks IS NULL OR jsonb_typeof(v_tasks) <> 'array' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Tasks array is required');
        END IF;

        v_task_count := jsonb_array_length(v_tasks);
        IF v_task_count < 1 OR v_task_count > 100 THEN
            RETURN jsonb_build_object('success', false, 'error', 'A Service Template must contain between 1 and 100 tasks');
        END IF;

        -- Validate all tasks before inserting
        FOR v_idx IN 0..(v_task_count - 1) LOOP
            v_task_item := v_tasks->v_idx;
            v_task_title := trim(v_task_item->>'title');
            IF v_task_title IS NULL OR length(v_task_title) = 0 THEN
                RETURN jsonb_build_object('success', false, 'error', 'Task #' || (v_idx + 1) || ' must have a non-empty title');
            END IF;

            v_task_dept := (COALESCE(v_task_item->>'department_id', v_task_item->>'departmentId'))::UUID;
            IF v_task_dept IS NULL OR NOT EXISTS (SELECT 1 FROM public.departments WHERE id = v_task_dept) THEN
                RETURN jsonb_build_object('success', false, 'error', 'Task "' || v_task_title || '" has an invalid department');
            END IF;
        END LOOP;

        -- Insert Master Template
        v_template_id := gen_random_uuid();
        INSERT INTO public.service_templates (
            id, name, service_label, description, status, version, sort_order,
            created_by, updated_by, created_at, updated_at
        ) VALUES (
            v_template_id, v_name, v_service_label, v_description, 'Active', 1, 0,
            v_caller_id, v_caller_id, timezone('utc'::text, now()), timezone('utc'::text, now())
        ) RETURNING * INTO v_created_tpl;

        -- Insert Child Tasks
        FOR v_idx IN 0..(v_task_count - 1) LOOP
            v_task_item := v_tasks->v_idx;
            v_task_title := trim(v_task_item->>'title');
            v_task_dept := (COALESCE(v_task_item->>'department_id', v_task_item->>'departmentId'))::UUID;
            v_task_priority := COALESCE(v_task_item->>'priority', 'Normal');
            IF v_task_priority NOT IN ('Low', 'Normal', 'High', 'Urgent') THEN
                v_task_priority := 'Normal';
            END IF;
            v_task_approval := COALESCE(COALESCE(v_task_item->>'approval_mode', v_task_item->>'approvalMode'), 'Internal Only');
            IF v_task_approval NOT IN ('Internal Only', 'Client Approval Required') THEN
                v_task_approval := 'Internal Only';
            END IF;
            v_task_offset := COALESCE((COALESCE(v_task_item->>'planned_offset_days', v_task_item->>'plannedOffsetDays'))::INTEGER, 0);
            v_task_duration := COALESCE((COALESCE(v_task_item->>'duration_business_days', v_task_item->>'durationBusinessDays'))::INTEGER, 1);

            INSERT INTO public.service_template_tasks (
                template_id, definition_id, title, description, department_id,
                priority, approval_mode, planned_offset_days, duration_business_days, display_order
            ) VALUES (
                v_template_id,
                COALESCE((COALESCE(v_task_item->>'definition_id', v_task_item->>'definitionId'))::UUID, gen_random_uuid()),
                v_task_title,
                v_task_item->>'description',
                v_task_dept,
                v_task_priority,
                v_task_approval,
                v_task_offset,
                v_task_duration,
                v_idx
            );
        END LOOP;

        -- Insert Version 1 Snapshot
        INSERT INTO public.service_template_versions (
            template_id, version, snapshot, created_by, created_at
        ) VALUES (
            v_template_id, 1,
            jsonb_build_object('id', v_template_id, 'name', v_name, 'service_label', v_service_label, 'tasks', v_tasks),
            v_caller_id, timezone('utc'::text, now())
        );

        RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_template_id, 'name', v_name, 'version', 1));

    ELSIF p_action = 'update' THEN
        v_template_id := (p_payload->>'id')::UUID;
        IF v_template_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Template ID is required for update');
        END IF;

        SELECT * INTO v_current
        FROM public.service_templates
        WHERE id = v_template_id
        FOR UPDATE;

        IF v_current.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Service template not found');
        END IF;

        IF v_current.status = 'Archived' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Cannot update an archived template. Please restore it first.');
        END IF;

        v_expected_version := (COALESCE(p_payload->>'expected_version', p_payload->>'expectedVersion'))::INTEGER;
        IF v_expected_version IS NOT NULL AND v_current.version != v_expected_version THEN
            RETURN jsonb_build_object('success', false, 'error', 'Conflict: Template was modified in another session. Please reload.');
        END IF;

        v_name := COALESCE(trim(p_payload->>'name'), v_current.name);
        v_service_label := COALESCE(trim(COALESCE(p_payload->>'service_label', p_payload->>'serviceLabel')), v_current.service_label);
        v_description := CASE WHEN p_payload ? 'description' THEN trim(p_payload->>'description') ELSE v_current.description END;
        v_next_version := v_current.version + 1;

        -- Update Master
        UPDATE public.service_templates
        SET name = v_name,
            service_label = v_service_label,
            description = v_description,
            version = v_next_version,
            updated_by = v_caller_id,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_template_id;

        -- Update Child Tasks if supplied
        v_tasks := p_payload->'tasks';
        IF v_tasks IS NOT NULL AND jsonb_typeof(v_tasks) = 'array' THEN
            v_task_count := jsonb_array_length(v_tasks);
            IF v_task_count < 1 OR v_task_count > 100 THEN
                RETURN jsonb_build_object('success', false, 'error', 'A Service Template must contain between 1 and 100 tasks');
            END IF;

            -- Validate before replacing
            FOR v_idx IN 0..(v_task_count - 1) LOOP
                v_task_item := v_tasks->v_idx;
                v_task_title := trim(v_task_item->>'title');
                IF v_task_title IS NULL OR length(v_task_title) = 0 THEN
                    RETURN jsonb_build_object('success', false, 'error', 'Task #' || (v_idx + 1) || ' must have a non-empty title');
                END IF;
                v_task_dept := (COALESCE(v_task_item->>'department_id', v_task_item->>'departmentId'))::UUID;
                IF v_task_dept IS NULL OR NOT EXISTS (SELECT 1 FROM public.departments WHERE id = v_task_dept) THEN
                    RETURN jsonb_build_object('success', false, 'error', 'Task "' || v_task_title || '" has an invalid department');
                END IF;
            END LOOP;

            -- Atomically replace tasks
            DELETE FROM public.service_template_tasks WHERE template_id = v_template_id;

            FOR v_idx IN 0..(v_task_count - 1) LOOP
                v_task_item := v_tasks->v_idx;
                v_task_title := trim(v_task_item->>'title');
                v_task_dept := (COALESCE(v_task_item->>'department_id', v_task_item->>'departmentId'))::UUID;
                v_task_priority := COALESCE(v_task_item->>'priority', 'Normal');
                IF v_task_priority NOT IN ('Low', 'Normal', 'High', 'Urgent') THEN v_task_priority := 'Normal'; END IF;
                v_task_approval := COALESCE(COALESCE(v_task_item->>'approval_mode', v_task_item->>'approvalMode'), 'Internal Only');
                IF v_task_approval NOT IN ('Internal Only', 'Client Approval Required') THEN v_task_approval := 'Internal Only'; END IF;
                v_task_offset := COALESCE((COALESCE(v_task_item->>'planned_offset_days', v_task_item->>'plannedOffsetDays'))::INTEGER, 0);
                v_task_duration := COALESCE((COALESCE(v_task_item->>'duration_business_days', v_task_item->>'durationBusinessDays'))::INTEGER, 1);

                INSERT INTO public.service_template_tasks (
                    template_id, definition_id, title, description, department_id,
                    priority, approval_mode, planned_offset_days, duration_business_days, display_order
                ) VALUES (
                    v_template_id,
                    COALESCE((COALESCE(v_task_item->>'definition_id', v_task_item->>'definitionId'))::UUID, gen_random_uuid()),
                    v_task_title,
                    v_task_item->>'description',
                    v_task_dept,
                    v_task_priority,
                    v_task_approval,
                    v_task_offset,
                    v_task_duration,
                    v_idx
                );
            END LOOP;

            -- Record Version Snapshot
            INSERT INTO public.service_template_versions (
                template_id, version, snapshot, created_by, created_at
            ) VALUES (
                v_template_id, v_next_version,
                jsonb_build_object('id', v_template_id, 'name', v_name, 'service_label', v_service_label, 'tasks', v_tasks),
                v_caller_id, timezone('utc'::text, now())
            );
        END IF;

        RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_template_id, 'name', v_name, 'version', v_next_version));

    ELSIF p_action = 'duplicate' THEN
        v_template_id := (p_payload->>'id')::UUID;
        IF v_template_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Template ID is required for duplicate');
        END IF;

        SELECT * INTO v_current FROM public.service_templates WHERE id = v_template_id;
        IF v_current.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Service template to duplicate not found');
        END IF;

        -- Insert Duplicate Master
        INSERT INTO public.service_templates (
            name, service_label, description, status, version, sort_order,
            created_by, updated_by, created_at, updated_at
        ) VALUES (
            'Copy of ' || v_current.name, v_current.service_label, v_current.description, 'Active', 1, v_current.sort_order,
            v_caller_id, v_caller_id, timezone('utc'::text, now()), timezone('utc'::text, now())
        ) RETURNING * INTO v_cloned;

        -- Clone Tasks
        INSERT INTO public.service_template_tasks (
            template_id, definition_id, title, description, department_id,
            priority, approval_mode, planned_offset_days, duration_business_days, display_order
        )
        SELECT
            v_cloned.id,
            gen_random_uuid(),
            title,
            description,
            department_id,
            priority,
            approval_mode,
            planned_offset_days,
            duration_business_days,
            display_order
        FROM public.service_template_tasks
        WHERE template_id = v_template_id
        ORDER BY display_order ASC;

        -- Version 1 Snapshot for clone
        INSERT INTO public.service_template_versions (
            template_id, version, snapshot, created_by, created_at
        ) VALUES (
            v_cloned.id, 1,
            jsonb_build_object('id', v_cloned.id, 'name', v_cloned.name, 'service_label', v_cloned.service_label),
            v_caller_id, timezone('utc'::text, now())
        );

        RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_cloned.id, 'name', v_cloned.name, 'version', 1));

    ELSIF p_action = 'archive' THEN
        v_template_id := (p_payload->>'id')::UUID;
        IF v_template_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Template ID is required for archive');
        END IF;

        UPDATE public.service_templates
        SET status = 'Archived',
            archived_at = timezone('utc'::text, now()),
            archived_by = v_caller_id,
            archive_reason = COALESCE(trim(p_payload->>'reason'), 'Archived by staff'),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_template_id;

        RETURN jsonb_build_object('success', true);

    ELSIF p_action = 'restore' THEN
        v_template_id := (p_payload->>'id')::UUID;
        IF v_template_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Template ID is required for restore');
        END IF;

        UPDATE public.service_templates
        SET status = 'Active',
            archived_at = NULL,
            archived_by = NULL,
            archive_reason = NULL,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_template_id;

        RETURN jsonb_build_object('success', true);

    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Unknown action: ' || p_action);
    END IF;
END;
$$;

ALTER FUNCTION public.fn_manage_service_template(TEXT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_manage_service_template(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_manage_service_template(TEXT, JSONB) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. AUTHORITATIVE WORK PLAN DRAFT MANAGEMENT RPCs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_save_draft_work_plan(
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_actor RECORD;
    v_plan_id UUID;
    v_client_id UUID;
    v_client RECORD;
    v_name TEXT;
    v_start_date DATE;
    v_end_date DATE;
    v_weeks JSONB;
    v_week_count INTEGER;
    v_expected_rev INTEGER;
    v_current RECORD;
    v_next_rev INTEGER;
    v_saved_plan RECORD;
    v_w_idx INTEGER;
    v_week_item JSONB;
    v_w_num INTEGER;
    v_w_start DATE;
    v_w_end DATE;
    v_week_id UUID;
    v_occurrences JSONB;
    v_occ_idx INTEGER;
    v_occ_item JSONB;
BEGIN
    -- 1. Authentication & Active Profile Check
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Missing authenticated user context');
    END IF;

    SELECT * INTO v_actor FROM public.profiles WHERE id = v_caller_id;
    IF v_actor.id IS NULL OR v_actor.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Inactive or invalid caller profile');
    END IF;

    IF v_actor.role NOT IN ('owner', 'operational_manager') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Team Members and Clients cannot save work plans');
    END IF;

    -- 2. Validate Client Scope (created_by removed)
    v_client_id := (COALESCE(p_payload->>'clientId', p_payload->>'client_id'))::UUID;
    IF v_client_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Client ID is required');
    END IF;

    SELECT * INTO v_client FROM public.clients WHERE id = v_client_id;
    IF v_client.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target client does not exist');
    END IF;

    IF v_client.status = 'Archived' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot create or modify work plans for an archived client');
    END IF;

    IF v_actor.role = 'operational_manager' THEN
        IF NOT (
            v_client.operational_manager_id = v_caller_id
            OR EXISTS (
                SELECT 1 FROM public.client_team_access cta
                WHERE cta.client_id = v_client_id AND cta.profile_id = v_caller_id
            )
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Operational Manager does not have access to this client workspace');
        END IF;
    END IF;

    -- 3. Validate Plan Name & 90-Calendar-Day Boundaries
    v_name := trim(p_payload->>'name');
    IF v_name IS NULL OR length(v_name) = 0 OR length(v_name) > 200 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Work plan name is required and must be under 200 characters');
    END IF;

    v_start_date := (COALESCE(p_payload->>'startDate', p_payload->>'start_date'))::DATE;
    IF v_start_date IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Plan start date is required');
    END IF;

    v_end_date := v_start_date + 89; -- Exact 90 calendar days inclusive
    v_weeks := p_payload->'weeks';
    v_plan_id := (p_payload->>'id')::UUID;

    -- 4. Create or Update Draft Plan
    IF v_plan_id IS NULL THEN
        -- Insert new Draft Plan
        INSERT INTO public.client_work_plans (
            client_id, name, status, start_date, end_date, revision, plan_data,
            created_by, updated_by, created_at, updated_at
        ) VALUES (
            v_client_id, v_name, 'Draft', v_start_date, v_end_date, 1, jsonb_build_object('weeks', v_weeks),
            v_caller_id, v_caller_id, timezone('utc'::text, now()), timezone('utc'::text, now())
        ) RETURNING * INTO v_saved_plan;
        v_plan_id := v_saved_plan.id;
    ELSE
        -- Update existing Draft Plan
        SELECT * INTO v_current
        FROM public.client_work_plans
        WHERE id = v_plan_id
        FOR UPDATE;

        IF v_current.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Work plan not found');
        END IF;

        IF v_current.client_id != v_client_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Conflict: Work Plan does not belong to the target client');
        END IF;

        IF v_current.status != 'Draft' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Cannot modify a plan that is already launched or archived. Status: ' || v_current.status);
        END IF;

        v_expected_rev := (COALESCE(p_payload->>'expectedRevision', p_payload->>'expected_revision'))::INTEGER;
        IF v_expected_rev IS NOT NULL AND v_current.revision != v_expected_rev THEN
            RETURN jsonb_build_object('success', false, 'error', 'Conflict: Work plan was modified in another session. Please reload.');
        END IF;

        v_next_rev := v_current.revision + 1;

        UPDATE public.client_work_plans
        SET name = v_name,
            start_date = v_start_date,
            end_date = v_end_date,
            revision = v_next_rev,
            plan_data = jsonb_build_object('weeks', v_weeks),
            updated_by = v_caller_id,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_plan_id
        RETURNING * INTO v_saved_plan;
    END IF;

    -- 5. Atomically Populate Normalized Weeks and Occurrences
    DELETE FROM public.client_work_plan_weeks WHERE work_plan_id = v_plan_id;

    IF v_weeks IS NOT NULL AND jsonb_typeof(v_weeks) = 'array' THEN
        v_week_count := jsonb_array_length(v_weeks);
        FOR v_w_idx IN 0..(v_week_count - 1) LOOP
            v_week_item := v_weeks->v_w_idx;
            v_w_num := COALESCE((COALESCE(v_week_item->>'weekNumber', v_week_item->>'week_number'))::INTEGER, v_w_idx + 1);
            v_w_start := (COALESCE(v_week_item->>'startDate', v_week_item->>'start_date'))::DATE;
            v_w_end := (COALESCE(v_week_item->>'endDate', v_week_item->>'end_date'))::DATE;

            IF v_w_start IS NOT NULL AND v_w_end IS NOT NULL THEN
                INSERT INTO public.client_work_plan_weeks (
                    work_plan_id, week_number, start_date, end_date
                ) VALUES (
                    v_plan_id, v_w_num, v_w_start, v_w_end
                ) RETURNING id INTO v_week_id;

                -- Insert Occurrences
                v_occurrences := v_week_item->'occurrences';
                IF v_occurrences IS NOT NULL AND jsonb_typeof(v_occurrences) = 'array' THEN
                    FOR v_occ_idx IN 0..(jsonb_array_length(v_occurrences) - 1) LOOP
                        v_occ_item := v_occurrences->v_occ_idx;
                        INSERT INTO public.client_work_plan_occurrences (
                            work_plan_id, week_number, template_id, template_version, custom_label, sort_order, snapshot
                        ) VALUES (
                            v_plan_id,
                            v_w_num,
                            (COALESCE(v_occ_item->>'templateId', v_occ_item->>'template_id'))::UUID,
                            COALESCE((COALESCE(v_occ_item->>'templateVersion', v_occ_item->>'template_version'))::INTEGER, 1),
                            COALESCE(v_occ_item->>'templateName', v_occ_item->>'custom_label'),
                            v_occ_idx,
                            v_occ_item
                        );
                    END LOOP;
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'id', v_saved_plan.id,
            'clientId', v_saved_plan.client_id,
            'name', v_saved_plan.name,
            'status', v_saved_plan.status,
            'startDate', v_saved_plan.start_date,
            'endDate', v_saved_plan.end_date,
            'revision', v_saved_plan.revision,
            'weeks', v_weeks
        )
    );
END;
$$;

ALTER FUNCTION public.fn_save_draft_work_plan(JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_save_draft_work_plan(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_save_draft_work_plan(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_delete_draft_work_plan(
    p_plan_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_actor RECORD;
    v_plan RECORD;
    v_client RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Missing authenticated user context');
    END IF;

    SELECT * INTO v_actor FROM public.profiles WHERE id = v_caller_id;
    IF v_actor.id IS NULL OR v_actor.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Inactive or invalid caller profile');
    END IF;

    SELECT * INTO v_plan FROM public.client_work_plans WHERE id = p_plan_id;
    IF v_plan.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Work plan not found');
    END IF;

    IF v_plan.status != 'Draft' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot delete a plan that is already launched or archived');
    END IF;

    SELECT * INTO v_client FROM public.clients WHERE id = v_plan.client_id;
    IF v_actor.role = 'operational_manager' THEN
        IF NOT (
            v_client.operational_manager_id = v_caller_id
            OR EXISTS (
                SELECT 1 FROM public.client_team_access cta
                WHERE cta.client_id = v_plan.client_id AND cta.profile_id = v_caller_id
            )
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Insufficient permissions for this client workspace');
        END IF;
    END IF;

    DELETE FROM public.client_work_plans WHERE id = p_plan_id;
    RETURN jsonb_build_object('success', true);
END;
$$;

ALTER FUNCTION public.fn_delete_draft_work_plan(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_delete_draft_work_plan(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_delete_draft_work_plan(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. AUTHORIZED, CONCURRENCY-SAFE TRANSACTIONAL LAUNCH RPC FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_launch_task_batch(
    p_request_id TEXT,
    p_client_id UUID,
    p_launch_type TEXT,
    p_source_id UUID,
    p_target_week INTEGER,
    p_tasks JSONB,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_actor RECORD;
    v_client RECORD;
    v_tpl RECORD;
    v_plan RECORD;
    v_existing_batch RECORD;
    v_task_item JSONB;
    v_new_task_id UUID;
    v_created_task_ids UUID[] := '{}';
    v_task_count INTEGER := 0;
    v_batch_id UUID;
    v_payload_hash TEXT;
    v_expected_revision INTEGER;
    v_task_title TEXT;
    v_task_dept UUID;
    v_task_priority TEXT;
    v_task_approval TEXT;
    v_task_planned TIMESTAMPTZ;
    v_task_due TIMESTAMPTZ;
    v_task_week INTEGER;
    v_plan_week INTEGER;
    v_clean_req_id TEXT;
    v_dow_planned INTEGER;
    v_dow_due INTEGER;
    v_rows_updated INTEGER;
BEGIN
    -- 1. Verify Caller Authentication & Identity (Authoritative auth.uid())
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Missing authenticated user context');
    END IF;

    -- 2. Validate Request ID Format & Length (Bounded, Non-Empty)
    v_clean_req_id := trim(COALESCE(p_request_id, ''));
    IF length(v_clean_req_id) = 0 OR length(v_clean_req_id) > 128 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid request_id: Must be a non-empty string up to 128 characters');
    END IF;

    -- 3. Verify Active Profile & Role Permissions
    SELECT * INTO v_actor
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_actor.id IS NULL OR v_actor.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Inactive or invalid caller profile');
    END IF;

    IF v_actor.role NOT IN ('owner', 'operational_manager') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Team Members and Clients cannot launch templates or work plans');
    END IF;

    -- 4. Verify Target Client Exists, Access Scope & Active Status (created_by removed)
    SELECT * INTO v_client
    FROM public.clients
    WHERE id = p_client_id;

    IF v_client.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not Found: Target client does not exist');
    END IF;

    IF v_client.status = 'Archived' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Cannot launch tasks for an archived client');
    END IF;

    IF v_client.status = 'Paused' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Cannot launch tasks for a paused client');
    END IF;

    -- Scope check for Operational Manager
    IF v_actor.role = 'operational_manager' THEN
        IF NOT (
            v_client.operational_manager_id = v_caller_id
            OR EXISTS (
                SELECT 1 FROM public.client_team_access cta
                WHERE cta.client_id = p_client_id AND cta.profile_id = v_caller_id
            )
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Operational Manager does not have access to this client workspace');
        END IF;
    END IF;

    -- 5. Validate Task Payload Count & JSON Structure
    IF p_tasks IS NULL OR jsonb_typeof(p_tasks) <> 'array' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid task batch: Expected a JSON array of tasks');
    END IF;

    v_task_count := jsonb_array_length(p_tasks);
    IF v_task_count < 1 OR v_task_count > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid task batch: Must contain between 1 and 100 tasks');
    END IF;

    -- 6. Launch-Type Guardrails (Service Template vs Work Plan)
    IF p_launch_type = 'service_template' THEN
        SELECT * INTO v_tpl
        FROM public.service_templates
        WHERE id = p_source_id;

        IF v_tpl.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Not Found: Service Template does not exist');
        END IF;

        IF v_tpl.status = 'Archived' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Cannot launch an archived Service Template');
        END IF;

    ELSIF p_launch_type = 'work_plan' THEN
        -- Atomic Row Lock on Work Plan
        SELECT * INTO v_plan
        FROM public.client_work_plans
        WHERE id = p_source_id
        FOR UPDATE;

        IF v_plan.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Not Found: Work Plan does not exist');
        END IF;

        IF v_plan.client_id != p_client_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Conflict: Work Plan does not belong to the target client');
        END IF;

        IF v_plan.status != 'Draft' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Conflict: Only Draft Work Plans can be launched. Current status: ' || v_plan.status);
        END IF;

        v_expected_revision := (COALESCE(p_metadata->>'expected_revision', p_metadata->>'expectedRevision'))::INTEGER;
        IF v_expected_revision IS NOT NULL AND v_plan.revision != v_expected_revision THEN
            RETURN jsonb_build_object('success', false, 'error', 'Conflict: Work Plan revision has changed. Please refresh and review.');
        END IF;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid launch_type: Expected "service_template" or "work_plan"');
    END IF;

    -- 7. Compute Complete Canonical Request Hash
    v_payload_hash := md5(
        p_client_id::text || '|' ||
        p_launch_type || '|' ||
        COALESCE(p_source_id::text, '') || '|' ||
        COALESCE(p_target_week::text, '') || '|' ||
        COALESCE((p_metadata->>'expected_revision'), '') || '|' ||
        COALESCE((p_metadata->>'expectedRevision'), '') || '|' ||
        COALESCE((p_metadata->>'source_version'), '') || '|' ||
        p_tasks::text
    );

    -- 8. Concurrency-Safe Idempotency Check & Atomic Reservation
    v_batch_id := gen_random_uuid();
    INSERT INTO public.task_launch_batches (
        id,
        request_id,
        actor_id,
        client_id,
        launch_type,
        source_template_id,
        source_plan_id,
        target_week,
        task_count,
        task_ids,
        payload_hash,
        metadata
    ) VALUES (
        v_batch_id,
        v_clean_req_id,
        v_caller_id,
        p_client_id,
        p_launch_type,
        CASE WHEN p_launch_type = 'service_template' THEN p_source_id ELSE NULL END,
        CASE WHEN p_launch_type = 'work_plan' THEN p_source_id ELSE NULL END,
        p_target_week,
        v_task_count,
        '{}',
        v_payload_hash,
        p_metadata
    )
    ON CONFLICT (client_id, request_id) DO NOTHING;

    -- Check if another request reserved or completed this batch
    IF NOT FOUND THEN
        SELECT * INTO v_existing_batch
        FROM public.task_launch_batches
        WHERE client_id = p_client_id AND request_id = v_clean_req_id;

        IF v_existing_batch.payload_hash = v_payload_hash THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent_replay', true,
                'batch_id', v_existing_batch.id,
                'task_ids', v_existing_batch.task_ids,
                'task_count', v_existing_batch.task_count
            );
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'Conflict: Request ID already used with a different task payload');
        END IF;
    END IF;

    -- 9. Validate & Insert All Child Tasks (Monday-Friday Enforced & Strictly Draft/Unassigned)
    FOR v_task_item IN SELECT * FROM jsonb_array_elements(p_tasks) LOOP
        v_task_title := trim(v_task_item->>'title');
        IF length(v_task_title) = 0 THEN
            RAISE EXCEPTION 'Task title cannot be empty';
        END IF;

        v_task_dept := (COALESCE(v_task_item->>'department_id', v_task_item->>'departmentId'))::UUID;
        IF v_task_dept IS NULL OR NOT EXISTS (SELECT 1 FROM public.departments WHERE id = v_task_dept) THEN
            RAISE EXCEPTION 'Invalid department specified for task "%"', v_task_title;
        END IF;

        v_task_priority := COALESCE(v_task_item->>'priority', 'Normal');
        IF v_task_priority NOT IN ('Low', 'Normal', 'High', 'Urgent') THEN
            RAISE EXCEPTION 'Invalid priority "%" for task "%"', v_task_priority, v_task_title;
        END IF;

        v_task_approval := COALESCE(COALESCE(v_task_item->>'approval_mode', v_task_item->>'approvalMode'), 'Internal Only');
        IF v_task_approval NOT IN ('Internal Only', 'Client Approval Required') THEN
            RAISE EXCEPTION 'Invalid approval mode "%" for task "%"', v_task_approval, v_task_title;
        END IF;

        v_task_planned := (COALESCE(v_task_item->>'planned_date', v_task_item->>'plannedDate'))::TIMESTAMPTZ;
        v_task_due := (COALESCE(v_task_item->>'due_date', v_task_item->>'dueDate'))::TIMESTAMPTZ;

        -- Monday-Friday Date Normalization:
        -- Roll Saturday (6) forward 2 days to Monday; Roll Sunday (0) forward 1 day to Monday
        IF v_task_planned IS NOT NULL THEN
            v_dow_planned := EXTRACT(DOW FROM v_task_planned AT TIME ZONE 'Asia/Karachi');
            IF v_dow_planned = 0 THEN
                v_task_planned := v_task_planned + INTERVAL '1 day';
            ELSIF v_dow_planned = 6 THEN
                v_task_planned := v_task_planned + INTERVAL '2 days';
            END IF;
        END IF;

        IF v_task_due IS NOT NULL THEN
            v_dow_due := EXTRACT(DOW FROM v_task_due AT TIME ZONE 'Asia/Karachi');
            IF v_dow_due = 0 THEN
                v_task_due := v_task_due + INTERVAL '1 day';
            ELSIF v_dow_due = 6 THEN
                v_task_due := v_task_due + INTERVAL '2 days';
            END IF;
        END IF;

        -- Ensure due_date >= planned_start
        IF v_task_planned IS NOT NULL AND v_task_due IS NOT NULL AND v_task_due < v_task_planned THEN
            v_task_due := v_task_planned;
        END IF;

        -- Week Number Assignment:
        -- Legacy week_number is constrained to 1..4. Plan week is 1..13.
        v_plan_week := (COALESCE(v_task_item->>'plan_week', v_task_item->>'planWeek'))::INTEGER;
        v_task_week := CASE
            WHEN p_target_week IS NOT NULL AND p_target_week BETWEEN 1 AND 4 THEN p_target_week
            WHEN v_plan_week IS NOT NULL AND v_plan_week BETWEEN 1 AND 4 THEN v_plan_week
            ELSE 1
        END;

        v_new_task_id := gen_random_uuid();

        INSERT INTO public.client_tasks (
            id,
            client_id,
            title,
            details,
            department_id,
            status,
            priority,
            approval_mode,
            assignee_id,
            week_number,
            planned_start,
            due_date,
            source_template_id,
            source_template_version,
            plan_id,
            plan_week,
            occurrence_id,
            launch_batch_id,
            created_by
        ) VALUES (
            v_new_task_id,
            p_client_id,
            v_task_title,
            v_task_item->>'description',
            v_task_dept,
            'Draft', -- Strictly Draft
            v_task_priority,
            v_task_approval,
            NULL, -- Strictly Unassigned
            v_task_week,
            COALESCE(v_task_planned, timezone('utc'::text, now())),
            COALESCE(v_task_due, timezone('utc'::text, now()) + INTERVAL '1 day'),
            CASE WHEN p_launch_type = 'service_template' THEN p_source_id ELSE (COALESCE(v_task_item->>'source_template_id', v_task_item->>'sourceTemplateId'))::UUID END,
            COALESCE((COALESCE(v_task_item->>'source_template_version', v_task_item->>'sourceTemplateVersion'))::INTEGER, 1),
            CASE WHEN p_launch_type = 'work_plan' THEN p_source_id ELSE NULL END,
            v_plan_week,
            (COALESCE(v_task_item->>'occurrence_id', v_task_item->>'occurrenceId'))::UUID,
            v_batch_id,
            v_caller_id
        );

        -- Audit Task Creation Event
        INSERT INTO public.client_task_events (
            task_id,
            client_id,
            actor_id,
            event_type,
            new_state,
            notes
        ) VALUES (
            v_new_task_id,
            p_client_id,
            v_caller_id,
            'created',
            jsonb_build_object(
                'status', 'Draft',
                'title', v_task_title,
                'launch_type', p_launch_type,
                'batch_id', v_batch_id
            ),
            'Task created via ' || p_launch_type || ' launch batch.'
        );

        v_created_task_ids := array_append(v_created_task_ids, v_new_task_id);
    END LOOP;

    -- 10. Update Launch Batch with Generated Task IDs
    UPDATE public.task_launch_batches
    SET task_ids = v_created_task_ids, task_count = array_length(v_created_task_ids, 1)
    WHERE id = v_batch_id;

    -- 11. Atomic State Transition for Work Plan
    IF p_launch_type = 'work_plan' THEN
        UPDATE public.client_work_plans
        SET status = 'Launched',
            launched_at = timezone('utc'::text, now()),
            launched_by = v_caller_id,
            launch_batch_id = v_batch_id,
            launch_snapshot = jsonb_build_object(
                'launched_tasks_count', array_length(v_created_task_ids, 1),
                'tasks', p_tasks,
                'metadata', p_metadata
            ),
            revision = revision + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_source_id AND status = 'Draft' AND revision = v_plan.revision;

        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN
            RAISE EXCEPTION 'Conflict: Work Plan could not be transitioned to Launched due to concurrent revision modification.';
        END IF;
    END IF;

    -- Return Result
    RETURN jsonb_build_object(
        'success', true,
        'batch_id', v_batch_id,
        'task_count', array_length(v_created_task_ids, 1),
        'task_ids', v_created_task_ids
    );
END;
$$;

-- Function Execution Permissions
ALTER FUNCTION public.fn_launch_task_batch(TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_launch_task_batch(TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_launch_task_batch(TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY POLICIES MATRIX
-- ------------------------------------------------------------------------------
ALTER TABLE public.service_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_work_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_work_plan_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_work_plan_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_launch_batches ENABLE ROW LEVEL SECURITY;

-- 9.1 Service Templates Policies
DROP POLICY IF EXISTS service_templates_insert_deny ON public.service_templates;
CREATE POLICY service_templates_insert_deny ON public.service_templates FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS service_templates_update_deny ON public.service_templates;
CREATE POLICY service_templates_update_deny ON public.service_templates FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS service_templates_delete_deny ON public.service_templates;
CREATE POLICY service_templates_delete_deny ON public.service_templates FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS service_templates_select ON public.service_templates;
CREATE POLICY service_templates_select ON public.service_templates FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.status = 'active'
          AND (
              p.role = 'owner'
              OR (p.role = 'operational_manager' AND service_templates.status = 'Active')
              OR (p.role = 'team_member' AND service_templates.status = 'Active')
          )
    )
);

-- 9.2 Service Template Tasks Policies
DROP POLICY IF EXISTS service_template_tasks_insert_deny ON public.service_template_tasks;
CREATE POLICY service_template_tasks_insert_deny ON public.service_template_tasks FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS service_template_tasks_update_deny ON public.service_template_tasks;
CREATE POLICY service_template_tasks_update_deny ON public.service_template_tasks FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS service_template_tasks_delete_deny ON public.service_template_tasks;
CREATE POLICY service_template_tasks_delete_deny ON public.service_template_tasks FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS service_template_tasks_select ON public.service_template_tasks;
CREATE POLICY service_template_tasks_select ON public.service_template_tasks FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.service_templates st
        JOIN public.profiles p ON p.id = (SELECT auth.uid())
        WHERE st.id = service_template_tasks.template_id
          AND p.status = 'active'
          AND (
              p.role = 'owner'
              OR (p.role IN ('operational_manager', 'team_member') AND st.status = 'Active')
          )
    )
);

-- 9.3 Service Template Versions Policies (Immutable Snapshots)
DROP POLICY IF EXISTS service_template_versions_insert_deny ON public.service_template_versions;
CREATE POLICY service_template_versions_insert_deny ON public.service_template_versions FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS service_template_versions_update_deny ON public.service_template_versions;
CREATE POLICY service_template_versions_update_deny ON public.service_template_versions FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS service_template_versions_delete_deny ON public.service_template_versions;
CREATE POLICY service_template_versions_delete_deny ON public.service_template_versions FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS service_template_versions_select ON public.service_template_versions;
CREATE POLICY service_template_versions_select ON public.service_template_versions FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.status = 'active'
          AND p.role IN ('owner', 'operational_manager')
    )
);

-- 9.4 Client Work Plans Policies (Strict Draft/Owner/Manager Scoped)
DROP POLICY IF EXISTS client_work_plans_insert_deny ON public.client_work_plans;
CREATE POLICY client_work_plans_insert_deny ON public.client_work_plans FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS client_work_plans_update_deny ON public.client_work_plans;
CREATE POLICY client_work_plans_update_deny ON public.client_work_plans FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS client_work_plans_delete_deny ON public.client_work_plans;
CREATE POLICY client_work_plans_delete_deny ON public.client_work_plans FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS client_work_plans_select ON public.client_work_plans;
CREATE POLICY client_work_plans_select ON public.client_work_plans FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.status = 'active'
          AND (
              p.role = 'owner'
              OR (
                  p.role = 'operational_manager'
                  AND EXISTS (
                      SELECT 1 FROM public.clients c
                      WHERE c.id = client_work_plans.client_id
                        AND (c.operational_manager_id = p.id OR EXISTS (
                            SELECT 1 FROM public.client_team_access cta WHERE cta.client_id = c.id AND cta.profile_id = p.id
                        ))
                  )
              )
              OR (
                  p.role = 'team_member'
                  AND EXISTS (
                      SELECT 1 FROM public.client_team_access cta
                      WHERE cta.client_id = client_work_plans.client_id
                        AND cta.profile_id = p.id
                  )
              )
          )
    )
);

-- 9.5 Client Work Plan Weeks & Occurrences Derived Policies
DROP POLICY IF EXISTS client_work_plan_weeks_insert_deny ON public.client_work_plan_weeks;
CREATE POLICY client_work_plan_weeks_insert_deny ON public.client_work_plan_weeks FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS client_work_plan_weeks_update_deny ON public.client_work_plan_weeks;
CREATE POLICY client_work_plan_weeks_update_deny ON public.client_work_plan_weeks FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS client_work_plan_weeks_delete_deny ON public.client_work_plan_weeks;
CREATE POLICY client_work_plan_weeks_delete_deny ON public.client_work_plan_weeks FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS client_work_plan_weeks_select ON public.client_work_plan_weeks;
CREATE POLICY client_work_plan_weeks_select ON public.client_work_plan_weeks FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.client_work_plans wp
        WHERE wp.id = client_work_plan_weeks.work_plan_id
          AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = (SELECT auth.uid()) AND p.status = 'active' AND (
                  p.role = 'owner'
                  OR (p.role IN ('operational_manager', 'team_member') AND EXISTS (
                      SELECT 1 FROM public.clients c WHERE c.id = wp.client_id AND (
                          c.operational_manager_id = p.id OR EXISTS (
                              SELECT 1 FROM public.client_team_access cta WHERE cta.client_id = c.id AND cta.profile_id = p.id
                          )
                      )
                  ))
              )
          )
    )
);

DROP POLICY IF EXISTS client_work_plan_occurrences_insert_deny ON public.client_work_plan_occurrences;
CREATE POLICY client_work_plan_occurrences_insert_deny ON public.client_work_plan_occurrences FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS client_work_plan_occurrences_update_deny ON public.client_work_plan_occurrences;
CREATE POLICY client_work_plan_occurrences_update_deny ON public.client_work_plan_occurrences FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS client_work_plan_occurrences_delete_deny ON public.client_work_plan_occurrences;
CREATE POLICY client_work_plan_occurrences_delete_deny ON public.client_work_plan_occurrences FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS client_work_plan_occurrences_select ON public.client_work_plan_occurrences;
CREATE POLICY client_work_plan_occurrences_select ON public.client_work_plan_occurrences FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.client_work_plans wp
        WHERE wp.id = client_work_plan_occurrences.work_plan_id
          AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = (SELECT auth.uid()) AND p.status = 'active' AND (
                  p.role = 'owner'
                  OR (p.role IN ('operational_manager', 'team_member') AND EXISTS (
                      SELECT 1 FROM public.clients c WHERE c.id = wp.client_id AND (
                          c.operational_manager_id = p.id OR EXISTS (
                              SELECT 1 FROM public.client_team_access cta WHERE cta.client_id = c.id AND cta.profile_id = p.id
                          )
                      )
                  ))
              )
          )
    )
);

-- 9.6 Task Launch Batches Policies
DROP POLICY IF EXISTS task_launch_batches_insert_deny ON public.task_launch_batches;
CREATE POLICY task_launch_batches_insert_deny ON public.task_launch_batches FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS task_launch_batches_update_deny ON public.task_launch_batches;
CREATE POLICY task_launch_batches_update_deny ON public.task_launch_batches FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS task_launch_batches_delete_deny ON public.task_launch_batches;
CREATE POLICY task_launch_batches_delete_deny ON public.task_launch_batches FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS task_launch_batches_select ON public.task_launch_batches;
CREATE POLICY task_launch_batches_select ON public.task_launch_batches FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.status = 'active'
          AND (
              p.role = 'owner'
              OR (
                  p.role = 'operational_manager'
                  AND EXISTS (
                      SELECT 1 FROM public.clients c
                      WHERE c.id = task_launch_batches.client_id
                        AND (c.operational_manager_id = p.id OR EXISTS (
                            SELECT 1 FROM public.client_team_access cta WHERE cta.client_id = c.id AND cta.profile_id = p.id
                        ))
                  )
              )
          )
    )
);
