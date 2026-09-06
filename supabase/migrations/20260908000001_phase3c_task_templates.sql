-- ==============================================================================
-- MIGRATION: 20260908_phase3c_task_templates.sql
-- Phase: 3C — Task Templates System (Internal FLC Global Template Library)
-- Database: PostgreSQL / Supabase
-- ==============================================================================

-- 1. Create task_templates table (Internal FLC Global Template Library)
CREATE TABLE IF NOT EXISTS public.task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    default_task_title TEXT NOT NULL,
    task_details TEXT,
    default_priority TEXT NOT NULL DEFAULT 'Normal',
    default_approval_mode TEXT NOT NULL DEFAULT 'Internal Only',
    suggested_duration_days INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'Active',
    sort_order INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    seed_key TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    archive_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Independent column verification for task_templates (safe on partial states)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'name') THEN
        ALTER TABLE public.task_templates ADD COLUMN name TEXT NOT NULL DEFAULT 'Untitled Template';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'description') THEN
        ALTER TABLE public.task_templates ADD COLUMN description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'department_id') THEN
        ALTER TABLE public.task_templates ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'default_task_title') THEN
        ALTER TABLE public.task_templates ADD COLUMN default_task_title TEXT NOT NULL DEFAULT 'Task';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'task_details') THEN
        ALTER TABLE public.task_templates ADD COLUMN task_details TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'default_priority') THEN
        ALTER TABLE public.task_templates ADD COLUMN default_priority TEXT NOT NULL DEFAULT 'Normal';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'default_approval_mode') THEN
        ALTER TABLE public.task_templates ADD COLUMN default_approval_mode TEXT NOT NULL DEFAULT 'Internal Only';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'suggested_duration_days') THEN
        ALTER TABLE public.task_templates ADD COLUMN suggested_duration_days INTEGER NOT NULL DEFAULT 3;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'status') THEN
        ALTER TABLE public.task_templates ADD COLUMN status TEXT NOT NULL DEFAULT 'Active';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'sort_order') THEN
        ALTER TABLE public.task_templates ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'version') THEN
        ALTER TABLE public.task_templates ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'seed_key') THEN
        ALTER TABLE public.task_templates ADD COLUMN seed_key TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'created_by') THEN
        ALTER TABLE public.task_templates ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'updated_by') THEN
        ALTER TABLE public.task_templates ADD COLUMN updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'archived_at') THEN
        ALTER TABLE public.task_templates ADD COLUMN archived_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'archived_by') THEN
        ALTER TABLE public.task_templates ADD COLUMN archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'archive_reason') THEN
        ALTER TABLE public.task_templates ADD COLUMN archive_reason TEXT;
    END IF;

    -- Corrected companion checks targeting table_name = 'task_templates' and column_name = 'created_at'/'updated_at'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'created_at') THEN
        ALTER TABLE public.task_templates ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'updated_at') THEN
        ALTER TABLE public.task_templates ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

