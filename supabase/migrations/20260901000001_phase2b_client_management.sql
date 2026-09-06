-- ==============================================================================
-- FORWARD MIGRATION: Phase 2B Base Client Management Schema & Hardened RLS
-- Location: supabase/migrations/20260901_phase2b_client_management.sql
-- Database: PostgreSQL / Supabase (jcaptlqenwmpfchjyipw)
-- Target: Production Client Management Foundation, Workspace Links, & RLS
-- ==============================================================================

-- 1. Create public.clients Table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  package TEXT NOT NULL CHECK (package IN ('Basic', 'Intermediate', 'Advanced')),
  operational_manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  activation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Onboarding' CHECK (status IN ('Onboarding', 'Active', 'Paused', 'Archived')),
  pause_reason TEXT CHECK (pause_reason IN ('Payment overdue', 'Client request', 'Operational reason', 'Other')),
  source_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

-- Indexes for client searches and filtering
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_manager ON public.clients(operational_manager_id);
CREATE INDEX IF NOT EXISTS idx_clients_source ON public.clients(source_client_id);
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON public.clients(company_name);

-- 2. Create public.client_links Table (Expanded Workspace & Communication URLs)
CREATE TABLE IF NOT EXISTS public.client_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN (
    'website', 
    'google_drive', 
    'facebook', 
    'instagram', 
    'linkedin_company_page', 
    'slack_channel', 
    'whatsapp_group'
  )),
  url TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_client_link_type UNIQUE (client_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_client_links_client ON public.client_links(client_id);

-- 3. Create public.client_team_access Table (Granular Staff Grants)
CREATE TABLE IF NOT EXISTS public.client_team_access (
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_client_team_access_profile ON public.client_team_access(profile_id);

-- 4. Create public.client_audit_log Table
CREATE TABLE IF NOT EXISTS public.client_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  changed_field TEXT,
  previous_value TEXT,
  new_value TEXT,
  safe_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_audit_client ON public.client_audit_log(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_audit_actor ON public.client_audit_log(actor_id, created_at DESC);

-- ==============================================================================
-- 5. SECURITY DEFINER HELPERS
-- ==============================================================================

CREATE OR REPLACE FUNCTION app_private.can_access_client(caller_id UUID, target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = caller_id AND p.status = 'active' AND (
      p.role = 'owner'
      OR (
        p.role = 'operational_manager' AND EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = target_client_id 
            AND (c.operational_manager_id = caller_id OR c.created_by = caller_id)
        )
      )
      OR (
        p.role = 'team_member' AND EXISTS (
          SELECT 1 FROM public.client_team_access cta
          WHERE cta.client_id = target_client_id AND cta.profile_id = caller_id
        )
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.can_access_client(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.can_manage_client(caller_id UUID, target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = caller_id AND p.status = 'active' AND (
      p.role = 'owner'
      OR (
        p.role = 'operational_manager' AND EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = target_client_id 
            AND (c.operational_manager_id = caller_id OR c.created_by = caller_id)
        )
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.can_manage_client(UUID, UUID) TO authenticated;

-- ==============================================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ==============================================================================

-- A. CLIENTS TABLE
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_select" ON public.clients;
DROP POLICY IF EXISTS "clients_insert" ON public.clients;
DROP POLICY IF EXISTS "clients_update" ON public.clients;
DROP POLICY IF EXISTS "clients_delete" ON public.clients;

CREATE POLICY "clients_select"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (app_private.can_access_client((SELECT auth.uid()), id));

CREATE POLICY "clients_insert"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (app_private.is_manager_or_owner((SELECT auth.uid())));

CREATE POLICY "clients_update"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (app_private.can_manage_client((SELECT auth.uid()), id))
  WITH CHECK (app_private.can_manage_client((SELECT auth.uid()), id));

CREATE POLICY "clients_delete"
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (app_private.is_owner((SELECT auth.uid())));

-- B. CLIENT LINKS TABLE
ALTER TABLE public.client_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_links_select" ON public.client_links;
DROP POLICY IF EXISTS "client_links_insert_update" ON public.client_links;
DROP POLICY IF EXISTS "client_links_delete" ON public.client_links;

CREATE POLICY "client_links_select"
  ON public.client_links
  FOR SELECT
  TO authenticated
  USING (app_private.can_access_client((SELECT auth.uid()), client_id));

CREATE POLICY "client_links_insert_update"
  ON public.client_links
  FOR ALL
  TO authenticated
  USING (app_private.can_access_client((SELECT auth.uid()), client_id))
  WITH CHECK (app_private.can_access_client((SELECT auth.uid()), client_id));

-- C. CLIENT TEAM ACCESS TABLE
ALTER TABLE public.client_team_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_team_access_select" ON public.client_team_access;
DROP POLICY IF EXISTS "client_team_access_modify" ON public.client_team_access;

CREATE POLICY "client_team_access_select"
  ON public.client_team_access
  FOR SELECT
  TO authenticated
  USING (
    profile_id = (SELECT auth.uid()) OR app_private.can_manage_client((SELECT auth.uid()), client_id)
  );

CREATE POLICY "client_team_access_modify"
  ON public.client_team_access
  FOR ALL
  TO authenticated
  USING (app_private.can_manage_client((SELECT auth.uid()), client_id))
  WITH CHECK (app_private.can_manage_client((SELECT auth.uid()), client_id));

-- D. CLIENT AUDIT LOG TABLE
ALTER TABLE public.client_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_audit_log_select" ON public.client_audit_log;
DROP POLICY IF EXISTS "client_audit_log_insert" ON public.client_audit_log;

CREATE POLICY "client_audit_log_select"
  ON public.client_audit_log
  FOR SELECT
  TO authenticated
  USING (app_private.is_manager_or_owner((SELECT auth.uid())));

CREATE POLICY "client_audit_log_insert"
  ON public.client_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (app_private.is_staff((SELECT auth.uid())));

NOTIFY pgrst, 'reload schema';
