-- ==============================================================================
-- MIGRATION: 20260913000005_employee_operations_bank_and_persistence.sql
-- Description:
--   1. Allow unverified/blank account titles in employee_bank_details (drop chk_account_title, drop NOT NULL).
--   2. Add optional account_number, iban, and branch_code columns to employee_bank_details for explicit schema fidelity.
--   3. Ensure Management RLS policy permits direct insert/update/upsert on employee_bank_details.
--   4. Ensure employees have read-only access to their own bank details.
-- ==============================================================================

-- 1. Schema fidelity for employee_bank_details
ALTER TABLE public.employee_bank_details DROP CONSTRAINT IF EXISTS chk_account_title;
ALTER TABLE public.employee_bank_details ALTER COLUMN account_title DROP NOT NULL;
ALTER TABLE public.employee_bank_details ALTER COLUMN account_title SET DEFAULT '';

ALTER TABLE public.employee_bank_details ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE public.employee_bank_details ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE public.employee_bank_details ADD COLUMN IF NOT EXISTS branch_code TEXT;

-- 2. Ensure RLS policies on employee_bank_details
ALTER TABLE public.employee_bank_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employee can read own bank details" ON public.employee_bank_details;
CREATE POLICY "Employee can read own bank details"
    ON public.employee_bank_details FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Management can manage bank details" ON public.employee_bank_details;
CREATE POLICY "Management can manage bank details"
    ON public.employee_bank_details FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));
