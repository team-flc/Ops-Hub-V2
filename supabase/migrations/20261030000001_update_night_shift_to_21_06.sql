-- Migration: 20261030000001_update_night_shift_to_21_06.sql
-- Description: Update Night Shift schedule boundaries to 21:00:00 - 06:00:00 PKT (9:00 PM - 6:00 AM PKT)
--              Ensure single Night Shift record and preserve all existing staff assignments.

BEGIN;

-- 1. Update existing Night Shift record
UPDATE public.work_shifts
SET
  start_time = '21:00:00'::time,
  end_time = '06:00:00'::time,
  crosses_midnight = true,
  updated_at = NOW()
WHERE code = 'night' OR LOWER(name) LIKE '%night%';

-- 2. Clear any legacy custom override of 20:00 / 05:00 on employee records if present
UPDATE public.employee_records
SET custom_check_in_time = '21:00:00'::time
WHERE custom_check_in_time = '20:00:00'::time;

UPDATE public.employee_records
SET custom_check_out_time = '06:00:00'::time
WHERE custom_check_out_time = '05:00:00'::time;

COMMIT;
