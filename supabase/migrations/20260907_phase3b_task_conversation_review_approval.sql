-- ==============================================================================
-- MIGRATION: 20260907_phase3b_task_conversation_review_approval.sql
-- Phase: 3B — Task Conversation Feed, Review & Approval
-- Database: PostgreSQL / Supabase
-- ==============================================================================

-- 1. Extend client_tasks with approval mode and completion/reopening columns
-- Each column addition is independently idempotent to handle partial applications safely.
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
        ALTER TABLE public.client_tasks ADD COLUMN completed_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'completed_by'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'reopened_at'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN reopened_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'reopened_by'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN reopened_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_tasks' AND column_name = 'reopen_reason'
    ) THEN
        ALTER TABLE public.client_tasks ADD COLUMN reopen_reason TEXT;
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
    'client_approval_override',
    'client_changes_requested',
    'completed',
    'reopened',
    'archived',
    'restored'
));

-- 4. JSON Link Structure Validator
CREATE OR REPLACE FUNCTION public.validate_task_message_links(links JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    elem JSONB;
BEGIN
    IF links IS NULL THEN
        RETURN TRUE;
    END IF;
    IF jsonb_typeof(links) <> 'array' THEN
        RETURN FALSE;
    END IF;
    IF jsonb_array_length(links) > 5 THEN
        RETURN FALSE;
    END IF;
    FOR elem IN SELECT * FROM jsonb_array_elements(links) LOOP
        IF jsonb_typeof(elem) <> 'object' THEN
            RETURN FALSE;
        END IF;
        IF NOT (elem ? 'url') OR jsonb_typeof(elem->'url') <> 'string' OR length(elem->>'url') = 0 OR length(elem->>'url') > 2048 THEN
            RETURN FALSE;
        END IF;
        IF elem ? 'title' AND jsonb_typeof(elem->'title') <> 'string' THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    RETURN TRUE;
END;
$$;

-- 5. Create client_task_messages table (Append-only human comments + external HTTPS links)
CREATE TABLE IF NOT EXISTS public.client_task_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.client_tasks(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    visibility TEXT NOT NULL CHECK (visibility IN ('internal_note', 'shared_with_client')),
    content TEXT NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 5000),
    links JSONB NOT NULL DEFAULT '[]'::jsonb,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_client_task_messages_links CHECK (public.validate_task_message_links(links))
);

CREATE INDEX IF NOT EXISTS idx_client_task_messages_task_feed
ON public.client_task_messages(task_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_client_task_messages_client
ON public.client_task_messages(client_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_task_messages_idempotency
ON public.client_task_messages(task_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 6. Enforce task_id and client_id agreement trigger
CREATE OR REPLACE FUNCTION public.enforce_task_message_client_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    task_client_id UUID;
BEGIN
    SELECT client_id INTO task_client_id
    FROM public.client_tasks
    WHERE id = NEW.task_id;

    IF task_client_id IS NULL THEN
        RAISE EXCEPTION 'Referenced task % does not exist.', NEW.task_id;
    END IF;

    IF NEW.client_id IS NULL THEN
        NEW.client_id := task_client_id;
    ELSIF NEW.client_id <> task_client_id THEN
        RAISE EXCEPTION 'client_id % does not match client_id % of referenced task %.', NEW.client_id, task_client_id, NEW.task_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_task_message_client_id ON public.client_task_messages;
CREATE TRIGGER trg_enforce_task_message_client_id
BEFORE INSERT ON public.client_task_messages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_task_message_client_id();

-- 7. Immutability Trigger for client_task_messages (Strictly append-only)
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

-- 8. Create client_task_read_states table (One row per user/task)
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

-- 9. Idempotency Table for task workflow transitions
CREATE TABLE IF NOT EXISTS public.task_action_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.client_tasks(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.profiles(id),
    response_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_task_action_idempotency UNIQUE (task_id, action_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_task_action_idempotency_lookup
ON public.task_action_idempotency(task_id, action_type, idempotency_key);

-- 10. Update can_access_client helper to strictly assigned Operational Managers and mapped clients
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
            AND c.operational_manager_id = p.id
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

-- 11. Update can_manage_client helper to strictly assigned Operational Managers (removes created_by)
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
            AND c.operational_manager_id = p.id
        )
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.can_manage_client(UUID) TO authenticated;

-- 12. Enable Row Level Security
ALTER TABLE public.client_task_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_task_read_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_action_idempotency ENABLE ROW LEVEL SECURITY;

-- 13. RLS Policies for client_task_messages
-- Deny direct client/authenticated mutations (all mutations route authoritatively through Edge Function)
DROP POLICY IF EXISTS client_task_messages_insert_deny ON public.client_task_messages;
CREATE POLICY client_task_messages_insert_deny ON public.client_task_messages
FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS client_task_messages_update_deny ON public.client_task_messages;
CREATE POLICY client_task_messages_update_deny ON public.client_task_messages
FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS client_task_messages_delete_deny ON public.client_task_messages;
CREATE POLICY client_task_messages_delete_deny ON public.client_task_messages
FOR DELETE TO authenticated USING (false);

-- SELECT Policy: Client sees only shared_with_client; Staff sees both internal_note and shared_with_client.
-- Must verify: task exists, task belongs to same client_id, and caller can access that client.
DROP POLICY IF EXISTS client_task_messages_select ON public.client_task_messages;
CREATE POLICY client_task_messages_select ON public.client_task_messages
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.client_tasks t
        WHERE t.id = client_task_messages.task_id
          AND t.client_id = client_task_messages.client_id
          AND app_private.can_access_client(t.client_id)
    )
    AND (
        client_task_messages.visibility = 'shared_with_client'
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.status = 'active'
              AND p.role IN ('owner', 'operational_manager', 'team_member')
        )
    )
);

-- 14. RLS Policies for client_task_read_states (Scoped to auth.uid() AND authorized task)
DROP POLICY IF EXISTS client_task_read_states_select ON public.client_task_read_states;
CREATE POLICY client_task_read_states_select ON public.client_task_read_states
FOR SELECT TO authenticated
USING (
    profile_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.client_tasks t
        WHERE t.id = client_task_read_states.task_id
          AND app_private.can_access_client(t.client_id)
    )
);

