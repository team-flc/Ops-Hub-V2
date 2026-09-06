# Phase 3B: Task Conversation Feed, Review & Approval — Implementation Plan

## Problem Statement & Context
Phase 3B completes the client deliverables loop within Ops Hub v2 by introducing:
1. Two-tier task approvals (`Internal Only` vs `Client Approval Required`).
2. Client-facing deliverable reviews (`Client Review` status) with authoritative Client sign-off.
3. Append-only chronological conversation feed with internal notes, shared messages, and HTTPS external links.
4. Concurrency safety via atomic Compare-And-Swap (CAS) updates and database-backed idempotency.
5. Strict isolation preventing client users from seeing internal discussions, staff email addresses, or unshared event payloads.

## Proposed Architecture & Changes

### 1. Database Schema & RLS Hardening
- **Migration**: `supabase/migrations/20260907_phase3b_task_conversation_review_approval.sql`
  - Independent idempotent column checks on `client_tasks` (`approval_mode`, `completed_at`, `completed_by`, `reopened_at`, `reopened_by`, `reopen_reason`).
  - Strict append-only table `client_task_messages` with external links validation function `validate_task_message_links`.
  - Trigger `trg_enforce_task_message_client_id` guaranteeing synchronization between `task_id` and `client_id`.
  - Trigger `trg_prevent_task_message_tampering` prohibiting updates and deletions.
  - Table `client_task_read_states` with RLS enforcing caller task-access.
  - Table `task_action_idempotency` for service-role idempotency tracking.
  - Hardened `app_private.can_access_client` and `app_private.can_manage_client` to eliminate stale creator access (`c.created_by = p.id` removed; Operational Manager strictly scoped to `c.operational_manager_id = p.id`).
  - Realtime publication safely and idempotently adding `client_task_messages`, `client_task_read_states`, and `client_task_events`.

### 2. Edge Function Authorization & Concurrency
- **File**: `supabase/functions/manage-client-task/index.ts`
  - **Operational Manager Restriction**: Operational Managers cannot approve tasks in `Client Review` on behalf of the client (returns 403 Forbidden).
  - **Owner Override**: Owner can approve `Client Review` tasks only with explicit `is_override: true` and mandatory justification, recording distinct event `client_approval_override`.
  - **Team Member Restriction**: Team Members can submit only their own assigned work (`existingTask.assignee_id === callerProfile.id`) to `Team Review`.
  - **Atomic Compare-And-Swap (CAS)**: All status transitions query `.eq('id', task_id).eq('status', current)`. Concurrently modified records update 0 rows and return 409 Conflict.
  - **Idempotency**: Requests with `idempotency_key` check `task_action_idempotency` and `client_task_messages` before execution and return cached responses on replay.
  - **Client Feed Privacy**: Strip internal notes, unshared events, internal reasons, and staff emails for client callers.
  - **Composite Cursor Pagination**: Feed paginated using `(created_at, id)` returning the newest 30 combined items.

### 3. Maintainable Component Decomposition
- **Modular Subcomponents**:
  - `useTaskFeed.ts`: Custom hook for feed data, pagination, and single Realtime subscription.
  - `TaskConversationFeed.tsx`: Feed list, load older button, message cards, and immutable audit history.
  - `TaskMessageComposer.tsx`: Internal/shared note toggle, message textarea, external link chips, and submit logic.
  - `TaskReviewActions.tsx`: Role-based and status-based review actions.
  - `ClientTaskDetailsModal.tsx`: High-level drawer shell, metadata grid, and modal dialogs.

## Verification Plan
- Automated test suite: 99/99 tests passing (`npm test`).
- Production build: Clean build with asset chunk reporting (`npm run build`).
- Git diff verification: `git diff --check` clean.
