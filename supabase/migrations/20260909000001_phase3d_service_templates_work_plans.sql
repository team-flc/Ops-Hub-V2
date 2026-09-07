-- ==============================================================================
-- MIGRATION: 20260909000001_phase3d_service_templates_work_plans.sql
-- Description: Phase 3D Multi-Task Service Templates, 90-Day Work Plans,
--              Database-Backed Launch Idempotency Registry, Authoritative
--              Mutation RPCs, Strict RLS Security Matrix, and Idempotent
--              Non-Destructive Phase 3C Backfill.
-- Schema Authority: PostgreSQL 15+ / Supabase Auth
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND EXISTING TABLES WITH COMPANION COLUMNS
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'source_template_id'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN source_template_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'source_template_version'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN source_template_version INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'plan_id'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN plan_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'plan_week'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN plan_week INTEGER CHECK (plan_week IS NULL OR (plan_week >= 1 AND plan_week <= 13));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'occurrence_id'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN occurrence_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'launch_batch_id'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN launch_batch_id UUID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_tasks_plan_id ON public.client_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_client_tasks_plan_week ON public.client_tasks(plan_week);
CREATE INDEX IF NOT EXISTS idx_client_tasks_source_template_id ON public.client_tasks(source_template_id);
CREATE INDEX IF NOT EXISTS idx_client_tasks_launch_batch_id ON public.client_tasks(launch_batch_id);

-- ------------------------------------------------------------------------------
-- 2. MULTI-TASK SERVICE TEMPLATES ENTITY SUITE
-- ------------------------------------------------------------------------------

-- 2.1 Service Templates Master Table
CREATE TABLE IF NOT EXISTS public.service_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_task_template_id UUID,
    name TEXT NOT NULL,
    service_label TEXT NOT NULL DEFAULT 'General Service',
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    archive_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT chk_service_templates_name CHECK (length(trim(name)) > 0 AND length(name) <= 150),
    CONSTRAINT chk_service_templates_label CHECK (length(trim(service_label)) > 0 AND length(service_label) <= 100),
    CONSTRAINT uq_service_templates_legacy_id UNIQUE (legacy_task_template_id)
);

CREATE INDEX IF NOT EXISTS idx_service_templates_status_sort
ON public.service_templates(status, sort_order);

