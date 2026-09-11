-- ==============================================================================
-- MIGRATION: 20260912000001_employee_operations_system.sql
-- Description: Comprehensive Employee Operations System for Faseeh Lall & Co. Ops Hub V2.
--              Includes:
--              1. Work Shifts & Company Schedules (Effective-dated Mon-Sat schedule)
--              2. Companion Employee Records (1:1 with public.profiles)
--              3. Employee Attendance & Evidence Tracking (Screenshots, Server Time, PKR 500 Late, Absence)
--              4. Company Asset Governance (Acknowledgement, Return, Damage/Loss)
--              5. Protected Employee Bank Details & Profile Change Requests
--              6. Employee Payroll Records & Payment Proofs (1st-End cycle, Paid 15th)
--              7. Employee Performance Records (Goals, Achievements, Incidents & Coaching, Warnings, Hikes)
--              8. Internal Employee Management Tasks (60m Missing Check-in Alerts, Reviews, Concerns)
--              9. Final Settlement Workflows
--              10. Private Storage Buckets & Strict Row-Level Security Matrix
-- Schema Authority: PostgreSQL 15+ / Supabase Auth
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. WORK SHIFTS & COMPANY SCHEDULES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.work_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    crosses_midnight BOOLEAN NOT NULL DEFAULT false,
    timezone TEXT NOT NULL DEFAULT 'Asia/Karachi',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT chk_work_shifts_name CHECK (length(trim(name)) > 0)
);

-- Seed Default Company Shifts (Morning: 11:00 AM - 8:00 PM, Night: 8:00 PM - 5:00 AM PKT)
INSERT INTO public.work_shifts (name, code, start_time, end_time, crosses_midnight, timezone)
VALUES 
    ('Morning Shift', 'morning', '11:00:00', '20:00:00', false, 'Asia/Karachi'),
    ('Night Shift', 'night', '20:00:00', '05:00:00', true, 'Asia/Karachi')
ON CONFLICT (code) DO UPDATE 
SET start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    crosses_midnight = EXCLUDED.crosses_midnight,
    timezone = EXCLUDED.timezone;

CREATE TABLE IF NOT EXISTS public.company_work_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    effective_from DATE NOT NULL,
    effective_to DATE,
    working_days INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6], -- 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat (Sunday=0/7 excluded)
    description TEXT DEFAULT 'Standard 6-Day Work Week (Monday to Saturday)',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Seed Default Schedule starting 2026-01-01
INSERT INTO public.company_work_schedules (effective_from, working_days, description)
SELECT '2026-01-01', ARRAY[1, 2, 3, 4, 5, 6], 'Standard 6-Day Work Week (Monday to Saturday, Weekly Off Sunday)'
WHERE NOT EXISTS (SELECT 1 FROM public.company_work_schedules WHERE effective_from = '2026-01-01');

-- ------------------------------------------------------------------------------
-- 2. COMPANION EMPLOYEE RECORDS (1-to-1 with public.profiles)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_records (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_id TEXT UNIQUE,
    employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contractor', 'intern')),
    date_of_birth DATE,
    salary NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (salary >= 0),
    job_description TEXT,
    shift_id UUID REFERENCES public.work_shifts(id) ON DELETE SET NULL,
    custom_check_in_time TIME,
    custom_check_out_time TIME,
    employment_status TEXT NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'inactive', 'probation', 'resigned', 'terminated')),
    sop_acknowledged BOOLEAN NOT NULL DEFAULT false,
    sop_acknowledged_at TIMESTAMPTZ,
    sop_version TEXT DEFAULT '1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_records_employee_id ON public.employee_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_records_shift_id ON public.employee_records(shift_id);
CREATE INDEX IF NOT EXISTS idx_employee_records_employment_status ON public.employee_records(employment_status);

