-- Migration: Add CNIC Number to profiles and employee_records
-- Author: Antigravity Assistant
-- Description: Adds optional cnic column to profiles and employee_records tables

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cnic TEXT;

ALTER TABLE public.employee_records
  ADD COLUMN IF NOT EXISTS cnic TEXT;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
