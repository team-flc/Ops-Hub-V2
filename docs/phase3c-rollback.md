# Phase 3C: Task Templates System — Rollback Documentation

## 1. Executive Summary

This document specifies the step-by-step rollback procedures for Phase 3C (Task Templates System). Because Phase 3C was developed under strict isolation boundaries:
- The database migration has **not** been applied to remote production Supabase.
- The `manage-task-template` Edge Function has **not** been deployed to production.
- Production `main` remains at commit `37d5e824b7f15856cfaf47e93d443085f0efdf5a` (Phase 3B Owner Only Beta).
- The feature branch `feature/phase3c-task-templates` contains all Phase 3C code.

Should any rollback be required either during feature branch evaluation or after a future production rollout, execute the procedures detailed below.

---

## 2. Frontend Rollback Procedures

### Scenario A: Rollback on Feature Branch / Preview
To revert the feature branch to the Phase 3B production baseline:
```bash
git checkout feature/phase3c-task-templates
git reset --hard 37d5e824b7f15856cfaf47e93d443085f0efdf5a
git push origin feature/phase3c-task-templates --force
```
Cloudflare Pages Preview will automatically rebuild and serve the Phase 3B baseline.

### Scenario B: Rollback after Production Release (Future)
If Phase 3C is merged into `main` and needs immediate rollback:
```bash
git checkout main
git revert -m 1 <merge-commit-sha> -m "revert: rollback Phase 3C task templates"
git push origin main
```
Cloudflare Pages Production will automatically redeploy the clean Phase 3B build.

---

## 3. Backend Edge Function Rollback Procedures

If Edge Functions are deployed in a future release and encounter anomalies:

### 3.1 `manage-task-template`
- If deployed, this is a net-new function.
- It can be decommissioned or disabled without impacting any other platform capabilities:
  ```bash
  # Delete or unpublish from Supabase CLI
  supabase functions delete manage-task-template --project-ref <project-ref>
  ```
- With `manage-task-template` removed, the frontend gracefully falls back to Blank Task mode without throwing unhandled exceptions.

### 3.2 `manage-client-task`
- Re-deploy Phase 3B Version 3 of `manage-client-task`:
  ```bash
  git checkout 37d5e824b7f15856cfaf47e93d443085f0efdf5a -- supabase/functions/manage-client-task/index.ts
  supabase functions deploy manage-client-task --project-ref <project-ref>
  ```
- The Phase 3B Version 3 code continues to operate seamlessly with existing `client_tasks`.

---

## 4. Database Rollback Procedures (Down-Migration)

If `supabase/migrations/20260908_phase3c_task_templates.sql` is applied to remote Supabase in a future rollout and needs full reversal, execute the following non-destructive down-migration script:

```sql
-- ==============================================================================
-- PHASE 3C DOWN-MIGRATION / ROLLBACK SCRIPT
-- ==============================================================================

BEGIN;

-- 1. Remove foreign key columns from client_tasks (non-destructive to tasks)
ALTER TABLE IF EXISTS public.client_tasks 
  DROP COLUMN IF EXISTS source_template_version,
  DROP COLUMN IF EXISTS source_template_id;

-- 2. Drop RLS policies on task_templates
DROP POLICY IF EXISTS "task_templates_select_active" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_select_owner" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_insert_owner" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_update_owner" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_delete_owner" ON public.task_templates;

-- 3. Drop indexes on task_templates
DROP INDEX IF EXISTS public.idx_task_templates_org;
DROP INDEX IF EXISTS public.idx_task_templates_category;
DROP INDEX IF EXISTS public.idx_task_templates_status;
DROP INDEX IF EXISTS public.uq_idx_task_templates_seed_key;

-- 4. Drop task_templates table
DROP TABLE IF EXISTS public.task_templates CASCADE;

COMMIT;
```

### Data Impact Assessment
- **Existing Tasks**: Zero impact. All `client_tasks` created before or during Phase 3C retain their complete status, assignees, dates, deliverables, and Phase 3B conversation feeds.
- **Client Records**: Zero impact.
- **Audit Logs**: Historical audit events recording `TEMPLATE_CREATED` or `TASK_CREATED` remain preserved in `system_audit_events` for governance integrity.