-- 3. Stable Named Constraints (avoids duplicate unnamed CHECK constraints)
DO $$
BEGIN
    ALTER TABLE public.task_templates DROP CONSTRAINT IF EXISTS chk_task_templates_name;
    ALTER TABLE public.task_templates ADD CONSTRAINT chk_task_templates_name
        CHECK (length(trim(name)) > 0 AND length(name) <= 200);

    ALTER TABLE public.task_templates DROP CONSTRAINT IF EXISTS chk_task_templates_default_title;
    ALTER TABLE public.task_templates ADD CONSTRAINT chk_task_templates_default_title
        CHECK (length(trim(default_task_title)) > 0 AND length(default_task_title) <= 200);

    ALTER TABLE public.task_templates DROP CONSTRAINT IF EXISTS chk_task_templates_priority;
    ALTER TABLE public.task_templates ADD CONSTRAINT chk_task_templates_priority
        CHECK (default_priority IN ('Low', 'Normal', 'High', 'Urgent'));

    ALTER TABLE public.task_templates DROP CONSTRAINT IF EXISTS chk_task_templates_approval_mode;
    ALTER TABLE public.task_templates ADD CONSTRAINT chk_task_templates_approval_mode
        CHECK (default_approval_mode IN ('Internal Only', 'Client Approval Required'));

    ALTER TABLE public.task_templates DROP CONSTRAINT IF EXISTS chk_task_templates_duration;
    ALTER TABLE public.task_templates ADD CONSTRAINT chk_task_templates_duration
        CHECK (suggested_duration_days >= 1 AND suggested_duration_days <= 30);

    ALTER TABLE public.task_templates DROP CONSTRAINT IF EXISTS chk_task_templates_status;
    ALTER TABLE public.task_templates ADD CONSTRAINT chk_task_templates_status
        CHECK (status IN ('Active', 'Archived'));

    ALTER TABLE public.task_templates DROP CONSTRAINT IF EXISTS chk_task_templates_version;
    ALTER TABLE public.task_templates ADD CONSTRAINT chk_task_templates_version
        CHECK (version >= 1);
END $$;

-- 4. Unique Seed Key & Performance Indexes
DROP INDEX IF EXISTS public.uq_idx_task_templates_org_seed_key;
DROP INDEX IF EXISTS public.uq_idx_task_templates_seed_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_task_templates_seed_key
ON public.task_templates(seed_key)
WHERE seed_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_templates_status_sort
ON public.task_templates(status, sort_order ASC, name ASC);

CREATE INDEX IF NOT EXISTS idx_task_templates_department
ON public.task_templates(department_id);

-- 5. Companion Columns on client_tasks (Provenance tracking)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'source_template_id'
    ) THEN
        ALTER TABLE public.client_tasks
        ADD COLUMN source_template_id UUID REFERENCES public.task_templates(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'source_template_version'
    ) THEN
        ALTER TABLE public.client_tasks
        ADD COLUMN source_template_version INTEGER;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_tasks_source_template
ON public.client_tasks(source_template_id)
WHERE source_template_id IS NOT NULL;

-- 6. Template Mutation Requests (Secure, Action-Scoped Idempotency Tracking)
CREATE TABLE IF NOT EXISTS public.template_mutation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    action TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    resource_id UUID,
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_template_mutation_idempotency UNIQUE (actor_id, action, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_template_mutation_lookup
ON public.template_mutation_requests(actor_id, action, idempotency_key);

-- Enable RLS on template_mutation_requests (strictly accessible via backend service role)
ALTER TABLE public.template_mutation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS template_mutation_deny_all ON public.template_mutation_requests;
CREATE POLICY template_mutation_deny_all ON public.template_mutation_requests
FOR ALL TO public USING (false) WITH CHECK (false);

-- 7. Row Level Security on task_templates
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- Deny direct authenticated writes (strictly managed through backend Edge Function)
DROP POLICY IF EXISTS task_templates_insert_deny ON public.task_templates;
CREATE POLICY task_templates_insert_deny ON public.task_templates
FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS task_templates_update_deny ON public.task_templates;
CREATE POLICY task_templates_update_deny ON public.task_templates
FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS task_templates_delete_deny ON public.task_templates;
CREATE POLICY task_templates_delete_deny ON public.task_templates
FOR DELETE TO authenticated USING (false);

-- SELECT Policy with Role Boundaries:
-- Owner: can select all (Active + Archived)
-- Operational Manager: can select Active templates only
-- Team Member & Client: denied (fail closed)
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
              OR (p.role = 'operational_manager' AND task_templates.status = 'Active')
          )
    )
);

-- 8. Idempotent Starter Seed: Media Buying template
DO $$
DECLARE
    paid_ads_dept_id UUID;
    system_owner_id UUID;
