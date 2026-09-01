-- ==============================================================================
-- MIGRATION: 20260901_phase3a_operational_task_core.sql
-- Description: Phase 3A Operational Task Management Core schema, RLS, and audit trail
-- Database: PostgreSQL / Supabase (jcaptlqenwmpfchjyipw)
-- ==============================================================================

-- 1. Create client_tasks table
CREATE TABLE IF NOT EXISTS public.client_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 4),
    title TEXT NOT NULL,
    details TEXT,
    department_id UUID NOT NULL REFERENCES public.departments(id),
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    planned_start TIMESTAMPTZ NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Assigned', 'In Progress', 'Blocked', 'Team Review')),
    blocked_reason TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    archive_reason TEXT,
    
    -- Constraints
    CONSTRAINT chk_task_due_after_start CHECK (due_date > planned_start),
    CONSTRAINT chk_task_blocked_reason CHECK (status != 'Blocked' OR (blocked_reason IS NOT NULL AND length(trim(blocked_reason)) > 0)),
    CONSTRAINT chk_task_archive_reason CHECK (archived_at IS NULL OR (archive_reason IS NOT NULL AND length(trim(archive_reason)) > 0))
);

-- Indexes for client_tasks
CREATE INDEX IF NOT EXISTS idx_client_tasks_client_week ON public.client_tasks(client_id, week_number) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_tasks_assignee ON public.client_tasks(assignee_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_tasks_due_date ON public.client_tasks(due_date) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_tasks_status ON public.client_tasks(status) WHERE archived_at IS NULL;

-- 2. Create client_task_events table (Append-only audit trail)
CREATE TABLE IF NOT EXISTS public.client_task_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.client_tasks(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'created', 
        'field_updated', 
        'assigned', 
        'reassigned', 
        'status_changed', 
        'blocked', 
        'unblocked', 
        'submitted_for_review', 
        'review_returned', 
        'archived'
    )),
    previous_state JSONB,
    new_state JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for client_task_events
CREATE INDEX IF NOT EXISTS idx_client_task_events_task_id ON public.client_task_events(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_task_events_client_id ON public.client_task_events(client_id, created_at DESC);

-- 3. Security Helper Functions
CREATE OR REPLACE FUNCTION app_private.can_access_client(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.status = 'active' AND (
      p.role = 'owner'
      OR (
        p.role = 'operational_manager' AND EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = target_client_id 
            AND (c.operational_manager_id = p.id OR c.created_by = p.id)
        )
      )
      OR (
        p.role = 'team_member' AND EXISTS (
          SELECT 1 FROM public.client_team_access cta
          WHERE cta.client_id = target_client_id AND cta.profile_id = p.id
        )
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.can_access_client(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.can_manage_client(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.status = 'active' AND (
      p.role = 'owner'
      OR (
        p.role = 'operational_manager' AND EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = target_client_id 
            AND (c.operational_manager_id = p.id OR c.created_by = p.id)
        )
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.can_manage_client(UUID) TO authenticated;

-- 4. Enable RLS
ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_task_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for client_tasks
DROP POLICY IF EXISTS "client_tasks_select" ON public.client_tasks;
CREATE POLICY "client_tasks_select" ON public.client_tasks
FOR SELECT TO authenticated
USING (
    app_private.can_access_client(client_id)
);

DROP POLICY IF EXISTS "client_tasks_insert" ON public.client_tasks;
CREATE POLICY "client_tasks_insert" ON public.client_tasks
FOR INSERT TO authenticated
WITH CHECK (
    app_private.can_manage_client(client_id)
);

DROP POLICY IF EXISTS "client_tasks_update" ON public.client_tasks;
CREATE POLICY "client_tasks_update" ON public.client_tasks
FOR UPDATE TO authenticated
USING (
    app_private.can_access_client(client_id)
)
WITH CHECK (
    app_private.can_manage_client(client_id)
    OR (
        assignee_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = (SELECT auth.uid()) AND p.role = 'team_member' AND p.status = 'active'
        )
    )
);

DROP POLICY IF EXISTS "client_tasks_delete_deny" ON public.client_tasks;
CREATE POLICY "client_tasks_delete_deny" ON public.client_tasks
FOR DELETE TO authenticated
USING (false);

-- 6. RLS Policies for client_task_events
DROP POLICY IF EXISTS "client_task_events_select" ON public.client_task_events;
CREATE POLICY "client_task_events_select" ON public.client_task_events
FOR SELECT TO authenticated
USING (
    app_private.can_access_client(client_id)
);

DROP POLICY IF EXISTS "client_task_events_insert" ON public.client_task_events;
CREATE POLICY "client_task_events_insert" ON public.client_task_events
FOR INSERT TO authenticated
WITH CHECK (
    app_private.can_access_client(client_id)
);

DROP POLICY IF EXISTS "client_task_events_delete_deny" ON public.client_task_events;
CREATE POLICY "client_task_events_delete_deny" ON public.client_task_events
FOR DELETE TO authenticated
USING (false);

DROP POLICY IF EXISTS "client_task_events_update_deny" ON public.client_task_events;
CREATE POLICY "client_task_events_update_deny" ON public.client_task_events
FOR UPDATE TO authenticated
USING (false);
