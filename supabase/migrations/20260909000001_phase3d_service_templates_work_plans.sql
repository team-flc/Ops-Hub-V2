-- ==============================================================================
-- MIGRATION: 20260909000001_phase3d_service_templates_work_plans.sql
-- Phase: 3D — Multi-Task Service Templates, 90-Day Work Plans & Transactional Launch
-- Database: PostgreSQL / Supabase
-- ==============================================================================

-- 1. Create service_templates table
CREATE TABLE IF NOT EXISTS public.service_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create service_template_tasks table (Ordered Child Tasks per Template)
CREATE TABLE IF NOT EXISTS public.service_template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.service_templates(id) ON DELETE CASCADE,
    definition_id UUID NOT NULL DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    approval_mode TEXT NOT NULL DEFAULT 'Internal Only' CHECK (approval_mode IN ('Internal Only', 'Client Approval Required')),
    planned_offset_days INTEGER NOT NULL DEFAULT 0 CHECK (planned_offset_days >= 0),
    duration_business_days INTEGER NOT NULL DEFAULT 1 CHECK (duration_business_days >= 1 AND duration_business_days <= 30),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_service_template_tasks_template_order
ON public.service_template_tasks(template_id, display_order ASC);

-- 3. Create service_template_versions table (Immutable Version Snapshots)
CREATE TABLE IF NOT EXISTS public.service_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.service_templates(id) ON DELETE CASCADE,
    version INTEGER NOT NULL CHECK (version >= 1),
    snapshot JSONB NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_service_template_version UNIQUE (template_id, version)
);

-- 4. Create client_work_plans table (Exact 90-Calendar-Day Work Plans)
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
    CONSTRAINT chk_plan_90_days CHECK (end_date = start_date + 89)
);

CREATE INDEX IF NOT EXISTS idx_client_work_plans_client_status
ON public.client_work_plans(client_id, status);

-- 5. Create task_launch_batches table (Transactional Idempotency Registry)
CREATE TABLE IF NOT EXISTS public.task_launch_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    launch_type TEXT NOT NULL CHECK (launch_type IN ('service_template', 'work_plan')),
    source_template_id UUID REFERENCES public.service_templates(id) ON DELETE SET NULL,
    source_plan_id UUID REFERENCES public.client_work_plans(id) ON DELETE SET NULL,
    target_week INTEGER,
    task_count INTEGER NOT NULL,
    task_ids UUID[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_launch_batch_idempotency UNIQUE (actor_id, request_id)
);

-- 6. Add Companion Provenance Columns to client_tasks
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'plan_id'
    ) THEN
        ALTER TABLE public.client_tasks
        ADD COLUMN plan_id UUID REFERENCES public.client_work_plans(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'plan_week'
    ) THEN
        ALTER TABLE public.client_tasks
        ADD COLUMN plan_week INTEGER CHECK (plan_week BETWEEN 1 AND 13);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'occurrence_id'
    ) THEN
        ALTER TABLE public.client_tasks
        ADD COLUMN occurrence_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'launch_batch_id'
    ) THEN
        ALTER TABLE public.client_tasks
        ADD COLUMN launch_batch_id UUID REFERENCES public.task_launch_batches(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_tasks_plan_provenance
ON public.client_tasks(plan_id, plan_week);

-- 7. Safe Idempotent Backfill from legacy task_templates
DO $$
DECLARE
    tpl RECORD;
    dept_name TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_templates') THEN
        FOR tpl IN SELECT * FROM public.task_templates LOOP
            -- Look up department name for service label
            SELECT name INTO dept_name FROM public.departments WHERE id = tpl.department_id;
            
            -- Insert into service_templates preserving UUID
            INSERT INTO public.service_templates (
                id, name, service_label, description, status, version,
                sort_order, created_by, updated_by, archived_at, archived_by,
                archive_reason, created_at, updated_at
            ) VALUES (
                tpl.id,
                tpl.name,
                COALESCE(dept_name, 'General Service'),
                tpl.description,
                tpl.status,
                tpl.version,
                tpl.sort_order,
                tpl.created_by,
                tpl.updated_by,
                tpl.archived_at,
                tpl.archived_by,
                tpl.archive_reason,
                tpl.created_at,
                tpl.updated_at
            ) ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                status = EXCLUDED.status,
                version = EXCLUDED.version,
                updated_at = EXCLUDED.updated_at;

            -- Insert primary child task definition
            INSERT INTO public.service_template_tasks (
                template_id, definition_id, title, description,
                department_id, priority, approval_mode, planned_offset_days,
                duration_business_days, display_order, created_at, updated_at
            ) VALUES (
                tpl.id,
                gen_random_uuid(),
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
            ) ON CONFLICT DO NOTHING;

            -- Create version 1 snapshot
            INSERT INTO public.service_template_versions (
                template_id, version, snapshot, created_by, created_at
            ) VALUES (
                tpl.id,
                tpl.version,
                jsonb_build_object(
                    'id', tpl.id,
                    'name', tpl.name,
                    'version', tpl.version,
                    'tasks', jsonb_build_array(
                        jsonb_build_object(
                            'title', tpl.default_task_title,
                            'description', tpl.task_details,
                            'department_id', tpl.department_id,
                            'priority', tpl.default_priority,
                            'approval_mode', tpl.default_approval_mode,
                            'duration_business_days', tpl.suggested_duration_days
                        )
                    )
                ),
                tpl.created_by,
                tpl.created_at
            ) ON CONFLICT (template_id, version) DO NOTHING;
        END LOOP;
    END IF;
END $$;

-- 8. Row Level Security Policies
ALTER TABLE public.service_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_work_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_launch_batches ENABLE ROW LEVEL SECURITY;

-- Deny direct writes on templates from client (handled via backend/RPC)
DROP POLICY IF EXISTS service_templates_insert_deny ON public.service_templates;
CREATE POLICY service_templates_insert_deny ON public.service_templates FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS service_templates_update_deny ON public.service_templates;
CREATE POLICY service_templates_update_deny ON public.service_templates FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS service_templates_delete_deny ON public.service_templates;
CREATE POLICY service_templates_delete_deny ON public.service_templates FOR DELETE TO authenticated USING (false);

-- SELECT Policy for service_templates
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
          )
    )
);

