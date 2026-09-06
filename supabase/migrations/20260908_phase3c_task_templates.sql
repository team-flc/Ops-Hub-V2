-- ==============================================================================
-- MIGRATION: 20260908_phase3c_task_templates.sql
-- Phase: 3C — Task Templates System (Multi-Tenant Organization Isolated)
-- Database: PostgreSQL / Supabase
-- ==============================================================================

-- 1. Ensure public.organizations table exists (Safe multi-tenant foundation)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- 2. Create task_templates table with organization ownership
CREATE TABLE IF NOT EXISTS public.task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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

-- 3. Comprehensive independent migration safety for all companion columns & backfill
DO $$
DECLARE
    default_org_id UUID;
BEGIN
    -- Resolve or create default organization for safe backfill
    IF NOT EXISTS (SELECT 1 FROM public.organizations) THEN
        INSERT INTO public.organizations (name, slug)
        VALUES ('FLC Ops Hub', 'flc')
        RETURNING id INTO default_org_id;

        UPDATE public.profiles
        SET organization_id = default_org_id::text
        WHERE role = 'owner' AND (organization_id IS NULL OR organization_id = '');
    ELSE
        SELECT id INTO default_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- Ensure organization_id exists on task_templates
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE public.task_templates ADD COLUMN organization_id UUID;
    END IF;

    -- Safe, unambiguous backfill of existing task_templates rows:
    -- Backfill from creator profile organization_id if valid UUID
    UPDATE public.task_templates tt
    SET organization_id = p.organization_id::uuid
    FROM public.profiles p
    WHERE tt.created_by = p.id
      AND tt.organization_id IS NULL
      AND p.organization_id IS NOT NULL
      AND p.organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    -- If creator profile had no organization_id, use the unambiguous default organization
    UPDATE public.task_templates
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;

    -- Enforce NOT NULL constraint only after backfill
    ALTER TABLE public.task_templates ALTER COLUMN organization_id SET NOT NULL;

    -- Add foreign key constraint if missing
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_task_templates_organization'
    ) THEN
        ALTER TABLE public.task_templates
        ADD CONSTRAINT fk_task_templates_organization
        FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;

    -- Independent column verification for all required columns
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

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'created_at') THEN
        ALTER TABLE public.task_templates ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'updated_at') THEN
        ALTER TABLE public.task_templates ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

-- 4. Stable Named Constraints (avoids duplicate unnamed CHECK constraints)
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

-- 5. Organization-scoped Unique Seed Key & Performance Indexes
DROP INDEX IF EXISTS public.uq_idx_task_templates_seed_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_task_templates_org_seed_key
ON public.task_templates(organization_id, seed_key)
WHERE seed_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_templates_org
ON public.task_templates(organization_id);

CREATE INDEX IF NOT EXISTS idx_task_templates_org_status
ON public.task_templates(organization_id, status, sort_order ASC, name ASC);

CREATE INDEX IF NOT EXISTS idx_task_templates_department
ON public.task_templates(department_id);

-- 6. Companion Columns on client_tasks (Provenance tracking)
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

-- 7. Database-backed Mutation Idempotency Records
CREATE TABLE IF NOT EXISTS public.mutation_idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_id UUID,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_mutation_idempotency UNIQUE (organization_id, actor_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_mutation_idempotency_lookup
ON public.mutation_idempotency_records(organization_id, actor_id, idempotency_key);

-- 8. Add organization_id column to system_audit_events if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'system_audit_events' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE public.system_audit_events ADD COLUMN organization_id UUID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_system_audit_events_org
ON public.system_audit_events(organization_id)
WHERE organization_id IS NOT NULL;

-- 9. Row Level Security on task_templates
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

-- SELECT Policy with Multi-Tenant Isolation:
-- Owner: can select all (Active + Archived) within their same organization
-- Operational Manager: can select Active templates only within their same organization
-- Team Member & Client: denied (fail closed)
DROP POLICY IF EXISTS task_templates_select ON public.task_templates;
CREATE POLICY task_templates_select ON public.task_templates
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.status = 'active'
          AND p.organization_id = task_templates.organization_id::text
          AND (
              p.role = 'owner'
              OR (p.role = 'operational_manager' AND task_templates.status = 'Active')
          )
    )
);

-- 10. Idempotent Starter Seed: Media Buying template per eligible organization
DO $$
DECLARE
    paid_ads_dept_id UUID;
    org_rec RECORD;
    org_owner_id UUID;
    v_seeded_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
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

    -- Iterate over each organization to seed independently
    FOR org_rec IN SELECT id, name FROM public.organizations ORDER BY created_at ASC LOOP
        -- Resolve active Owner profile belonging specifically to this organization
        SELECT p.id INTO org_owner_id
        FROM public.profiles p
        WHERE p.role = 'owner'
          AND p.status = 'active'
          AND p.organization_id = org_rec.id::text
        ORDER BY p.created_at ASC
        LIMIT 1;

        -- Fallback: If no owner has this org_id yet and an active owner has empty/null org_id, associate them
        IF org_owner_id IS NULL THEN
            SELECT p.id INTO org_owner_id
            FROM public.profiles p
            WHERE p.role = 'owner'
              AND p.status = 'active'
              AND (p.organization_id IS NULL OR p.organization_id = '')
            ORDER BY p.created_at ASC
            LIMIT 1;

            IF org_owner_id IS NOT NULL THEN
                UPDATE public.profiles
                SET organization_id = org_rec.id::text
                WHERE id = org_owner_id;
            END IF;
        END IF;

        -- If the organization has no eligible active Owner, skip safely and log behavior
        IF org_owner_id IS NULL THEN
            RAISE NOTICE 'Starter seed skipped for organization "%" (%): No eligible active Owner profile found.', org_rec.name, org_rec.id;
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- If pre-existing template in this organization matches by name without seed_key, backfill seed_key
        UPDATE public.task_templates
        SET seed_key = 'media_buying_campaign_setup_v1'
        WHERE organization_id = org_rec.id
          AND name = 'Media Buying Campaign Setup & Launch'
          AND seed_key IS NULL;

        -- Insert starter template only if seed_key does not already exist in this organization
        IF NOT EXISTS (
            SELECT 1 FROM public.task_templates
            WHERE organization_id = org_rec.id
              AND seed_key = 'media_buying_campaign_setup_v1'
        ) THEN
            INSERT INTO public.task_templates (
                organization_id,
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
                org_rec.id,
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
                org_owner_id,
                org_owner_id
            );
            v_seeded_count := v_seeded_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'Starter seed complete: % organization(s) seeded, % skipped.', v_seeded_count, v_skipped_count;
END $$;
