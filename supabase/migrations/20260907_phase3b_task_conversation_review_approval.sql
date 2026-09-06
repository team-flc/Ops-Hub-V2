-- ==============================================================================
-- MIGRATION: 20260907_phase3b_task_conversation_review_approval.sql
-- Phase: 3B — Task Conversation Feed, Review & Approval
-- Database: PostgreSQL / Supabase
-- ==============================================================================

-- 1. Extend client_tasks with approval mode and completion/reopening columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'approval_mode'
    ) THEN
        ALTER TABLE public.client_tasks
        ADD COLUMN approval_mode TEXT NOT NULL DEFAULT 'Internal Only'
        CHECK (approval_mode IN ('Internal Only', 'Client Approval Required'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'completed_at'
    ) THEN
        ALTER TABLE public.client_tasks
        ADD COLUMN completed_at TIMESTAMPTZ,
        ADD COLUMN completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'reopened_at'
    ) THEN
        ALTER TABLE public.client_tasks
        ADD COLUMN reopened_at TIMESTAMPTZ,
        ADD COLUMN reopened_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        ADD COLUMN reopen_reason TEXT;
    END IF;
END $$;

-- 2. Expand client_tasks status check constraint to include Client Review and Completed
ALTER TABLE public.client_tasks DROP CONSTRAINT IF EXISTS client_tasks_status_check;
ALTER TABLE public.client_tasks ADD CONSTRAINT client_tasks_status_check
CHECK (status IN ('Draft', 'Assigned', 'In Progress', 'Blocked', 'Team Review', 'Client Review', 'Completed'));

-- 3. Expand client_task_events event_type check constraint
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
    'client_changes_requested',
    'completed',
    'reopened',
    'archived',
    'restored'
));

-- 4. Create client_task_messages table (Append-only human comments + external HTTPS links)
CREATE TABLE IF NOT EXISTS public.client_task_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.client_tasks(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    visibility TEXT NOT NULL CHECK (visibility IN ('internal_note', 'shared_with_client')),
    content TEXT NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 5000),
    links JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_client_task_messages_task_feed
ON public.client_task_messages(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_task_messages_client
ON public.client_task_messages(client_id);

-- 5. Immutability Trigger for client_task_messages (Strictly append-only)
CREATE OR REPLACE FUNCTION public.prevent_task_message_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE EXCEPTION 'Task messages are append-only. Updates and deletions are strictly forbidden.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_task_message_tampering ON public.client_task_messages;
CREATE TRIGGER trg_prevent_task_message_tampering
BEFORE UPDATE OR DELETE ON public.client_task_messages
FOR EACH ROW
EXECUTE FUNCTION public.prevent_task_message_tampering();

-- 6. Create client_task_read_states table (One row per user/task)
CREATE TABLE IF NOT EXISTS public.client_task_read_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.client_tasks(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_task_read_state_user UNIQUE (task_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_client_task_read_states_user
ON public.client_task_read_states(profile_id, task_id);

-- 7. Update can_access_client helper to support client role mapping
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
      OR (
        p.role = 'client' AND (p.organization_id = target_client_id::text)
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.can_access_client(UUID) TO authenticated;

-- 8. Enable Row Level Security
ALTER TABLE public.client_task_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_task_read_states ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for client_task_messages
-- Deny direct client/authenticated mutations (enforces Edge Function server-authoritative logic)
DROP POLICY IF EXISTS client_task_messages_insert_deny ON public.client_task_messages;
CREATE POLICY client_task_messages_insert_deny ON public.client_task_messages
FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS client_task_messages_update_deny ON public.client_task_messages;
CREATE POLICY client_task_messages_update_deny ON public.client_task_messages
FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS client_task_messages_delete_deny ON public.client_task_messages;
CREATE POLICY client_task_messages_delete_deny ON public.client_task_messages
FOR DELETE TO authenticated USING (false);

-- SELECT Policy: Client sees only shared_with_client; Staff sees both internal_note and shared_with_client
DROP POLICY IF EXISTS client_task_messages_select ON public.client_task_messages;
CREATE POLICY client_task_messages_select ON public.client_task_messages
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.status = 'active' AND (
            (p.role = 'owner')
            OR (p.role = 'operational_manager' AND EXISTS (
                SELECT 1 FROM public.clients c
                WHERE c.id = client_task_messages.client_id
                  AND (c.operational_manager_id = p.id OR c.created_by = p.id)
            ))
            OR (p.role = 'team_member' AND EXISTS (
                SELECT 1 FROM public.client_team_access cta
                WHERE cta.client_id = client_task_messages.client_id AND cta.profile_id = p.id
            ))
            OR (p.role = 'client' AND (p.organization_id = client_task_messages.client_id::text) AND client_task_messages.visibility = 'shared_with_client')
        )
    )
);

-- 10. RLS Policies for client_task_read_states (Scoped to auth.uid())
DROP POLICY IF EXISTS client_task_read_states_select ON public.client_task_read_states;
CREATE POLICY client_task_read_states_select ON public.client_task_read_states
FOR SELECT TO authenticated
USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS client_task_read_states_insert ON public.client_task_read_states;
CREATE POLICY client_task_read_states_insert ON public.client_task_read_states
FOR INSERT TO authenticated
WITH CHECK (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS client_task_read_states_update ON public.client_task_read_states;
CREATE POLICY client_task_read_states_update ON public.client_task_read_states
FOR UPDATE TO authenticated
USING (profile_id = (SELECT auth.uid()))
WITH CHECK (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS client_task_read_states_delete_deny ON public.client_task_read_states;
CREATE POLICY client_task_read_states_delete_deny ON public.client_task_read_states
FOR DELETE TO authenticated
USING (false);
