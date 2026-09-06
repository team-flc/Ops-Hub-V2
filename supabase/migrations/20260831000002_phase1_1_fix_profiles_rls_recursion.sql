-- ==============================================================================
-- FORWARD MIGRATION: Fix public.profiles RLS Recursion (Postgres Error 42P17)
-- Location: supabase/migrations/20260831_phase1_1_fix_profiles_rls_recursion.sql
-- Database: PostgreSQL / Supabase (jcaptlqenwmpfchjyipw)
-- Target: Phase 1.1 Authentication Hardening & Non-Recursive RLS Architecture
-- ==============================================================================

-- 1. Create Private Helper Schema (Isolated from PostgREST Data API)
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated;

-- 2. Non-Recursive Security Definer Helper Functions
-- Note: Defined with SET search_path = '' and fully qualified public.profiles references
-- to safely bypass RLS loops during policy evaluation.

CREATE OR REPLACE FUNCTION app_private.get_auth_role(user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = user_id AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION app_private.is_staff(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
      AND role IN ('owner', 'operational_manager', 'team_member')
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION app_private.is_owner(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
      AND role = 'owner'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION app_private.is_manager_or_owner(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
      AND role IN ('owner', 'operational_manager')
      AND status = 'active'
  );
$$;

-- Secure function permissions
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO authenticated;

-- 3. Rebuild public.profiles Policies (Remove Infinite Recursion)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-write for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow user to read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow staff to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow owners to update profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_staff_directory" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_owner_only" ON public.profiles;

-- Direct non-recursive comparison for reading own profile (all authenticated roles)
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

-- Staff directory read using non-recursive security definer helper
CREATE POLICY "profiles_select_staff_directory"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (app_private.is_staff((SELECT auth.uid())));

-- Only verified owners can modify profile roles or statuses
CREATE POLICY "profiles_update_owner_only"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (app_private.is_owner((SELECT auth.uid())))
  WITH CHECK (app_private.is_owner((SELECT auth.uid())));

-- 4. Rebuild Operational Table Policies Using Non-Recursive Helper Functions

-- A. TASKS TABLE
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow authenticated staff on tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_staff_all" ON public.tasks;

CREATE POLICY "tasks_staff_all"
  ON public.tasks
  FOR ALL
  TO authenticated
  USING (app_private.is_staff((SELECT auth.uid())))
  WITH CHECK (app_private.is_staff((SELECT auth.uid())));

-- B. SPACES TABLE
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for spaces" ON public.spaces;
DROP POLICY IF EXISTS "Allow authenticated staff on spaces" ON public.spaces;
DROP POLICY IF EXISTS "spaces_staff_all" ON public.spaces;

CREATE POLICY "spaces_staff_all"
  ON public.spaces
  FOR ALL
  TO authenticated
  USING (app_private.is_staff((SELECT auth.uid())))
  WITH CHECK (app_private.is_staff((SELECT auth.uid())));

-- C. CLIENTS & VENDORS TABLE
ALTER TABLE public.clients_vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for clients_vendors" ON public.clients_vendors;
DROP POLICY IF EXISTS "Allow authenticated staff on clients_vendors" ON public.clients_vendors;
DROP POLICY IF EXISTS "clients_vendors_staff_all" ON public.clients_vendors;

CREATE POLICY "clients_vendors_staff_all"
  ON public.clients_vendors
  FOR ALL
  TO authenticated
  USING (app_private.is_staff((SELECT auth.uid())))
  WITH CHECK (app_private.is_staff((SELECT auth.uid())));

-- D. SOP DOCUMENTS TABLE
ALTER TABLE public.sop_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for sop_documents" ON public.sop_documents;
DROP POLICY IF EXISTS "Allow authenticated staff on sop_documents" ON public.sop_documents;
DROP POLICY IF EXISTS "sop_documents_staff_all" ON public.sop_documents;

CREATE POLICY "sop_documents_staff_all"
  ON public.sop_documents
  FOR ALL
  TO authenticated
  USING (app_private.is_staff((SELECT auth.uid())))
  WITH CHECK (app_private.is_staff((SELECT auth.uid())));

-- E. AUTOMATION RULES TABLE
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for automation_rules" ON public.automation_rules;
DROP POLICY IF EXISTS "Allow authenticated staff on automation_rules" ON public.automation_rules;
DROP POLICY IF EXISTS "automation_rules_staff_all" ON public.automation_rules;

CREATE POLICY "automation_rules_staff_all"
  ON public.automation_rules
  FOR ALL
  TO authenticated
  USING (app_private.is_manager_or_owner((SELECT auth.uid())))
  WITH CHECK (app_private.is_manager_or_owner((SELECT auth.uid())));

-- F. USERS TABLE
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated staff on users" ON public.users;
DROP POLICY IF EXISTS "users_staff_all" ON public.users;

CREATE POLICY "users_staff_all"
  ON public.users
  FOR ALL
  TO authenticated
  USING (app_private.is_staff((SELECT auth.uid())))
  WITH CHECK (app_private.is_manager_or_owner((SELECT auth.uid())));
