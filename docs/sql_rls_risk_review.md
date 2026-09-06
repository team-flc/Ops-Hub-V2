# Phase 3B: SQL & RLS Security Risk Review

## 1. Syntax and Delimiter Balance
- File: `supabase/migrations/20260907_phase3b_task_conversation_review_approval.sql`
- Total `$$` delimiter occurrences: 14 (exactly 7 pairs).
- Syntactically verified:
  - 2 `DO $$` procedural blocks (all terminated with `END $$;`).
  - 5 `CREATE OR REPLACE FUNCTION` definitions (all with balanced `$$` quoting and correct language declarations).
  - No nested dollar quoting or malformed string literals.

## 2. Independent Idempotent Column Additions
- Every new column on `public.client_tasks` (`approval_mode`, `completed_at`, `completed_by`, `reopened_at`, `reopened_by`, `reopen_reason`) is added via an independent `IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = '...')` conditional block.
- Guarantee: If a previous migration or partial run created `approval_mode`, companion columns `completed_by` and `reopened_by` will not be skipped.

## 3. Data Integrity & Denormalization Safeguards
- Table `client_task_messages` contains `task_id` and denormalized `client_id`.
- Trigger: `trg_enforce_task_message_client_id` executes `BEFORE INSERT`:
  - Verifies referenced task exists in `public.client_tasks`.
  - Automatically synchronizes `NEW.client_id := task_client_id` if null.
  - Rejects with an exception if `NEW.client_id <> task_client_id`.
- Trigger: `trg_prevent_task_message_tampering` executes `BEFORE UPDATE OR DELETE`:
  - Enforces strict append-only immutability. All updates and deletions are rejected at the database level.

## 4. Link Structure Validation
- Function: `public.validate_task_message_links(links JSONB)`
  - Validates JSON array type.
  - Enforces maximum 5 array elements.
  - Inspects each element: must be an object containing a non-empty `url` string (length 1 to 2048) and optional string `title`.
  - Enforced via table check constraint: `CONSTRAINT chk_client_task_messages_links CHECK (public.validate_task_message_links(links))`.

## 5. Row Level Security Policies
### `client_task_messages`
- Direct client/authenticated mutations (`INSERT`, `UPDATE`, `DELETE`) denied (`WITH CHECK (false)`, `USING (false)`). All message creations route authoritatively through Edge Function `manage-client-task`.
- `SELECT` policy:
  - Enforces task exists, task belongs to same `client_id`, and caller can access that client via `app_private.can_access_client(t.client_id)`.
  - For client users, requires `client_task_messages.visibility = 'shared_with_client'`.
  - Staff (`owner`, `operational_manager`, `team_member`) can view both internal and shared notes.

### `client_task_read_states`
- Scoped strictly to `profile_id = auth.uid()` AND verified task access (`app_private.can_access_client(t.client_id)`).
- Deletions denied.

### `client_task_events`
- `SELECT` policy updated: Client users may only select client-facing event types (`created`, `client_review_submitted`, `client_approved`, `client_approval_override`, `client_changes_requested`, `completed`). Internal events are hidden.
- Direct inserts denied (`INSERT TO authenticated WITH CHECK (false)`).

### `task_action_idempotency`
- All direct authenticated access denied (`FOR ALL TO authenticated USING (false)`). Service role only.

## 6. Access Scope Function Hardening
- `app_private.can_access_client(UUID)` and `app_private.can_manage_client(UUID)`:
  - Operational Manager access is strictly checked against assigned client: `c.operational_manager_id = p.id`.
  - The broad legacy condition `c.created_by = p.id` was removed. Creator Operational Managers no longer retain stale access after client reassignment.
  - Client role verified against `p.organization_id = target_client_id::text`.

## 7. Realtime Publication
- `supabase_realtime` publication registration:
  - Safely verifies existence of `pg_publication` where `pubname = 'supabase_realtime'`.
  - Checks `pg_publication_tables` before issuing `ALTER PUBLICATION supabase_realtime ADD TABLE ...`.
  - Idempotently adds `client_task_messages`, `client_task_read_states`, and `client_task_events`.
