-- ==============================================================================
-- MIGRATION: 20260913000006_allow_nullable_task_dates_for_templates.sql
-- Description: Allow nullable planned_start and due_date in client_tasks for
--              service template and batch task launches in Draft status.
-- ==============================================================================

ALTER TABLE public.client_tasks ALTER COLUMN planned_start DROP NOT NULL;
ALTER TABLE public.client_tasks ALTER COLUMN due_date DROP NOT NULL;

ALTER TABLE public.client_tasks DROP CONSTRAINT IF EXISTS chk_task_due_after_start;
ALTER TABLE public.client_tasks ADD CONSTRAINT chk_task_due_after_start
    CHECK (due_date IS NULL OR planned_start IS NULL OR due_date > planned_start);