-- 2.2 Service Template Tasks (Ordered Child Tasks 1..100)
CREATE TABLE IF NOT EXISTS public.service_template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.service_templates(id) ON DELETE CASCADE,
    definition_id UUID NOT NULL DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    approval_mode TEXT NOT NULL DEFAULT 'Internal Only' CHECK (approval_mode IN ('Internal Only', 'Client Approval Required')),
    planned_offset_days INTEGER NOT NULL DEFAULT 0 CHECK (planned_offset_days >= 0 AND planned_offset_days <= 90),
    duration_business_days INTEGER NOT NULL DEFAULT 1 CHECK (duration_business_days >= 1 AND duration_business_days <= 90),
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0 AND display_order < 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT chk_service_template_tasks_title CHECK (length(trim(title)) > 0 AND length(title) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_service_template_tasks_tpl_order
ON public.service_template_tasks(template_id, display_order);

-- 2.3 Service Template Version History (Audit Snapshots)
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
-- 3. 90-DAY CLIENT WORK PLANS ENTITY SUITE
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

    CONSTRAINT chk_launch_batch_req_id CHECK (length(trim(request_id)) > 0 AND length(request_id) <= 128),
    CONSTRAINT uq_launch_batch_client_request UNIQUE (client_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_task_launch_batches_client_req
ON public.task_launch_batches(client_id, request_id);

-- Add Foreign Key Constraints to companion columns independently
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_client_tasks_source_template' AND table_name = 'client_tasks'
    ) THEN
        ALTER TABLE public.client_tasks ADD CONSTRAINT fk_client_tasks_source_template
            FOREIGN KEY (source_template_id) REFERENCES public.service_templates(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_client_tasks_plan_id' AND table_name = 'client_tasks'
    ) THEN
        ALTER TABLE public.client_tasks ADD CONSTRAINT fk_client_tasks_plan_id
            FOREIGN KEY (plan_id) REFERENCES public.client_work_plans(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_client_tasks_launch_batch' AND table_name = 'client_tasks'
    ) THEN
        ALTER TABLE public.client_tasks ADD CONSTRAINT fk_client_tasks_launch_batch
            FOREIGN KEY (launch_batch_id) REFERENCES public.task_launch_batches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. REAL PHASE 3C IDEMPOTENT, NON-DESTRUCTIVE BACKFILL
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    tpl RECORD;
    dept_name TEXT;
    new_template_id UUID;
    v_order INTEGER := 0;
    v_dur INTEGER;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'task_templates'
    ) THEN
        FOR tpl IN
            SELECT tt.*, d.name AS dept_name
            FROM public.task_templates tt
            LEFT JOIN public.departments d ON d.id = tt.department_id
            ORDER BY tt.created_at ASC
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.service_templates
                WHERE legacy_task_template_id = tpl.id
            ) THEN
                v_order := v_order + 1;
                new_template_id := gen_random_uuid();
                v_dur := COALESCE(tpl.suggested_duration_days, 1);
                IF v_dur < 1 OR v_dur > 90 THEN v_dur := 1; END IF;

                INSERT INTO public.service_templates (
                    id,
                    legacy_task_template_id,
                    name,
                    service_label,
                    description,
                    status,
                    version,
                    sort_order,
                    created_by,
                    updated_by,
                    created_at,
                    updated_at
                ) VALUES (
                    new_template_id,
                    tpl.id,
                    tpl.name,
                    COALESCE(tpl.dept_name, 'General Service'),
                    tpl.description,
                    tpl.status,
                    1,
                    v_order,
                    tpl.created_by,
                    tpl.created_by,
                    tpl.created_at,
                    tpl.created_at
                );

                INSERT INTO public.service_template_tasks (
                    id,
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
                    created_at
                ) VALUES (
                    gen_random_uuid(),
                    new_template_id,
                    tpl.id,
                    tpl.default_task_title,
                    tpl.task_details,
                    tpl.department_id,
                    tpl.default_priority,
                    tpl.default_approval_mode,
                    0,
                    v_dur,
                    0,
                    tpl.created_at
                );

                INSERT INTO public.service_template_versions (
                    id,
                    template_id,
                    version,
                    snapshot,
                    created_by,
                    created_at
                ) VALUES (
                    gen_random_uuid(),
                    new_template_id,
                    1,
                    jsonb_build_object(
                        'template_id', new_template_id,
                        'name', tpl.name,
                        'service_label', COALESCE(tpl.dept_name, 'General Service'),
                        'description', tpl.description,
                        'tasks', jsonb_build_array(
                            jsonb_build_object(
                                'definition_id', tpl.id,
                                'title', tpl.default_task_title,
                                'description', tpl.task_details,
                                'department_id', tpl.department_id,
                                'priority', tpl.default_priority,
                                'approval_mode', tpl.default_approval_mode,
                                'planned_offset_days', 0,
                                'duration_business_days', v_dur,
                                'display_order', 0
                            )
                        )
                    ),
                    tpl.created_by,
                    tpl.created_at
                );
            END IF;
        END LOOP;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. AUTHORITATIVE MUTATION RPC: fn_manage_service_template
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_manage_service_template(TEXT, UUID, TEXT, TEXT, TEXT, JSONB, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.fn_manage_service_template(TEXT, UUID, TEXT, TEXT, TEXT, JSONB, INTEGER, TEXT, INTEGER);

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
    v_is_suspended BOOLEAN;
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

    SELECT role, is_suspended INTO v_caller_role, v_is_suspended
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_caller_role IS NULL OR v_is_suspended = true THEN
        RETURN jsonb_build_object('error', 'Forbidden: User profile is suspended or does not exist.');
    END IF;

    IF v_caller_role NOT IN ('owner', 'operational_manager') THEN
        RETURN jsonb_build_object('error', 'Forbidden: Only Owners and Operational Managers can manage service templates.');
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
            END IF;

            IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = v_dept_id AND is_active = true) THEN
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
            END IF;

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
                END IF;

                IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = v_dept_id AND is_active = true) THEN
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

            v_new_version := v_template.version + 1;

            UPDATE public.service_templates
            SET name = COALESCE(NULLIF(trim(p_name), ''), name),
                service_label = COALESCE(NULLIF(trim(p_service_label), ''), service_label),
                description = CASE WHEN p_description IS NOT NULL THEN NULLIF(trim(p_description), '') ELSE description END,
                sort_order = COALESCE(p_sort_order, sort_order),
                version = v_new_version,
                updated_by = v_caller_id,
                updated_at = timezone('utc'::text, now())
            WHERE id = p_template_id AND version = p_expected_version;

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
                END IF;

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
                jsonb_build_object('id', p_template_id, 'name', COALESCE(NULLIF(trim(p_name), ''), v_template.name), 'service_label', COALESCE(NULLIF(trim(p_service_label), ''), v_template.service_label), 'tasks', v_task_array),
                v_caller_id
            );

            RETURN jsonb_build_object('success', true, 'template_id', p_template_id, 'version', v_new_version);
        ELSE
            UPDATE public.service_templates
            SET name = COALESCE(NULLIF(trim(p_name), ''), name),
                service_label = COALESCE(NULLIF(trim(p_service_label), ''), service_label),
                description = CASE WHEN p_description IS NOT NULL THEN NULLIF(trim(p_description), '') ELSE description END,
                sort_order = COALESCE(p_sort_order, sort_order),
                updated_by = v_caller_id,
                updated_at = timezone('utc'::text, now())
            WHERE id = p_template_id AND version = p_expected_version;

            RETURN jsonb_build_object('success', true, 'template_id', p_template_id, 'version', v_template.version);
        END IF;

    -- =========================================================================
    -- ACTION: DUPLICATE
    -- =========================================================================
    ELSIF p_action = 'duplicate' THEN
        IF p_template_id IS NULL THEN
            RETURN jsonb_build_object('error', 'Validation Error: template_id is required for duplicate.');
        END IF;

        SELECT * INTO v_template FROM public.service_templates WHERE id = p_template_id;
        IF v_template.id IS NULL THEN
            RETURN jsonb_build_object('error', 'Not Found: Source service template does not exist.');
        END IF;

        v_target_id := gen_random_uuid();
        INSERT INTO public.service_templates (
            id, name, service_label, description, status, version, sort_order, created_by, updated_by
        ) VALUES (
            v_target_id, format('%s (Copy)', v_template.name), v_template.service_label, v_template.description,
            'Active', 1, v_template.sort_order + 1, v_caller_id, v_caller_id
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
            jsonb_build_object('id', v_target_id, 'name', format('%s (Copy)', v_template.name), 'service_label', v_template.service_label, 'tasks', v_task_array),
            v_caller_id
        );

        RETURN jsonb_build_object('success', true, 'template_id', v_target_id, 'version', 1);

    -- =========================================================================
    -- ACTION: ARCHIVE
    -- =========================================================================
    ELSIF p_action = 'archive' THEN
        IF p_template_id IS NULL THEN
            RETURN jsonb_build_object('error', 'Validation Error: template_id is required for archive.');
        END IF;

        IF v_caller_role != 'owner' THEN
            RETURN jsonb_build_object('error', 'Forbidden: Only the Owner can archive service templates.');
        END IF;

        SELECT * INTO v_template FROM public.service_templates WHERE id = p_template_id FOR UPDATE;
        IF v_template.id IS NULL THEN
            RETURN jsonb_build_object('error', 'Not Found: Service template does not exist.');
        END IF;
        IF v_template.status = 'Archived' THEN
            RETURN jsonb_build_object('error', 'Conflict: Template is already archived.');
        END IF;

        UPDATE public.service_templates
        SET status = 'Archived',
            archived_at = timezone('utc'::text, now()),
            archived_by = v_caller_id,
            archive_reason = NULLIF(trim(p_archive_reason), ''),
            updated_by = v_caller_id,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_template_id;

        RETURN jsonb_build_object('success', true, 'template_id', p_template_id, 'status', 'Archived');

    -- =========================================================================
    -- ACTION: RESTORE
    -- =========================================================================
    ELSIF p_action = 'restore' THEN
        IF p_template_id IS NULL THEN
            RETURN jsonb_build_object('error', 'Validation Error: template_id is required for restore.');
        END IF;

        IF v_caller_role != 'owner' THEN
            RETURN jsonb_build_object('error', 'Forbidden: Only the Owner can restore archived service templates.');
        END IF;

        SELECT * INTO v_template FROM public.service_templates WHERE id = p_template_id FOR UPDATE;
        IF v_template.id IS NULL THEN
            RETURN jsonb_build_object('error', 'Not Found: Service template does not exist.');
        END IF;
        IF v_template.status = 'Active' THEN
            RETURN jsonb_build_object('error', 'Conflict: Template is already active.');
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
        RETURN jsonb_build_object('error', format('Invalid Action: "%s" is not supported.', p_action));
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. AUTHORITATIVE MUTATION RPCS: fn_save_draft_work_plan & fn_delete_draft_work_plan
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_save_draft_work_plan(UUID, UUID, TEXT, DATE, JSONB, INTEGER);

