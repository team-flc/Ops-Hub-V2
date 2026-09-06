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

## Unabridged Rollback Procedure

In the event of an unexpected anomaly during deployment or verification:

### 1. Frontend Rollback
- Revert the Cloudflare Pages deployment to the previous production deployment hash from `main` commit `4958ecb`.
- Time to restore: < 60 seconds via Cloudflare dashboard or Wrangler.

### 2. Edge Function Rollback
- Redeploy the previous production version of `manage-client-task` from commit `4958ecb`:
  ```bash
  git checkout 4958ecb -- supabase/functions/manage-client-task/index.ts
  supabase functions deploy manage-client-task
  ```

### 3. Database Rollback SQL (Non-Destructive)
If database rollback is required, execute the following non-destructive rollback script:
```sql
-- Remove tables from realtime publication
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.client_task_messages;
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.client_task_read_states;
    END IF;
END $$;

-- Drop RLS policies
DROP POLICY IF EXISTS client_task_messages_select ON public.client_task_messages;
DROP POLICY IF EXISTS client_task_messages_insert_deny ON public.client_task_messages;
DROP POLICY IF EXISTS client_task_messages_update_deny ON public.client_task_messages;
DROP POLICY IF EXISTS client_task_messages_delete_deny ON public.client_task_messages;

DROP POLICY IF EXISTS client_task_read_states_select ON public.client_task_read_states;
DROP POLICY IF EXISTS client_task_read_states_insert ON public.client_task_read_states;
DROP POLICY IF EXISTS client_task_read_states_update ON public.client_task_read_states;
DROP POLICY IF EXISTS client_task_read_states_delete_deny ON public.client_task_read_states;

DROP POLICY IF EXISTS task_action_idempotency_authenticated_deny ON public.task_action_idempotency;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS trg_enforce_task_message_client_id ON public.client_task_messages;
DROP FUNCTION IF EXISTS public.enforce_task_message_client_id();

DROP TRIGGER IF EXISTS trg_prevent_task_message_tampering ON public.client_task_messages;
DROP FUNCTION IF EXISTS public.prevent_task_message_tampering();

DROP FUNCTION IF EXISTS public.validate_task_message_links(jsonb);

-- Drop new Phase 3B tables
DROP TABLE IF EXISTS public.task_action_idempotency;
DROP TABLE IF EXISTS public.client_task_read_states;
DROP TABLE IF EXISTS public.client_task_messages;

-- Reset client_tasks status check constraint
ALTER TABLE public.client_tasks DROP CONSTRAINT IF EXISTS client_tasks_status_check;
ALTER TABLE public.client_tasks ADD CONSTRAINT client_tasks_status_check
CHECK (status IN ('Draft', 'Assigned', 'In Progress', 'Blocked', 'Team Review'));
```
