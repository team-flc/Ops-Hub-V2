-- =============================================================================
-- Migration: 20260927000001_contain_backup_tables_security.sql
-- Description:
--   Security Containment: Enable Row Level Security (RLS) on all pre-release
--   backup tables (_backup_20260927_*), revoke ALL privileges from PUBLIC,
--   anon, and authenticated roles, and restrict access strictly to service_role.
-- =============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE '_backup_20260927_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated;', r.tablename);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role;', r.tablename);
  END LOOP;
END $$;