CREATE OR REPLACE FUNCTION public.fn_save_draft_work_plan(
    p_plan_id UUID DEFAULT NULL,
    p_client_id UUID DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_weeks JSONB DEFAULT '[]'::jsonb,
    p_expected_revision INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_is_suspended BOOLEAN;
    v_client RECORD;
    v_existing RECORD;
    v_target_id UUID;
    v_start_date DATE;
    v_end_date DATE;
    v_target_revision INTEGER;
    v_week_count INTEGER;
    v_week_idx INTEGER;
    v_week_obj JSONB;
    v_week_num INTEGER;
    v_week_start DATE;
    v_week_end DATE;
    v_seen_weeks INTEGER[] := '{}';
    v_occ_idx INTEGER;
    v_occ_obj JSONB;
    v_occ_tpl_id UUID;
    v_occ_tpl RECORD;
    v_occ_tpl_ver INTEGER;
    v_occ_snapshot JSONB;
    v_custom_tasks JSONB;
    v_custom_idx INTEGER;
    v_custom_elem JSONB;
    v_custom_title TEXT;
    v_custom_dept_id UUID;
    v_custom_priority TEXT;
    v_custom_approval TEXT;
    v_custom_dur INTEGER;
    v_validated_weeks JSONB := '[]'::jsonb;
    v_affected_rows INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Unauthorized: Missing active authentication session.');
    END IF;

    SELECT role, is_suspended INTO v_caller_role, v_is_suspended
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_caller_role IS NULL OR v_is_suspended = true THEN
        RETURN jsonb_build_object('error', 'Forbidden: User profile is suspended or does not exist.');
    END IF;

    IF v_caller_role NOT IN ('owner', 'operational_manager') THEN
        RETURN jsonb_build_object('error', 'Forbidden: Only Owners and Operational Managers can manage work plans.');
    END IF;

    IF p_start_date IS NULL THEN
        RETURN jsonb_build_object('error', 'Validation Error: Plan start_date is required.');
    END IF;

    v_start_date := p_start_date;
    v_end_date := v_start_date + 89; -- Exactly 90 calendar days (day 0 to day 89)

    -- Validate Exactly 13 Weeks Array
    IF jsonb_typeof(p_weeks) != 'array' THEN
        RETURN jsonb_build_object('error', 'Validation Error: weeks payload must be a JSON array.');
    END IF;

    v_week_count := jsonb_array_length(p_weeks);
    IF v_week_count != 13 THEN
        RETURN jsonb_build_object('error', format('Validation Error: A 90-day work plan must contain exactly 13 weeks (received %s).', v_week_count));
    END IF;

    -- Validate each week and occurrences
    FOR v_week_idx IN 0..12 LOOP
        v_week_obj := p_weeks->v_week_idx;
        v_week_num := COALESCE((v_week_obj->>'weekNumber')::INTEGER, (v_week_obj->>'week_number')::INTEGER);

        IF v_week_num IS NULL OR v_week_num < 1 OR v_week_num > 13 THEN
            RETURN jsonb_build_object('error', format('Validation Error: Invalid week number at index %s.', v_week_idx));
        END IF;

        IF v_week_num = ANY(v_seen_weeks) THEN
            RETURN jsonb_build_object('error', format('Validation Error: Duplicate week number %s detected.', v_week_num));
        END IF;
        v_seen_weeks := array_append(v_seen_weeks, v_week_num);

        IF v_week_num <= 12 THEN
            v_week_start := v_start_date + ((v_week_num - 1) * 7);
            v_week_end := v_week_start + 6; -- 7 days
        ELSE
            -- Week 13 is exactly 6 calendar days, ending on v_start_date + 89
            v_week_start := v_start_date + 84;
            v_week_end := v_start_date + 89;
        END IF;

        -- Validate Occurrences within week
        IF jsonb_typeof(v_week_obj->'occurrences') = 'array' THEN
            FOR v_occ_idx IN 0..(jsonb_array_length(v_week_obj->'occurrences') - 1) LOOP
                v_occ_obj := (v_week_obj->'occurrences')->v_occ_idx;
                BEGIN
                    v_occ_tpl_id := (v_occ_obj->>'templateId')::UUID;
                EXCEPTION WHEN OTHERS THEN
                    v_occ_tpl_id := NULL;
                END IF;

                IF v_occ_tpl_id IS NOT NULL THEN
                    SELECT * INTO v_occ_tpl FROM public.service_templates WHERE id = v_occ_tpl_id;
                    IF v_occ_tpl.id IS NULL OR v_occ_tpl.status != 'Active' THEN
                        RETURN jsonb_build_object('error', format('Validation Error: Week %s occurrence references an archived or non-existent template.', v_week_num));
                    END IF;
                END IF;
            END LOOP;
        END IF;

        -- Validate Custom Tasks within week
        v_custom_tasks := v_week_obj->'customTasks';
        IF jsonb_typeof(v_custom_tasks) = 'array' THEN
            FOR v_custom_idx IN 0..(jsonb_array_length(v_custom_tasks) - 1) LOOP
                v_custom_elem := v_custom_tasks->v_custom_idx;
                v_custom_title := trim(COALESCE(v_custom_elem->>'title', ''));
                IF length(v_custom_title) = 0 THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Week %s custom task #%s must have a non-empty title.', v_week_num, v_custom_idx + 1));
                END IF;
                IF length(v_custom_title) > 200 THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Week %s custom task #%s title cannot exceed 200 characters.', v_week_num, v_custom_idx + 1));
                END IF;

                BEGIN
                    v_custom_dept_id := (v_custom_elem->>'departmentId')::UUID;
                EXCEPTION WHEN OTHERS THEN
                    BEGIN
                        v_custom_dept_id := (v_custom_elem->>'department_id')::UUID;
                    EXCEPTION WHEN OTHERS THEN
                        v_custom_dept_id := NULL;
                    END;
                END IF;

                IF v_custom_dept_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.departments WHERE id = v_custom_dept_id AND is_active = true) THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Week %s custom task #%s has an invalid or inactive department.', v_week_num, v_custom_idx + 1));
                END IF;

                v_custom_priority := COALESCE(v_custom_elem->>'priority', 'Normal');
                IF v_custom_priority NOT IN ('Low', 'Normal', 'High', 'Urgent') THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Week %s custom task #%s has invalid priority "%s".', v_week_num, v_custom_idx + 1, v_custom_priority));
                END IF;

                v_custom_approval := COALESCE(v_custom_elem->>'approvalMode', v_custom_elem->>'approval_mode', 'Internal Only');
                IF v_custom_approval NOT IN ('Internal Only', 'Client Approval Required') THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Week %s custom task #%s has invalid approval mode "%s".', v_week_num, v_custom_idx + 1, v_custom_approval));
                END IF;

                v_custom_dur := COALESCE((v_custom_elem->>'durationBusinessDays')::INTEGER, (v_custom_elem->>'duration_business_days')::INTEGER, 1);
                IF v_custom_dur < 1 OR v_custom_dur > 90 THEN
                    RETURN jsonb_build_object('error', format('Validation Error: Week %s custom task #%s duration must be between 1 and 90.', v_week_num, v_custom_idx + 1));
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    IF cardinality(v_seen_weeks) != 13 THEN
        RETURN jsonb_build_object('error', 'Validation Error: Weeks array must contain unique numbers from 1 to 13.');
    END IF;

    -- =========================================================================
    -- CREATE NEW WORK PLAN
    -- =========================================================================
    IF p_plan_id IS NULL THEN
        IF p_client_id IS NULL THEN
            RETURN jsonb_build_object('error', 'Validation Error: client_id is required for new work plan.');
        END IF;

        SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;
        IF v_client.id IS NULL THEN
            RETURN jsonb_build_object('error', 'Validation Error: Target client does not exist.');
        END IF;
        IF v_client.status IN ('Archived', 'Paused') THEN
            RETURN jsonb_build_object('error', format('Forbidden: Cannot create work plan for a %s client.', v_client.status));
        END IF;

        IF v_caller_role = 'operational_manager' THEN
            IF NOT (
                v_client.operational_manager_id = v_caller_id
                OR EXISTS (
                    SELECT 1 FROM public.client_team_access
                    WHERE client_id = p_client_id AND profile_id = v_caller_id
                )
            ) THEN
                RETURN jsonb_build_object('error', 'Forbidden: Operational Manager does not have access to this client.');
            END IF;
        END IF;

        IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
            RETURN jsonb_build_object('error', 'Validation Error: Work plan name is required.');
        END IF;
        IF length(p_name) > 200 THEN
            RETURN jsonb_build_object('error', 'Validation Error: Work plan name cannot exceed 200 characters.');
        END IF;

        v_target_id := gen_random_uuid();
        v_target_revision := 1;

        INSERT INTO public.client_work_plans (
            id, client_id, name, status, start_date, end_date, revision, plan_data, created_by, updated_by
        ) VALUES (
            v_target_id, p_client_id, trim(p_name), 'Draft', v_start_date, v_end_date, 1,
            jsonb_build_object('weeks', p_weeks), v_caller_id, v_caller_id
        );

    -- =========================================================================
    -- UPDATE EXISTING DRAFT WORK PLAN
    -- =========================================================================
    ELSE
        IF p_expected_revision IS NULL THEN
            RETURN jsonb_build_object('error', 'Validation Error: expected_revision is required to update a work plan.');
        END IF;

        SELECT * INTO v_existing FROM public.client_work_plans WHERE id = p_plan_id FOR UPDATE;
        IF v_existing.id IS NULL THEN
            RETURN jsonb_build_object('error', 'Not Found: Work plan does not exist.');
        END IF;

        IF v_existing.status != 'Draft' THEN
            RETURN jsonb_build_object('error', format('Conflict: Cannot modify a work plan with status "%s".', v_existing.status));
        END IF;

        IF v_existing.revision != p_expected_revision THEN
            RETURN jsonb_build_object('error', 'Conflict: Work plan was modified by another session. Please reload.');
        END IF;

        SELECT * INTO v_client FROM public.clients WHERE id = v_existing.client_id;
        IF v_client.status IN ('Archived', 'Paused') THEN
            RETURN jsonb_build_object('error', format('Forbidden: Cannot edit work plan for a %s client.', v_client.status));
        END IF;

        IF v_caller_role = 'operational_manager' THEN
            IF NOT (
                v_client.operational_manager_id = v_caller_id
                OR EXISTS (
                    SELECT 1 FROM public.client_team_access
                    WHERE client_id = v_client.id AND profile_id = v_caller_id
                )
            ) THEN
                RETURN jsonb_build_object('error', 'Forbidden: Operational Manager does not have access to this client.');
            END IF;
        END IF;

        v_target_id := p_plan_id;
        v_target_revision := v_existing.revision + 1;

        UPDATE public.client_work_plans
        SET name = COALESCE(NULLIF(trim(p_name), ''), name),
            start_date = v_start_date,
            end_date = v_end_date,
            revision = v_target_revision,
            plan_data = jsonb_build_object('weeks', p_weeks),
            updated_by = v_caller_id,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_plan_id AND revision = p_expected_revision AND status = 'Draft';

        GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
        IF v_affected_rows = 0 THEN
            RETURN jsonb_build_object('error', 'Conflict: Stale revision or concurrent modification detected.');
        END IF;

        DELETE FROM public.client_work_plan_weeks WHERE work_plan_id = p_plan_id;
        DELETE FROM public.client_work_plan_occurrences WHERE work_plan_id = p_plan_id;
    END IF;

    -- Normalize 13 weeks & occurrences into relational child tables
    FOR v_week_idx IN 0..12 LOOP
        v_week_obj := p_weeks->v_week_idx;
        v_week_num := COALESCE((v_week_obj->>'weekNumber')::INTEGER, (v_week_obj->>'week_number')::INTEGER);

        IF v_week_num <= 12 THEN
            v_week_start := v_start_date + ((v_week_num - 1) * 7);
            v_week_end := v_week_start + 6;
        ELSE
            v_week_start := v_start_date + 84;
            v_week_end := v_start_date + 89;
        END IF;

        INSERT INTO public.client_work_plan_weeks (
            id, work_plan_id, week_number, start_date, end_date
        ) VALUES (
            gen_random_uuid(), v_target_id, v_week_num, v_week_start, v_week_end
        ) ON CONFLICT (work_plan_id, week_number) DO NOTHING;

        IF jsonb_typeof(v_week_obj->'occurrences') = 'array' THEN
            FOR v_occ_idx IN 0..(jsonb_array_length(v_week_obj->'occurrences') - 1) LOOP
                v_occ_obj := (v_week_obj->'occurrences')->v_occ_idx;
                BEGIN
                    v_occ_tpl_id := (v_occ_obj->>'templateId')::UUID;
                EXCEPTION WHEN OTHERS THEN
                    v_occ_tpl_id := NULL;
                END IF;
                v_occ_tpl_ver := COALESCE((v_occ_obj->>'templateVersion')::INTEGER, 1);

                INSERT INTO public.client_work_plan_occurrences (
                    id, work_plan_id, week_number, template_id, template_version, custom_label, sort_order, snapshot
                ) VALUES (
                    gen_random_uuid(), v_target_id, v_week_num, v_occ_tpl_id, v_occ_tpl_ver,
                    v_occ_obj->>'customLabel', v_occ_idx, v_occ_obj
                );
            END LOOP;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'plan_id', v_target_id, 'revision', v_target_revision);
