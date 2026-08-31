-- ==============================================================================
-- FORWARD MIGRATION: Phase 2A Team & User Management Schema & Hardened RLS
-- Location: supabase/migrations/20260831_phase2a_team_user_management.sql
-- Database: PostgreSQL / Supabase (jcaptlqenwmpfchjyipw)
-- Target: Phase 2A Production Team Member Administration & Scoped Governance
-- ==============================================================================

-- 1. Extend public.profiles Table Additively
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS work_email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS designation_id UUID,
  ADD COLUMN IF NOT EXISTS reporting_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Case-insensitive unique index for work_email on active/registered profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_work_email_lower 
  ON public.profiles (LOWER(work_email)) 
  WHERE work_email IS NOT NULL;

-- Indexes on reporting manager and designation
CREATE INDEX IF NOT EXISTS idx_profiles_reporting_manager ON public.profiles(reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_designation ON public.profiles(designation_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);

-- 2. Create Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent Seed: Locked Production Departments
INSERT INTO public.departments (name, slug, sort_order)
VALUES
  ('Operations', 'operations', 1),
  ('Account Management', 'account-management', 2),
  ('Business Development', 'business-development', 3),
  ('Content Writing', 'content-writing', 4),
  ('Graphic Design', 'graphic-design', 5),
  ('Video Editing', 'video-editing', 6),
  ('Paid Ads', 'paid-ads', 7),
  ('CRM', 'crm', 8),
  ('Social Media', 'social-media', 9),
  ('Technology/Development', 'technology-development', 10),
  ('Email Marketing', 'email-marketing', 11),
  ('SEO', 'seo', 12)
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- 3. Create Designations Table
CREATE TABLE IF NOT EXISTS public.designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Foreign key link from profiles.designation_id to designations.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_profiles_designation'
  ) THEN
    ALTER TABLE public.profiles 
      ADD CONSTRAINT fk_profiles_designation 
      FOREIGN KEY (designation_id) REFERENCES public.designations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Create Profile Departments (Multi-Department Membership)
