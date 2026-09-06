# Phase 3C: Task Templates System — Implementation Documentation

## 1. Overview & Architecture

Phase 3C introduces a complete, production-grade Task Templates System to Ops Hub v2. The system enables FLC agency leadership to standardize operational workflows by defining reusable task templates that can be instantiated into client tasks during weekly setup cycles.

### Single-Tenant Clarification
Ops Hub v2 does not currently implement agency-level multi-tenancy. The `profiles.organization_id` column is historically used exclusively for Client users to reference their respective `clients.id`. Previous experimental iterations that introduced a multi-tenant `organizations` table and `organization_id` foreign keys have been completely removed. Task Templates is an internal, global agency library guarded strictly by user roles.

### Role & Governance Model
- **Executive Owner**: Full governance rights. Can view both Active and Archived templates, create, update, duplicate, archive (with mandatory reason), and restore templates.
- **Operational Manager**: Operational consumer. Can view Active templates and instantiate client tasks from templates. Cannot create, edit, duplicate, archive, or restore templates (HTTP 403 Forbidden).
- **Team Member & Client**: Strictly denied. Cannot view, list, or mutate templates (HTTP 403 Forbidden / RLS deny-all).

---

## 2. Frontend Architecture & Components

### 2.1 Task Creation Entry Flow
- **`TaskCreationModeModal.tsx`**: Renders when an authorized user (Owner or Operational Manager) clicks `+ Add Task` in `ClientWorkspaceView`. Provides two explicit pathways:
  1. **Start from Template**: Launches `TaskTemplatePickerModal` with the selected client and week number.
  2. **Create Blank Task**: Bypasses templates and directly opens `CreateClientTaskModal`, fully preserving legacy and ad-hoc task creation workflows.
- Statically imported in `ClientWorkspaceView` to guarantee instantaneous, synchronous modal rendering while maintaining compatibility with existing automated testing harnesses.

### 2.2 Template Selection & Preview
- **`TaskTemplatePickerModal.tsx`**: Displays active templates categorized by department with keyword search, previewing, and direct instantiation.
  - **Graceful Backend-Unavailable Fallback**: When the database migration or Edge Function is not yet deployed, the modal detects backend unavailability and renders:
    - Exactly **ONE** clear `Create Blank Task Instead` CTA button in the modal footer.
    - Exactly **ONE** `Cancel` button in the modal footer.
    - Removed all redundant or duplicate fallback triggers from banners and empty state containers.
  - Code-split and lazy-loaded via `React.lazy` with `<React.Suspense fallback={null}>` to keep the main bundle footprint minimal.

### 2.3 Template Management in Settings
- **`TaskTemplatesView.tsx`**: Dedicated view within Settings for managing organization templates.
  - **Role Guarded**: Only accessible by authenticated Owners and Operational Managers (read-only for Managers).
  - **Backend-Unavailable Handling**: When the backend is offline/unmigrated:
    - Disables or hides `+ Create Template` and `Create First Template` buttons.
    - Prevents users from entering an un-saveable form state.
    - Renders a prominent informational banner explaining that template authoring becomes available once the backend rollout is complete.
    - Automatically restores interactive controls without code changes as soon as the backend responds.
  - Modals (`CreateEditTemplateModal`, `TemplatePreviewModal`, `ArchiveTemplateModal`) are lazy-loaded on demand.

### 2.4 Client API Layer
- **`src/lib/taskTemplateService.ts`**: Provides robust client-side methods:
  - `fetchTemplates(includeArchived = false)`: Retrieves active templates (or all templates if Owner). Returns `isUnavailable: true` on backend unreadiness for graceful zero-crash fallback.
  - `createTemplate()`, `updateTemplate()`, `duplicateTemplate()`, `archiveTemplate()`, `restoreTemplate()`: Edge Function wrappers passing client-generated `idempotency_key` (via `x-idempotency-key` header and body payload).

---

## 3. Database Schema & Migration (`supabase/migrations/20260908_phase3c_task_templates.sql`)