END;
$$;

DROP FUNCTION IF EXISTS public.fn_delete_draft_work_plan(UUID);

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
    v_caller_role TEXT;
    v_is_suspended BOOLEAN;
    v_plan RECORD;
    v_client RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Unauthorized: Missing active authentication session.');
    END IF;

    SELECT role, is_suspended INTO v_caller_role, v_is_suspended
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_caller_role IS NULL OR v_is_suspended = true THEN
        RETURN jsonb_build_object('error', 'Forbidden: User profile is suspended or does not exist.');
    END IF;

    SELECT * INTO v_plan FROM public.client_work_plans WHERE id = p_plan_id FOR UPDATE;
    IF v_plan.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Not Found: Work plan does not exist.');
    END IF;

    IF v_plan.status != 'Draft' THEN
        RETURN jsonb_build_object('error', 'Conflict: Only Draft work plans can be deleted.');
    END IF;

    SELECT * INTO v_client FROM public.clients WHERE id = v_plan.client_id;
    IF v_client.status IN ('Archived', 'Paused') THEN
        RETURN jsonb_build_object('error', format('Forbidden: Cannot delete work plan for a %s client.', v_client.status));
    END IF;

    IF v_caller_role = 'operational_manager' THEN
        IF NOT (
            v_client.operational_manager_id = v_caller_id
            OR EXISTS (
                SELECT 1 FROM public.client_team_access
                WHERE client_id = v_client.id AND profile_id = v_caller_id
            )
        ) THEN
            RETURN jsonb_build_object('error', 'Forbidden: Operational Manager does not have access to this client.');
        END IF;
    ELSIF v_caller_role != 'owner' THEN
        RETURN jsonb_build_object('error', 'Forbidden: Unauthorized to delete work plans.');
    END IF;

    DELETE FROM public.client_work_plans WHERE id = p_plan_id AND status = 'Draft';
    RETURN jsonb_build_object('success', true, 'deleted_plan_id', p_plan_id);
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. AUTHORITATIVE LAUNCH MUTATION RPC: fn_launch_task_batch
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_launch_task_batch(UUID, TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.fn_launch_task_batch(TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB);

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
    v_is_suspended BOOLEAN;
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

    SELECT role, is_suspended INTO v_caller_role, v_is_suspended
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_caller_role IS NULL OR v_is_suspended = true THEN
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

    -- Canonical SHA-256 Payload Hash using PostgreSQL built-in sha256
    v_canonical_string := v_caller_id::TEXT || ':' ||
        p_client_id::TEXT || ':' ||
        p_launch_type || ':' ||
        COALESCE(p_source_id::TEXT, '') || ':' ||
        COALESCE(p_target_week::TEXT, '') || ':' ||
        p_tasks::TEXT || ':' ||
        p_metadata::TEXT;

    v_payload_hash := encode(sha256(v_canonical_string::bytea), 'hex');

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
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = v_dept_id AND is_active = true) THEN
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
            id, task_id, client_id, actor_id, event_type, old_state, new_state, notes, created_at
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