-- SELECT Policy for service_template_tasks
DROP POLICY IF EXISTS service_template_tasks_select ON public.service_template_tasks;
CREATE POLICY service_template_tasks_select ON public.service_template_tasks FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.service_templates st
        WHERE st.id = service_template_tasks.template_id
          AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = (SELECT auth.uid())
                AND p.status = 'active'
                AND (
                    p.role = 'owner'
                    OR (p.role = 'operational_manager' AND st.status = 'Active')
                )
          )
    )
);

-- Policies for client_work_plans
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
                      SELECT 1 FROM public.client_team_access cta
                      WHERE cta.client_id = client_work_plans.client_id
                        AND cta.user_id = p.id
                  )
              )
          )
    )
);

DROP POLICY IF EXISTS client_work_plans_write ON public.client_work_plans;
CREATE POLICY client_work_plans_write ON public.client_work_plans FOR ALL TO authenticated
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
                      SELECT 1 FROM public.client_team_access cta
                      WHERE cta.client_id = client_work_plans.client_id
                        AND cta.user_id = p.id
                  )
              )
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.status = 'active'
          AND (
              p.role = 'owner'
              OR (
                  p.role = 'operational_manager'
                  AND EXISTS (
                      SELECT 1 FROM public.client_team_access cta
                      WHERE cta.client_id = client_work_plans.client_id
                        AND cta.user_id = p.id
                  )
              )
          )
    )
);