### 3.1 `task_templates` Table
```sql
CREATE TABLE public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  default_task_title TEXT NOT NULL,
  task_details TEXT,
  default_priority TEXT NOT NULL DEFAULT 'Normal'
    CONSTRAINT chk_task_templates_priority CHECK (default_priority IN ('Low', 'Normal', 'High', 'Urgent')),
  default_approval_mode TEXT NOT NULL DEFAULT 'Internal Only'
    CONSTRAINT chk_task_templates_approval_mode CHECK (default_approval_mode IN ('Internal Only', 'Client Approval Required')),
  suggested_duration_days INTEGER NOT NULL DEFAULT 3
    CONSTRAINT chk_task_templates_suggested_duration CHECK (suggested_duration_days BETWEEN 1 AND 30),
  status TEXT NOT NULL DEFAULT 'Active'
    CONSTRAINT chk_task_templates_status CHECK (status IN ('Active', 'Archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  seed_key TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  archive_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 `template_mutation_requests` Table
Dedicated idempotency claim store:
```sql
CREATE TABLE public.template_mutation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  response_payload JSONB,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CONSTRAINT chk_template_mutation_status CHECK (status IN ('in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_template_mutation_actor_action_key UNIQUE (actor_id, action, idempotency_key)
);
```
- Protected with RLS enabled and an explicit deny-all policy for `anon` and `authenticated` roles.
- Mutated exclusively by Edge Functions using the service role client.

### 3.3 Companion Columns on `client_tasks`
```sql
ALTER TABLE public.client_tasks
  ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES public.task_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_template_version INTEGER;
```
- Companion column existence checks specifically target `table_name = 'task_templates'`.
- Preserves provenance without preventing template archival or deletion.

### 3.4 Starter Seed
- Idempotently inserts a single initial starter template: "Media Buying Campaign Setup & Launch" with `seed_key = 'media_buying_campaign_setup_v1'`.
- Globally unique `uq_task_templates_seed_key` constraint guarantees that renaming the template never re-seeds a duplicate.
- Seed is linked to the earliest Executive Owner in `profiles`.

### 3.5 Row-Level Security (RLS)
- Defense-in-depth: RLS denies all direct mutations (`INSERT`, `UPDATE`, `DELETE`) to public/authenticated users.
- Read access is allowed for Active templates to authenticated users (Owners and Managers).
- Realtime publication is intentionally excluded.

---

## 4. Backend Edge Functions & Authorization

### 4.1 `manage-task-template` Edge Function
- **Endpoint**: `POST /functions/v1/manage-task-template`
- **Actions**: `list`, `get`, `create`, `update`, `duplicate`, `archive`, `restore`.
- **Identity & RBAC**:
  - Validates caller session via `supabaseAdmin.auth.getUser(jwt)`.
  - Queries `profiles` for role and active status.
  - Owners: full access.
  - Operational Managers: read Active templates only (`list` with `include_archived: false`, `get`). All mutation actions return HTTP 403 Forbidden.
  - Team Members & Clients: HTTP 403 Forbidden on all actions.
- **Claim-Before-Mutation Idempotency**:
  1. Checks `template_mutation_requests` for existing `(actor_id, action, idempotency_key)`.
  2. If found with status `completed`, returns the cached response payload immediately.
  3. If found with status `in_progress`, returns HTTP 409 Conflict.
  4. Otherwise, inserts an initial claim with `status: 'in_progress'`.
  5. Upon successful mutation and audit logging, updates the claim to `status: 'completed'` with the response payload.
- **Atomic Concurrency**:
  - `update`: Enforces `WHERE id = template_id AND version = expected_version`. If zero rows updated, distinguishes 404 Not Found from 409 Conflict (stale version).
  - `archive`: Enforces `WHERE id = template_id AND status = 'Active'`. If zero rows updated, returns 409 Conflict.
  - `restore`: Enforces `WHERE id = template_id AND status = 'Archived'`. If zero rows updated, returns 409 Conflict.
- **Mandatory Audit Logging**:
  - Inserts audit record into `system_audit_events` adhering strictly to existing schema columns (`actor_id`, `actor_name`, `actor_role`, `action`, `entity_type`, `entity_id`, `entity_name`, `previous_state`, `new_state`).
  - Explicitly verifies `{ error }` on audit insert; any failure aborts the operation and returns HTTP 500.

### 4.2 `manage-client-task` Edge Function
- Preserves existing `'create'` action vocabulary.
- When `source_template_id` is supplied:
  - Verifies template exists in `task_templates`.
  - Verifies template is `Active` (rejects archived templates with HTTP 400).
  - Locks `source_template_version` strictly to the template's current database `version`.
- Completely free of experimental `organizations` queries and cross-organization checks.

---

## 5. Bundle Optimization

- **Phase 3B Baseline**: `465.67 kB` (gzip: `84.58 kB`).
- **Phase 3C Unoptimized**: `493.81 kB` (gzip: `89.03 kB`).
- **Phase 3C Post-Optimization**: **`479.48 kB`** (gzip: **`87.11 kB`**).
- **Net Optimization**: Reduced main bundle by ~14.33 kB, leaving ~20.5 kB headroom beneath the 500 kB Vite warning threshold.
- `chunkSizeWarningLimit` remains at the strict default of 500 kB.

---

## 6. Verification & Automated Test Suite

- **All 7 test files passed**: 143 / 143 tests passing.
- **Legacy preservation**: All previous tests (Phase 1 through Phase 3B) pass unchanged.
- **Phase 3C Behavioral Tests**: 44 tests covering:
  - Business day calendar calculation (skipping weekends, roll-forward, clamping).
  - Task creation entry flow, lazy loading, single fallback CTA on backend unreadiness.
  - Template picker modal search, filtering, and prefill.
  - SOP checklist preview in read-only mode.
  - Strict RBAC: Owner full governance, Operational Manager read-only active templates, Team Member & Client HTTP 403 denial.
  - Claim-before-mutation idempotency and duplicate request replay.
  - Atomic concurrency: version checks (409) and archive/restore status checks (409).
  - Mandatory audit logging failure rollback.
  - `manage-client-task` action `'create'` preservation and immutable version locking.