-- ------------------------------------------------------------------------------
-- 9. COMPLETE RLS SECURITY POLICY MATRIX
-- ------------------------------------------------------------------------------

ALTER TABLE public.service_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_work_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_work_plan_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_work_plan_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_launch_batches ENABLE ROW LEVEL SECURITY;

-- Helper security functions
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND is_suspended = false
          AND role IN ('owner', 'operational_manager', 'team_member')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND is_suspended = false
          AND role IN ('owner', 'operational_manager')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND is_suspended = false
          AND role = 'owner'
    );
$$;

CREATE OR REPLACE FUNCTION public.has_client_access(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_suspended = false
          AND (
              p.role = 'owner'
              OR (
                  p.role = 'operational_manager'
                  AND EXISTS (
                      SELECT 1 FROM public.clients c
                      WHERE c.id = p_client_id
                        AND (
                            c.operational_manager_id = p.id
                            OR EXISTS (
                                SELECT 1 FROM public.client_team_access cta
                                WHERE cta.client_id = p_client_id AND cta.profile_id = p.id
                            )
                        )
                  )
              )
              OR (
                  p.role = 'team_member'
                  AND EXISTS (
                      SELECT 1 FROM public.client_team_access cta
                      WHERE cta.client_id = p_client_id AND cta.profile_id = p.id
                  )
              )
              OR (
                  p.role = 'client'
                  AND p.id = p_client_id
              )
          )
    );
