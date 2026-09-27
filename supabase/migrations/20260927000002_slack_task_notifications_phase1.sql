-- =============================================================================
-- Migration: 20260927000002_slack_task_notifications_phase1.sql
-- Description:
--   Phase 1 Ops Hub -> Slack Notifications:
--   1. Add unique slack_member_id mapping to employee profiles.
--   2. Update update_team_member_tx RPC to support slack_member_id atomically.
--   3. Add assignment_seq and approval_seq to client_tasks for reliable occurrence keys.
--   4. Create durable slack_notification_outbox table with atomic claiming (FOR UPDATE SKIP LOCKED)
--      and management-only visibility.
--   5. Implement authoritative PostgreSQL triggers on client_tasks:
--      - Deterministic sequence tracking BEFORE INSERT/UPDATE
--      - Event 1: Task Assigned or Reassigned (DM assignee, skip if unchanged or unassigned draft)
--      - Event 2: Task Submitted for Internal Approval (post in #ops-approvals C0C4MCNDX0D)
--      - Event 3: Owner/Manager Approves or Returns Task (DM assignee)
--   6. Enforce privacy: Metadata only (Client, Task, Priority, Assignee, Link),
--      NO evidence contents, NO completion notes, NO private docs, NO HR/banking/salary.
--   7. Server-side dispatch authorization and claim_slack_outbox_batch RPC.
-- =============================================================================

-- 1. Add slack_member_id to profiles with format check and unique index
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS slack_member_id TEXT;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS check_profiles_slack_member_id_format;

ALTER TABLE public.profiles
ADD CONSTRAINT check_profiles_slack_member_id_format
CHECK (slack_member_id IS NULL OR slack_member_id ~* '^[UW][A-Z0-9]{8,14}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_slack_member_id_unique
ON public.profiles (slack_member_id)
WHERE slack_member_id IS NOT NULL;

-- 2. Update update_team_member_tx to include slack_member_id
CREATE OR REPLACE FUNCTION public.update_team_member_tx(
  p_profile_id UUID,
  p_actor_id UUID,
  p_profile_data JSONB DEFAULT '{}'::jsonb,
  p_department_ids UUID[] DEFAULT NULL,
  p_client_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res JSONB;
BEGIN
  -- 1. Row-level lock on target profile
  PERFORM 1 FROM public.profiles WHERE id = p_profile_id FOR UPDATE;

  -- 2. Atomically update profile details
  IF p_profile_data IS NOT NULL AND p_profile_data <> '{}'::jsonb THEN
    UPDATE public.profiles
    SET
      full_name = CASE WHEN p_profile_data ? 'full_name' THEN p_profile_data->>'full_name' ELSE full_name END,
      phone = CASE WHEN p_profile_data ? 'phone' THEN p_profile_data->>'phone' ELSE phone END,
      backup_phone = CASE WHEN p_profile_data ? 'backup_phone' THEN p_profile_data->>'backup_phone' ELSE backup_phone END,
      contact_email = CASE WHEN p_profile_data ? 'contact_email' THEN p_profile_data->>'contact_email' ELSE contact_email END,
      linkedin_url = CASE WHEN p_profile_data ? 'linkedin_url' THEN p_profile_data->>'linkedin_url' ELSE linkedin_url END,
      bio = CASE WHEN p_profile_data ? 'bio' THEN p_profile_data->>'bio' ELSE bio END,
      avatar_url = CASE WHEN p_profile_data ? 'avatar_url' THEN p_profile_data->>'avatar_url' ELSE avatar_url END,
      cnic = CASE WHEN p_profile_data ? 'cnic' THEN p_profile_data->>'cnic' ELSE cnic END,
      slack_member_id = CASE
        WHEN p_profile_data ? 'slack_member_id'
        THEN NULLIF(trim(p_profile_data->>'slack_member_id'), '')
        ELSE slack_member_id
      END,
      designation_id = CASE
        WHEN p_profile_data ? 'designation_id' AND p_profile_data->>'designation_id' IS NOT NULL
        THEN (p_profile_data->>'designation_id')::UUID
        ELSE designation_id
      END,
      reporting_manager_id = CASE
        WHEN p_profile_data ? 'reporting_manager_id' AND p_profile_data->>'reporting_manager_id' IS NOT NULL
        THEN (p_profile_data->>'reporting_manager_id')::UUID
        ELSE reporting_manager_id
      END,
      start_date = CASE
        WHEN p_profile_data ? 'start_date' AND p_profile_data->>'start_date' IS NOT NULL
        THEN (p_profile_data->>'start_date')::DATE
        ELSE start_date
      END,
      role = CASE WHEN p_profile_data ? 'role' THEN p_profile_data->>'role' ELSE role END,
      updated_at = NOW()
    WHERE id = p_profile_id;
  END IF;

  -- 3. Atomically synchronize departments
  IF p_department_ids IS NOT NULL THEN
    DELETE FROM public.profile_departments WHERE profile_id = p_profile_id;
    IF cardinality(p_department_ids) > 0 THEN
      INSERT INTO public.profile_departments (profile_id, department_id, created_by)
      SELECT p_profile_id, dept_id, p_actor_id
      FROM unnest(p_department_ids) AS dept_id;
    END IF;
  END IF;

  -- 4. Atomically synchronize client access tables via sync_member_client_access_tx
  IF p_client_ids IS NOT NULL THEN
    v_res := public.sync_member_client_access_tx(p_profile_id, p_client_ids, p_actor_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'client_sync', v_res
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_team_member_tx(UUID, UUID, JSONB, UUID[], UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_team_member_tx(UUID, UUID, JSONB, UUID[], UUID[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_team_member_tx(UUID, UUID, JSONB, UUID[], UUID[]) TO service_role;

-- 3. Add sequence occurrence tracking columns to client_tasks
ALTER TABLE public.client_tasks
ADD COLUMN IF NOT EXISTS assignment_seq INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS approval_seq INT NOT NULL DEFAULT 0;

-- 4. Create durable slack_notification_outbox table with atomic claiming support
CREATE TABLE IF NOT EXISTS public.slack_notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.client_tasks(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('task_assigned', 'approval_submitted', 'approval_decision')),
  idempotency_key TEXT UNIQUE NOT NULL,
  recipient_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_slack_id TEXT,
  channel_id TEXT,
  message_text TEXT NOT NULL,
  blocks JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'skipped')),
  skip_reason TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  claimed_by TEXT,
  last_error TEXT,
  slack_message_ts TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure constraints and columns exist if table was already created
ALTER TABLE public.slack_notification_outbox
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by TEXT;

ALTER TABLE public.slack_notification_outbox
  DROP CONSTRAINT IF EXISTS slack_notification_outbox_status_check;

ALTER TABLE public.slack_notification_outbox
  ADD CONSTRAINT slack_notification_outbox_status_check
  CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_slack_outbox_claimable
ON public.slack_notification_outbox (status, next_retry_at, retry_count)
WHERE status IN ('pending', 'failed', 'processing');

CREATE INDEX IF NOT EXISTS idx_slack_outbox_task_id
ON public.slack_notification_outbox (task_id);

CREATE INDEX IF NOT EXISTS idx_slack_outbox_client_id
ON public.slack_notification_outbox (client_id);

-- Enable RLS on slack_notification_outbox
ALTER TABLE public.slack_notification_outbox ENABLE ROW LEVEL SECURITY;

-- Management-only read visibility
DROP POLICY IF EXISTS "slack_outbox_select_management" ON public.slack_notification_outbox;
CREATE POLICY "slack_outbox_select_management"
  ON public.slack_notification_outbox
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'operational_manager')
    )
  );

REVOKE ALL ON TABLE public.slack_notification_outbox FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.slack_notification_outbox TO authenticated;
GRANT ALL ON TABLE public.slack_notification_outbox TO service_role;

-- 5. Atomic RPC for claiming outbox batches (Worker isolation with FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_slack_outbox_batch(
  p_batch_size INT DEFAULT 25,
  p_worker_id TEXT DEFAULT 'worker-default',
  p_timeout_seconds INT DEFAULT 300
)
RETURNS SETOF public.slack_notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM public.slack_notification_outbox
    WHERE (
      -- Pending rows that are due
      (status = 'pending' AND next_retry_at <= now())
      -- Retrying rows that are due and have retries remaining (prevents head-of-line blocking by exhausted failures)
      OR (status = 'failed' AND retry_count < max_retries AND next_retry_at <= now())
      -- Stale processing rows where previous worker timed out or crashed
      OR (status = 'processing' AND claimed_at < now() - (p_timeout_seconds || ' seconds')::interval)
    )
    ORDER BY created_at ASC, id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  )
  UPDATE public.slack_notification_outbox o
  SET status = 'processing',
      claimed_at = now(),
      claimed_by = p_worker_id,
      updated_at = now()
  FROM claimable
  WHERE o.id = claimable.id
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_slack_outbox_batch(INT, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_slack_outbox_batch(INT, TEXT, INT) TO service_role;

-- 5b. RPC for management to safely retry failed notifications
CREATE OR REPLACE FUNCTION public.retry_failed_slack_notification(
  p_notification_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Validate caller is management (owner or operational_manager)
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role NOT IN ('owner', 'operational_manager') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only owners and operational managers can retry failed notifications.'
    );
  END IF;

  UPDATE public.slack_notification_outbox
  SET status = 'pending',
      retry_count = 0,
      next_retry_at = now(),
      claimed_at = NULL,
      claimed_by = NULL,
      last_error = NULL,
      skip_reason = NULL,
      updated_at = now()
  WHERE id = p_notification_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', p_notification_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.retry_failed_slack_notification(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_failed_slack_notification(UUID) TO authenticated, service_role;

-- 6. Trigger Function: Maintain Occurrence Sequences on client_tasks BEFORE write
CREATE OR REPLACE FUNCTION public.fn_track_task_notification_sequences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Track assignment occurrence sequence:
  -- Increments on new assignment, reassignment, or activation from Draft status.
  IF (TG_OP = 'INSERT' AND NEW.assignee_id IS NOT NULL AND NEW.status <> 'Draft')
     OR (TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT NULL AND (
          (OLD.assignee_id IS DISTINCT FROM NEW.assignee_id AND NEW.status <> 'Draft')
          OR (OLD.status = 'Draft' AND NEW.status <> 'Draft')
     )) THEN
    NEW.assignment_seq := COALESCE(OLD.assignment_seq, 0) + 1;
  ELSE
    IF TG_OP = 'UPDATE' THEN
      NEW.assignment_seq := COALESCE(OLD.assignment_seq, 0);
    ELSE
      NEW.assignment_seq := 0;
    END IF;
  END IF;

  -- Track approval occurrence sequence:
  -- Increments when task transitions into 'Approval' or 'Team Review'.
  IF (TG_OP = 'INSERT' AND NEW.status IN ('Approval', 'Team Review'))
     OR (TG_OP = 'UPDATE' AND NEW.status IN ('Approval', 'Team Review') AND OLD.status NOT IN ('Approval', 'Team Review')) THEN
    NEW.approval_seq := COALESCE(OLD.approval_seq, 0) + 1;
  ELSE
    IF TG_OP = 'UPDATE' THEN
      NEW.approval_seq := COALESCE(OLD.approval_seq, 0);
    ELSE
      NEW.approval_seq := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_task_notification_sequences ON public.client_tasks;
CREATE TRIGGER trg_track_task_notification_sequences
  BEFORE INSERT OR UPDATE OF assignee_id, status ON public.client_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_track_task_notification_sequences();

-- 7. Trigger Function: Authoritative Slack Notification Enqueueing with Occurrence Keys
CREATE OR REPLACE FUNCTION public.fn_trigger_enqueue_slack_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_name TEXT;
  v_assignee_slack_id TEXT;
  v_assignee_name TEXT;
  v_base_url TEXT := 'https://ops.faseehlall.com';
  v_task_link TEXT;
  v_blocks JSONB;
  v_event_type TEXT;
  v_idempotency_key TEXT;
  v_message_text TEXT;
  v_channel_id TEXT;
  v_status TEXT := 'pending';
  v_skip_reason TEXT := NULL;
  v_recipient_profile_id UUID := NULL;
  v_recipient_slack_id TEXT := NULL;
  v_decision TEXT;
BEGIN
  -- We do not process archived tasks
  IF NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Build Ops Hub Link (Production origin only, never preview URL)
  v_task_link := v_base_url || '/clients/' || NEW.client_id::text;

  -- Query client company name
  SELECT company_name INTO v_client_name
  FROM public.clients
  WHERE id = NEW.client_id;
  v_client_name := COALESCE(v_client_name, 'Client Workspace');

  -- =========================================================================
  -- EVENT 1: Task Assigned or Reassigned
  -- Triggered when assignment_seq increments on an active assigned task.
  -- Key: task_assigned:{task_id}:occ_{assignment_seq}:{assignee_id}
  -- This reliably handles Assignment -> Reassignment -> Original Assignee!
  -- =========================================================================
  IF NEW.assignment_seq > 0
     AND (TG_OP = 'INSERT' OR NEW.assignment_seq > COALESCE(OLD.assignment_seq, 0)) THEN

    v_event_type := 'task_assigned';
    v_recipient_profile_id := NEW.assignee_id;
    v_idempotency_key := 'task_assigned:' || NEW.id::text || ':occ_' || NEW.assignment_seq::text || ':' || NEW.assignee_id::text;

    -- Lookup assignee's Slack Member ID
    SELECT slack_member_id, full_name INTO v_assignee_slack_id, v_assignee_name
    FROM public.profiles
    WHERE id = NEW.assignee_id;

    v_assignee_name := COALESCE(v_assignee_name, 'Team Member');

    IF v_assignee_slack_id IS NULL OR trim(v_assignee_slack_id) = '' THEN
      v_status := 'skipped';
      v_skip_reason := 'missing_slack_member_id';
      v_recipient_slack_id := NULL;
    ELSE
      v_status := 'pending';
      v_skip_reason := NULL;
      v_recipient_slack_id := v_assignee_slack_id;
    END IF;

    v_message_text := '📋 *New Task Assigned*: ' || NEW.title || ' (' || v_client_name || ')';

    -- Privacy: Task title, Client name, Priority, Due Date, Ops Hub Link. NO evidence, NO private docs.
    v_blocks := jsonb_build_array(
      jsonb_build_object(
        'type', 'header',
        'text', jsonb_build_object('type', 'plain_text', 'text', '📋 New Task Assigned', 'emoji', true)
      ),
      jsonb_build_object(
        'type', 'section',
        'fields', jsonb_build_array(
          jsonb_build_object('type', 'mrkdwn', 'text', '*Client:*\n' || v_client_name),
          jsonb_build_object('type', 'mrkdwn', 'text', '*Priority:*\n' || COALESCE(NEW.priority, 'Normal')),
          jsonb_build_object('type', 'mrkdwn', 'text', '*Task:*\n' || NEW.title),
          jsonb_build_object('type', 'mrkdwn', 'text', '*Due Date:*\n' || COALESCE(NEW.due_date::text, 'Not specified'))
        )
      ),
      jsonb_build_object(
        'type', 'actions',
        'elements', jsonb_build_array(
          jsonb_build_object(
            'type', 'button',
            'text', jsonb_build_object('type', 'plain_text', 'text', 'Open in Ops Hub', 'emoji', true),
            'url', v_task_link,
            'style', 'primary'
          )
        )
      )
    );

    INSERT INTO public.slack_notification_outbox (
      task_id,
      client_id,
      event_type,
      idempotency_key,
      recipient_profile_id,
      recipient_slack_id,
      channel_id,
      message_text,
      blocks,
      status,
      skip_reason
    ) VALUES (
      NEW.id,
      NEW.client_id,
      v_event_type,
      v_idempotency_key,
      v_recipient_profile_id,
      v_recipient_slack_id,
      NULL,
      v_message_text,
      v_blocks,
      v_status,
      v_skip_reason
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

  END IF;

  -- =========================================================================
  -- EVENT 2: Task Submitted for Internal Approval
  -- Triggered when approval_seq increments on move to Approval/Team Review.
  -- Key: approval_submitted:{task_id}:occ_{approval_seq}
  -- This reliably handles Approval -> Return -> Resubmission occurrences!
  -- =========================================================================
  IF NEW.approval_seq > 0
     AND (TG_OP = 'INSERT' OR NEW.approval_seq > COALESCE(OLD.approval_seq, 0)) THEN

    v_event_type := 'approval_submitted';
    v_idempotency_key := 'approval_submitted:' || NEW.id::text || ':occ_' || NEW.approval_seq::text;
    v_channel_id := 'C0C4MCNDX0D'; -- Public #ops-approvals channel ID

    IF NEW.assignee_id IS NOT NULL THEN
      SELECT full_name INTO v_assignee_name FROM public.profiles WHERE id = NEW.assignee_id;
    END IF;
    v_assignee_name := COALESCE(v_assignee_name, 'Unassigned');

    v_message_text := '🔍 *Task Submitted for Internal Approval*: ' || NEW.title || ' (' || v_client_name || ')';

    -- Privacy: NO evidence content, NO completion notes, NO private docs, NO HR/banking/salary
    v_blocks := jsonb_build_array(
      jsonb_build_object(
        'type', 'header',
        'text', jsonb_build_object('type', 'plain_text', 'text', '🔍 Task Submitted for Approval', 'emoji', true)
      ),
      jsonb_build_object(
        'type', 'section',
        'fields', jsonb_build_array(
          jsonb_build_object('type', 'mrkdwn', 'text', '*Client:*\n' || v_client_name),
          jsonb_build_object('type', 'mrkdwn', 'text', '*Assignee:*\n' || v_assignee_name),
          jsonb_build_object('type', 'mrkdwn', 'text', '*Task:*\n' || NEW.title),
          jsonb_build_object('type', 'mrkdwn', 'text', '*Priority:*\n' || COALESCE(NEW.priority, 'Normal'))
        )
      ),
      jsonb_build_object(
        'type', 'actions',
        'elements', jsonb_build_array(
          jsonb_build_object(
            'type', 'button',
            'text', jsonb_build_object('type', 'plain_text', 'text', 'Review in Ops Hub', 'emoji', true),
            'url', v_task_link,
            'style', 'primary'
          )
        )
      )
    );

    INSERT INTO public.slack_notification_outbox (
      task_id,
      client_id,
      event_type,
      idempotency_key,
      recipient_profile_id,
      recipient_slack_id,
      channel_id,
      message_text,
      blocks,
      status,
      skip_reason
    ) VALUES (
      NEW.id,
      NEW.client_id,
      v_event_type,
      v_idempotency_key,
      NULL,
      NULL,
      v_channel_id,
      v_message_text,
      v_blocks,
      'pending',
      NULL
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

  END IF;

  -- =========================================================================
  -- EVENT 3: Owner or Operational Manager Approves or Returns Task
  -- Triggered on status transition out of Approval/Team Review into Done/In Progress.
  -- Key: approval_decision:{task_id}:occ_{approval_seq}:{decision}
  -- =========================================================================
  IF TG_OP = 'UPDATE'
     AND OLD.status IN ('Approval', 'Team Review')
     AND NEW.status IN ('Done', 'Completed', 'In Progress', 'Todo')
     AND NEW.assignee_id IS NOT NULL THEN

    v_event_type := 'approval_decision';
    v_recipient_profile_id := NEW.assignee_id;
    v_decision := CASE WHEN NEW.status IN ('Done', 'Completed') THEN 'approved' ELSE 'returned' END;
    v_idempotency_key := 'approval_decision:' || NEW.id::text || ':occ_' || NEW.approval_seq::text || ':' || v_decision;

    -- Lookup assignee's Slack Member ID
    SELECT slack_member_id INTO v_assignee_slack_id
    FROM public.profiles
    WHERE id = NEW.assignee_id;

    IF v_assignee_slack_id IS NULL OR trim(v_assignee_slack_id) = '' THEN
      v_status := 'skipped';
      v_skip_reason := 'missing_slack_member_id';
      v_recipient_slack_id := NULL;
    ELSE
      v_status := 'pending';
      v_skip_reason := NULL;
      v_recipient_slack_id := v_assignee_slack_id;
    END IF;

    IF v_decision = 'approved' THEN
      v_message_text := '✅ *Task Approved*: ' || NEW.title || ' (' || v_client_name || ')';
      v_blocks := jsonb_build_array(
        jsonb_build_object(
          'type', 'header',
          'text', jsonb_build_object('type', 'plain_text', 'text', '✅ Task Approved', 'emoji', true)
        ),
        jsonb_build_object(
          'type', 'section',
          'fields', jsonb_build_array(
            jsonb_build_object('type', 'mrkdwn', 'text', '*Client:*\n' || v_client_name),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Decision:*\nApproved'),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Task:*\n' || NEW.title),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Status:*\nCompleted')
          )
        ),
        jsonb_build_object(
          'type', 'actions',
          'elements', jsonb_build_array(
            jsonb_build_object(
              'type', 'button',
              'text', jsonb_build_object('type', 'plain_text', 'text', 'View in Ops Hub', 'emoji', true),
              'url', v_task_link
            )
          )
        )
      );
    ELSE
      -- Returned for changes
      v_message_text := '🔄 *Task Returned for Changes*: ' || NEW.title || ' (' || v_client_name || ')';
      v_blocks := jsonb_build_array(
        jsonb_build_object(
          'type', 'header',
          'text', jsonb_build_object('type', 'plain_text', 'text', '🔄 Task Returned for Changes', 'emoji', true)
        ),
        jsonb_build_object(
          'type', 'section',
          'fields', jsonb_build_array(
            jsonb_build_object('type', 'mrkdwn', 'text', '*Client:*\n' || v_client_name),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Decision:*\nReturned for changes'),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Task:*\n' || NEW.title),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Status:*\nIn Progress')
          )
        ),
        jsonb_build_object(
          'type', 'actions',
          'elements', jsonb_build_array(
            jsonb_build_object(
              'type', 'button',
              'text', jsonb_build_object('type', 'plain_text', 'text', 'Open Task in Ops Hub', 'emoji', true),
              'url', v_task_link,
              'style', 'primary'
            )
          )
        )
      );
    END IF;

    INSERT INTO public.slack_notification_outbox (
      task_id,
      client_id,
      event_type,
      idempotency_key,
      recipient_profile_id,
      recipient_slack_id,
      channel_id,
      message_text,
      blocks,
      status,
      skip_reason
    ) VALUES (
      NEW.id,
      NEW.client_id,
      v_event_type,
      v_idempotency_key,
      v_recipient_profile_id,
      v_recipient_slack_id,
      NULL,
      v_message_text,
      v_blocks,
      v_status,
      v_skip_reason
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

  END IF;

  RETURN NEW;
END;
$$;

-- 8. Attach trigger to client_tasks
DROP TRIGGER IF EXISTS trg_enqueue_slack_task_notifications ON public.client_tasks;
CREATE TRIGGER trg_enqueue_slack_task_notifications
  AFTER INSERT OR UPDATE OF assignee_id, status, archived_at ON public.client_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trigger_enqueue_slack_notification();
