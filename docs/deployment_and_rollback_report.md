# Phase 3B: Deployment and Rollback Report

## Deployment Boundaries Adhered To
- **NO remote SQL applied to Supabase**.
- **NO Edge Function deployed or redeployed**.
- **NO Git branch pushed to remote origin**.
- **NO merges into main**.
- **NO modifications to Production data or Cloudflare Production**.

---

## Controlled Deployment Plan (For Future Release)

### Pre-Deployment Verification
1. Confirm Git working tree is clean.
2. Confirm branch HEAD is at the approved Phase 3B commit.
3. Confirm `main` is at expected production SHA (`4958ecb3bb3d8b28b8cc9641823e5bf18300e52d`).
4. Validate SQL migration contains no data `DELETE`, table `DROP`, or column `DROP`.

### Step 1: Backend Database Migration
- Apply `supabase/migrations/20260907_phase3b_task_conversation_review_approval.sql`.
- Verify tables exist: `client_task_messages`, `client_task_read_states`, `task_action_idempotency`.
- Verify columns on `client_tasks`: `approval_mode`, `completed_at`, `completed_by`, `reopened_at`, `reopened_by`, `reopen_reason`.
- Verify RLS policies and publication tables in `supabase_realtime`.

### Step 2: Deploy Edge Function
- Deploy `manage-client-task`:
  ```bash
  supabase functions deploy manage-client-task
  ```
- Verify Edge Function secret environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### Step 3: Frontend Deployment
- Build and verify: `npm run build`.
- Deploy frontend to Cloudflare Pages.

---

## Rollback Procedures

### Architecture-Aware Rollback Strategy
Rollback procedures are strictly differentiated based on whether user data has been recorded in production.

---

### Scenario A: Pre-Data Rollback (Deployment Window Only — Zero Production Data)
Use this procedure **ONLY** if an anomaly occurs immediately during the deployment window before any production user activity has occurred and no messages, approvals, or review transitions have been created.

#### 1. Frontend Rollback
- Revert Cloudflare Pages deployment to commit `4958ecb`.
- Restore time: < 60 seconds.

#### 2. Edge Function Rollback
- Redeploy previous production version of `manage-client-task` from commit `4958ecb`:
  ```bash
  git checkout 4958ecb -- supabase/functions/manage-client-task/index.ts
  supabase functions deploy manage-client-task
  ```

#### 3. Database Rollback SQL (Pre-Data Only)
> [!CAUTION]
> Execute this script ONLY if 0 rows exist in `client_task_messages`, `client_task_read_states`, and `task_action_idempotency`, and NO tasks are in `'Client Review'` or `'Completed'` status.