$$;

-- 9.1 service_templates RLS
DROP POLICY IF EXISTS "service_templates_select_policy" ON public.service_templates;
CREATE POLICY "service_templates_select_policy" ON public.service_templates
    FOR SELECT USING (
        public.is_owner()
        OR (public.is_manager_or_owner() AND status = 'Active')
    );

DROP POLICY IF EXISTS "service_templates_insert_policy" ON public.service_templates;
CREATE POLICY "service_templates_insert_policy" ON public.service_templates
    FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "service_templates_update_policy" ON public.service_templates;
CREATE POLICY "service_templates_update_policy" ON public.service_templates
    FOR UPDATE USING (false);

DROP POLICY IF EXISTS "service_templates_delete_policy" ON public.service_templates;
CREATE POLICY "service_templates_delete_policy" ON public.service_templates
    FOR DELETE USING (false);

-- 9.2 service_template_tasks RLS
DROP POLICY IF EXISTS "service_template_tasks_select_policy" ON public.service_template_tasks;
CREATE POLICY "service_template_tasks_select_policy" ON public.service_template_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.service_templates st
            WHERE st.id = service_template_tasks.template_id
              AND (public.is_owner() OR (public.is_manager_or_owner() AND st.status = 'Active'))
        )
    );

DROP POLICY IF EXISTS "service_template_tasks_insert_policy" ON public.service_template_tasks;
CREATE POLICY "service_template_tasks_insert_policy" ON public.service_template_tasks
    FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "service_template_tasks_update_policy" ON public.service_template_tasks;