-- ------------------------------------------------------------------------------
-- 3. EMPLOYEE ATTENDANCE & EVIDENCE TRACKING
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    shift_id UUID REFERENCES public.work_shifts(id) ON DELETE SET NULL,
    scheduled_check_in TIMESTAMPTZ NOT NULL,
    scheduled_check_out TIMESTAMPTZ NOT NULL,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('on_time', 'late', 'absent', 'incomplete', 'early_checkout', 'corrected')),
    minutes_late INTEGER NOT NULL DEFAULT 0 CHECK (minutes_late >= 0),
    late_deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (late_deduction >= 0),
    absence_deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (absence_deduction >= 0),
    check_in_screenshot_path TEXT,
    check_out_screenshot_path TEXT,
    check_in_evidence_type TEXT CHECK (check_in_evidence_type IN ('screen_capture', 'manual_upload')),
    check_out_evidence_type TEXT CHECK (check_out_evidence_type IN ('screen_capture', 'manual_upload')),
    check_in_metadata JSONB,
    check_out_metadata JSONB,
    early_checkout_reason TEXT,
    early_checkout_status TEXT CHECK (early_checkout_status IN ('pending_review', 'approved', 'warning_issued', 'deduction_applied')),
    correction_reason TEXT,
    corrected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    corrected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_employee_work_date UNIQUE (employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_employee_attendance_employee_id ON public.employee_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_work_date ON public.employee_attendance(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_status ON public.employee_attendance(status);

-- ------------------------------------------------------------------------------
-- 4. COMPANY ASSETS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.company_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    issue_date DATE NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'receipt_pending', 'received', 'returned', 'damaged', 'lost')),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    return_date DATE,
    damage_loss_reason TEXT,
    damage_loss_evidence_url TEXT,
    financial_recovery_approved BOOLEAN NOT NULL DEFAULT false,
    financial_recovery_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (financial_recovery_amount >= 0),
    recovery_payroll_period TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    CONSTRAINT chk_company_assets_item_name CHECK (length(trim(item_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_company_assets_employee_id ON public.company_assets(employee_id);
CREATE INDEX IF NOT EXISTS idx_company_assets_status ON public.company_assets(status);

-- ------------------------------------------------------------------------------
-- 5. EMPLOYEE BANK DETAILS & PROFILE CHANGE REQUESTS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_title TEXT NOT NULL,
    account_number_or_iban TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_change', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    CONSTRAINT chk_bank_name CHECK (length(trim(bank_name)) > 0),
    CONSTRAINT chk_account_title CHECK (length(trim(account_title)) > 0),
    CONSTRAINT chk_account_number CHECK (length(trim(account_number_or_iban)) > 0)
);

CREATE TABLE IF NOT EXISTS public.employee_profile_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL CHECK (request_type IN ('profile_details', 'bank_details')),
    requested_changes JSONB NOT NULL,
    current_values JSONB,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_change_requests_employee ON public.employee_profile_change_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON public.employee_profile_change_requests(status);

-- ------------------------------------------------------------------------------
-- 6. EMPLOYEE PAYROLL RECORDS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payroll_period TEXT NOT NULL CHECK (payroll_period ~ '^\d{4}-\d{2}$'),
    gross_salary NUMERIC(12,2) NOT NULL CHECK (gross_salary >= 0),
    late_deductions_total NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (late_deductions_total >= 0),
    absence_deductions_total NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (absence_deductions_total >= 0),
    manual_adjustments_total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    asset_recovery_deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (asset_recovery_deduction >= 0),
    net_payable NUMERIC(12,2) NOT NULL,
    scheduled_payment_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Under Review', 'Approved', 'Paid', 'Concern Raised')),
    payment_proof_path TEXT,
    payment_date TIMESTAMPTZ,
    paid_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    management_notes TEXT,
    concern_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    CONSTRAINT uq_employee_payroll_period UNIQUE (employee_id, payroll_period)
);

CREATE INDEX IF NOT EXISTS idx_payroll_records_employee_id ON public.employee_payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON public.employee_payroll_records(payroll_period DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_records_status ON public.employee_payroll_records(status);

-- ------------------------------------------------------------------------------
-- 7. EMPLOYEE PERFORMANCE RECORDS & REVIEWS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_performance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL CHECK (record_type IN ('goal', 'achievement', 'incident_coaching', 'warning', 'salary_hike', 'contract_document', 'status_change', 'exit_settlement')),
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
    document_url TEXT,
    previous_salary NUMERIC(12,2),
    new_salary NUMERIC(12,2),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'cancelled')),
    concern_status TEXT NOT NULL DEFAULT 'none' CHECK (concern_status IN ('none', 'concern_raised', 'concern_resolved', 'concern_rejected')),
    concern_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    CONSTRAINT chk_performance_title CHECK (length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_performance_employee_id ON public.employee_performance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_record_type ON public.employee_performance_records(record_type);

-- ------------------------------------------------------------------------------
-- 8. INTERNAL EMPLOYEE MANAGEMENT TASKS (Non-client task queue)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_management_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type TEXT NOT NULL CHECK (task_type IN ('missing_checkin_60m', 'early_checkout_review', 'missing_checkout', 'employee_concern', 'profile_change_request', 'payroll_approval', 'asset_review')),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
    priority TEXT NOT NULL DEFAULT 'high' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    reference_id TEXT,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_employee_tasks_status ON public.employee_management_tasks(status);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_employee_id ON public.employee_management_tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_type ON public.employee_management_tasks(task_type);

-- ------------------------------------------------------------------------------
-- 9. EMPLOYEE FINAL SETTLEMENTS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_final_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_working_date DATE NOT NULL,
    notice_period_status TEXT NOT NULL DEFAULT 'served' CHECK (notice_period_status IN ('served', 'waived', 'short', 'not_served')),
    pending_earned_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    current_accrued_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    approved_deductions NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    asset_clearance_status TEXT NOT NULL DEFAULT 'pending' CHECK (asset_clearance_status IN ('pending', 'cleared', 'charges_applied')),
    final_payable_amount NUMERIC(12,2) NOT NULL,
    payment_proof_path TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved', 'settled')),
    settled_at TIMESTAMPTZ,
    settled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 10. PRIVATE STORAGE BUCKETS
-- ------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('employee-attendance-evidence', 'employee-attendance-evidence', false),
    ('employee-payroll-proofs', 'employee-payroll-proofs', false),
    ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ------------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS on all newly created tables
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_profile_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_performance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_management_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_final_settlements ENABLE ROW LEVEL SECURITY;

-- A. WORK SHIFTS & SCHEDULES (Staff read-only, Management write)
DROP POLICY IF EXISTS "Staff can read work shifts" ON public.work_shifts;
CREATE POLICY "Staff can read work shifts"
    ON public.work_shifts FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager', 'team_member') AND status = 'active'
    ));

