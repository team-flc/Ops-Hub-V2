-- ==============================================================================
-- MIGRATION: 20260908_phase3c_task_templates.sql
-- Phase: 3C — Task Templates System
-- Database: PostgreSQL / Supabase
-- ==============================================================================

-- 1. Create task_templates table (independently idempotent)
CREATE TABLE IF NOT EXISTS public.task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 200),
    description TEXT,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    default_task_title TEXT NOT NULL CHECK (length(trim(default_task_title)) > 0 AND length(default_task_title) <= 200),
    task_details TEXT,
    default_priority TEXT NOT NULL DEFAULT 'Normal' CHECK (default_priority IN ('Low', 'Normal', 'High', 'Urgent')),
    default_approval_mode TEXT NOT NULL DEFAULT 'Internal Only' CHECK (default_approval_mode IN ('Internal Only', 'Client Approval Required')),
    suggested_duration_days INTEGER NOT NULL DEFAULT 3 CHECK (suggested_duration_days >= 1 AND suggested_duration_days <= 30),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    seed_key TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    archive_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure all companion columns exist idempotently if table was pre-existing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'description') THEN
        ALTER TABLE public.task_templates ADD COLUMN description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'task_details') THEN
        ALTER TABLE public.task_templates ADD COLUMN task_details TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'default_priority') THEN
        ALTER TABLE public.task_templates ADD COLUMN default_priority TEXT NOT NULL DEFAULT 'Normal' CHECK (default_priority IN ('Low', 'Normal', 'High', 'Urgent'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'default_approval_mode') THEN
        ALTER TABLE public.task_templates ADD COLUMN default_approval_mode TEXT NOT NULL DEFAULT 'Internal Only' CHECK (default_approval_mode IN ('Internal Only', 'Client Approval Required'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'suggested_duration_days') THEN
        ALTER TABLE public.task_templates ADD COLUMN suggested_duration_days INTEGER NOT NULL DEFAULT 3 CHECK (suggested_duration_days >= 1 AND suggested_duration_days <= 30);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'status') THEN
        ALTER TABLE public.task_templates ADD COLUMN status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'sort_order') THEN
        ALTER TABLE public.task_templates ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'version') THEN
        ALTER TABLE public.task_templates ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);
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
END $$;

-- Unique constraint on seed_key for idempotent starter seeds even after rename
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_task_templates_seed_key
ON public.task_templates(seed_key)
WHERE seed_key IS NOT NULL;

-- Indexes for performance and filtering
CREATE INDEX IF NOT EXISTS idx_task_templates_department
ON public.task_templates(department_id);

CREATE INDEX IF NOT EXISTS idx_task_templates_status
ON public.task_templates(status, sort_order ASC, name ASC);

-- 2. Extend client_tasks with provenance columns (independently idempotent)
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

-- 3. Enable Row Level Security on task_templates
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for task_templates
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

-- SELECT Policy:
-- Owner: can select all (Active + Archived)
-- Operational Manager: can select Active templates only
-- Team Member & Client: denied
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

-- 5. Idempotent Seed: Starter Media Buying template
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

    -- Look up an active Owner profile ID
    SELECT id INTO system_owner_id
    FROM public.profiles
    WHERE role = 'owner' AND status = 'active'
    LIMIT 1;

    -- If the template was already seeded previously by name without seed_key, backfill its seed_key
    UPDATE public.task_templates
    SET seed_key = 'media_buying_campaign_setup_v1'
    WHERE name = 'Media Buying Campaign Setup & Launch'
      AND seed_key IS NULL;

    -- Insert starter template using seed_key idempotency check (immune to rename)
    IF paid_ads_dept_id IS NOT NULL THEN
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
        END IF;
    END IF;
END $$;
