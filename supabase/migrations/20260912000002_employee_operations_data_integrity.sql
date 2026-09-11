-- ==============================================================================
-- Migration: 20260912000002_employee_operations_data_integrity.sql
-- Description: Additive data integrity enhancements for Employee Operations System
-- ==============================================================================

-- 1. Add setup_completed_at column to employee_records for safe onboarding gate
ALTER TABLE employee_records ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;

-- 2. Add detailed breakdown columns to employee_final_settlements
ALTER TABLE employee_final_settlements ADD COLUMN IF NOT EXISTS good_standing_status TEXT DEFAULT 'good_standing';
ALTER TABLE employee_final_settlements ADD COLUMN IF NOT EXISTS held_pending_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE employee_final_settlements ADD COLUMN IF NOT EXISTS late_deductions NUMERIC(12,2) DEFAULT 0;
ALTER TABLE employee_final_settlements ADD COLUMN IF NOT EXISTS absence_deductions NUMERIC(12,2) DEFAULT 0;
ALTER TABLE employee_final_settlements ADD COLUMN IF NOT EXISTS asset_recovery_deduction NUMERIC(12,2) DEFAULT 0;
ALTER TABLE employee_final_settlements ADD COLUMN IF NOT EXISTS other_adjustments NUMERIC(12,2) DEFAULT 0;
ALTER TABLE employee_final_settlements ADD COLUMN IF NOT EXISTS deduction_reason_notes TEXT;

-- 3. Add asset fields to company_assets if not already present
ALTER TABLE company_assets ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE company_assets ADD COLUMN IF NOT EXISTS asset_tag TEXT;
ALTER TABLE company_assets ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE company_assets ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'laptop';
ALTER TABLE company_assets ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'good';
ALTER TABLE company_assets ADD COLUMN IF NOT EXISTS replacement_value NUMERIC(12,2) DEFAULT 0;

-- 4. Idempotent Index on setup_completed_at
CREATE INDEX IF NOT EXISTS idx_employee_records_setup_completed ON employee_records(setup_completed_at);
