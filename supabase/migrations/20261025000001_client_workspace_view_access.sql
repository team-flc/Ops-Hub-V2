-- ==============================================================================
-- MIGRATION: 20261025000001_client_workspace_view_access.sql
-- Description: Client Workspace View Access & Transparent Read-Only Permissions
--              1. Authorize role 'client' in can_access_client for their own organization
--              2. Update clients_select policy to permit client users to view their organization
--              3. Allow client users to transparently view all active workspace tasks
--              4. Maintain strict database write denial for clients (mutation = staff only)
-- Target Database: PostgreSQL 15+ / Supabase Auth
-- ==============================================================================

-- 1. Helper function: can_access_client with client role organization mapping
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
        p.role = 'operational_manager' AND (
          EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = target_client_id 
              AND (c.operational_manager_id = caller_id OR c.created_by = caller_id)
          )
          OR EXISTS (
            SELECT 1 FROM public.client_team_access cta
            WHERE cta.client_id = target_client_id AND cta.profile_id = caller_id
          )
          OR EXISTS (
            SELECT 1 FROM public.profile_client_access pca
            WHERE pca.client_id = target_client_id::text AND pca.profile_id = caller_id
          )
        )
      )
      OR (
        p.role = 'team_member' AND (
          EXISTS (
            SELECT 1 FROM public.client_team_access cta
            WHERE cta.client_id = target_client_id AND cta.profile_id = caller_id
          )
          OR EXISTS (
            SELECT 1 FROM public.profile_client_access pca
            WHERE pca.client_id = target_client_id::text AND pca.profile_id = caller_id
          )
        )
      )
      OR (
        p.role = 'client' AND (
          p.organization_id = target_client_id::text
          OR EXISTS (
            SELECT 1 FROM public.client_portal_recipients cpr
            WHERE cpr.client_id = target_client_id AND cpr.profile_id = caller_id AND cpr.status = 'active'
          )
        )
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.can_access_client(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.can_access_client(UUID, UUID) TO service_role;

-- Single-argument overload
CREATE OR REPLACE FUNCTION app_private.can_access_client(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT app_private.can_access_client((SELECT auth.uid()), target_client_id);
$$;

GRANT EXECUTE ON FUNCTION app_private.can_access_client(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.can_access_client(UUID) TO service_role;

-- 2. Update clients_select policy to include client role access to their assigned organization
DROP POLICY IF EXISTS "clients_select" ON public.clients;

CREATE POLICY "clients_select"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    app_private.is_owner((SELECT auth.uid()))
    OR (
      app_private.is_operational_manager((SELECT auth.uid()))
      AND (
        operational_manager_id = (SELECT auth.uid())
        OR created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.client_team_access cta
          WHERE cta.client_id = clients.id AND cta.profile_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.profile_client_access pca
          WHERE pca.client_id = clients.id::text AND pca.profile_id = (SELECT auth.uid())
        )
      )
    )
    OR (
      app_private.is_team_member((SELECT auth.uid()))
      AND (
        EXISTS (
          SELECT 1 FROM public.client_team_access cta
          WHERE cta.client_id = clients.id AND cta.profile_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.profile_client_access pca
          WHERE pca.client_id = clients.id::text AND pca.profile_id = (SELECT auth.uid())
        )
      )
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.role = 'client' AND p.status = 'active'
          AND (
            p.organization_id = clients.id::text
            OR EXISTS (
              SELECT 1 FROM public.client_portal_recipients cpr
              WHERE cpr.client_id = clients.id AND cpr.profile_id = p.id AND cpr.status = 'active'
            )
          )
      )
    )
  );

-- 3. Update client_tasks SELECT policy to allow clients to view all active tasks transparently
DROP POLICY IF EXISTS "client_tasks_select" ON public.client_tasks;

CREATE POLICY "client_tasks_select" ON public.client_tasks
FOR SELECT TO authenticated
USING (
    app_private.can_access_client(client_id)
    AND (
        archived_at IS NULL
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid()) 
              AND p.status = 'active' 
              AND p.role IN ('owner', 'operational_manager', 'team_member')
        )
    )
);