DROP POLICY IF EXISTS "Management can manage work shifts" ON public.work_shifts;
CREATE POLICY "Management can manage work shifts"
    ON public.work_shifts FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

DROP POLICY IF EXISTS "Staff can read company schedules" ON public.company_work_schedules;
CREATE POLICY "Staff can read company schedules"
    ON public.company_work_schedules FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager', 'team_member') AND status = 'active'
    ));

DROP POLICY IF EXISTS "Management can manage company schedules" ON public.company_work_schedules;
CREATE POLICY "Management can manage company schedules"
    ON public.company_work_schedules FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

-- B. EMPLOYEE RECORDS (Self read, Management all)
DROP POLICY IF EXISTS "Employee can read own employee record" ON public.employee_records;
CREATE POLICY "Employee can read own employee record"
    ON public.employee_records FOR SELECT TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Management can manage employee records" ON public.employee_records;
CREATE POLICY "Management can manage employee records"
    ON public.employee_records FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

-- C. ATTENDANCE (Self read & check-in, Management all)
DROP POLICY IF EXISTS "Employee can read own attendance" ON public.employee_attendance;
CREATE POLICY "Employee can read own attendance"
    ON public.employee_attendance FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Employee can insert own attendance" ON public.employee_attendance;
CREATE POLICY "Employee can insert own attendance"
    ON public.employee_attendance FOR INSERT TO authenticated
    WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "Employee can update own check-out attendance" ON public.employee_attendance;
CREATE POLICY "Employee can update own check-out attendance"
    ON public.employee_attendance FOR UPDATE TO authenticated
    USING (employee_id = auth.uid() AND check_out_time IS NULL)
    WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "Management can manage attendance" ON public.employee_attendance;
CREATE POLICY "Management can manage attendance"
    ON public.employee_attendance FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

-- D. COMPANY ASSETS (Self read & acknowledge, Management all)
DROP POLICY IF EXISTS "Employee can read own assets" ON public.company_assets;
CREATE POLICY "Employee can read own assets"
    ON public.company_assets FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Employee can acknowledge own assets" ON public.company_assets;
CREATE POLICY "Employee can acknowledge own assets"
    ON public.company_assets FOR UPDATE TO authenticated
    USING (employee_id = auth.uid() AND status IN ('assigned', 'receipt_pending'))
    WITH CHECK (employee_id = auth.uid() AND status = 'received');

DROP POLICY IF EXISTS "Management can manage assets" ON public.company_assets;
CREATE POLICY "Management can manage assets"
    ON public.company_assets FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

-- E. BANK DETAILS (Self read, Management all)
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

-- F. PROFILE CHANGE REQUESTS (Self read/insert, Management all)
DROP POLICY IF EXISTS "Employee can read own change requests" ON public.employee_profile_change_requests;
CREATE POLICY "Employee can read own change requests"
    ON public.employee_profile_change_requests FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Employee can create change requests" ON public.employee_profile_change_requests;
