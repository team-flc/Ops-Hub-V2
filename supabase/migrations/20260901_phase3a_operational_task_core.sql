-- ==============================================================================
-- FORWARD MIGRATION: Phase 3A Operational Task Management Core Schema & RLS
-- Location: supabase/migrations/20260901_phase3a_operational_task_core.sql
-- Database: PostgreSQL / Supabase (jcaptlqenwmpfchjyipw)
-- Target: Phase 3A Production Operational Tasks, Week 1-4 Setup & Event Audit
-- ==============================================================================

-- 1. Create public.client_tasks Table
CREATE TABLE IF NOT EXISTS public.client_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  week_number INT NOT NULL CHECK (week_number IN (1, 2, 3, 4)),
  title TEXT NOT NULL,
  details TEXT,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
  planned_start TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Assigned', 'In Progress', 'Blocked', 'Team Review')),
  blocked_reason TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  archive_reason TEXT,
  CONSTRAINT chk_task_due_after_start CHECK (due_date > planned_start),
  CONSTRAINT chk_task_blocked_reason CHECK (
    (status = 'Blocked' AND blocked_reason IS NOT NULL AND length(trim(blocked_reason)) > 0)
    OR (status != 'Blocked')
  ),
  CONSTRAINT chk_task_archive_reason CHECK (
    (archived_at IS NOT NULL AND archive_reason IS NOT NULL AND length(trim(archive_reason)) > 0)
    OR (archived_at IS NULL)
  )
);

-- Indexes for high-performance task queries and filtering
CREATE INDEX IF NOT EXISTS idx_client_tasks_client_week ON public.client_tasks(client_id, week_number) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_tasks_assignee ON public.client_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_client_tasks_dept ON public.client_tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_client_tasks_status ON public.client_tasks(status);
CREATE INDEX IF NOT EXISTS idx_client_tasks_due ON public.client_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_client_tasks_archived ON public.client_tasks(archived_at);

-- 2. Create public.client_task_events Table (Immutable Audit Trail)
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
  previous_state JSONB DEFAULT '{}'::jsonb,
  new_state JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_events_task ON public.client_task_events(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_events_client ON public.client_task_events(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_events_actor ON public.client_task_events(actor_id, created_at DESC);

-- 3. Automatic Updated Timestamp Trigger
CREATE OR REPLACE FUNCTION app_private.handle_client_task_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_client_task_updated_at ON public.client_tasks;
CREATE TRIGGER tr_client_task_updated_at
  BEFORE UPDATE ON public.client_tasks
  FOR EACH ROW
  EXECUTE FUNCTION app_private.handle_client_task_updated_at();

-- ==============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ==============================================================================

-- A. CLIENT TASKS TABLE
ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_tasks_select" ON public.client_tasks;
DROP POLICY IF EXISTS "client_tasks_insert" ON public.client_tasks;
DROP POLICY IF EXISTS "client_tasks_update" ON public.client_tasks;
DROP POLICY IF EXISTS "client_tasks_delete" ON public.client_tasks;

-- Read Access: Owner, authorized Operational Manager, or assigned Team Member with client grant
CREATE POLICY "client_tasks_select"
  ON public.client_tasks
  FOR SELECT
  TO authenticated
  USING (
    app_private.can_access_client(auth.uid(), client_id)
  );

-- Insert Access: Owner or authorized Operational Manager for this client
CREATE POLICY "client_tasks_insert"
  ON public.client_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    app_private.can_manage_client(auth.uid(), client_id)
  );

-- Update Access: Owner, authorized Manager, or assigned Team Member
CREATE POLICY "client_tasks_update"
  ON public.client_tasks
  FOR UPDATE
  TO authenticated
  USING (
    app_private.can_manage_client(auth.uid(), client_id)
    OR (
      assignee_id = auth.uid() 
      AND archived_at IS NULL
      AND app_private.can_access_client(auth.uid(), client_id)
    )
  )
  WITH CHECK (
    app_private.can_manage_client(auth.uid(), client_id)
    OR (
      assignee_id = auth.uid() 
      AND archived_at IS NULL
      AND app_private.can_access_client(auth.uid(), client_id)
    )
  );

-- Delete Policy: Strictly Disallow Hard Delete
CREATE POLICY "client_tasks_delete"
  ON public.client_tasks
  FOR DELETE
  TO authenticated
  USING (false);

-- B. CLIENT TASK EVENTS TABLE (Immutable Audit Trail)
ALTER TABLE public.client_task_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_task_events_select" ON public.client_task_events;
DROP POLICY IF EXISTS "client_task_events_insert" ON public.client_task_events;
DROP POLICY IF EXISTS "client_task_events_update" ON public.client_task_events;
DROP POLICY IF EXISTS "client_task_events_delete" ON public.client_task_events;

CREATE POLICY "client_task_events_select"
  ON public.client_task_events
  FOR SELECT
  TO authenticated
  USING (
    app_private.can_access_client(auth.uid(), client_id)
  );

CREATE POLICY "client_task_events_insert"
  ON public.client_task_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    app_private.can_access_client(auth.uid(), client_id)
  );

CREATE POLICY "client_task_events_update"
  ON public.client_task_events
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "client_task_events_delete"
  ON public.client_task_events
  FOR DELETE
  TO authenticated
  USING (false);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