CREATE TABLE IF NOT EXISTS public.profile_departments (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_departments_dept ON public.profile_departments(department_id);

-- 5. Create Profile Client Access (Explicit Granular Client Grants)
CREATE TABLE IF NOT EXISTS public.profile_client_access (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES public.clients_vendors(id) ON DELETE RESTRICT,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_client_access_client ON public.profile_client_access(client_id);

-- 6. Create User Management Audit Log
CREATE TABLE IF NOT EXISTS public.user_management_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  safe_changes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_target ON public.user_management_audit_log(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.user_management_audit_log(actor_id, created_at DESC);

-- ==============================================================================
-- 7. SECURITY DEFINER HELPERS (Private Schema: app_private)
-- ==============================================================================

-- Helper: Check if an Operational Manager manages a specific direct report
CREATE OR REPLACE FUNCTION app_private.can_manage_team_member(caller_id UUID, target_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles caller
    WHERE caller.id = caller_id AND caller.status = 'active' AND (
      caller.role = 'owner' OR (
        caller.role = 'operational_manager' AND EXISTS (
          SELECT 1 FROM public.profiles target
          WHERE target.id = target_id 
            AND target.role = 'team_member'
            AND target.reporting_manager_id = caller_id
        )
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.can_manage_team_member(UUID, UUID) TO authenticated;

-- ==============================================================================
-- 8. ROW LEVEL SECURITY POLICIES
-- ==============================================================================

-- A. DEPARTMENTS TABLE
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "departments_select_staff" ON public.departments;
DROP POLICY IF EXISTS "departments_modify_owner" ON public.departments;

CREATE POLICY "departments_select_staff"
  ON public.departments
  FOR SELECT
  TO authenticated
  USING (app_private.is_staff((SELECT auth.uid())));

CREATE POLICY "departments_modify_owner"
  ON public.departments
  FOR ALL
  TO authenticated
  USING (app_private.is_owner((SELECT auth.uid())))
  WITH CHECK (app_private.is_owner((SELECT auth.uid())));

-- B. DESIGNATIONS TABLE
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "designations_select_staff" ON public.designations;
DROP POLICY IF EXISTS "designations_modify_managers_owner" ON public.designations;

CREATE POLICY "designations_select_staff"
  ON public.designations
  FOR SELECT
  TO authenticated
  USING (app_private.is_staff((SELECT auth.uid())));

CREATE POLICY "designations_modify_managers_owner"
  ON public.designations
  FOR ALL
  TO authenticated
  USING (app_private.is_manager_or_owner((SELECT auth.uid())))
  WITH CHECK (app_private.is_manager_or_owner((SELECT auth.uid())));

-- C. PROFILE DEPARTMENTS TABLE
ALTER TABLE public.profile_departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile_departments_select" ON public.profile_departments;
DROP POLICY IF EXISTS "profile_departments_modify" ON public.profile_departments;

CREATE POLICY "profile_departments_select"
  ON public.profile_departments
  FOR SELECT
  TO authenticated
  USING (
    profile_id = (SELECT auth.uid()) OR app_private.is_staff((SELECT auth.uid()))
  );

CREATE POLICY "profile_departments_modify"
  ON public.profile_departments
  FOR ALL
  TO authenticated
  USING (app_private.is_manager_or_owner((SELECT auth.uid())))
  WITH CHECK (app_private.is_manager_or_owner((SELECT auth.uid())));

-- D. PROFILE CLIENT ACCESS TABLE
ALTER TABLE public.profile_client_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile_client_access_select" ON public.profile_client_access;
DROP POLICY IF EXISTS "profile_client_access_modify" ON public.profile_client_access;

CREATE POLICY "profile_client_access_select"
  ON public.profile_client_access
  FOR SELECT
  TO authenticated
  USING (
    profile_id = (SELECT auth.uid()) OR app_private.is_staff((SELECT auth.uid()))
  );

CREATE POLICY "profile_client_access_modify"
  ON public.profile_client_access
  FOR ALL
  TO authenticated
  USING (app_private.is_manager_or_owner((SELECT auth.uid())))
  WITH CHECK (app_private.is_manager_or_owner((SELECT auth.uid())));

-- E. USER MANAGEMENT AUDIT LOG TABLE
ALTER TABLE public.user_management_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_select_managers_owner" ON public.user_management_audit_log;
DROP POLICY IF EXISTS "audit_log_insert_managers_owner" ON public.user_management_audit_log;

CREATE POLICY "audit_log_select_managers_owner"
  ON public.user_management_audit_log
  FOR SELECT
  TO authenticated
  USING (app_private.is_manager_or_owner((SELECT auth.uid())));

CREATE POLICY "audit_log_insert_managers_owner"
  ON public.user_management_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (app_private.is_manager_or_owner((SELECT auth.uid())));

-- ==============================================================================
-- 9. FIX DEFERRED PUBLIC.USERS POLICY DEFECT (Command-Specific Protection)
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated staff on users" ON public.users;
DROP POLICY IF EXISTS "users_staff_all" ON public.users;
DROP POLICY IF EXISTS "users_select_staff" ON public.users;
DROP POLICY IF EXISTS "users_insert_managers_owner" ON public.users;
DROP POLICY IF EXISTS "users_update_managers_owner" ON public.users;
DROP POLICY IF EXISTS "users_delete_owner_only" ON public.users;

-- Read: Authenticated staff
CREATE POLICY "users_select_staff"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (app_private.is_staff((SELECT auth.uid())));

-- Insert: Owner or Operational Manager
CREATE POLICY "users_insert_managers_owner"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (app_private.is_manager_or_owner((SELECT auth.uid())));

-- Update: Owner or Operational Manager
CREATE POLICY "users_update_managers_owner"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (app_private.is_manager_or_owner((SELECT auth.uid())))
  WITH CHECK (app_private.is_manager_or_owner((SELECT auth.uid())));

-- Delete: Strictly Owner Only (Team Members and Operational Managers cannot DELETE legacy rows)
CREATE POLICY "users_delete_owner_only"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (app_private.is_owner((SELECT auth.uid())));