-- 9. Transactional Launch RPC Function
CREATE OR REPLACE FUNCTION public.fn_launch_task_batch(
    p_actor_id UUID,
    p_request_id TEXT,
    p_client_id UUID,
    p_launch_type TEXT,
    p_source_id UUID,
    p_target_week INTEGER,
    p_tasks JSONB,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private, extensions
AS $$
DECLARE
    v_actor_profile RECORD;
    v_client RECORD;
    v_existing_batch RECORD;
    v_task_item JSONB;
    v_new_task_id UUID;
    v_created_task_ids UUID[] := '{}';
    v_task_count INTEGER := 0;
    v_batch_id UUID;
    v_plan_revision INTEGER;
    v_expected_revision INTEGER;
BEGIN
    -- 1. Validate Actor
    SELECT * INTO v_actor_profile
    FROM public.profiles
    WHERE id = p_actor_id;

    IF v_actor_profile.id IS NULL OR v_actor_profile.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Inactive or invalid caller profile');
    END IF;

    IF v_actor_profile.role NOT IN ('owner', 'operational_manager') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Insufficient privileges to launch tasks');
    END IF;

    -- 2. Validate Target Client
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

    -- If manager, verify access
    IF v_actor_profile.role = 'operational_manager' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.client_team_access
            WHERE client_id = p_client_id AND user_id = p_actor_id
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Operational Manager does not have access to this client');
        END IF;
    END IF;

    -- 3. Check Idempotency
    SELECT * INTO v_existing_batch
    FROM public.task_launch_batches
    WHERE actor_id = p_actor_id AND request_id = p_request_id;

    IF v_existing_batch.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent_replay', true,
            'batch_id', v_existing_batch.id,
            'task_ids', v_existing_batch.task_ids,
            'task_count', v_existing_batch.task_count
        );
    END IF;

    -- 4. Work Plan Overlap & Revision Check (if launch_type = 'work_plan')
    IF p_launch_type = 'work_plan' THEN
        SELECT revision INTO v_plan_revision
        FROM public.client_work_plans
        WHERE id = p_source_id;

        v_expected_revision := (p_metadata->>'expected_revision')::INTEGER;
        IF v_expected_revision IS NOT NULL AND v_plan_revision != v_expected_revision THEN
            RETURN jsonb_build_object('success', false, 'error', 'Conflict: Work Plan revision has changed. Please refresh and review.');
        END IF;

        -- Check overlapping active plans
        IF EXISTS (
            SELECT 1 FROM public.client_work_plans existing_p
            JOIN public.client_work_plans cur_p ON cur_p.id = p_source_id
            WHERE existing_p.client_id = p_client_id
              AND existing_p.id != p_source_id
              AND existing_p.status = 'Launched'
              AND (existing_p.start_date <= cur_p.end_date AND existing_p.end_date >= cur_p.start_date)
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Conflict: Another Work Plan is already active for this client during the requested date range.');
        END IF;
    END IF;

    -- 5. Insert Launch Batch Record
    v_batch_id := gen_random_uuid();
    INSERT INTO public.task_launch_batches (
        id, request_id, actor_id, client_id, launch_type,
        source_template_id, source_plan_id, target_week,
        task_count, task_ids, metadata
    ) VALUES (
        v_batch_id,
        p_request_id,
        p_actor_id,
        p_client_id,
        p_launch_type,
        CASE WHEN p_launch_type = 'service_template' THEN p_source_id ELSE NULL END,
        CASE WHEN p_launch_type = 'work_plan' THEN p_source_id ELSE NULL END,
        p_target_week,
        jsonb_array_length(p_tasks),
        '{}',
        p_metadata
    );

    -- 6. Insert All Child Tasks (Draft, Unassigned)
    FOR v_task_item IN SELECT * FROM jsonb_array_elements(p_tasks) LOOP
        v_new_task_id := gen_random_uuid();
        
        INSERT INTO public.client_tasks (
            id,
            client_id,
            title,
            description,
            department_id,
            status,
            priority,
            approval_mode,
            assignee_id,
            week_number,
            planned_date,
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
            v_task_item->>'title',
            v_task_item->>'description',
            (v_task_item->>'department_id')::UUID,
            'Draft', -- Strictly Draft
            COALESCE(v_task_item->>'priority', 'Normal'),
            COALESCE(v_task_item->>'approval_mode', 'Internal Only'),
            NULL, -- Strictly Unassigned
            COALESCE((v_task_item->>'week_number')::INTEGER, CASE WHEN p_target_week <= 4 THEN p_target_week ELSE 1 END),
            (v_task_item->>'planned_date')::TIMESTAMPTZ,
            (v_task_item->>'due_date')::TIMESTAMPTZ,
            CASE WHEN p_launch_type = 'service_template' THEN p_source_id ELSE (v_task_item->>'source_template_id')::UUID END,
            COALESCE((v_task_item->>'source_template_version')::INTEGER, 1),
            CASE WHEN p_launch_type = 'work_plan' THEN p_source_id ELSE NULL END,
            (v_task_item->>'plan_week')::INTEGER,
            (v_task_item->>'occurrence_id')::UUID,
            v_batch_id,
            p_actor_id
        );

        v_created_task_ids := array_append(v_created_task_ids, v_new_task_id);
        v_task_count := v_task_count + 1;
    END LOOP;

    -- Update batch with task IDs
    UPDATE public.task_launch_batches
    SET task_ids = v_created_task_ids, task_count = v_task_count
    WHERE id = v_batch_id;

    -- If work_plan, update plan status to Launched
    IF p_launch_type = 'work_plan' THEN
        UPDATE public.client_work_plans
        SET status = 'Launched',
            launched_at = timezone('utc'::text, now()),
            launched_by = p_actor_id,
            launch_batch_id = v_batch_id,
            launch_snapshot = jsonb_build_object(
                'launched_tasks_count', v_task_count,
                'tasks', p_tasks,
                'metadata', p_metadata
            ),
            revision = revision + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_source_id;
    END IF;

    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'batch_id', v_batch_id,
        'task_count', v_task_count,
        'task_ids', v_created_task_ids
    );
END;
$$;

ALTER FUNCTION public.fn_launch_task_batch(UUID, TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_launch_task_batch(UUID, TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_launch_task_batch(UUID, TEXT, UUID, TEXT, UUID, INTEGER, JSONB, JSONB) TO authenticated, service_role;
