-- ==============================================================================
-- MIGRATION: 20260913000008_week_workflow_and_kanban_board.sql
-- Description: Week Workflow UI, Client Weeks, and 4-Column Kanban Task Board
-- Database: PostgreSQL / Supabase (jcaptlqenwmpfchjyipw)
-- ==============================================================================

-- 1. Create client_weeks table for per-client week names
CREATE TABLE IF NOT EXISTS public.client_weeks (
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 4),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (client_id, week_number)
);

-- Index for fast lookup by client
CREATE INDEX IF NOT EXISTS idx_client_weeks_client_id ON public.client_weeks(client_id);

-- Enable RLS on client_weeks
ALTER TABLE public.client_weeks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "client_weeks_select_policy" ON public.client_weeks;
DROP POLICY IF EXISTS "client_weeks_insert_policy" ON public.client_weeks;
DROP POLICY IF EXISTS "client_weeks_update_policy" ON public.client_weeks;
DROP POLICY IF EXISTS "client_weeks_delete_policy" ON public.client_weeks;

-- Select policy: any user with access to the client
CREATE POLICY "client_weeks_select_policy" ON public.client_weeks
    FOR SELECT
    TO authenticated
    USING (
        app_private.can_access_client(client_id)
    );

-- Insert/Update/Delete policies: Only Owner or Operational Manager of the client
CREATE POLICY "client_weeks_insert_policy" ON public.client_weeks
    FOR INSERT
    TO authenticated
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
                          SELECT 1 FROM public.clients c
                          WHERE c.id = client_id
                            AND (c.operational_manager_id = p.id OR c.created_by = p.id)
                      )
                  )
              )
        )
    );

CREATE POLICY "client_weeks_update_policy" ON public.client_weeks
    FOR UPDATE
    TO authenticated
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
                          WHERE c.id = client_id
                            AND (c.operational_manager_id = p.id OR c.created_by = p.id)
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
                          SELECT 1 FROM public.clients c
                          WHERE c.id = client_id
                            AND (c.operational_manager_id = p.id OR c.created_by = p.id)
                      )
                  )
              )
        )
    );

-- Populate default week names for all existing clients
INSERT INTO public.client_weeks (client_id, week_number, name)
SELECT c.id, w.week_num, w.default_name
FROM public.clients c
CROSS JOIN (
    VALUES
        (1, 'Social Media Optimization'),
        (2, 'LinkedIn Optimization'),
        (3, 'Funnel Setup'),
        (4, 'Paid Ads Setup')
) AS w(week_num, default_name)
ON CONFLICT (client_id, week_number) DO NOTHING;

-- 2. Add additive columns to client_tasks for Kanban workflow, timer, evidence, and feedback
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'time_spent_seconds'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN time_spent_seconds INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'timer_started_at'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN timer_started_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'evidence_url'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN evidence_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'completion_notes'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN completion_notes TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'feedback'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN feedback TEXT;
    END IF;
END $$;

-- 3. Update client_tasks status check constraint to include new Kanban statuses ('Pending', 'In Progress', 'Approval', 'Done') while preserving legacy status compatibility
ALTER TABLE public.client_tasks DROP CONSTRAINT IF EXISTS client_tasks_status_check;
ALTER TABLE public.client_tasks ADD CONSTRAINT client_tasks_status_check
CHECK (status IN (
    'Pending',
    'In Progress',
    'Approval',
    'Done',
    'Draft',
    'Assigned',
    'Blocked',
    'Team Review',
    'Client Review',
    'Completed'
));

-- 4. Safely map existing tasks to Pending / Approval / Done
UPDATE public.client_tasks
SET status = 'Pending'
WHERE status IN ('Draft', 'Assigned', 'Blocked');

UPDATE public.client_tasks
SET status = 'Approval'
WHERE status IN ('Team Review', 'Client Review');

UPDATE public.client_tasks
SET status = 'Done'
WHERE status = 'Completed';

-- 5. Expand client_task_events event_type check constraint
ALTER TABLE public.client_task_events DROP CONSTRAINT IF EXISTS client_task_events_event_type_check;
ALTER TABLE public.client_task_events ADD CONSTRAINT client_task_events_event_type_check
CHECK (event_type IN (
    'created',
    'field_updated',
    'assigned',
    'reassigned',
    'status_changed',
    'blocked',
    'unblocked',
    'submitted_for_review',
    'review_returned',
    'changes_requested',
    'client_review_submitted',
    'client_approved',
    'client_approval_override',
    'client_changes_requested',
    'completed',
    'reopened',
    'archived',
    'restored',
    'timer_started',
    'timer_stopped',
    'evidence_added',
    'feedback_added',
    'week_renamed'
));
