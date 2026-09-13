-- ==============================================================================
-- TEST-ONLY FIXTURE: Legacy Schema Bootstrap (Ephemeral CI Database Stack Only)
-- Location: supabase/tests/fixtures/legacy_schema_bootstrap.sql
-- NOT A PRODUCTION MIGRATION — DO NOT DEPLOY TO PRODUCTION
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated;

CREATE OR REPLACE FUNCTION app_private.get_caller_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()) AND status = 'active';
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO authenticated;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  role TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clients_vendors (
  id TEXT PRIMARY KEY,
  name TEXT,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sop_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  rule_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