BEGIN
    -- Look up Paid Ads department ID
    SELECT id INTO paid_ads_dept_id
    FROM public.departments
    WHERE slug = 'paid-ads'
    LIMIT 1;

    IF paid_ads_dept_id IS NULL THEN
        RAISE NOTICE 'Skipping starter template seed: Paid Ads department (slug: paid-ads) not found.';
        RETURN;
    END IF;

    -- Look up an active Owner profile ID
    SELECT id INTO system_owner_id
    FROM public.profiles
    WHERE role = 'owner' AND status = 'active'
    ORDER BY created_at ASC
    LIMIT 1;

    IF system_owner_id IS NULL THEN
        RAISE NOTICE 'Skipping starter template seed: No active Owner profile found.';
        RETURN;
    END IF;

    -- If the template was already seeded previously by name without seed_key, backfill its seed_key
    UPDATE public.task_templates
    SET seed_key = 'media_buying_campaign_setup_v1'
    WHERE name = 'Media Buying Campaign Setup & Launch'
      AND seed_key IS NULL;

    -- Insert starter template using seed_key idempotency check (immune to rename)
    IF NOT EXISTS (
        SELECT 1 FROM public.task_templates
        WHERE seed_key = 'media_buying_campaign_setup_v1'
    ) THEN
        INSERT INTO public.task_templates (
            name,
            description,
            department_id,
            default_task_title,
            task_details,
            default_priority,
            default_approval_mode,
            suggested_duration_days,
            status,
            sort_order,
            version,
            seed_key,
            created_by,
            updated_by
        ) VALUES (
            'Media Buying Campaign Setup & Launch',
            'Standard operational workflow for structuring, verifying, and launching paid advertising campaigns.',
            paid_ads_dept_id,
            'Media Buying Campaign Setup & Launch',
            '### Pre-Launch Operational Checklist
- [ ] **Access & Account Verification**: Confirm ad account permissions, billing setup, and two-factor authentication.
- [ ] **Offer & Objective Confirmation**: Validate target conversion event, core landing page URL, and KPI benchmarks.
- [ ] **Tracking & Pixel Verification**: Test conversion events via Pixel Helper / Events Manager (PageView, ViewContent, Lead/Purchase).
- [ ] **Campaign Structure Setup**: Establish standardized naming convention: `[Client]_[Objective]_[Audience]_[Date]`.
- [ ] **Budget & Targeting Setup**: Configure daily/lifetime pacing, geo-targeting, exclusions, and custom/lookalike audiences.
- [ ] **Creative & Copy Readiness**: Upload high-resolution assets, primary copy variations, headlines, and UTM parameters.
- [ ] **Quality Assurance (QA)**: Verify all destination URLs, mobile responsiveness, tracking parameters, and disclaimer compliance.
- [ ] **Launch**: Transition campaign from Draft to Active status.
- [ ] **Initial Monitoring**: Perform live audit 2-4 hours post-launch to confirm spend pacing, impression delivery, and tracking accuracy.',
            'Normal',
            'Client Approval Required',
            5,
            'Active',
            0,
            1,
            'media_buying_campaign_setup_v1',
            system_owner_id,
            system_owner_id
        );
        RAISE NOTICE 'Starter seed complete: Media Buying template inserted.';
    ELSE
        RAISE NOTICE 'Starter seed already present: Skipped.';
    END IF;
END $$;