```sql
-- 1. Remove tables from realtime publication
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.client_task_messages;
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.client_task_read_states;
    END IF;
END $$;

-- 2. Drop RLS policies on Phase 3B tables
DROP POLICY IF EXISTS client_task_messages_select ON public.client_task_messages;
DROP POLICY IF EXISTS client_task_messages_insert_deny ON public.client_task_messages;
DROP POLICY IF EXISTS client_task_messages_update_deny ON public.client_task_messages;
DROP POLICY IF EXISTS client_task_messages_delete_deny ON public.client_task_messages;

DROP POLICY IF EXISTS client_task_read_states_select ON public.client_task_read_states;
DROP POLICY IF EXISTS client_task_read_states_insert ON public.client_task_read_states;
DROP POLICY IF EXISTS client_task_read_states_update ON public.client_task_read_states;
DROP POLICY IF EXISTS client_task_read_states_delete_deny ON public.client_task_read_states;

DROP POLICY IF EXISTS task_action_idempotency_authenticated_deny ON public.task_action_idempotency;

-- 3. Restore previous client_task_events RLS policies
DROP POLICY IF EXISTS "client_task_events_select" ON public.client_task_events;
DROP POLICY IF EXISTS client_task_events_select ON public.client_task_events;
CREATE POLICY "client_task_events_select" ON public.client_task_events
FOR SELECT TO authenticated
USING (app_private.can_access_client(client_id));

DROP POLICY IF EXISTS "client_task_events_insert" ON public.client_task_events;
DROP POLICY IF EXISTS client_task_events_insert ON public.client_task_events;
DROP POLICY IF EXISTS client_task_events_insert_deny ON public.client_task_events;
CREATE POLICY "client_task_events_insert" ON public.client_task_events
FOR INSERT TO authenticated
WITH CHECK (app_private.can_access_client(client_id));

DROP POLICY IF EXISTS client_task_events_update_deny ON public.client_task_events;
CREATE POLICY "client_task_events_update_deny" ON public.client_task_events
FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS client_task_events_delete_deny ON public.client_task_events;
CREATE POLICY "client_task_events_delete_deny" ON public.client_task_events
FOR DELETE TO authenticated USING (false);

-- 4. Drop Phase 3B triggers and functions
DROP TRIGGER IF EXISTS trg_enforce_task_message_client_id ON public.client_task_messages;
DROP FUNCTION IF EXISTS public.enforce_task_message_client_id();

DROP TRIGGER IF EXISTS trg_prevent_task_message_tampering ON public.client_task_messages;
DROP FUNCTION IF EXISTS public.prevent_task_message_tampering();

DROP FUNCTION IF EXISTS public.validate_task_message_links(jsonb);

-- 5. Restore previous can_access_client and can_manage_client definitions (with created_by)
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

-- 6. Drop Phase 3B tables (pre-data only)
DROP TABLE IF EXISTS public.task_action_idempotency;
DROP TABLE IF EXISTS public.client_task_read_states;
DROP TABLE IF EXISTS public.client_task_messages;

-- 7. Reset client_tasks status check constraint (pre-data only)
ALTER TABLE public.client_tasks DROP CONSTRAINT IF EXISTS client_tasks_status_check;
ALTER TABLE public.client_tasks ADD CONSTRAINT client_tasks_status_check
CHECK (status IN ('Draft', 'Assigned', 'In Progress', 'Blocked', 'Team Review'));

-- 8. Reset client_task_events event_type constraint (pre-data only)
ALTER TABLE public.client_task_events DROP CONSTRAINT IF EXISTS client_task_events_event_type_check;
ALTER TABLE public.client_task_events ADD CONSTRAINT client_task_events_event_type_check
CHECK (event_type IN ('created', 'status_changed', 'assigned', 'dates_updated', 'priority_updated', 'blocked_reason_updated'));
```

---

### Scenario B: Forward-Safe Production Rollback (Post-Data Active Production)
Use this procedure whenever Phase 3B has been live and real data exists (e.g. task messages, client reviews, approvals, or completed tasks).

> [!IMPORTANT]
> **DO NOT DROP Phase 3B TABLES OR COLUMNS ONCE REAL DATA EXISTS.**
> Dropping tables destroys authentic conversation feeds and review history. Dropping check constraints or columns (`approval_mode`, `completed_at`, `completed_by`, `reopened_at`, `reopened_by`, `reopen_reason`) will cause immediate database exceptions if rows hold those values.

#### 1. Forward-Safe Rollback Strategy
The preferred post-launch rollback preserves additive database schemas while reverting executable logic:
1. **Frontend**: Roll back Cloudflare Pages to commit `4958ecb` (or deploy a safe patch branch). The Phase 3A frontend will safely ignore Phase 3B columns.
2. **Edge Function**: Revert `manage-client-task` logic or deploy an Edge Function hotfix that gracefully handles legacy actions while preventing new Phase 3B conversation feed operations.
3. **Database Schema Remains Intact**:
   - `client_task_messages`, `client_task_read_states`, and `task_action_idempotency` are preserved without loss of records.
   - Statuses `'Client Review'` and `'Completed'` remain valid in `client_tasks_status_check` constraint so existing tasks do not violate constraints.
   - Columns `approval_mode`, `completed_at`, `completed_by`, `reopened_at`, `reopened_by`, `reopen_reason` remain in `client_tasks`.
   - Realtime publication remains registered or can be temporarily suspended without schema destruction:
     ```sql
     -- Optional: suspend realtime replication without dropping tables
     ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.client_task_messages;
     ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.client_task_read_states;
     ```
4. **Subsequent Resolution**:
   - Any database adjustments must be delivered as a forward-moving reviewed migration (e.g., `20260908_phase3b_maintenance_hotfix.sql`), never by ad-hoc dropping of tables.
