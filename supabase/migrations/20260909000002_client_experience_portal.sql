-- ==============================================================================
-- MIGRATION: 20260909000002_client_experience_portal.sql
-- Description: Client Experience Portal Additive Schema
--              - Client Task publication visibility boundary (is_client_visible)
--              - Client Portal Recipients explicit registry and governance
--              - Verified Published Business Results (client_published_results)
--              - Hardened RLS policies preserving zero anonymous access
-- Target Database: PostgreSQL 15+ / Supabase Auth
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TASK PUBLICATION VISIBILITY BOUNDARY
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'is_client_visible'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN is_client_visible BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_tasks_client_visibility 
ON public.client_tasks(client_id, is_client_visible) 
WHERE archived_at IS NULL;

-- ------------------------------------------------------------------------------
-- 2. CLIENT PORTAL APPROVED RECIPIENTS REGISTRY
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.client_portal_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT chk_recipient_email CHECK (length(trim(email)) > 0 AND email LIKE '%@%'),
    CONSTRAINT chk_recipient_name CHECK (length(trim(full_name)) > 0),
    CONSTRAINT uq_client_recipient_email UNIQUE (client_id, email)
);

CREATE INDEX IF NOT EXISTS idx_portal_recipients_client 
ON public.client_portal_recipients(client_id, status);

CREATE INDEX IF NOT EXISTS idx_portal_recipients_email 
ON public.client_portal_recipients(email);

-- ------------------------------------------------------------------------------
-- 3. VERIFIED PUBLISHED BUSINESS RESULTS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.client_published_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value TEXT NOT NULL,
    metric_definition TEXT NOT NULL,
    reporting_period TEXT NOT NULL,
    period_start_date DATE,
    period_end_date DATE,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'archived')),
    published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT chk_published_results_metric CHECK (length(trim(metric_name)) > 0 AND length(metric_name) <= 120),
    CONSTRAINT chk_published_results_val CHECK (length(trim(metric_value)) > 0 AND length(metric_value) <= 60),
    CONSTRAINT chk_published_results_src CHECK (length(trim(source)) > 0 AND length(source) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_published_results_client_status 
ON public.client_published_results(client_id, status);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.client_portal_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_published_results ENABLE ROW LEVEL SECURITY;

-- 4.1 client_portal_recipients RLS
DROP POLICY IF EXISTS "portal_recipients_select" ON public.client_portal_recipients;
CREATE POLICY "portal_recipients_select" ON public.client_portal_recipients
FOR SELECT TO authenticated
USING (
    app_private.can_access_client(client_id)
);

DROP POLICY IF EXISTS "portal_recipients_owner_manage" ON public.client_portal_recipients;
CREATE POLICY "portal_recipients_owner_manage" ON public.client_portal_recipients
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.role = 'owner' AND p.status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.role = 'owner' AND p.status = 'active'
    )
);

-- 4.2 client_published_results RLS
DROP POLICY IF EXISTS "published_results_select" ON public.client_published_results;
CREATE POLICY "published_results_select" ON public.client_published_results
FOR SELECT TO authenticated
USING (
    app_private.can_access_client(client_id)
    AND (
        status = 'published'
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid()) AND p.role IN ('owner', 'operational_manager', 'team_member') AND p.status = 'active'
        )
    )
);

DROP POLICY IF EXISTS "published_results_manage" ON public.client_published_results;
CREATE POLICY "published_results_manage" ON public.client_published_results
FOR ALL TO authenticated
USING (
    app_private.can_manage_client(client_id)
)
WITH CHECK (
    app_private.can_manage_client(client_id)
);

-- 4.3 Update client_tasks SELECT RLS with publication boundary for clients
DROP POLICY IF EXISTS "client_tasks_select" ON public.client_tasks;
CREATE POLICY "client_tasks_select" ON public.client_tasks
FOR SELECT TO authenticated
USING (
    app_private.can_access_client(client_id)
    AND (
        -- Staff roles can view all tasks in client scope
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid()) 
              AND p.status = 'active' 
              AND p.role IN ('owner', 'operational_manager', 'team_member')
        )
        -- Client role strictly restricted to published or review/completed tasks
        OR (
            is_client_visible = true 
            OR status IN ('Client Review', 'Completed')
        )
    )
);

-- ------------------------------------------------------------------------------
-- 5. ROLLBACK SCRIPT (FORWARD-SAFE, PRESERVES EXISTING TABLES)
-- ------------------------------------------------------------------------------
/*
BEGIN;
    -- Revert client_tasks SELECT policy to Phase 3A/3B state
    DROP POLICY IF EXISTS "client_tasks_select" ON public.client_tasks;
    CREATE POLICY "client_tasks_select" ON public.client_tasks
    FOR SELECT TO authenticated
    USING (app_private.can_access_client(client_id));

    DROP TABLE IF EXISTS public.client_published_results CASCADE;
    DROP TABLE IF EXISTS public.client_portal_recipients CASCADE;
    DROP INDEX IF EXISTS idx_client_tasks_client_visibility;
    ALTER TABLE public.client_tasks DROP COLUMN IF EXISTS is_client_visible;
COMMIT;
*/