-- 9. Transactional Mutation RPC Function (Genuine Atomic Mutation, Audit & Idempotency)
CREATE OR REPLACE FUNCTION public.fn_manage_task_template_mutation(
    p_actor_id UUID,
    p_action TEXT,
    p_idempotency_key TEXT,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_actor_profile RECORD;
    v_existing_claim RECORD;
    v_claim_id UUID;
    v_claim_inserted BOOLEAN := FALSE;
    v_template RECORD;
    v_old_template RECORD;
    v_source_template RECORD;
    v_department_name TEXT;
    v_response_payload JSONB;
    v_template_json JSONB;
    v_previous_state JSONB := NULL;
    v_new_state JSONB := NULL;
    v_entity_id UUID := NULL;
    v_entity_name TEXT := NULL;
    v_audit_action TEXT := NULL;

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
    -- 1. Validate Actor Profile & Owner Authorization
    SELECT id, full_name, role, status
    INTO v_actor_profile
    FROM public.profiles
    WHERE id = p_actor_id;

    IF v_actor_profile.id IS NULL OR v_actor_profile.status != 'active' OR v_actor_profile.role != 'owner' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Forbidden: Only active Executive Owners can govern task templates.',
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

    -- 2. Race-Safe Idempotency Claim (Atomic INSERT ... ON CONFLICT DO NOTHING RETURNING id)
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
        -- Row already exists: lock and read existing claim row
        SELECT id, status, response_payload
        INTO v_existing_claim
        FROM public.template_mutation_requests
        WHERE actor_id = p_actor_id
          AND action = p_action
          AND idempotency_key = p_idempotency_key
        FOR UPDATE;

        IF v_existing_claim.status = 'completed' AND v_existing_claim.response_payload IS NOT NULL THEN
            -- Cached replay: Return immediately with is_replay = true without repeating mutation or audit event
            RETURN jsonb_set(v_existing_claim.response_payload, '{is_replay}', 'true'::jsonb);
        ELSIF v_existing_claim.status = 'processing' THEN
            -- In-flight concurrency: Another worker is currently processing this exact mutation
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Conflict: Mutation already in progress for this request. Please wait.',
                'code', '409_CONCURRENT'
            );
        ELSIF v_existing_claim.status = 'failed' THEN
            -- Previous attempt failed: allow controlled retry by flipping back to 'processing'
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
    -- --------------------------------------------------------------------------
    -- ACTION: create
    -- --------------------------------------------------------------------------
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

        -- Validations
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

        IF v_default_priority NOT IN ('Low', 'Normal', 'High', 'Urgent') THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Invalid default priority.', 'code', '400_BAD_REQUEST');
        END IF;

        IF v_default_approval_mode NOT IN ('Internal Only', 'Client Approval Required') THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Invalid default approval mode.', 'code', '400_BAD_REQUEST');
        END IF;

        IF v_suggested_duration_days < 1 OR v_suggested_duration_days > 30 THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Suggested duration must be between 1 and 30 business days.', 'code', '400_BAD_REQUEST');
        END IF;

        -- Check department existence
        SELECT name INTO v_department_name FROM public.departments WHERE id = v_department_id;
        IF v_department_name IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Referenced department does not exist.', 'code', '400_BAD_REQUEST');
        END IF;

        INSERT INTO public.task_templates (
            name,
            description,
            department_id,
            default_task_title,
            task_details,
            default_priority,
            default_approval_mode,
            suggested_duration_days,
            sort_order,
            status,
            version,
            created_by,
            updated_by
        ) VALUES (
            v_name,
            v_description,
            v_department_id,
            v_default_task_title,
            v_task_details,
            v_default_priority,
            v_default_approval_mode,
            v_suggested_duration_days,
            v_sort_order,
            'Active',
            1,
            p_actor_id,
            p_actor_id
        ) RETURNING * INTO v_template;

        v_entity_id := v_template.id;
        v_entity_name := v_template.name;
        v_previous_state := NULL;
        v_new_state := to_jsonb(v_template);
        v_audit_action := 'template_created';

    -- --------------------------------------------------------------------------
    -- ACTION: update
    -- --------------------------------------------------------------------------
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

        -- Lock existing template
        SELECT * INTO v_old_template FROM public.task_templates WHERE id = v_template_id FOR UPDATE;
        IF v_old_template.id IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Template not found.', 'code', '404_NOT_FOUND');
        END IF;

        -- Atomic version check
        IF v_old_template.version != v_expected_version THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Stale update rejected: Expected version ' || v_expected_version || ', but template is at version ' || v_old_template.version || '. Please refresh and retry.',
                'code', '409_VERSION_CONFLICT'
            );
        END IF;

        -- Extract fields or preserve existing
        IF p_payload ? 'name' THEN
            v_name := trim(p_payload->>'name');
            IF length(v_name) = 0 THEN
                UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
                RETURN jsonb_build_object('success', false, 'error', 'Template name cannot be empty.', 'code', '400_BAD_REQUEST');
            END IF;
        ELSE
            v_name := v_old_template.name;
        END IF;

        IF p_payload ? 'default_task_title' THEN
            v_default_task_title := trim(p_payload->>'default_task_title');
            IF length(v_default_task_title) = 0 THEN
                UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
                RETURN jsonb_build_object('success', false, 'error', 'Default task title cannot be empty.', 'code', '400_BAD_REQUEST');
            END IF;
        ELSE
            v_default_task_title := v_old_template.default_task_title;
        END IF;

        IF p_payload ? 'department_id' THEN
            v_department_id := (p_payload->>'department_id')::UUID;
            SELECT name INTO v_department_name FROM public.departments WHERE id = v_department_id;
            IF v_department_name IS NULL THEN
                UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
                RETURN jsonb_build_object('success', false, 'error', 'Referenced department does not exist.', 'code', '400_BAD_REQUEST');
            END IF;
        ELSE
            v_department_id := v_old_template.department_id;
        END IF;

        IF p_payload ? 'description' THEN
            v_description := p_payload->>'description';
        ELSE
            v_description := v_old_template.description;
        END IF;

        IF p_payload ? 'task_details' THEN
            v_task_details := p_payload->>'task_details';
        ELSE
            v_task_details := v_old_template.task_details;
        END IF;

        IF p_payload ? 'default_priority' THEN
            v_default_priority := p_payload->>'default_priority';
            IF v_default_priority NOT IN ('Low', 'Normal', 'High', 'Urgent') THEN
                UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
                RETURN jsonb_build_object('success', false, 'error', 'Invalid default priority.', 'code', '400_BAD_REQUEST');
            END IF;
        ELSE
            v_default_priority := v_old_template.default_priority;
        END IF;

        IF p_payload ? 'default_approval_mode' THEN
            v_default_approval_mode := p_payload->>'default_approval_mode';
            IF v_default_approval_mode NOT IN ('Internal Only', 'Client Approval Required') THEN
                UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
                RETURN jsonb_build_object('success', false, 'error', 'Invalid default approval mode.', 'code', '400_BAD_REQUEST');
            END IF;
        ELSE
            v_default_approval_mode := v_old_template.default_approval_mode;
        END IF;

        IF p_payload ? 'suggested_duration_days' THEN
            v_suggested_duration_days := (p_payload->>'suggested_duration_days')::INTEGER;
            IF v_suggested_duration_days < 1 OR v_suggested_duration_days > 30 THEN
                UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
                RETURN jsonb_build_object('success', false, 'error', 'Suggested duration must be between 1 and 30 business days.', 'code', '400_BAD_REQUEST');
            END IF;
        ELSE
            v_suggested_duration_days := v_old_template.suggested_duration_days;
        END IF;

        IF p_payload ? 'sort_order' THEN
            v_sort_order := (p_payload->>'sort_order')::INTEGER;
        ELSE
            v_sort_order := v_old_template.sort_order;
        END IF;

        -- Atomic update with WHERE version check
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

    -- --------------------------------------------------------------------------
    -- ACTION: duplicate
    -- --------------------------------------------------------------------------
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
            name,
            description,
            department_id,
            default_task_title,
            task_details,
            default_priority,
            default_approval_mode,
            suggested_duration_days,
            sort_order,
            status,
            version,
            seed_key,
            created_by,
            updated_by
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
            'Active',
            1,
            NULL,
            p_actor_id,
            p_actor_id
        ) RETURNING * INTO v_template;

        v_entity_id := v_template.id;
        v_entity_name := v_template.name;
        v_previous_state := NULL;
        v_new_state := to_jsonb(v_template);
        v_audit_action := 'template_duplicated';

    -- --------------------------------------------------------------------------
    -- ACTION: archive
    -- --------------------------------------------------------------------------
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

        -- Atomic check for Active status
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

        IF v_template.id IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Conflict: Template is not Active or was modified concurrently.', 'code', '409_STATUS_CONFLICT');
        END IF;

        v_entity_id := v_template.id;
        v_entity_name := v_template.name;
        v_previous_state := to_jsonb(v_old_template);
        v_new_state := to_jsonb(v_template);
        v_audit_action := 'template_archived';

    -- --------------------------------------------------------------------------
    -- ACTION: restore
    -- --------------------------------------------------------------------------
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

        -- Atomic check for Archived status
        IF v_old_template.status != 'Archived' THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Conflict: Template is already active or is not in Archived status.',
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

        IF v_template.id IS NULL THEN
            UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object('success', false, 'error', 'Conflict: Template is not Archived or was modified concurrently.', 'code', '409_STATUS_CONFLICT');
        END IF;

        v_entity_id := v_template.id;
        v_entity_name := v_template.name;
        v_previous_state := to_jsonb(v_old_template);
        v_new_state := to_jsonb(v_template);
        v_audit_action := 'template_restored';

    ELSE
        UPDATE public.template_mutation_requests SET status = 'failed' WHERE actor_id = p_actor_id AND action = p_action AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('success', false, 'error', 'Unsupported mutation action: ' || p_action, 'code', '400_BAD_REQUEST');
    END IF;

    -- 4. Mandatory Audit Event Logging (Inside Same PostgreSQL Transaction)
    INSERT INTO public.system_audit_events (
        actor_id,
        actor_name,
        actor_role,
        action,
        entity_type,
        entity_id,
        entity_name,
        previous_state,
        new_state
    ) VALUES (
        p_actor_id,
        v_actor_profile.full_name,
        v_actor_profile.role,
        v_audit_action,
        'task_template',
        v_entity_id,
        v_entity_name,
        v_previous_state,
        v_new_state
    );

    -- 5. Construct Final Template Representation & Save Completed Idempotency Record
    SELECT name INTO v_department_name FROM public.departments WHERE id = v_template.department_id;

    v_template_json := jsonb_build_object(
        'id', v_template.id,
        'name', v_template.name,
        'description', v_template.description,
        'departmentId', v_template.department_id,
        'departmentName', v_department_name,
        'defaultTaskTitle', v_template.default_task_title,
        'taskDetails', v_template.task_details,
        'defaultPriority', v_template.default_priority,
        'defaultApprovalMode', v_template.default_approval_mode,
        'suggestedDurationDays', v_template.suggested_duration_days,
        'status', v_template.status,
        'sortOrder', v_template.sort_order,
        'version', v_template.version,
        'createdBy', v_template.created_by,
        'updatedBy', v_template.updated_by,
        'archivedAt', v_template.archived_at,
        'archivedBy', v_template.archived_by,
        'archiveReason', v_template.archive_reason,
        'createdAt', v_template.created_at,
        'updatedAt', v_template.updated_at
    );

    v_response_payload := jsonb_build_object(
        'success', true,
        'template', v_template_json
    );

    UPDATE public.template_mutation_requests
    SET status = 'completed',
        resource_id = v_template.id,
        response_payload = v_response_payload,
        completed_at = timezone('utc'::text, now())
    WHERE actor_id = p_actor_id
      AND action = p_action
      AND idempotency_key = p_idempotency_key;

    -- 6. Return Completed Response Payload
    RETURN v_response_payload;
END;
$$;

-- 10. Privileged RPC Function Permissions (Strict Service Role Only)
ALTER FUNCTION public.fn_manage_task_template_mutation(UUID, TEXT, TEXT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_manage_task_template_mutation(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_manage_task_template_mutation(UUID, TEXT, TEXT, JSONB) TO service_role;
