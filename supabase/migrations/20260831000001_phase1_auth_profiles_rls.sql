-- ==============================================================================
-- CANONICAL PHASE 1 & 1.1 MIGRATION: Supabase Auth, Profiles & RLS Hardening
-- Location: supabase/migrations/20260831_phase1_auth_profiles_rls.sql
-- Database: PostgreSQL / Supabase (jcaptlqenwmpfchjyipw)
-- ==============================================================================

-- 1. Create Profiles Table referencing auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('owner', 'operational_manager', 'team_member', 'client')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  organization_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Trigger for automatic profile creation on auth.users insert (least privileged role: client)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, status, created_at, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(
      CASE 
        WHEN new.raw_user_meta_data->>'role' IN ('owner', 'operational_manager', 'team_member', 'client') 
        THEN new.raw_user_meta_data->>'role' 
        ELSE 'client' 
      END, 
      'client'
    ),
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Allow public read-write for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow user to read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow staff to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow owners to update profiles" ON public.profiles;

-- Authenticated user can read their own profile
CREATE POLICY "Allow user to read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Staff can read directory profiles
CREATE POLICY "Allow staff to read profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'operational_manager', 'team_member') AND status = 'active'
    )
  );

-- Only owner can update roles/status (users cannot update their own role or status)
CREATE POLICY "Allow owners to update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  );

-- ==============================================================================
-- 4. HARDEN ROW LEVEL SECURITY ON ALL OPERATIONAL TABLES (DENY ANONYMOUS & CLIENT ACCESS)
-- ==============================================================================

-- A. TASKS TABLE (Staff Only)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow authenticated staff on tasks" ON public.tasks;

CREATE POLICY "Allow authenticated staff on tasks"
  ON public.tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'operational_manager', 'team_member') AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'operational_manager', 'team_member') AND status = 'active'
    )
  );

-- B. SPACES TABLE (Staff Only)
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for spaces" ON public.spaces;
DROP POLICY IF EXISTS "Allow authenticated staff on spaces" ON public.spaces;

CREATE POLICY "Allow authenticated staff on spaces"
  ON public.spaces
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'operational_manager', 'team_member') AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'operational_manager', 'team_member') AND status = 'active'
    )
  );

-- C. CLIENTS & VENDORS TABLE (Staff Only)
ALTER TABLE public.clients_vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for clients_vendors" ON public.clients_vendors;
DROP POLICY IF EXISTS "Allow authenticated staff on clients_vendors" ON public.clients_vendors;

CREATE POLICY "Allow authenticated staff on clients_vendors"
  ON public.clients_vendors
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'operational_manager', 'team_member') AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'operational_manager', 'team_member') AND status = 'active'
    )
  );

-- D. SOP DOCUMENTS TABLE (Staff Only)
ALTER TABLE public.sop_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for sop_documents" ON public.sop_documents;
DROP POLICY IF EXISTS "Allow authenticated staff on sop_documents" ON public.sop_documents;

CREATE POLICY "Allow authenticated staff on sop_documents"
  ON public.sop_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'operational_manager', 'team_member') AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'operational_manager', 'team_member') AND status = 'active'
    )
  );

-- E. AUTOMATION RULES TABLE (Staff Only)
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for automation_rules" ON public.automation_rules;
DROP POLICY IF EXISTS "Allow authenticated staff on automation_rules" ON public.automation_rules;

CREATE POLICY "Allow authenticated staff on automation_rules"
  ON public.automation_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    )
  );

-- F. USERS TABLE (Staff Only)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated staff on users" ON public.users;

CREATE POLICY "Allow authenticated staff on users"
  ON public.users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'operational_manager', 'team_member') AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'operational_manager') AND status = 'active'
    )
  );