CREATE POLICY "service_template_tasks_update_policy" ON public.service_template_tasks
    FOR UPDATE USING (false);

DROP POLICY IF EXISTS "service_template_tasks_delete_policy" ON public.service_template_tasks;
CREATE POLICY "service_template_tasks_delete_policy" ON public.service_template_tasks
    FOR DELETE USING (false);

-- 9.3 service_template_versions RLS
DROP POLICY IF EXISTS "service_template_versions_select_policy" ON public.service_template_versions;
CREATE POLICY "service_template_versions_select_policy" ON public.service_template_versions
    FOR SELECT USING (public.is_manager_or_owner());

DROP POLICY IF EXISTS "service_template_versions_write_policy" ON public.service_template_versions;
CREATE POLICY "service_template_versions_write_policy" ON public.service_template_versions
    FOR ALL USING (false) WITH CHECK (false);

-- 9.4 client_work_plans RLS
DROP POLICY IF EXISTS "client_work_plans_select_policy" ON public.client_work_plans;
CREATE POLICY "client_work_plans_select_policy" ON public.client_work_plans
    FOR SELECT USING (
        public.is_manager_or_owner() AND public.has_client_access(client_id)
    );

DROP POLICY IF EXISTS "client_work_plans_direct_write_policy" ON public.client_work_plans;
CREATE POLICY "client_work_plans_direct_write_policy" ON public.client_work_plans
    FOR ALL USING (false) WITH CHECK (false);

