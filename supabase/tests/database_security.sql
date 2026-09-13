-- ==============================================================================
-- COMPREHENSIVE BEHAVIORAL pgTAP SECURITY & RLS TEST SUITE
-- Location: supabase/tests/database_security.sql
-- Database: PostgreSQL / Ephemeral Local Supabase Stack
-- ==============================================================================

BEGIN;

-- 41 Planned Behavioral Assertions
SELECT plan(41);

-- ------------------------------------------------------------------------------
-- 1. FIXTURE SETUP (Transactional Test Users & Entities)
-- ------------------------------------------------------------------------------

-- Role memberships to permit seamless role-switching during test execution
GRANT anon TO authenticated, service_role;
GRANT authenticated TO anon, service_role;
GRANT service_role TO anon, authenticated;

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO PUBLIC, authenticated, anon, service_role;

-- Auth helper routines (Non-SECURITY DEFINER so set_config('role') is permitted)
CREATE OR REPLACE FUNCTION tests.authenticate_as(p_user_id UUID, p_role TEXT DEFAULT 'authenticated')
RETURNS void AS $$
BEGIN
    PERFORM set_config('role', p_role, true);
    PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', p_role)::text, true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tests.authenticate_service_role()
RETURNS void AS $$
BEGIN
    PERFORM set_config('role', 'service_role', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '{"role": "service_role"}'::text, true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tests.clear_auth()
RETURNS void AS $$
BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
END;
$$ LANGUAGE plpgsql;

GRANT ALL ON ALL FUNCTIONS IN SCHEMA tests TO PUBLIC, authenticated, anon, service_role;

-- Insert Work Shifts
INSERT INTO public.work_shifts (id, name, code, start_time, end_time, crosses_midnight)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Standard Day Shift', 'DAY', '11:00:00', '20:00:00', false),
  ('a2222222-2222-2222-2222-222222222222', 'Overnight Shift', 'NIGHT', '20:00:00', '05:00:00', true)
ON CONFLICT (id) DO NOTHING;

-- Insert Work Schedules:
-- 1) Standard 6-Day Work Week (effective 2026-01-01, Mon-Sat)
-- 2) Future 5-Day Work Week (effective 2026-10-01, Mon-Fri)
INSERT INTO public.company_work_schedules (id, effective_from, working_days, description)
VALUES
  ('c1111111-1111-1111-1111-111111111111', '2026-01-01', ARRAY[1, 2, 3, 4, 5, 6], 'Standard 6-Day Work Week'),
  ('c2222222-2222-2222-2222-222222222222', '2026-10-01', ARRAY[1, 2, 3, 4, 5], 'Future 5-Day Work Week')
ON CONFLICT (id) DO NOTHING;

-- Insert Test Users into auth.users and profiles
INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, aud, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'client@ops-hub-test.local', '{"full_name": "Test Client"}'::jsonb, '{"provider": "email"}'::jsonb, now(), now(), 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'empa@ops-hub-test.local', '{"full_name": "Test Emp A"}'::jsonb, '{"provider": "email"}'::jsonb, now(), now(), 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'empb@ops-hub-test.local', '{"full_name": "Test Emp B"}'::jsonb, '{"provider": "email"}'::jsonb, now(), now(), 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'inactive@ops-hub-test.local', '{"full_name": "Inactive Emp"}'::jsonb, '{"provider": "email"}'::jsonb, now(), now(), 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', 'pending@ops-hub-test.local', '{"full_name": "Pending Emp"}'::jsonb, '{"provider": "email"}'::jsonb, now(), now(), 'authenticated', 'authenticated'),
  ('66666666-6666-6666-6666-666666666666', 'manager@ops-hub-test.local', '{"full_name": "Test Manager"}'::jsonb, '{"provider": "email"}'::jsonb, now(), now(), 'authenticated', 'authenticated'),
  ('77777777-7777-7777-7777-777777777777', 'owner@ops-hub-test.local', '{"full_name": "Test Owner"}'::jsonb, '{"provider": "email"}'::jsonb, now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, work_email, role, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test Client', 'client@ops-hub-test.local', 'client', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Test Emp A', 'empa@ops-hub-test.local', 'team_member', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'Test Emp B', 'empb@ops-hub-test.local', 'team_member', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'Inactive Emp', 'inactive@ops-hub-test.local', 'team_member', 'inactive'),
  ('55555555-5555-5555-5555-555555555555', 'Pending Emp', 'pending@ops-hub-test.local', 'team_member', 'active'),
  ('66666666-6666-6666-6666-666666666666', 'Test Manager', 'manager@ops-hub-test.local', 'operational_manager', 'active'),
  ('77777777-7777-7777-7777-777777777777', 'Test Owner', 'owner@ops-hub-test.local', 'owner', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, full_name = EXCLUDED.full_name;

-- Insert Employee Companion Records
INSERT INTO public.employee_records (id, employee_id, employment_type, salary, shift_id, employment_status, sop_acknowledged, setup_completed_at)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'EMP-001', 'full_time', 150000.00, 'a1111111-1111-1111-1111-111111111111', 'active', true, now()),
  ('33333333-3333-3333-3333-333333333333', 'EMP-002', 'full_time', 180000.00, 'a2222222-2222-2222-2222-222222222222', 'active', true, now()),
  ('44444444-4444-4444-4444-444444444444', 'EMP-003', 'full_time', 100000.00, 'a1111111-1111-1111-1111-111111111111', 'inactive', false, now()),
  ('55555555-5555-5555-5555-555555555555', 'EMP-004', 'full_time', 0.00, NULL, 'active', false, NULL)
