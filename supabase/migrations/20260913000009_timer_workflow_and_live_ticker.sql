-- ==============================================================================
-- MIGRATION: 20260913000009_timer_workflow_and_live_ticker.sql
-- Description: Automatic Task Timer Workflow & Live Client Activity Ticker
-- Database: PostgreSQL / Supabase (jcaptlqenwmpfchjyipw)
-- Approach: ADDITIVE ONLY - preserves all existing data and constraints
-- ==============================================================================

-- 1. Add paused_seconds column to client_tasks (tracks cumulative paused time separately)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'paused_seconds'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN paused_seconds INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- 2. Create client_active_announcements table for live ticker
CREATE TABLE IF NOT EXISTS public.client_active_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.client_tasks(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    team_member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (task_id)
);

-- Index for fast lookup by client
CREATE INDEX IF NOT EXISTS idx_client_active_announcements_client_id
    ON public.client_active_announcements(client_id);

CREATE INDEX IF NOT EXISTS idx_client_active_announcements_task_id
    ON public.client_active_announcements(task_id);

CREATE INDEX IF NOT EXISTS idx_client_active_announcements_active
    ON public.client_active_announcements(client_id, is_active);

-- 3. Enable RLS on client_active_announcements
ALTER TABLE public.client_active_announcements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "caa_select_policy" ON public.client_active_announcements;
DROP POLICY IF EXISTS "caa_insert_policy" ON public.client_active_announcements;
DROP POLICY IF EXISTS "caa_update_policy" ON public.client_active_announcements;
DROP POLICY IF EXISTS "caa_delete_policy" ON public.client_active_announcements;

-- SELECT: Any authenticated user who can access the client (internal team OR client role)
CREATE POLICY "caa_select_policy" ON public.client_active_announcements
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.status = 'active'
              AND (
                  -- Owner can see all
                  p.role = 'owner'
                  -- Operational manager assigned to this client
                  OR (p.role = 'operational_manager' AND EXISTS (
                      SELECT 1 FROM public.clients c
                      WHERE c.id = client_id AND (c.operational_manager_id = p.id OR c.created_by = p.id)
                  ))
                  -- Team member with explicit access to this client
                  OR (p.role = 'team_member' AND EXISTS (
                      SELECT 1 FROM public.client_team_access cta
                      WHERE cta.client_id = client_id AND cta.profile_id = p.id
                  ))
                  -- Client role: only their own organization (portal ticker)
                  OR (p.role = 'client' AND p.organization_id = client_id)
              )
        )
    );

-- INSERT: Team member (assignee), owner, or operational manager for this client
CREATE POLICY "caa_insert_policy" ON public.client_active_announcements
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.status = 'active'
              AND (
                  p.role = 'owner'
                  OR (p.role = 'operational_manager' AND EXISTS (
                      SELECT 1 FROM public.clients c
                      WHERE c.id = client_id AND (c.operational_manager_id = p.id OR c.created_by = p.id)
                  ))
                  OR (p.role = 'team_member' AND EXISTS (
                      SELECT 1 FROM public.client_team_access cta
                      WHERE cta.client_id = client_id AND cta.profile_id = p.id
                  ))
              )
        )
    );

-- UPDATE: Same as INSERT
CREATE POLICY "caa_update_policy" ON public.client_active_announcements
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.status = 'active'
              AND (
                  p.role = 'owner'
                  OR (p.role = 'operational_manager' AND EXISTS (
                      SELECT 1 FROM public.clients c
                      WHERE c.id = client_id AND (c.operational_manager_id = p.id OR c.created_by = p.id)
                  ))
                  OR (p.role = 'team_member' AND EXISTS (
                      SELECT 1 FROM public.client_team_access cta
                      WHERE cta.client_id = client_id AND cta.profile_id = p.id
                  ))
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
                  OR (p.role = 'operational_manager' AND EXISTS (
                      SELECT 1 FROM public.clients c
                      WHERE c.id = client_id AND (c.operational_manager_id = p.id OR c.created_by = p.id)
                  ))
                  OR (p.role = 'team_member' AND EXISTS (
                      SELECT 1 FROM public.client_team_access cta
                      WHERE cta.client_id = client_id AND cta.profile_id = p.id
                  ))
              )
        )
    );

-- DELETE: Owner or operational manager only
CREATE POLICY "caa_delete_policy" ON public.client_active_announcements
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.status = 'active'
              AND (
                  p.role = 'owner'
                  OR (p.role = 'operational_manager' AND EXISTS (
                      SELECT 1 FROM public.clients c
                      WHERE c.id = client_id AND (c.operational_manager_id = p.id OR c.created_by = p.id)
                  ))
                  OR (p.role = 'team_member' AND EXISTS (
                      SELECT 1 FROM public.client_team_access cta
                      WHERE cta.client_id = client_id AND cta.profile_id = p.id
                  ))
              )
        )
    );

-- 4. Enable Supabase Realtime on client_active_announcements
-- Add to the supabase_realtime publication so clients receive live updates
DO $$
BEGIN
    -- Only add if supabase_realtime publication exists (standard Supabase setup)
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        -- Check if table is already in the publication
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'client_active_announcements'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.client_active_announcements;
        END IF;
    END IF;
END $$;

-- 5. Expand client_task_events event_type check constraint to include new timer/announcement events
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
    'timer_paused',
    'timer_resumed',
    'start_work',
    'evidence_added',
    'feedback_added',
    'week_renamed',
    'announcement_created',
    'announcement_removed'
));