-- 9.5 client_work_plan_weeks RLS
DROP POLICY IF EXISTS "client_work_plan_weeks_select_policy" ON public.client_work_plan_weeks;
CREATE POLICY "client_work_plan_weeks_select_policy" ON public.client_work_plan_weeks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.client_work_plans cwp
            WHERE cwp.id = client_work_plan_weeks.work_plan_id
              AND public.is_manager_or_owner()
              AND public.has_client_access(cwp.client_id)
        )
    );

DROP POLICY IF EXISTS "client_work_plan_weeks_direct_write" ON public.client_work_plan_weeks;
CREATE POLICY "client_work_plan_weeks_direct_write" ON public.client_work_plan_weeks
    FOR ALL USING (false) WITH CHECK (false);

-- 9.6 client_work_plan_occurrences RLS
DROP POLICY IF EXISTS "client_work_plan_occurrences_select_policy" ON public.client_work_plan_occurrences;
CREATE POLICY "client_work_plan_occurrences_select_policy" ON public.client_work_plan_occurrences
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.client_work_plans cwp
            WHERE cwp.id = client_work_plan_occurrences.work_plan_id
              AND public.is_manager_or_owner()
              AND public.has_client_access(cwp.client_id)
        )
    );

DROP POLICY IF EXISTS "client_work_plan_occurrences_direct_write" ON public.client_work_plan_occurrences;
CREATE POLICY "client_work_plan_occurrences_direct_write" ON public.client_work_plan_occurrences
    FOR ALL USING (false) WITH CHECK (false);

-- 9.7 task_launch_batches RLS
DROP POLICY IF EXISTS "task_launch_batches_select_policy" ON public.task_launch_batches;
CREATE POLICY "task_launch_batches_select_policy" ON public.task_launch_batches
    FOR SELECT USING (
        public.is_manager_or_owner() AND public.has_client_access(client_id)
    );

DROP POLICY IF EXISTS "task_launch_batches_direct_write" ON public.task_launch_batches;
CREATE POLICY "task_launch_batches_direct_write" ON public.task_launch_batches
    FOR ALL USING (false) WITH CHECK (false);

-- ------------------------------------------------------------------------------
-- 10. GRANTS & REVOKES
-- ------------------------------------------------------------------------------
GRANT SELECT ON public.service_templates TO authenticated;
GRANT SELECT ON public.service_template_tasks TO authenticated;
GRANT SELECT ON public.service_template_versions TO authenticated;
GRANT SELECT ON public.client_work_plans TO authenticated;
GRANT SELECT ON public.client_work_plan_weeks TO authenticated;
GRANT SELECT ON public.client_work_plan_occurrences TO authenticated;
GRANT SELECT ON public.task_launch_batches TO authenticated;

-- Revoke default public / anon execution on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.fn_manage_service_template(TEXT, UUID, TEXT, TEXT, TEXT, JSONB, INTEGER, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_manage_service_template(TEXT, UUID, TEXT, TEXT, TEXT, JSONB, INTEGER, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_manage_service_template(TEXT, UUID, TEXT, TEXT, TEXT, JSONB, INTEGER, TEXT, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_save_draft_work_plan(UUID, UUID, TEXT, DATE, JSONB, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_save_draft_work_plan(UUID, UUID, TEXT, DATE, JSONB, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_save_draft_work_plan(UUID, UUID, TEXT, DATE, JSONB, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_delete_draft_work_plan(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_delete_draft_work_plan(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_delete_draft_work_plan(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_launch_task_batch(TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_launch_task_batch(TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_launch_task_batch(TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB) TO authenticated;