ON CONFLICT (id) DO UPDATE SET setup_completed_at = EXCLUDED.setup_completed_at, employment_status = EXCLUDED.employment_status, salary = EXCLUDED.salary;

-- Seed Bank Details, Payroll, Assets for Emp A and Emp B
INSERT INTO public.employee_bank_details (employee_id, bank_name, account_title, account_number_or_iban)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'Meezan Bank', 'Emp A Title', 'PK36MEZN0000001234567890'),
  ('33333333-3333-3333-3333-333333333333', 'Habib Bank', 'Emp B Title', 'PK36HABB0000009876543210')
ON CONFLICT (employee_id) DO NOTHING;

INSERT INTO public.employee_payroll_records (id, employee_id, payroll_period, gross_salary, late_deductions_total, absence_deductions_total, net_payable, scheduled_payment_date, status)
VALUES
  ('e1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '2026-09', 150000.00, 1000.00, 5000.00, 144000.00, '2026-09-15', 'Draft'),
  ('e2222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '2026-09', 180000.00, 0.00, 0.00, 180000.00, '2026-09-15', 'Draft')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.company_assets (id, employee_id, item_name, issue_date, price, status)
VALUES
  ('ba111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'MacBook Pro M3 Max', '2026-09-01', 350000.00, 'assigned'),
  ('ba222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'Dell Precision Workstation', '2026-09-01', 280000.00, 'assigned')
ON CONFLICT (id) DO NOTHING;

-- Seed known attendance record owned by Emp A for mutation RLS testing
INSERT INTO public.employee_attendance (
    id, employee_id, work_date, shift_id, scheduled_check_in, scheduled_check_out,
    check_in_time, check_out_time, status, check_in_screenshot_path
) VALUES (
    '99999999-9999-9999-9999-999999999999',
    '22222222-2222-2222-2222-222222222222',
    '2026-09-10',
    'a1111111-1111-1111-1111-111111111111',
    '2026-09-10 11:00:00+05'::timestamptz,
    '2026-09-10 20:00:00+05'::timestamptz,
    '2026-09-10 11:00:00+05'::timestamptz,
    '2026-09-10 20:00:00+05'::timestamptz,
    'on_time',
    '22222222-2222-2222-2222-222222222222/checkin_a.jpg'
) ON CONFLICT (employee_id, work_date) DO UPDATE SET
    check_in_time = EXCLUDED.check_in_time,
    check_out_time = EXCLUDED.check_out_time,
    status = EXCLUDED.status;

-- Seed an unclosed night-shift attendance for Emp B (started yesterday at 20:00)
INSERT INTO public.employee_attendance (
    id, employee_id, work_date, shift_id, scheduled_check_in, scheduled_check_out,
    check_in_time, check_out_time, status, check_in_screenshot_path
) VALUES (
    '88888888-8888-8888-8888-888888888888',
    '33333333-3333-3333-3333-333333333333',
    (timezone('Asia/Karachi', now()) - interval '1 day')::date,
    'a2222222-2222-2222-2222-222222222222',
    ((timezone('Asia/Karachi', now()) - interval '1 day')::date || ' 20:00:00')::timestamp AT TIME ZONE 'Asia/Karachi',
    (timezone('Asia/Karachi', now())::date || ' 05:00:00')::timestamp AT TIME ZONE 'Asia/Karachi',
    ((timezone('Asia/Karachi', now()) - interval '1 day')::date || ' 20:00:00')::timestamp AT TIME ZONE 'Asia/Karachi',
    NULL,
    'on_time',
    '33333333-3333-3333-3333-333333333333/checkin_night.jpg'
) ON CONFLICT (employee_id, work_date) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. BEHAVIORAL ASSERTIONS
-- ------------------------------------------------------------------------------

-- 1. Anonymous Access Denied
SELECT tests.clear_auth();
SELECT is_empty('SELECT * FROM public.employee_attendance', '1. Anon cannot read employee attendance via RLS');
SELECT is_empty('SELECT * FROM public.employee_records', '2. Anon cannot read employee records via RLS');
SELECT throws_ok(
    $$ SELECT public.fn_employee_check_in('22222222-2222-2222-2222-222222222222/test.jpg') $$,
    '%authenticated session required%',
    '3. Anon check-in RPC is rejected with Unauthorized'
);

-- 2. Client Role Denied Attendance & Employee Records
SELECT tests.authenticate_as('11111111-1111-1111-1111-111111111111');
SELECT is_empty('SELECT * FROM public.employee_attendance', '4. Client role cannot read employee attendance');
SELECT is_empty('SELECT * FROM public.employee_records', '5. Client role cannot read employee records');
SELECT throws_ok(
    $$ SELECT public.fn_employee_check_in('11111111-1111-1111-1111-111111111111/test.jpg') $$,
    '%active internal employee profile required%',
    '6. Client role check-in RPC is rejected with Forbidden'
);

-- 3. Inactive Employee Denied Attendance
SELECT tests.authenticate_as('44444444-4444-4444-4444-444444444444');
SELECT throws_ok(
    $$ SELECT public.fn_employee_check_in('44444444-4444-4444-4444-444444444444/test.jpg') $$,
    '%active internal employee profile required%',
    '7. Inactive employee check-in RPC is rejected'
);

-- 4. Setup-Pending Employee Denied Attendance
SELECT tests.authenticate_as('55555555-5555-5555-5555-555555555555');
SELECT throws_ok(
    $$ SELECT public.fn_employee_check_in('55555555-5555-5555-5555-555555555555/test.jpg') $$,
    '%Employee setup is pending%',
    '8. Setup-pending employee check-in RPC is rejected'
);

-- 5. Active Employee Access Self vs Cross-Employee Isolation
SELECT tests.authenticate_as('22222222-2222-2222-2222-222222222222');
SELECT is(
    (SELECT COUNT(*)::int FROM public.employee_records WHERE id = '22222222-2222-2222-2222-222222222222'),
    1,
    '9. Active Emp A can read their own employee record'
);
SELECT is(
    (SELECT COUNT(*)::int FROM public.employee_records WHERE id = '33333333-3333-3333-3333-333333333333'),
    0,
    '10. Active Emp A cannot read Emp B employee record'
);
SELECT is(
    (SELECT COUNT(*)::int FROM public.employee_bank_details WHERE employee_id = '33333333-3333-3333-3333-333333333333'),
    0,
    '11. Cross-employee bank details access is denied'
);
SELECT is(
    (SELECT COUNT(*)::int FROM public.employee_payroll_records WHERE employee_id = '33333333-3333-3333-3333-333333333333'),
    0,
    '12. Cross-employee payroll records access is denied'
);
SELECT is(
    (SELECT COUNT(*)::int FROM public.company_assets WHERE employee_id = '33333333-3333-3333-3333-333333333333'),
    0,
    '13. Cross-employee company asset access is denied'
);
SELECT is(
    (SELECT COUNT(*)::int FROM public.employee_attendance WHERE employee_id = '33333333-3333-3333-3333-333333333333'),
    0,
    '14. Cross-employee attendance SELECT is denied by RLS'
);

-- 6. Direct Employee INSERT, UPDATE, DELETE Denied on Attendance (Must use RPC)
SELECT throws_ok(
    $$ INSERT INTO public.employee_attendance (employee_id, work_date, scheduled_check_in, scheduled_check_out, status)
       VALUES ('22222222-2222-2222-2222-222222222222', '2026-09-12', now(), now() + interval '8 hours', 'on_time') $$,
    '%violates row-level security policy%',
    '15. Direct employee INSERT on attendance table is denied by RLS'
);

-- Direct UPDATE fails RLS: returns zero rows and leaves underlying data unchanged
SELECT is_empty(
    $$ WITH updated AS (UPDATE public.employee_attendance SET check_out_time = now() WHERE id = '99999999-9999-9999-9999-999999999999' RETURNING id) SELECT * FROM updated $$,
    '16. Direct employee UPDATE on attendance affects 0 rows under RLS'
);
SELECT tests.authenticate_service_role();
SELECT is(
    (SELECT check_out_time = '2026-09-10 20:00:00+05'::timestamptz FROM public.employee_attendance WHERE id = '99999999-9999-9999-9999-999999999999'::uuid),
    true,
    '17. Attendance check_out_time remains unchanged in database after denied direct UPDATE'
);

-- Direct DELETE fails RLS: returns zero rows and leaves row in database
SELECT tests.authenticate_as('22222222-2222-2222-2222-222222222222');
SELECT is_empty(
    $$ WITH deleted AS (DELETE FROM public.employee_attendance WHERE id = '99999999-9999-9999-9999-999999999999' RETURNING id) SELECT * FROM deleted $$,
    '18. Direct employee DELETE on attendance affects 0 rows under RLS'
);
SELECT tests.authenticate_service_role();
SELECT is(
    (SELECT COUNT(*)::int FROM public.employee_attendance WHERE id = '99999999-9999-9999-9999-999999999999'::uuid),
    1,
    '19. Attendance record still exists in database after denied direct DELETE'
);

-- 7. Direct Employee Modification of Protected Governance Fields Denied
SELECT tests.authenticate_as('22222222-2222-2222-2222-222222222222');
SELECT is_empty(
    $$ WITH updated AS (UPDATE public.employee_records SET salary = 999999.00 WHERE id = '22222222-2222-2222-2222-222222222222' RETURNING id) SELECT * FROM updated $$,
    '20. Direct employee UPDATE on salary affects 0 rows under RLS'
);
SELECT tests.authenticate_service_role();
SELECT is(
    (SELECT salary FROM public.employee_records WHERE id = '22222222-2222-2222-2222-222222222222'::uuid),
    150000.00,
    '21. Employee salary remains unchanged in database after denied direct UPDATE'
);

-- 8. Screenshot Path Ownership & Traversal Defense
SELECT tests.authenticate_as('22222222-2222-2222-2222-222222222222');
SELECT throws_ok(
    $$ SELECT public.fn_employee_check_in('33333333-3333-3333-3333-333333333333/checkin.jpg') $$,
    '%must reside in authenticated employee directory%',
    '22. Using another employee screenshot path is strictly rejected'
);
SELECT throws_ok(
    $$ SELECT public.fn_employee_check_in('22222222-2222-2222-2222-222222222222/../../../etc/passwd.jpg') $$,
    '%must reside in authenticated employee directory%',
    '23. Directory traversal in screenshot path is strictly rejected'
);

-- 9. Cron RPC Access Control (Service Role ONLY)
SELECT throws_ok(
    $$ SELECT public.fn_cron_process_attendance_automation() $$,
    '%permission denied%',
    '24. Employee role cannot execute attendance automation cron RPC'
);

SELECT tests.authenticate_as('77777777-7777-7777-7777-777777777777'); -- Owner
SELECT throws_ok(
    $$ SELECT public.fn_cron_process_attendance_automation() $$,
    '%permission denied%',
    '25. Owner role cannot execute cron RPC (service_role only)'
);

SELECT tests.authenticate_as('66666666-6666-6666-6666-666666666666'); -- Manager
SELECT throws_ok(
    $$ SELECT public.fn_cron_process_attendance_automation() $$,
    '%permission denied%',
    '26. Operational Manager role cannot execute cron RPC (service_role only)'
);

SELECT tests.authenticate_service_role();
SELECT lives_ok(
    $$ SELECT public.fn_cron_process_attendance_automation() $$,
    '27. Service role can execute attendance automation cron RPC'
);

-- 10. Management Visibility for Owner & Operational Manager
SELECT tests.authenticate_as('77777777-7777-7777-7777-777777777777'); -- Owner
SELECT is(
    (SELECT COUNT(*)::int FROM public.employee_records),
    4,
    '28. Owner can view all internal employee companion records'
);
SELECT is(
    (SELECT COUNT(*)::int FROM public.employee_payroll_records),
    2,
    '29. Owner can view all payroll records across employees'
);

SELECT tests.authenticate_as('66666666-6666-6666-6666-666666666666'); -- Manager
SELECT is(
    (SELECT COUNT(*)::int FROM public.employee_records),
    4,
    '30. Operational Manager can view all internal employee companion records'
);

-- 11. Asset Acknowledgement Protected Fields
SELECT tests.authenticate_as('22222222-2222-2222-2222-222222222222');
SELECT lives_ok(
    $$ SELECT public.fn_employee_acknowledge_asset('ba111111-1111-1111-1111-111111111111'::uuid) $$,
    '31. Emp A can acknowledge assigned asset'
);
SELECT is(
    (SELECT status FROM public.company_assets WHERE id = 'ba111111-1111-1111-1111-111111111111'::uuid),
    'acknowledged',
    '32. Asset status updated to acknowledged'
);
SELECT is(
    (SELECT price FROM public.company_assets WHERE id = 'ba111111-1111-1111-1111-111111111111'::uuid),
    350000.00,
    '33. Asset price remains immutable during acknowledgement'
);

-- 12. Payroll Concern Protected Fields
SELECT lives_ok(
    $$ SELECT public.fn_employee_raise_payroll_concern('e1111111-1111-1111-1111-111111111111'::uuid, 'Late deduction dispute for Sept 10') $$,
    '34. Emp A can raise payroll concern'
);
SELECT is(
    (SELECT gross_salary FROM public.employee_payroll_records WHERE id = 'e1111111-1111-1111-1111-111111111111'::uuid),
    150000.00,
    '35. Gross salary remains immutable when concern is raised'
);
SELECT is(
    (SELECT net_payable FROM public.employee_payroll_records WHERE id = 'e1111111-1111-1111-1111-111111111111'::uuid),
    144000.00,
    '36. Net payable remains immutable when concern is raised'
);

-- 13. Dynamic Company Working Schedule: Sunday Excluded & Future 5-Day Schedule
SELECT is(
    public.fn_is_company_working_day('2026-09-13'::date),
    false,
    '37. Sunday (2026-09-13) is excluded under current 6-day schedule'
);
SELECT is(
    public.fn_is_company_working_day('2026-09-14'::date),
    true,
    '38. Monday (2026-09-14) is included under current 6-day schedule'
);
SELECT is(
    public.fn_is_company_working_day('2026-10-03'::date),
    false,
    '39. Saturday (2026-10-03) is excluded under future effective 5-day schedule without code change'
);

-- 14. Overnight Shift Retrieval & Late Checkout after 5:00 AM
SELECT tests.authenticate_as('33333333-3333-3333-3333-333333333333'); -- Emp B (Night Shift 20:00 - 05:00)
SELECT is(
    (public.fn_employee_get_current_attendance() ->> 'id'),
    '88888888-8888-8888-8888-888888888888',
    '40. Correct unclosed night shift attendance ID is returned for late checkout after 05:00 AM'
);

-- 15. Repeated Automation Cycle Row Count Comparison & Idempotency
SELECT tests.authenticate_service_role();
DO $$
DECLARE
    v_tasks_before int;
    v_att_before int;
    v_tasks_after int;
    v_att_after int;
BEGIN
    -- First cycle
    PERFORM public.fn_cron_process_attendance_automation();

    SELECT count(*)::int INTO v_tasks_before FROM public.employee_management_tasks;
    SELECT count(*)::int INTO v_att_before FROM public.employee_attendance;

    -- Second cycle
    PERFORM public.fn_cron_process_attendance_automation();

    SELECT count(*)::int INTO v_tasks_after FROM public.employee_management_tasks;
    SELECT count(*)::int INTO v_att_after FROM public.employee_attendance;

    IF v_tasks_after <> v_tasks_before THEN
        RAISE EXCEPTION 'Idempotency violation: tasks increased from % to %', v_tasks_before, v_tasks_after;
    END IF;

    IF v_att_after <> v_att_before THEN
        RAISE EXCEPTION 'Idempotency violation: attendance records increased from % to %', v_att_before, v_att_after;
    END IF;
END;
$$;

SELECT ok(
    true,
    '41. Running automation cycle twice creates ZERO duplicate anomaly tasks or attendance records'
);

SELECT * FROM finish();
ROLLBACK;
