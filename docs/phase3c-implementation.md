# Phase 3C: Task Templates System — Implementation Documentation

## 1. Overview & Architecture

Phase 3C introduces a complete, production-grade Task Templates System to Ops Hub v2. The system enables organizations to standardize operational workflows by defining reusable task templates that can be instantiated into client tasks during weekly setup cycles.

The implementation adheres to strict enterprise multi-tenant isolation, defense-in-depth authorization, non-destructive referencing, and backward compatibility with all Phase 3A/3B task workflows.

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
  - `fetchActiveTemplates()`: Retrieves organization-scoped active templates. Returns `isUnavailable: true` on network failure, missing tables, or 404/500 backend responses, enabling zero-crash fallback behavior.
  - `fetchAllTemplates()`: Retrieves all templates (active and archived) for Owner management.
  - `createTemplate()`, `updateTemplate()`, `duplicateTemplate()`, `archiveTemplate()`, `restoreTemplate()`: Edge Function invocation wrappers with normalized error codes.

---

## 3. Database Schema & Migration (`supabase/migrations/20260908_phase3c_task_templates.sql`)

### 3.1 `task_templates` Table
```sql
CREATE TABLE IF NOT EXISTS public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Operations',
  recommended_week INTEGER NOT NULL DEFAULT 1 CHECK (recommended_week BETWEEN 1 AND 4),
  default_priority TEXT NOT NULL DEFAULT 'Medium' CHECK (default_priority IN ('Low', 'Medium', 'High', 'Urgent')),
  default_assignee_role TEXT NOT NULL DEFAULT 'Team Member' CHECK (default_assignee_role IN ('Owner', 'Operational Manager', 'Team Member')),
  default_approval_mode TEXT NOT NULL DEFAULT 'internal_only' CHECK (default_approval_mode IN ('internal_only', 'client_review')),
  default_visibility TEXT NOT NULL DEFAULT 'internal' CHECK (default_visibility IN ('internal', 'shared')),
  deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_duration_hours NUMERIC(6, 2),
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
  seed_key TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 Companion Columns on `client_tasks`
- `source_template_id UUID REFERENCES public.task_templates(id) ON DELETE SET NULL`: Records template provenance without preventing template deletion or archival. Nullable for blank/manual tasks.
- `source_template_version INTEGER`: Immutable snapshot of the template version at the moment the task was instantiated.

### 3.3 Starter Seed Idempotency
- Uses a unique, organization-scoped `seed_key = 'media_buying_campaign_setup_v1'`.
- Guaranteed idempotent: Re-running the migration will never insert duplicate starter templates, even if an Owner has edited or renamed the template in their organization.

### 3.4 Row-Level Security (RLS) Policies
- Strict tenant boundary: `WHERE organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())`.
- Read: Available to Owners and Operational Managers for Active templates; Owners can also view Archived templates.
- Write (Insert, Update, Delete): Restricted exclusively to Owners.
- Client and Team Member accounts are denied all direct access to `task_templates`.
- Realtime publication excluded: `task_templates` is intentionally not registered with `supabase_realtime` to avoid unnecessary connection overhead.

---

## 4. Backend Edge Functions & Authorization

### 4.1 `manage-task-template` Edge Function
- **Endpoint**: `POST /functions/v1/manage-task-template`
- **Enforced JWT Verification**: `verify_jwt = true` configured in `supabase/config.toml`.
- **Identity Resolution**: Resolved via `supabase.auth.getUser()`; client-supplied roles or organization IDs are completely ignored.
- **Role Enforcement Matrix**:
  - `list_active`: Allowed for Owner, Operational Manager. Denied for Team Member, Client.
  - `list_all`: Allowed for Owner only.
  - `create`, `update`, `duplicate`, `archive`, `restore`: Allowed for Owner only.
- **Idempotency & Replay**:
  - Validates `idempotency_key` and detects recent identical submissions.
  - Replays `archive` idempotently if the template is already archived.
  - Replays `restore` idempotently if the template is already active.
- **Audit Logging**: Inserts directly into `public.system_audit_events` with exact schema compliance (`actor_name`, `actor_role`, `client_id`, `new_state`, `metadata`).

### 4.2 `manage-client-task` Edge Function (Phase 3C Updates)
- **Provenance Validation**: When `source_template_id` is supplied:
  1. Validates that the template exists within the actor's organization.
  2. Ensures the template is currently `Active` (rejects `Archived` templates).
  3. Validates version alignment.
  4. Stores `source_template_id` and `source_template_version` in the created `client_tasks` record.
- **Task Decoupling**: Subsequent edits or archival of the parent template have zero effect on existing instantiated tasks.
- **Audit Logging**: Emits `TASK_CREATED` audit events with `source_template_id` in metadata.

---

## 5. Bundle Optimization

- **Phase 3B Baseline**: `465.67 kB` (gzip: `84.58 kB`).
- **Phase 3C Unoptimized**: `493.81 kB` (gzip: `89.03 kB`).
- **Phase 3C Post-Optimization**: **`479.48 kB`** (gzip: **`87.11 kB`**).
- **Net Optimization**: Reduced main bundle by ~14.33 kB, leaving ~20.5 kB headroom beneath the 500 kB Vite warning threshold.
- `chunkSizeWarningLimit` remains at the strict default of 500 kB.

---

## 6. Verification & Automated Test Suite

- **All 7 test files passed**: 133 / 133 tests passing.
- **Legacy preservation**: All 99 previous tests (Phase 1 through Phase 3B) pass unchanged.
- **Phase 3C Behavioral Tests**: 34 tests covering:
  - Task creation chooser UI and Blank Task pass-through.
  - Single fallback CTA on backend unavailability.
  - Settings template management disabled state and explanatory banner.
  - Code-splitting and lazy-loading verification.
  - Multi-tenant boundary enforcement and cross-organization denial.
  - Edge Function JWT verification and role matrix.
  - Template archival lifecycle and non-destructive decoupling.
  - Seed key idempotency across template renames.
