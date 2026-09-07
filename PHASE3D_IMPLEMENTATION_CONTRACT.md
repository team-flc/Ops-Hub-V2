# Phase 3D Implementation Contract: Service Templates, Work Plans & System Hardening

**Repository**: `Ops-Hub-V2`  
**Baseline Git Commit**: `adc9c15a0a8644add66c183aaf4bb8d15a63e8ce`  
**Feature Branch**: `feature/phase3d-service-templates-work-plans`  
**Local Baseline Test Inventory**: 8 test files, 160 passing tests (0 failing)  

---

## 1. Baseline Inventory & Discovered Entities

### 1.1 Existing Migrations
1. `20260831000001_phase1_auth_profiles_rls.sql`
2. `20260831000002_phase1_1_fix_profiles_rls_recursion.sql`
3. `20260831000003_phase2a_team_user_management.sql`
4. `20260901000001_phase2b_client_management.sql`
5. `20260901000002_phase2b_client_linkedin_access.sql`
6. `20260901000003_phase3a_operational_task_core.sql`
7. `20260902000001_phase3a1_connected_foundation_profiles_archive_audit.sql`
8. `20260903000001_phase3a1_security_corrections.sql`
9. `20260907000001_phase3b_task_conversation_review_approval.sql`
10. `20260908000001_phase3c_task_templates.sql`

### 1.2 Established Authorization & Business Constraints
- **Caller Roles**: `owner`, `operational_manager`, `team_member`, `client`.
- **Client Access**: Enforced via `app_private.can_access_client(caller_id, client_id)` and `can_manage_client`.
- **Team Access**: Enforced via `app_private.can_manage_team_member(caller_id, target_id)`.
- **Tasks**: Scoped to clients; status workflow includes Draft, In Progress, Team Review, Client Review, Completed, Blocked. Approval modes: `Internal Only` vs `Client Approval Required`.
- **Existing 30-Day Setup**: Week 1-4 structure preserved; existing tasks must not be corrupted or remapped.

---

## 2. Proposed Additive Schema Changes

New migration: `supabase/migrations/20260909000001_phase3d_service_templates_work_plans.sql`

### 2.1 Entities
1. **`service_templates`**: Multi-task service templates (Name, Service Label, Description, Status [Active/Archived], Version, CreatedBy, UpdatedBy).
2. **`service_template_tasks`**: Ordered task definitions per template (Title, SOP/Description, Department, Priority, Approval Mode, Planned Offset Days, Duration Business Days, Display Order).
3. **`service_template_versions`**: Immutable JSON snapshots of template revisions.
4. **`client_work_plans`**: Client 90-calendar-day work plans (ClientID, Name, Status [Draft/Launched/Archived], StartDate, EndDate = StartDate + 89, Revision, PlanData JSON, LaunchSnapshot JSON, LaunchedAt, LaunchedBy).
5. **`task_launch_batches`**: Transactional launch batch registry backing idempotency (`uq_launch_batch_idempotency` on `(actor_id, request_id)`).
6. **`client_tasks` Companion Columns**:
   - `plan_id` (UUID references `client_work_plans`)
   - `plan_week` (INTEGER 1..13)
   - `occurrence_id` (UUID)
   - `launch_batch_id` (UUID references `task_launch_batches`)
7. **Backfill**:
   - Safely reads existing single-task `public.task_templates` and populates `service_templates` and `service_template_tasks` (using identical UUIDs so references from `client_tasks` are preserved).
   - Idempotent `ON CONFLICT DO NOTHING`.

### 2.2 Security & Transactional Functions
- `public.fn_launch_task_batch(...)`:
  - Enforces caller active profile & role.
  - Enforces client access & active client status (rejects archived or paused clients).
  - Enforces that all created tasks are `status = 'Draft'` and `assignee_id = null`.
  - Atomic single-transaction insert of all task rows and launch batch.
  - Returns identical result on network retry (idempotency key).
  - Rejects overlapping active launched plans for the same client.

---

## 3. Existing Behavior Preserved Without Regression
- 30-Day Setup four-week views (`week1` - `week4`) remain fully operational.
- Existing single-task creation flow (+ Add Task) remains available alongside "Apply Service Template".
- Existing Phase 3B conversation feed, internal notes isolation, review & approval workflows remain intact.
- Archive center and audit log tamper-proof tracking remain untouched.
- Modal portals render to `document.body` outside transformed Sidebar containers.

---

## 4. Implementation Stages

- **Stage A**: Domain model, migrations, backfill script, and backward compatibility.
- **Stage B**: Service Template builder, versioning, and unified launch engine.
- **Stage C**: User provisioning permissions (Owner -> Mgr/Member; Mgr -> Member only).
- **Stage D**: 90-Day Work Plan builder, 13-week calendar/business-day engine, draft persistence, and plan launch.
- **Stage E**: Monochrome UI palette, Sidebar client links, and mobile layout polish.
- **Stage F**: Comprehensive test suite execution, type checking, build verification, and final reporting.

---

## 5. Acceptance Criteria & Test Mapping

1. **Service Templates**:
   - Master template contains N ordered tasks -> Launch creates exactly N tasks.
   - All created tasks have `status = 'Draft'` and `assignee_id = null`.
   - Modifying a launch occurrence does not mutate the master template.
   - Master edits do not rewrite already launched tasks.
   - Test file: `tests/phase3dServiceTemplatesAndWorkPlans.test.tsx`
2. **Launch Engine & Idempotency**:
   - Duplicate `request_id` returns previous batch without creating duplicate tasks.
   - Reused `request_id` with altered payload is rejected.
   - Paused or archived clients reject bulk task launch.
   - Test file: `tests/phase3dServiceTemplatesAndWorkPlans.test.tsx`
3. **90-Day Work Plan**:
   - Date range is exactly 90 calendar days inclusive (Start to Start + 89).
   - Weeks 1–12 have 7 days; Week 13 has 6 days.
   - Sunday / weekend exclusion adheres to Asia/Karachi calendar.
   - Draft plans persist across refreshes without generating task records until manual launch.
   - Overlapping active plan ranges for the same client are denied.
   - Test file: `tests/phase3dServiceTemplatesAndWorkPlans.test.tsx`
4. **User Creation Matrix**:
   - Owner can create Operational Manager and Team Member.
   - Operational Manager can create Team Member only.
   - No user can create Owner.
   - Forged role payloads are rejected server-side.
   - Test file: `tests/teamManagement.test.tsx` / `tests/phase3dServiceTemplatesAndWorkPlans.test.tsx`
5. **Sidebar Links & Monochrome UI**:
   - Client links reside in Sidebar, update immediately on client switch, and open in new tabs.
   - Top Header remains compact.
   - Modals portal to `document.body`.
   - Palette restricted to brand red, white, near-black, and neutral grayscale.

---

## 6. Verification Boundaries & Deployment Strategy

- **Local Verification**: All unit tests, component tests, DOM structure tests, and build checks run in the local working directory.
- **Remote Boundaries**: No migrations applied to remote Supabase; no live Edge Functions deployed; no remote database mutations performed.
- **Backward Compatibility**: If the deployed backend does not have Phase 3D migrations yet, client-side graceful feature detection displays a clear status notice rather than crashing.