DROP POLICY IF EXISTS client_task_read_states_insert ON public.client_task_read_states;
CREATE POLICY client_task_read_states_insert ON public.client_task_read_states
FOR INSERT TO authenticated
WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.client_tasks t
        WHERE t.id = client_task_read_states.task_id
          AND app_private.can_access_client(t.client_id)
    )
);

DROP POLICY IF EXISTS client_task_read_states_update ON public.client_task_read_states;
CREATE POLICY client_task_read_states_update ON public.client_task_read_states
FOR UPDATE TO authenticated
USING (
    profile_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.client_tasks t
        WHERE t.id = client_task_read_states.task_id
          AND app_private.can_access_client(t.client_id)
    )
)
WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.client_tasks t
        WHERE t.id = client_task_read_states.task_id
          AND app_private.can_access_client(t.client_id)
    )
);

DROP POLICY IF EXISTS client_task_read_states_delete_deny ON public.client_task_read_states;
CREATE POLICY client_task_read_states_delete_deny ON public.client_task_read_states
FOR DELETE TO authenticated
USING (false);

-- 15. RLS Policies for client_task_events (Client users only see client-facing events)
DROP POLICY IF EXISTS client_task_events_select ON public.client_task_events;
CREATE POLICY client_task_events_select ON public.client_task_events
FOR SELECT TO authenticated
USING (
    app_private.can_access_client(client_id)
    AND (
        event_type IN ('created', 'client_review_submitted', 'client_approved', 'client_approval_override', 'client_changes_requested', 'completed')
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.status = 'active'
              AND p.role IN ('owner', 'operational_manager', 'team_member')
        )
    )
);

DROP POLICY IF EXISTS client_task_events_insert_deny ON public.client_task_events;
DROP POLICY IF EXISTS client_task_events_insert ON public.client_task_events;
CREATE POLICY client_task_events_insert_deny ON public.client_task_events
FOR INSERT TO authenticated WITH CHECK (false);

-- 16. RLS for task_action_idempotency (Service-role only; deny direct authenticated writes/reads)
DROP POLICY IF EXISTS task_action_idempotency_authenticated_deny ON public.task_action_idempotency;
CREATE POLICY task_action_idempotency_authenticated_deny ON public.task_action_idempotency
FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 17. Realtime Publication (Safely and idempotently register tables)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'client_task_messages'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.client_task_messages;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'client_task_read_states'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.client_task_read_states;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'client_task_events'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.client_task_events;
        END IF;
    END IF;
END $$;
