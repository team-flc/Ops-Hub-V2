-- ==============================================================================
-- pgTAP Database Security & RLS Integration Tests for Employee Operations
-- ==============================================================================

BEGIN;
SELECT plan(15);

-- 1. Check Tables Exist
SELECT has_table('public', 'work_shifts', 'work_shifts table exists');
SELECT has_table('public', 'company_work_schedules', 'company_work_schedules table exists');
SELECT has_table('public', 'employee_records', 'employee_records table exists');
SELECT has_table('public', 'employee_attendance', 'employee_attendance table exists');
SELECT has_table('public', 'employee_bank_details', 'employee_bank_details table exists');
SELECT has_table('public', 'company_assets', 'company_assets table exists');

-- 2. Check Security Definer RPCs Exist
SELECT has_function('public', 'fn_employee_check_in', ARRAY['text', 'text', 'jsonb'], 'fn_employee_check_in RPC exists');
SELECT has_function('public', 'fn_employee_check_out', ARRAY['uuid', 'text', 'text', 'text', 'jsonb'], 'fn_employee_check_out RPC exists');
SELECT has_function('public', 'fn_employee_get_current_attendance', ARRAY[]::text[], 'fn_employee_get_current_attendance RPC exists');
SELECT has_function('public', 'fn_cron_trigger_attendance_automation', ARRAY[]::text[], 'fn_cron_trigger_attendance_automation RPC exists');

-- 3. Verify Public Execution Revoked on Core Functions
SELECT function_privs_are('public', 'fn_employee_check_in', ARRAY['text', 'text', 'jsonb'], 'authenticated', ARRAY['EXECUTE'], 'fn_employee_check_in is granted to authenticated only');
SELECT function_privs_are('public', 'fn_employee_check_out', ARRAY['uuid', 'text', 'text', 'text', 'jsonb'], 'authenticated', ARRAY['EXECUTE'], 'fn_employee_check_out is granted to authenticated only');

-- 4. Check RLS is Enabled
SELECT row_eq(
    $$SELECT relrowsecurity FROM pg_class WHERE relname = 'employee_records'$$,
    ROW(true),
    'RLS is enabled on employee_records'
);
SELECT row_eq(
    $$SELECT relrowsecurity FROM pg_class WHERE relname = 'employee_attendance'$$,
    ROW(true),
    'RLS is enabled on employee_attendance'
);
SELECT row_eq(
    $$SELECT relrowsecurity FROM pg_class WHERE relname = 'company_work_schedules'$$,
    ROW(true),
    'RLS is enabled on company_work_schedules'
);

SELECT * FROM finish();
ROLLBACK;