CREATE POLICY "Employee can create change requests"
    ON public.employee_profile_change_requests FOR INSERT TO authenticated
    WITH CHECK (employee_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Management can manage change requests" ON public.employee_profile_change_requests;
CREATE POLICY "Management can manage change requests"
    ON public.employee_profile_change_requests FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

-- G. PAYROLL RECORDS (Self read, Management all)
DROP POLICY IF EXISTS "Employee can read own payroll" ON public.employee_payroll_records;
CREATE POLICY "Employee can read own payroll"
    ON public.employee_payroll_records FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Employee can raise payroll concern" ON public.employee_payroll_records;
CREATE POLICY "Employee can raise payroll concern"
    ON public.employee_payroll_records FOR UPDATE TO authenticated
    USING (employee_id = auth.uid() AND status IN ('Approved', 'Paid'))
    WITH CHECK (employee_id = auth.uid() AND status = 'Concern Raised');

DROP POLICY IF EXISTS "Management can manage payroll" ON public.employee_payroll_records;
CREATE POLICY "Management can manage payroll"
    ON public.employee_payroll_records FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

-- H. PERFORMANCE RECORDS (Self read & concern, Management all)
DROP POLICY IF EXISTS "Employee can read own performance records" ON public.employee_performance_records;
CREATE POLICY "Employee can read own performance records"
    ON public.employee_performance_records FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Employee can raise performance concern" ON public.employee_performance_records;
CREATE POLICY "Employee can raise performance concern"
    ON public.employee_performance_records FOR UPDATE TO authenticated
    USING (employee_id = auth.uid())
    WITH CHECK (employee_id = auth.uid() AND concern_status = 'concern_raised');

DROP POLICY IF EXISTS "Management can manage performance records" ON public.employee_performance_records;
CREATE POLICY "Management can manage performance records"
    ON public.employee_performance_records FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

-- I. MANAGEMENT TASKS (Management only)
DROP POLICY IF EXISTS "Management can manage internal tasks" ON public.employee_management_tasks;
CREATE POLICY "Management can manage internal tasks"
    ON public.employee_management_tasks FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

-- J. FINAL SETTLEMENTS (Self read, Management all)
DROP POLICY IF EXISTS "Employee can read own settlement" ON public.employee_final_settlements;
CREATE POLICY "Employee can read own settlement"
    ON public.employee_final_settlements FOR SELECT TO authenticated
    USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Management can manage settlements" ON public.employee_final_settlements;
CREATE POLICY "Management can manage settlements"
    ON public.employee_final_settlements FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    ));

-- ------------------------------------------------------------------------------
-- 12. STORAGE POLICIES FOR PRIVATE BUCKETS
-- ------------------------------------------------------------------------------

-- Attendance Evidence
DROP POLICY IF EXISTS "Staff can read attendance evidence" ON storage.objects;
CREATE POLICY "Staff can read attendance evidence"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'employee-attendance-evidence' AND (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role IN ('owner', 'operational_manager')
            ) OR
            (storage.foldername(name))[1] = auth.uid()::text OR
            name LIKE auth.uid()::text || '/%'
        )
    );

DROP POLICY IF EXISTS "Staff can upload attendance evidence" ON storage.objects;
CREATE POLICY "Staff can upload attendance evidence"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'employee-attendance-evidence' AND (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role IN ('owner', 'operational_manager')
            ) OR
            (storage.foldername(name))[1] = auth.uid()::text OR
            name LIKE auth.uid()::text || '/%'
        )
    );

-- Payroll Proofs
DROP POLICY IF EXISTS "Staff can read payroll proofs" ON storage.objects;
CREATE POLICY "Staff can read payroll proofs"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'employee-payroll-proofs' AND (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role IN ('owner', 'operational_manager')
            ) OR
            (storage.foldername(name))[1] = auth.uid()::text OR
            name LIKE auth.uid()::text || '/%'
        )
    );

DROP POLICY IF EXISTS "Management can upload payroll proofs" ON storage.objects;
CREATE POLICY "Management can upload payroll proofs"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'employee-payroll-proofs' AND (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role IN ('owner', 'operational_manager')
            )
        )
    );

-- Employee Documents
DROP POLICY IF EXISTS "Staff can read employee documents" ON storage.objects;
CREATE POLICY "Staff can read employee documents"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'employee-documents' AND (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role IN ('owner', 'operational_manager')
            ) OR
            (storage.foldername(name))[1] = auth.uid()::text OR
            name LIKE auth.uid()::text || '/%'
        )
    );

DROP POLICY IF EXISTS "Management can upload employee documents" ON storage.objects;
CREATE POLICY "Management can upload employee documents"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'employee-documents' AND (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role IN ('owner', 'operational_manager')
            )
        )
    );
