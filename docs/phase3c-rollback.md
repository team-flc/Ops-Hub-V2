# Phase 3C: Task Templates System — Rollback Documentation

## 1. Executive Summary

This document specifies the rollback procedures for Phase 3C (Task Templates System). Because Phase 3C is developed under strict isolation boundaries:
- The database migration has **not** been applied to remote production Supabase.
- The `manage-task-template` Edge Function and transactional RPC have **not** been deployed to production.
- Production `main` remains at commit `37d5e824b7f15856cfaf47e93d443085f0efdf5a` (Phase 3B Owner Only Beta).
- The feature branch `feature/phase3c-task-templates` contains all Phase 3C code.

---

## 2. Application & Edge Function Revert Procedures

All code reverts must use standard Git forward commits (`git revert`). Never use `git reset --hard` or force-push on shared or deployment branches.

### 2.1 Feature Branch / Preview Evaluation
To revert experimental changes on the feature branch while maintaining linear Git history:
```bash
git checkout feature/phase3c-task-templates
git revert --no-edit <commit-sha>
git push origin feature/phase3c-task-templates
```

### 2.2 Post-Production Merge Revert (Future)
If Phase 3C is merged into `main` and needs immediate frontend/function rollback:
```bash
git checkout main
git revert -m 1 <merge-commit-sha> -m "revert: rollback Phase 3C task templates"
git push origin main
```
Cloudflare Pages Production will automatically build and deploy the reverted codebase.

### 2.3 Edge Functions Decommissioning
- **`manage-task-template`**: Net-new Edge Function. If deployed, disable or delete via Supabase CLI:
  ```bash
  supabase functions delete manage-task-template --project-ref <project-ref>
  ```
- **`manage-client-task`**: Re-deploy the Phase 3B baseline version from `main`:
  ```bash
  git checkout 37d5e824b7f15856cfaf47e93d443085f0efdf5a -- supabase/functions/manage-client-task/index.ts
  supabase functions deploy manage-client-task --project-ref <project-ref>
  ```

---

## 3. Database Rollback Strategies

### Strategy A: Forward-Safe Post-Launch Rollback (Recommended once production data exists)
When production data has already been written (e.g. customized agency templates created or client tasks instantiated with template provenance):
1. **Preserve Database Tables & Provenance Columns**: Leave `task_templates`, `template_mutation_requests`, `client_tasks.source_template_id`, `client_tasks.source_template_version`, and audit events in `system_audit_events` intact.
2. **Revert Frontend & Edge Functions**: Reverting the application code gracefully returns the user interface to legacy task creation. The frontend's built-in backend-unavailability guards automatically fallback to Blank Task mode without data loss.
3. **Draft Reviewed Forward Migration**: If schema changes are needed, apply an additive forward migration rather than dropping populated tables.

### Strategy B: Pre-Data Cleanup / Destructive Purge (Strictly allowed ONLY before real production data exists)
If `supabase/migrations/20260908000001_phase3c_task_templates.sql` was applied in staging or before any real production template data was created, execute the following destructive purge script:

```sql
-- ==============================================================================
-- PHASE 3C DESTRUCTIVE PURGE SCRIPT (Pre-Data Cleanup Only)
-- WARNING: Drops task_templates, template_mutation_requests, and RPC functions.
-- ==============================================================================

BEGIN;

-- 1. Remove companion columns from client_tasks
ALTER TABLE IF EXISTS public.client_tasks 
  DROP COLUMN IF EXISTS source_template_version,
  DROP COLUMN IF EXISTS source_template_id;

-- 2. Drop RPC function
DROP FUNCTION IF EXISTS public.fn_manage_task_template_mutation(UUID, TEXT, TEXT, JSONB);

-- 3. Drop RLS policies on template_mutation_requests and task_templates
DROP POLICY IF EXISTS "template_mutation_deny_all" ON public.template_mutation_requests;
DROP POLICY IF EXISTS "task_templates_select" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_insert_deny" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_update_deny" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_delete_deny" ON public.task_templates;

-- 4. Drop tables (CASCADE removes foreign keys, indexes, and named constraints)
DROP TABLE IF EXISTS public.template_mutation_requests CASCADE;
DROP TABLE IF EXISTS public.task_templates CASCADE;

COMMIT;
```

---

## 4. Schema References & Invariants Reference
- **Foreign Key Invariants**:
  - `task_templates.department_id` -> `public.departments(id)` (`ON DELETE RESTRICT`)
  - `task_templates.created_by`, `updated_by`, `archived_by` -> `public.profiles(id)` (`ON DELETE SET NULL`)
  - `template_mutation_requests.actor_id` -> `public.profiles(id)` (`ON DELETE RESTRICT`)
  - `client_tasks.source_template_id` -> `public.task_templates(id)` (`ON DELETE SET NULL`)
- **Exact Named Constraints**:
  - `chk_task_templates_name`
  - `chk_task_templates_default_title`
  - `chk_task_templates_priority`
  - `chk_task_templates_approval_mode`
  - `chk_task_templates_duration`
  - `chk_task_templates_status`
  - `chk_task_templates_version`
  - `chk_template_mutation_status` (`CHECK (status IN ('processing', 'completed', 'failed'))`)
- **Exact Index Names**:
  - `uq_idx_task_templates_seed_key`
  - `idx_task_templates_status_sort`
  - `idx_task_templates_department`
  - `idx_client_tasks_source_template`
  - `idx_template_mutation_lookup`
