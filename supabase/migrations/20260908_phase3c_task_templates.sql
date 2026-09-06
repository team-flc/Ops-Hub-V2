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
